import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ensureSchema } from '@/lib/hr-schema';
import { getHrPrincipal } from '@/lib/hr-access';
import { requestIsSameOrigin } from '@/lib/request-origin';
import { normalizeVapidPublicKey } from '@/lib/vapid-key';
import {
  buildTestNotice, createRateLimiter, normalizeLanguage, normalizeSubscription,
} from '@/lib/hr-call-notify-core';
import {
  deleteSubscription, pushConfigured, saveSubscription, sendWebPush, subscriptionsFor, removeSubscription,
} from '@/lib/hr-call-notify-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 登記這台裝置的來電通知（Web Push 訂閱）。誰登記的就只通知誰：訂閱記在登入者的聊天室識別（與 /api/hr/chat 的 getReaderKey 相同，
// tests/hr-call-integration.test.mjs 會檢查沒有改歧）。
function getReaderKey(principal,session) {
  if(principal.id)return `member:${principal.id}`;
  return `admin:${session.user.email?.trim().toLowerCase()||session.user.lineUserId||'unknown'}`;
}

const testLimiter = createRateLimiter({ windowMs: 10000, max: 1 });

async function identify(request, { write }) {
  const session=await auth();
  if(!session?.user)return { response: NextResponse.json({error:'Authentication required'},{status:401}) };
  if(write&&!requestIsSameOrigin(request))return { response: NextResponse.json({error:'請從本站提交資料。',en:'Please submit from this site.'},{status:403}) };
  await ensureSchema();
  const principal=await getHrPrincipal(session);
  if(!principal?.role)return { response: NextResponse.json({error:'HR membership required'},{status:403}) };
  return { key: getReaderKey(principal,session) };
}

// 前端要知道：伺服器有沒有設定推播金鑰、公開金鑰是什麼（訂閱時需要）。
export async function GET(request) {
  const who=await identify(request,{write:false});
  if(who.response)return who.response;
  const enabled=pushConfigured();
  // .env 的金鑰可能夾帶引號、空白或標籤文字，先整理成瀏覽器能用的格式；整理不出來就回空字串，前端會提示金鑰格式不正確
  const publicKey=enabled?normalizeVapidPublicKey(process.env.HR_PUSH_VAPID_PUBLIC_KEY):'';
  return NextResponse.json({enabled,publicKey,keyInvalid:enabled&&!publicKey});
}

export async function POST(request) {
  const who=await identify(request,{write:true});
  if(who.response)return who.response;
  try {
    const body=await request.json();
    const lang=normalizeLanguage(body.lang);
    // 關閉通知不需要推播金鑰：金鑰被移除後，使用者仍然要能把自己的訂閱清掉
    if(body.type==='unsubscribe'){
      await deleteSubscription(who.key,body.endpoint);
      return NextResponse.json({ok:true});
    }
    if(!pushConfigured())return NextResponse.json({error:'來電通知尚未啟用（伺服器缺少推播金鑰）。',en:'Call notifications are not enabled (the server has no push keys).'},{status:503});
    if(body.type==='subscribe'){
      const subscription=normalizeSubscription(body.subscription);
      if(!subscription)return NextResponse.json({error:'通知訂閱資料不正確。',en:'Invalid notification subscription.'},{status:400});
      await saveSubscription(who.key,subscription,{lang,userAgent:request.headers.get('user-agent')||''});
      return NextResponse.json({ok:true});
    }
    if(body.type==='test'){
      if(!testLimiter.allow(who.key))return NextResponse.json({error:'請稍等幾秒再測試。',en:'Please wait a few seconds before testing again.'},{status:429});
      const subs=(await subscriptionsFor([who.key])).get(who.key)||[];
      if(!subs.length)return NextResponse.json({error:'這台裝置還沒有開啟來電通知。',en:'Call notifications are not turned on for this device yet.'},{status:409});
      let sent=0;
      for(const sub of subs){
        try{await sendWebPush(sub,JSON.stringify(buildTestNotice(normalizeLanguage(sub.lang,lang))),{TTL:60,urgency:'high'});sent+=1;}
        catch(error){if(error?.statusCode===404||error?.statusCode===410)await removeSubscription(sub.endpoint);}
      }
      if(!sent)return NextResponse.json({error:'通知送不出去，請重新開啟來電通知。',en:'The notification could not be sent. Turn call notifications off and on again.'},{status:502});
      return NextResponse.json({ok:true,sent});
    }
    return NextResponse.json({error:'不支援的操作。',en:'Unsupported action.'},{status:400});
  } catch(error) {
    if(error instanceof SyntaxError)return NextResponse.json({error:'資料格式不正確。',en:'Invalid request.'},{status:400});
    console.error('hr_push_failed',error?.code||error?.name||'Error');
    return NextResponse.json({error:'無法完成，請稍後再試。',en:'Unable to complete the request. Please try again later.'},{status:503});
  }
}
