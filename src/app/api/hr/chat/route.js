import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ensureSchema } from '@/app/api/hr/route';
import { getHrPrincipal } from '@/lib/hr-access';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sameOrigin(request) {
  const origin=request.headers.get('origin');
  if(!origin)return false;
  try {
    const allowed=new Set([new URL(request.url).origin]);
    for(const value of [process.env.APP_ORIGIN,process.env.NEXTAUTH_URL])if(value)allowed.add(new URL(value).origin);
    const host=request.headers.get('x-forwarded-host')||request.headers.get('host');
    const protocol=(request.headers.get('x-forwarded-proto')||new URL(request.url).protocol.slice(0,-1)).split(',')[0].trim();
    if(host)allowed.add(`${protocol}://${host}`);
    return allowed.has(new URL(origin).origin);
  } catch { return false; }
}

async function ensureRooms() {
  await query("ALTER TABLE hr_chat_rooms DROP CONSTRAINT IF EXISTS hr_chat_rooms_room_type_check");
  await query("ALTER TABLE hr_chat_rooms DROP CONSTRAINT IF EXISTS hr_chat_rooms_check");
  await query("ALTER TABLE hr_chat_rooms ADD COLUMN IF NOT EXISTS direct_key TEXT");
  await query(`DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='hr_chat_rooms_type_check') THEN ALTER TABLE hr_chat_rooms ADD CONSTRAINT hr_chat_rooms_type_check CHECK((room_type='agency' AND agency_id IS NOT NULL AND case_id IS NULL) OR (room_type='case' AND case_id IS NOT NULL AND agency_id IS NULL) OR (room_type='direct' AND agency_id IS NULL AND case_id IS NULL AND direct_key IS NOT NULL)); END IF; END $$`);
  await query("CREATE UNIQUE INDEX IF NOT EXISTS hr_chat_rooms_direct_unique ON hr_chat_rooms(direct_key) WHERE room_type='direct'");
  await query(`CREATE TABLE IF NOT EXISTS hr_chat_participants (room_id BIGINT NOT NULL REFERENCES hr_chat_rooms(id) ON DELETE CASCADE, participant_key TEXT NOT NULL, member_id BIGINT REFERENCES hr_members(id) ON DELETE CASCADE, display_name TEXT NOT NULL, PRIMARY KEY(room_id,participant_key))`);
  await query(`CREATE TABLE IF NOT EXISTS hr_chat_reads (
    reader_key TEXT NOT NULL,
    room_id BIGINT NOT NULL REFERENCES hr_chat_rooms(id) ON DELETE CASCADE,
    last_read_message_id BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(reader_key,room_id)
  )`);
  await query("INSERT INTO hr_chat_rooms(room_type,agency_id) SELECT 'agency',id FROM hr_agencies WHERE active=TRUE ON CONFLICT DO NOTHING");
  await query("INSERT INTO hr_chat_rooms(room_type,case_id) SELECT 'case',id FROM hr_cases ON CONFLICT DO NOTHING");
}

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

function presentRoom(room,lastMessage) {
  if(room.room_type==='direct')return {id:Number(room.id),roomType:'direct',title:room.peer_name||'私訊',subtitle:'會員私訊',lastMessage:lastMessage?.body||'',lastMessageAt:lastMessage?.created_at||null,unreadCount:Number(room.unread_count||0)};
  return {
    id:Number(room.id), roomType:room.room_type,
    title:room.room_type==='agency'?`${room.agency_name} · 機構群組`:`${room.case_number} · ${room.worker_name}／${room.employer_name}`,
    agencyName:room.agency_name||'',caseNumber:room.case_number||'',workerName:room.worker_name||'',employerName:room.employer_name||'',
    subtitle:room.room_type==='agency'?'機構內部聊天室':`案件 · ${room.worker_name} · ${room.employer_name}`,
    lastMessage:lastMessage?.body||'', lastMessageAt:lastMessage?.created_at||null, unreadCount:Number(room.unread_count||0),
  };
}

export async function GET(request) {
  const session=await auth();
  if(!session?.user)return NextResponse.json({error:'Authentication required'},{status:401});
  try {
    await ensureSchema();
    const principal=await getHrPrincipal(session);
    if(!principal?.role)return NextResponse.json({error:'HR membership required'},{status:403});
    await ensureRooms();
    const roomId=new URL(request.url).searchParams.get('roomId');
    if(roomId){
      if(!/^\d+$/.test(roomId))return NextResponse.json({error:'聊天室編號不正確。'},{status:400});
      const room=await accessibleRoom(Number(roomId),principal,session);
      if(!room)return NextResponse.json({error:'你沒有權限查看此聊天室。'},{status:404});
      const messages=await query(`SELECT id,room_id,member_id,sender_name,sender_role,body,created_at FROM (
        SELECT id,room_id,member_id,sender_name,sender_role,body,created_at FROM hr_chat_messages WHERE room_id=$1 ORDER BY created_at DESC,id DESC LIMIT 200
      ) recent ORDER BY created_at,id`,[room.id]);
      const members=room.room_type==='agency'
        ? await query(`SELECT m.id,m.display_name,m.role,a.name agency_name FROM hr_members m LEFT JOIN hr_agencies a ON a.id=m.agency_id WHERE m.active=TRUE AND m.agency_id=$1 ORDER BY m.display_name`,[room.agency_id])
        : room.room_type==='case'
        ? await query(`SELECT DISTINCT m.id,m.display_name,m.role,a.name agency_name FROM hr_members m LEFT JOIN hr_agencies a ON a.id=m.agency_id LEFT JOIN hr_cases c ON c.id=$1 LEFT JOIN hr_workers w ON w.id=c.worker_id LEFT JOIN hr_employers e ON e.id=c.employer_id WHERE m.active=TRUE AND (m.worker_id=c.worker_id OR m.employer_id=c.employer_id OR m.agency_id=e.agency_id OR m.agency_id=w.agency_id) ORDER BY m.display_name`,[room.case_id])
        : await query(`SELECT id,display_name,role,NULL::text AS agency_name FROM hr_members WHERE id IN (SELECT member_id FROM hr_chat_participants WHERE room_id=$1 AND member_id IS NOT NULL) ORDER BY display_name`,[room.id]);
      const peer=room.room_type==='direct'?(await query(`SELECT display_name FROM hr_chat_participants WHERE room_id=$1 AND participant_key<>$2 LIMIT 1`,[room.id,getReaderKey(principal,session)]))[0]?.display_name:null;
      return NextResponse.json({room:presentRoom({...room,peer_name:peer},messages[messages.length-1]),messages,members:members.map(member=>({id:Number(member.id),name:member.display_name,role:member.role,agencyName:member.agency_name||''}))});
    }
    const readerKey=getReaderKey(principal,session);
    const rooms=await query(`SELECT r.id,r.room_type,r.agency_id,r.case_id,a.name agency_name,c.case_number,w.name worker_name,e.name employer_name,
      (SELECT p.display_name FROM hr_chat_participants p WHERE p.room_id=r.id AND p.participant_key<>$7 LIMIT 1) peer_name,
      (SELECT json_build_object('body',m.body,'created_at',m.created_at) FROM hr_chat_messages m WHERE m.room_id=r.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1) AS last_message
      ,(SELECT COUNT(*)::int FROM hr_chat_messages unread
        LEFT JOIN hr_chat_reads reads ON reads.room_id=r.id AND reads.reader_key=$7
        WHERE unread.room_id=r.id AND unread.id>COALESCE(reads.last_read_message_id,0)
          AND ($8::bigint IS NULL OR unread.member_id IS DISTINCT FROM $8::bigint)) AS unread_count
      FROM hr_chat_rooms r LEFT JOIN hr_agencies a ON a.id=r.agency_id LEFT JOIN hr_cases c ON c.id=r.case_id
      LEFT JOIN hr_workers w ON w.id=c.worker_id LEFT JOIN hr_employers e ON e.id=c.employer_id
      WHERE (r.room_type='direct' AND EXISTS(SELECT 1 FROM hr_chat_participants p WHERE p.room_id=r.id AND p.participant_key=$7))
        OR $1::text='admin'
        OR ($1::text='agency' AND r.room_type='agency' AND r.agency_id=$2)
        OR ($1::text='worker' AND r.room_type='case' AND c.worker_id=$3)
        OR ($1::text='employer' AND r.room_type='case' AND c.employer_id=$4)
        OR ($1::text='agency' AND $5::text='taiwan' AND r.room_type='case' AND (
          EXISTS(SELECT 1 FROM hr_job_order_candidates jc JOIN hr_job_order_routes jr ON jr.id=jc.route_id JOIN hr_job_order_agencies ja ON ja.id=jr.order_agency_id
            WHERE jc.case_id=c.id AND ja.taiwan_agency_id=$2 AND (ja.broker_member_id IS NULL OR ja.broker_member_id=$6))
          OR (NOT EXISTS(SELECT 1 FROM hr_job_order_candidates jc WHERE jc.case_id=c.id) AND e.agency_id=$2)
        )) ORDER BY r.created_at DESC`,
    [principal.role,principal.agency_id||null,principal.worker_id||null,principal.employer_id||null,principal.agency_type||null,principal.id||null,readerKey,principal.id||null]);
    return NextResponse.json({rooms:rooms.map(room=>presentRoom(room,room.last_message))});
  } catch(error) {
    console.error('hr_chat_read_failed',error?.code||error?.name||'Error');
    return NextResponse.json({error:'無法讀取聊天室，請稍後再試。'},{status:503});
  }
}

export async function POST(request) {
  const session=await auth();
  if(!session?.user)return NextResponse.json({error:'Authentication required'},{status:401});
  if(!sameOrigin(request))return NextResponse.json({error:'請從本站提交資料。'},{status:403});
  try {
    await ensureSchema();
    const principal=await getHrPrincipal(session);
    if(!principal?.role)return NextResponse.json({error:'HR membership required'},{status:403});
    await ensureRooms();
    const body=await request.json(),roomId=Number(body.roomId),message=typeof body.message==='string'?body.message.trim():'';
    if(body.type==='direct'){
      const targetId=Number(body.targetMemberId);
      if(!Number.isSafeInteger(roomId)||roomId<1||!Number.isSafeInteger(targetId)||targetId<1)return NextResponse.json({error:'會員或聊天室資料不正確。'},{status:400});
      const source=await accessibleRoom(roomId,principal,session);
      if(!source||source.room_type==='direct')return NextResponse.json({error:'無法從此聊天室建立私訊。'},{status:404});
      const eligible=source.room_type==='agency'
        ? await query(`SELECT id,display_name FROM hr_members WHERE active=TRUE AND agency_id=$1 AND id=$2`,[source.agency_id,targetId])
        : await query(`SELECT m.id,m.display_name FROM hr_members m LEFT JOIN hr_cases c ON c.id=$1 LEFT JOIN hr_workers w ON w.id=c.worker_id LEFT JOIN hr_employers e ON e.id=c.employer_id WHERE m.active=TRUE AND m.id=$2 AND (m.worker_id=c.worker_id OR m.employer_id=c.employer_id OR m.agency_id=e.agency_id OR m.agency_id=w.agency_id)`,[source.case_id,targetId]);
      if(!eligible[0]||Number(targetId)===Number(principal.id))return NextResponse.json({error:'只能私訊此群組內的其他會員。'},{status:403});
      const selfKey=getReaderKey(principal,session),otherKey=`member:${targetId}`,directKey=[selfKey,otherKey].sort().join('|');
      const inserted=await query(`INSERT INTO hr_chat_rooms(room_type,direct_key) VALUES('direct',$1) ON CONFLICT(direct_key) WHERE room_type='direct' DO UPDATE SET direct_key=EXCLUDED.direct_key RETURNING id`,[directKey]);
      await query(`INSERT INTO hr_chat_participants(room_id,participant_key,member_id,display_name) VALUES($1,$2,$3,$4),($1,$5,$6,$7) ON CONFLICT(room_id,participant_key) DO NOTHING`,[inserted[0].id,selfKey,principal.id||null,principal.name||session.user.name||'管理者',otherKey,targetId,eligible[0].display_name]);
      return NextResponse.json({roomId:Number(inserted[0].id)});
    }
    if(body.type==='read'){
      if(!Number.isSafeInteger(roomId)||roomId<1)return NextResponse.json({error:'聊天室編號不正確。'},{status:400});
      const room=await accessibleRoom(roomId,principal,session);
      if(!room)return NextResponse.json({error:'你沒有權限查看此聊天室。'},{status:404});
      await query(`INSERT INTO hr_chat_reads(reader_key,room_id,last_read_message_id)
        SELECT $1,$2,COALESCE(MAX(id),0) FROM hr_chat_messages WHERE room_id=$2
        ON CONFLICT(reader_key,room_id) DO UPDATE SET last_read_message_id=GREATEST(hr_chat_reads.last_read_message_id,EXCLUDED.last_read_message_id),updated_at=NOW()`,[getReaderKey(principal,session),roomId]);
      return NextResponse.json({ok:true});
    }
    if(!Number.isSafeInteger(roomId)||roomId<1||!message||message.length>3000)return NextResponse.json({error:'訊息不可空白，且最多 3000 字。'},{status:400});
    const room=await accessibleRoom(roomId,principal,session);
    if(!room)return NextResponse.json({error:'你沒有權限在此聊天室發言。'},{status:404});
    const inserted=await query(`INSERT INTO hr_chat_messages(room_id,member_id,sender_name,sender_role,body)
      VALUES($1,$2,$3,$4,$5) RETURNING id,room_id,member_id,sender_name,sender_role,body,created_at`,
    [roomId,principal.id||null,principal.name||session.user.name||'管理者',principal.role,message]);
    await query(`INSERT INTO hr_chat_reads(reader_key,room_id,last_read_message_id) VALUES($1,$2,$3)
      ON CONFLICT(reader_key,room_id) DO UPDATE SET last_read_message_id=GREATEST(hr_chat_reads.last_read_message_id,EXCLUDED.last_read_message_id),updated_at=NOW()`,[getReaderKey(principal,session),roomId,inserted[0].id]);
    return NextResponse.json(inserted[0],{status:201});
  } catch(error) {
    if(error instanceof SyntaxError)return NextResponse.json({error:'訊息格式不正確。'},{status:400});
    console.error('hr_chat_send_failed',error?.code||error?.name||'Error');
    return NextResponse.json({error:'訊息未能送出，請稍後再試。'},{status:500});
  }
}
