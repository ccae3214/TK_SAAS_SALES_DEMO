// 雇主補充資料、家庭成員、被照顧人、月薪的英文對照。
// 由 hr-translations.jsx 的 translateHrText 串接使用（已有的翻譯優先，這裡只補新增文字）。
import {
  CARE_NEED_OPTIONS, CARE_RELATION_OPTIONS, DORM_OPTIONS, FAMILY_RELATION_OPTIONS, GENDER_OPTIONS, HEALTH_CONDITION_OPTIONS, MESSAGES,
} from '@/lib/hr-employer-profile';

// 選項文字依 key 對照，這樣修改選項時不會漏掉翻譯（hr-employer-profile 測試會檢查每個選項都有英文）。
export const OPTION_EN = {
  gender: { male: 'Male', female: 'Female' },
  family: {
    spouse: 'Spouse', father: 'Father', mother: 'Mother', child: 'Child', grandparent: 'Grandparent',
    sibling: 'Sibling', parent_in_law: 'Parent-in-law', other: 'Other',
  },
  care: { self: 'The employer' },
  careNeed: { newborn: 'The care recipient is a newborn', shareRoom: 'Must share a room with the care recipient' },
  health: {
    healthy: 'Healthy, no special care needs', bedridden: 'Bedridden', mobility_aid: 'Uses a wheelchair or walker',
    transfer: 'Needs help with transfers or turning', dementia: 'Dementia', stroke: 'Stroke or physical disability',
    tube_care: 'Tube care (nasogastric tube, catheter, etc.)', infection_control: 'Needs infection-control care',
    night_care: 'Needs overnight care', other: 'Other (describe below)',
  },
  dorm: { yes: 'Dormitory provided', no: 'No dormitory' },
};

const fromOptions = (options, english) => Object.fromEntries(options.map(([key, label]) => [label, english[key]]));

export const EMPLOYER_PROFILE_EN = {
  ...fromOptions(GENDER_OPTIONS, OPTION_EN.gender),
  ...fromOptions(FAMILY_RELATION_OPTIONS, OPTION_EN.family),
  ...fromOptions(CARE_RELATION_OPTIONS.filter(([key]) => key === 'self'), OPTION_EN.care),
  ...fromOptions(HEALTH_CONDITION_OPTIONS, OPTION_EN.health),
  ...fromOptions(CARE_NEED_OPTIONS, OPTION_EN.careNeed),
  ...fromOptions(DORM_OPTIONS, OPTION_EN.dorm),

  // 雇主補充資料
  '性別': 'Gender', '年齡': 'Age', '歲': 'yrs', '電話': 'Phone', '地址': 'Address',
  '公司或機構請填負責人的性別與年齡。': 'For a company or organization, enter the responsible person’s gender and age.',
  '家庭成員': 'Household members',
  '家庭看護與家庭幫傭雇主必填，請列出同住或需要照顧的家人。': 'Required for home care and domestic helper employers. List the family members who live with you or need care.',
  '無其他同住家人（獨居）': 'No other household members (lives alone)',
  '關係': 'Relationship', '同住': 'Lives in household', '移除': 'Remove', '新增家庭成員': 'Add household member',
  '統一編號': 'Business registration number', '負責人姓名': 'Responsible person',
  '工廠登記證號': 'Factory registration number', '工作地點地址': 'Workplace address',
  '是否提供宿舍': 'Dormitory provided?', '宿舍地址': 'Dormitory address',
  '編輯雇主資料': 'Edit employer details',
  '安養機構': 'Nursing home',

  // 管理者刪除仲介機構
  '找不到仲介機構。': 'Agency not found.',
  '僅系統管理者可刪除雇主、工作者、案件與仲介機構。': 'Only system administrators can delete employers, workers, cases and agencies.',

  // 被照顧人
  '被照顧人': 'Care recipient',
  '為保護隱私，不需填寫被照顧人的全名或病歷資料；這些資訊會提供給負責的仲介作為配工參考。': 'To protect privacy, do not enter the care recipient’s full name or medical records. This information is shared with the responsible agencies to help match a suitable worker.',
  '被照顧人與雇主的關係': 'Care recipient’s relationship to the employer',
  '被照顧人年紀': 'Care recipient’s age', '被照顧人性別': 'Care recipient’s gender',
  '被照顧人身體狀況（可複選）': 'Care recipient’s health condition (select all that apply)',
  '診斷或身體狀況補充說明': 'Diagnosis or additional health details',

  // 被照顧人其他照護需求
  '其他照護需求（可複選）': 'Other care needs (select all that apply)',

  // 需求單工作天數與發文日
  '工作天數（選填）': 'Work period (optional)', '工作天數': 'Work period', '工作天數：': 'Work period: ', '個月': 'months', '日': 'days', '最多 36 個月 + 0 日': 'Up to 36 months + 0 days',
  '發文日（選填）': 'Issue date (optional)', '發文日': 'Issue date', '發文日：': 'Issue date: ',
  '備註：自發文日起 6+3 個月有效期限': 'Note: valid for 6+3 months from the issue date',
  '自發文日起 6+3 個月有效期限': 'Valid for 6+3 months from the issue date',

  // 需求單月薪
  '預計月薪（新臺幣，選填）': 'Expected monthly salary (NTD, optional)', '預計月薪': 'Expected monthly salary',

  // 伺服器與表單驗證訊息（來源：hr-employer-profile.js 的 MESSAGES）
  [MESSAGES.contact]: 'Enter the employer’s phone number and address.',
  [MESSAGES.gender]: 'Home care and domestic helper employers must select a gender.',
  [MESSAGES.age]: 'Home care and domestic helper employers must enter a valid age (18 to 120).',
  [MESSAGES.family]: 'Home care and domestic helper employers must list household members or select “lives alone”.',
  [MESSAGES.familyRow]: 'Household member details are incomplete. Enter each member’s relationship, age and gender.',
  [MESSAGES.company]: 'Factory employers must enter the business registration number and responsible person.',
  [MESSAGES.care]: 'Home care and domestic helper job orders require the care recipient’s relationship, age, gender and health condition.',
  [MESSAGES.workPeriod]: 'The work period is not valid. Choose 0 to 36 months and 0 to 30 days, up to a maximum of 36 months + 0 days.',
  [MESSAGES.issueDate]: 'The issue date is not valid. Please select the date again.',
  [MESSAGES.salary]: 'The monthly salary is not valid. Enter a whole number from 1 to 1,000,000.',
};

const AGENCY_BLOCKERS_EN = { 成員帳號: 'member accounts', 待審申請: 'pending applications', 工作者: 'workers', 雇主: 'employers', 需求單: 'job orders' };

// 提醒清單上的組合字串，例如「待補：性別、年齡」。逐項翻譯後再組回去；找不到的項目保留原文。
export function translateEmployerPattern(text, translate) {
  const agencyBlockers = text.match(/^此仲介機構還有(.+)，請先移轉或刪除後再刪除機構；若只是暫停使用，請改用「停用」。$/);
  if (agencyBlockers) {
    const items = agencyBlockers[1].split('、').map(item => AGENCY_BLOCKERS_EN[item] || translate(item)).join(', ');
    return `This agency still has ${items}. Transfer or delete them before deleting the agency. To pause it instead, use “Inactive”.`;
  }
  const agencyConfirm = text.match(/^確定刪除仲介機構「(.+)」？機構資料、認證紀錄與機構聊天室會一併刪除（仍有成員、工作者、雇主或需求單的機構無法刪除）。此操作無法復原。$/);
  if (agencyConfirm) return `Delete agency “${agencyConfirm[1]}”? Its profile, certifications and agency chat room will be deleted too (an agency that still has members, workers, employers or job orders cannot be deleted). This cannot be undone.`;
  const agencyDeleted = text.match(/^已刪除仲介機構「(.+)」$/);
  if (agencyDeleted) return `Deleted agency “${agencyDeleted[1]}”`;
  const missing = text.match(/^待補：(.+)$/);
  if (missing) return `Missing: ${missing[1].split('、').map(item => translate(item)).join(', ')}`;
  const employer = text.match(/^(.+) · 基本資料未完成$/);
  if (employer) return `${employer[1]} · Basic details incomplete`;
  const worker = text.match(/^(.+) · 履歷尚未完成$/);
  if (worker) return `${worker[1]} · Resume incomplete`;
  return '';
}
