import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ensureSchema, ensureChatSchema } from '@/lib/hr-schema';
import { getHrPrincipal } from '@/lib/hr-access';
import { query } from '@/lib/db';
import { requestIsSameOrigin } from '@/lib/request-origin';
import { buildIceServers, callSecret, signTicket } from '@/lib/hr-call-ticket';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 通話的權限與聊天室一致：能進哪個聊天室，就能在那個聊天室撥打或加入通話。
// 這個檔案的 getReaderKey / accessibleRoom 與 /api/hr/chat/route.js 相同（tests/hr-call-api.test.mjs 會檢查沒有改歧），
// 修改聊天室權限時兩邊要一起改。
function getReaderKey(principal,session) {
  if(principal.id)return `member:${principal.id}`;
  return `admin:${session.user.email?.trim().toLowerCase()||session.user.lineUserId||'unknown'}`;
}

async function accessibleRoom(roomId, principal, session) {
  const readerKey=getReaderKey(principal,session);
  const result=await query(`SELECT r.id,r.room_type,r.agency_id,r.case_id,
      a.name AS agency_name,c.case_number,w.name AS worker_name,e.name AS employer_name
    FROM hr_chat_rooms r LEFT JOIN hr_agencies a ON a.id=r.agency_id
    LEFT JOIN hr_cases c ON c.id=r.case_id LEFT JOIN hr_workers w ON w.id=c.worker_id
    LEFT JOIN hr_employers e ON e.id=c.employer_id
    WHERE r.id=$1 AND (
      $2::text='admin'
      OR ($2::text='agency' AND r.room_type='agency' AND r.agency_id=$3)
      OR ($2::text='worker' AND r.room_type='case' AND c.worker_id=$4)
      OR ($2::text='employer' AND r.room_type='case' AND c.employer_id=$5)
      OR (r.room_type='direct' AND EXISTS(SELECT 1 FROM hr_chat_participants p WHERE p.room_id=r.id AND p.participant_key=$8))
      OR ($2::text='agency' AND $6::text='taiwan' AND r.room_type='case' AND (
        EXISTS(SELECT 1 FROM hr_job_order_candidates jc JOIN hr_job_order_routes jr ON jr.id=jc.route_id JOIN hr_job_order_agencies ja ON ja.id=jr.order_agency_id
          WHERE jc.case_id=c.id AND ja.taiwan_agency_id=$3 AND (ja.broker_member_id IS NULL OR ja.broker_member_id=$7))
        OR (NOT EXISTS(SELECT 1 FROM hr_job_order_candidates jc WHERE jc.case_id=c.id) AND e.agency_id=$3)
      ))
    )`,[roomId,principal.role,principal.agency_id||null,principal.worker_id||null,principal.employer_id||null,principal.agency_type||null,principal.id||null,readerKey]);
  return result[0]||null;
}

// 響鈴對象：群組是聊天室成員（與聊天室「群組會員」清單相同），私訊是對方。
async function inviteeKeys(room) {
  if(room.room_type==='direct'){
    const rows=await query('SELECT participant_key FROM hr_chat_participants WHERE room_id=$1',[room.id]);
    return rows.map(row=>row.participant_key);
  }
  const rows=room.room_type==='agency'
    ? await query('SELECT m.id FROM hr_members m WHERE m.active=TRUE AND m.agency_id=$1',[room.agency_id])
    : await query('SELECT DISTINCT m.id FROM hr_members m LEFT JOIN hr_cases c ON c.id=$1 LEFT JOIN hr_workers w ON w.id=c.worker_id LEFT JOIN hr_employers e ON e.id=c.employer_id WHERE m.active=TRUE AND (m.worker_id=c.worker_id OR m.employer_id=c.employer_id OR m.agency_id=e.agency_id OR m.agency_id=w.agency_id)',[room.case_id]);
  return rows.map(row=>`member:${row.id}`);
}

const NOT_CONFIGURED={error:'通話功能尚未設定（伺服器缺少 NEXTAUTH_SECRET）。',en:'Calling is not configured (the server is missing NEXTAUTH_SECRET).'};

export async function POST(request) {
  const session=await auth();
  if(!session?.user)return NextResponse.json({error:'Authentication required'},{status:401});
  if(!requestIsSameOrigin(request))return NextResponse.json({error:'請從本站提交資料。'},{status:403});
  const secret=callSecret();
  if(!secret)return NextResponse.json(NOT_CONFIGURED,{status:503});
  try {
    await ensureSchema();
    const principal=await getHrPrincipal(session);
    if(!principal?.role)return NextResponse.json({error:'HR membership required'},{status:403});
    await ensureChatSchema();
    const body=await request.json();
    const key=getReaderKey(principal,session);
    const name=principal.name||session.user.name||'管理者';
    // 連線票證：讓這個瀏覽器的 WebSocket 登記成「這個人在線」，才收得到來電。
    if(body.type==='presence')return NextResponse.json({ticket:signTicket({p:'presence',k:key,n:name},secret,60)});
    const roomId=Number(body.roomId);
    if(body.type!=='room'||!Number.isSafeInteger(roomId)||roomId<1)return NextResponse.json({error:'聊天室編號不正確。',en:'Invalid chat room.'},{status:400});
    const room=await accessibleRoom(roomId,principal,session);
    if(!room)return NextResponse.json({error:'你沒有權限在此聊天室通話。',en:'You do not have access to call in this chat.'},{status:404});
    const invitees=(await inviteeKeys(room)).filter(item=>item!==key);
    const groupTitle=room.room_type==='agency'?`${room.agency_name} · 機構群組`:`${room.case_number} · ${room.worker_name}／${room.employer_name}`;
    let title=groupTitle,callTitle=groupTitle;
    if(room.room_type==='direct'){
      // 私訊：撥的人看到對方的名字，對方看到撥的人的名字
      const peer=await query('SELECT display_name FROM hr_chat_participants WHERE room_id=$1 AND participant_key<>$2 LIMIT 1',[room.id,key]);
      title=peer[0]?.display_name||'私訊';
      callTitle=name;
    }
    const ticket=signTicket({k:key,n:name,r:Number(room.id),invitees,ct:callTitle},secret,90);
    return NextResponse.json({ticket,roomId:Number(room.id),roomType:room.room_type,title,iceServers:buildIceServers(process.env,key)});
  } catch(error) {
    if(error instanceof SyntaxError)return NextResponse.json({error:'資料格式不正確。',en:'Invalid request.'},{status:400});
    console.error('hr_call_ticket_failed',error?.code||error?.name||'Error');
    return NextResponse.json({error:'無法開始通話，請稍後再試。',en:'Unable to start the call. Please try again later.'},{status:503});
  }
}
