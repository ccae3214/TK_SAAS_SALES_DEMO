// 雇主補充資料、家庭成員、被照顧人、月薪的英文對照。
// 由 hr-translations.jsx 的 translateHrText 串接使用（已有的翻譯優先，這裡只補新增文字）。
import {
  CARE_RELATION_OPTIONS, DORM_OPTIONS, FAMILY_RELATION_OPTIONS, GENDER_OPTIONS, HEALTH_CONDITION_OPTIONS, MESSAGES,
} from '@/lib/hr-employer-profile';

// 選項文字依 key 對照，這樣修改選項時不會漏掉翻譯（hr-employer-profile 測試會檢查每個選項都有英文）。
export const OPTION_EN = {
  gender: { male: 'Male', female: 'Female' },
  family: {
    spouse: 'Spouse', father: 'Father', mother: 'Mother', child: 'Child', grandparent: 'Grandparent',
    sibling: 'Sibling', parent_in_law: 'Parent-in-law', other: 'Other',
  },
  care: { self: 'The employer' },
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

  // 被照顧人
  '被照顧人': 'Care recipient',
  '為保護隱私，不需填寫被照顧人的全名或病歷資料；這些資訊會提供給負責的仲介作為配工參考。': 'To protect privacy, do not enter the care recipient’s full name or medical records. This information is shared with the responsible agencies to help match a suitable worker.',
  '被照顧人與雇主的關係': 'Care recipient’s relationship to the employer',
  '被照顧人年紀': 'Care recipient’s age', '被照顧人性別': 'Care recipient’s gender',
  '被照顧人身體狀況（可複選）': 'Care recipient’s health condition (select all that apply)',
  '診斷或身體狀況補充說明': 'Diagnosis or additional health details',

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
  [MESSAGES.salary]: 'The monthly salary is not valid. Enter a whole number from 1 to 1,000,000.',
};

// 提醒清單上的組合字串，例如「待補：性別、年齡」。逐項翻譯後再組回去；找不到的項目保留原文。
export function translateEmployerPattern(text, translate) {
  const missing = text.match(/^待補：(.+)$/);
  if (missing) return `Missing: ${missing[1].split('、').map(item => translate(item)).join(', ')}`;
  const employer = text.match(/^(.+) · 基本資料未完成$/);
  if (employer) return `${employer[1]} · Basic details incomplete`;
  const worker = text.match(/^(.+) · 履歷尚未完成$/);
  if (worker) return `${worker[1]} · Resume incomplete`;
  return '';
}
