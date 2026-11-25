import { tlText } from './language.js';
// 聊天室「系統訊息」的英文對照。
// 這些訊息由伺服器用中文寫進 hr_chat_messages（見 src/app/api/hr/_post/job-orders.js 的
// assignPhilippinesAgencies 與 employerPickCandidate），內容含雇主、工作者與仲介名稱，
// 沒辦法用完整字串比對，所以用句型翻譯。已經存在資料庫裡的舊訊息也會在顯示時翻譯。
// 只比對這兩種固定句型；使用者自己輸入的聊天內容不會被改動。
// 這個檔案不引用 '@/…'，方便 node --test 直接載入測試。

const ASSIGNED = /^管理者已將媒合需求單 #(\d+)（(.+)）直接指派給台灣仲介 (.+?) 與菲律賓仲介 (.+)，請雙方直接聯繫媒合。$/;
const PICKED = /^雇主 (.+) 已從需求單 #(\d+) 挑選工作者 (.+)（([^（）]+)）。請台灣仲介與菲律賓仲介聯繫安排後續面試。$/;

// translate：把工作類型之類的固定詞再翻成英文（例如「家庭幫傭」→ Domestic helper），可省略。
export function translateChatSystemPattern(text, translate = value => value) {
  if (typeof text !== 'string') return '';
  const trimmed = text.trim();
  const assigned = trimmed.match(ASSIGNED);
  if (assigned) {
    return `An administrator assigned job order #${assigned[1]} (${assigned[2]}) directly to Taiwan agency ${assigned[3]} and Philippines agency ${assigned[4]}. Please contact each other to arrange the match.`;
  }
  const picked = trimmed.match(PICKED);
  if (picked) {
    return `Employer ${picked[1]} selected worker ${picked[3]} (${translate(picked[4])}) from job order #${picked[2]}. The Taiwan and Philippines agencies should get in touch to arrange the next interview.`;
  }
  return '';
}

// 畫面用：英文介面時，系統訊息換成英文；其他文字（包含使用者輸入）原樣回傳。
export function translateChatSystemMessage(body, lang, translate) {
  if (lang === 'tl') return typeof body === 'string' ? tlText(translateChatSystemMessage(body, 'en', translate)) : body;
  if (lang !== 'en' || typeof body !== 'string') return body;
  return translateChatSystemPattern(body, translate) || body;
}
