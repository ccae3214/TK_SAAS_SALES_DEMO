import { getHrPrincipal } from '@/lib/hr-access';
import { query } from '@/lib/db';

const STAGE_LABELS = {
  intake: '需求受理', matching: '媒合中', documents: '文件處理',
  medical_training: '體檢與訓練', application: '申請辦理',
  arrangement: '後續安排', completed: '完成',
};
const STATUS_LABELS = { open: '進行中', on_hold: '暫停', closed: '結案' };
const TASK_LABELS = { todo: '待處理', in_progress: '處理中', blocked: '受阻', done: '完成' };
const DOC_LABELS = { missing: '未收件', submitted: '待審核', approved: '已核准', returned: '退回補件' };

function caseScope(principal) {
  if (principal.role === 'admin') return { where: '', params: [] };
  if (principal.role === 'worker') return { where: 'c.worker_id=$1', params: [principal.worker_id] };
  if (principal.role === 'employer') return { where: 'c.employer_id=$1', params: [principal.employer_id] };
  if (principal.role === 'agency') return { where: '(w.agency_id=$1 OR e.agency_id=$1)', params: [principal.agency_id] };
  return null;
}

async function visibleCases(principal, limit = 8) {
  const scope = caseScope(principal);
  if (!scope) return [];
  const params = [...scope.params];
  const limitParam = `$${params.push(limit)}`;
  return query(`SELECT c.id,c.case_number,c.job_type,c.stage,c.status,c.medical_status,c.training_status,
      w.name AS worker_name,e.name AS employer_name
    FROM hr_cases c JOIN hr_workers w ON w.id=c.worker_id
    JOIN hr_employers e ON e.id=c.employer_id
    ${scope.where ? `WHERE ${scope.where}` : ''}
    ORDER BY c.updated_at DESC LIMIT ${limitParam}`, params);
}

async function visibleRequirements(principal) {
  const scope = caseScope(principal);
  if (!scope) return [];
  return query(`SELECT r.name,r.status,r.review_reason,c.case_number,w.name AS worker_name
    FROM hr_case_requirements r JOIN hr_cases c ON c.id=r.case_id
    JOIN hr_workers w ON w.id=c.worker_id JOIN hr_employers e ON e.id=c.employer_id
    ${scope.where ? `WHERE ${scope.where}` : ''}
    ORDER BY CASE r.status WHEN 'submitted' THEN 0 WHEN 'returned' THEN 1 ELSE 2 END,c.updated_at DESC,r.id
    LIMIT 12`, scope.params);
}

async function visibleTasks(principal) {
  const scope = caseScope(principal);
  if (!scope) return [];
  return query(`SELECT t.title,t.status,t.due_date,c.case_number,w.name AS worker_name
    FROM hr_case_tasks t JOIN hr_cases c ON c.id=t.case_id
    JOIN hr_workers w ON w.id=c.worker_id JOIN hr_employers e ON e.id=c.employer_id
    ${scope.where ? `WHERE ${scope.where} AND t.status<>'done'` : "WHERE t.status<>'done'"}
    ORDER BY t.due_date NULLS LAST,t.updated_at DESC LIMIT 10`, scope.params);
}

function caseReply(cases, principal, en = false) {
  if (!cases.length) return en ? 'There are no cases linked to this account.' : '目前沒有與此會員帳號關聯的案件。';
  const header = en ? (principal.role === 'admin' ? 'HR cases:' : 'Cases linked to your account:') : (principal.role === 'admin' ? '人力系統案件：' : '與你帳號相關的案件：');
  return [header, ...cases.map(item => {
    const status = en ? ({open:'In progress',on_hold:'On hold',closed:'Closed'}[item.status] || item.status) : (STATUS_LABELS[item.status] || item.status);
    const stage = en ? ({intake:'Intake',matching:'Matching',documents:'Document processing',medical_training:'Medical & training',application:'Application',arrangement:'Placement',completed:'Completed'}[item.stage] || item.stage) : (STAGE_LABELS[item.stage] || item.stage);
    if (principal.role === 'worker') return `${item.case_number}｜${item.employer_name}｜${stage}・${status}`;
    if (principal.role === 'employer') return `${item.case_number}｜${item.worker_name}｜${stage}・${status}`;
    if (principal.role === 'agency') return `${item.case_number}｜${item.worker_name}／${item.employer_name}｜${stage}・${status}`;
    return `${item.case_number}｜${item.worker_name}／${item.employer_name}｜${stage}・${status}`;
  })].join('\n');
}

function helpText(principal = null, en = false) {
  if (en) return principal
    ? 'I can look up HR information your account is allowed to access.\n・Cases and case progress\n・Documents / passport / PSA\n・Medical checks and training\n・Pending tasks\n・Employer and agency information\nMember website: send “website” or “sign in”. New member: send “register”.'
    : 'Kolecion HR LINE service. Sign in to the member website with LINE. New members can choose a member type and submit it for review. Send “website” or “register” to get started.';
  if (!principal) return '克雷迅人力仲介 LINE 服務。請先使用 LINE 登入人力網站並申請會員類型，經管理者核准後即可查詢個人案件。輸入「說明」查看可用問題。';
  return '我可以查詢你有權查看的人力資料。可直接詢問：\n・案件／案件進度\n・文件／護照／PSA 進度\n・體檢與訓練\n・待辦事項\n・雇主與仲介資料\n會員網站：輸入「會員網站」或「登入」。新會員：輸入「註冊」。';
}

function websiteBase() {
  const origin = [process.env.APP_ORIGIN, process.env.NEXTAUTH_URL]
    .map(value => { try { return new URL(value).origin; } catch { return ''; } })
    .find(value => value && !/localhost|127\.0\.0\.1/i.test(value)) || 'https://kolecion.cc';
  return origin;
}

function memberWebsiteReply(en = false, isNewMember = false) {
  const url = `${websiteBase()}/hr/login${isNewMember ? '?register=1' : ''}`;
  const title = isNewMember
    ? (en ? 'Register for Kolecion HR' : '註冊克雷迅人力仲介會員')
    : (en ? 'Kolecion HR member website' : '克雷迅人力仲介會員網站');
  const description = isNewMember
    ? (en ? 'This LINE account is not registered yet. Continue with LINE to verify your account, then choose a member type to submit for review.' : '這個 LINE 帳號尚未註冊。使用 LINE 登入即可確認帳號，接著選擇會員類型並送交管理者審核。')
    : (en ? 'Open the HR member website and sign in with LINE to view the cases and information linked to your account.' : '開啟人力仲介會員網站，使用 LINE 登入後查看與帳號關聯的案件及資料。');
  return {
    type: 'flex',
    altText: title,
    contents: {
      type: 'bubble',
      body: {
        type: 'box', layout: 'vertical', spacing: 'md',
        contents: [
          { type: 'text', text: title, weight: 'bold', size: 'xl', color: '#176b54', wrap: true },
          { type: 'text', text: description, wrap: true, size: 'sm', color: '#43584f' },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', contents: [
          { type: 'button', style: 'primary', color: '#176b54', action: { type: 'uri', label: isNewMember ? (en ? 'Register with LINE' : '使用 LINE 立即註冊') : (en ? 'Open member website' : '開啟會員網站'), uri: url } },
        ],
      },
    },
  };
}

export async function replyForHrLineEvent(event) {
  if (event?.type === 'follow') {
    const lineUserId = event.source?.userId;
    const principal = lineUserId ? await getHrPrincipal({ user: { lineUserId, name: 'LINE 會員' } }) : null;
    return principal ? '克雷迅人力仲介 LINE 服務已連線。輸入「會員網站」或「說明」查看服務。' : memberWebsiteReply(false, true);
  }
  if (event?.type !== 'message' || event?.message?.type !== 'text') return null;
  const text = String(event.message.text || '').trim().replace(/\s+/g, ' ');
  const lower = text.toLowerCase();
  const en = /[a-z]/i.test(text) && !/[\u3400-\u9fff]/.test(text);
  if (event.source?.type !== 'user') return en ? 'For privacy, case queries are available only in a one-to-one chat with the official LINE account.' : '為保護會員資料，案件查詢只在 LINE 官方帳號的一對一聊天中提供。';

  const lineUserId = event.source?.userId;
  const principal = lineUserId ? await getHrPrincipal({ user: { lineUserId, name: 'LINE 會員' } }) : null;
  if (!principal) return memberWebsiteReply(en, true);
  if (['測試','test','ping'].includes(lower)) return helpText(principal, en);
  if (/會員網站|人力網站|網站|登入|註冊|加入會員|website|register|sign ?in|portal/.test(lower)) return memberWebsiteReply(en, false);
  if (['說明','help','menu'].includes(lower)) return helpText(principal, en);
  if (!principal.role) return en ? 'Your member type request is awaiting administrator review. You can check case information after approval.' : '你的會員類型申請正在等待管理者審核。審核完成後即可查詢案件資料。';
  if (!['admin','worker','employer','agency'].includes(principal.role)) return en ? 'Unable to verify this LINE account’s permissions. Please contact an administrator.' : '目前無法確認這個 LINE 帳號的會員權限，請聯絡管理者。';

  if (/文件|護照|psa|出生證明|document|passport|birth certificate/.test(lower)) {
    const rows = await visibleRequirements(principal);
    if (!rows.length) return en ? 'There is no case document progress available.' : '目前沒有可查看的案件文件進度。';
    return [en ? 'Document progress:' : '文件進度：', ...rows.map(item => `${item.case_number}｜${item.name}: ${en ? ({missing:'Not received',submitted:'Pending review',approved:'Approved',returned:'Returned for update'}[item.status] || item.status) : (DOC_LABELS[item.status] || item.status)}${item.status === 'returned' && item.review_reason ? ` (${item.review_reason})` : ''}`)].join('\n');
  }
  if (/待辦|待處理|工作事項|task|to-do|pending work/.test(lower)) {
    const rows = await visibleTasks(principal);
    if (!rows.length) return en ? 'There are no related open tasks.' : '目前沒有未完成的相關待辦事項。';
    return [en ? 'Open tasks:' : '未完成待辦：', ...rows.map(item => `${item.case_number}｜${item.title}: ${en ? ({todo:'To do',in_progress:'In progress',blocked:'Blocked'}[item.status] || item.status) : (TASK_LABELS[item.status] || item.status)}${item.due_date ? `${en ? ', due ' : '，期限 '}${new Date(item.due_date).toLocaleDateString(en ? 'en-US' : 'zh-TW')}` : ''}`)].join('\n');
  }
  if (/體檢|訓練|medical|training/.test(lower)) {
    const cases = await visibleCases(principal);
    if (!cases.length) return en ? 'There is no medical or training progress available.' : '目前沒有可查看的體檢或訓練進度。';
    return [en ? 'Medical and training progress:' : '體檢與訓練進度：', ...cases.map(item => `${item.case_number}｜${en ? 'Medical' : '體檢'}: ${item.medical_status || (en ? 'Not scheduled' : '未安排')}｜${en ? 'Training' : '訓練'}: ${item.training_status || (en ? 'Not scheduled' : '未安排')}`)].join('\n');
  }
  if (/仲介|雇主|案件|進度|狀態|我的工作者|agency|employer|case|progress|status|worker/.test(lower)) {
    return caseReply(await visibleCases(principal), principal, en);
  }
  return helpText(principal, en);
}
