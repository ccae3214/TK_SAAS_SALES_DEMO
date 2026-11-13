// 雇主補充資料、被照顧人與月薪的共用規則。
// 伺服器端（src/app/api/hr/route.js）與前端表單共用同一份驗證，避免兩邊規則不一致。
// 本檔案不依賴 React，也不存取資料庫。

export const HOME_EMPLOYER_TYPES = new Set(['home_care', 'domestic_helper']);
export const CARE_JOB_TYPES = new Set(['家庭看護', '家庭幫傭']);
export const MAX_FAMILY_MEMBERS = 20;

export const isHomeEmployer = type => HOME_EMPLOYER_TYPES.has(type);
export const needsCareRecipient = jobType => CARE_JOB_TYPES.has(String(jobType || '').trim());

// 選項的 key 會存進資料庫（與語言無關）；label 是中文顯示文字，英文由 hr-translations-employer.js 對照。
export const GENDER_OPTIONS = [['male', '男'], ['female', '女']];
export const FAMILY_RELATION_OPTIONS = [
  ['spouse', '配偶'], ['father', '父親'], ['mother', '母親'], ['child', '子女'],
  ['grandparent', '祖父母'], ['sibling', '兄弟姊妹'], ['parent_in_law', '配偶的父母'], ['other', '其他'],
];
export const CARE_RELATION_OPTIONS = [['self', '雇主本人'], ...FAMILY_RELATION_OPTIONS];
// 選項依指南「看護訓練重點」整理：基礎照顧、移位與翻身、感染控制、失智症互動、緊急處理。
export const HEALTH_CONDITION_OPTIONS = [
  ['healthy', '身體健康，無特殊照護需求'],
  ['bedridden', '臥床'],
  ['mobility_aid', '需輪椅或助行器'],
  ['transfer', '需協助移位或翻身'],
  ['dementia', '失智'],
  ['stroke', '中風或肢體障礙'],
  ['tube_care', '管路照護（鼻胃管、尿管等）'],
  ['infection_control', '需感染控制照護'],
  ['night_care', '夜間需要照護'],
  ['other', '其他（請於下方說明）'],
];
export const DORM_OPTIONS = [['yes', '提供宿舍'], ['no', '不提供宿舍']];

export const MESSAGES = {
  contact: '請填寫雇主的電話與地址。',
  gender: '家庭看護與家庭幫傭雇主請選擇性別。',
  age: '家庭看護與家庭幫傭雇主請填寫有效的年齡（18 至 120 歲）。',
  family: '家庭看護與家庭幫傭雇主需填寫家庭成員，或勾選獨居。',
  familyRow: '家庭成員資料不完整，請填寫每位成員的關係、年齡與性別。',
  company: '工廠雇主需填寫統一編號與負責人姓名。',
  care: '家庭看護或家庭幫傭需求單需填寫被照顧人的關係、年紀、性別與身體狀況。',
  salary: '預計月薪格式不正確，請填寫 1 至 1,000,000 的整數。',
};

const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const optionKey = (value, options) => (options.some(([key]) => key === value) ? value : '');
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function intInRange(value, min, max) {
  const raw = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  if (!/^\d{1,3}$/.test(raw)) return '';
  const number = Number(raw);
  return number >= min && number <= max ? String(number) : '';
}

export function cleanEmployerProfile(value) {
  const source = isObject(value) ? value : {};
  const livesAlone = source.livesAlone === true;
  const members = livesAlone || !Array.isArray(source.familyMembers) ? [] : source.familyMembers
    .slice(0, MAX_FAMILY_MEMBERS)
    .filter(isObject)
    .map(row => ({
      relation: optionKey(row.relation, FAMILY_RELATION_OPTIONS),
      age: intInRange(row.age, 0, 120),
      gender: optionKey(row.gender, GENDER_OPTIONS),
      livesTogether: row.livesTogether !== false,
    }))
    // 完全沒填的空白列直接略過；只填一部分的列保留，讓驗證能提醒補齊。
    .filter(row => row.relation || row.age || row.gender);
  const dormProvided = optionKey(source.dormProvided, DORM_OPTIONS);
  return {
    gender: optionKey(source.gender, GENDER_OPTIONS),
    age: intInRange(source.age, 18, 120),
    livesAlone,
    familyMembers: members,
    companyRegNo: text(source.companyRegNo, 20),
    factoryRegNo: text(source.factoryRegNo, 40),
    responsiblePerson: text(source.responsiblePerson, 120),
    workAddress: text(source.workAddress, 300),
    dormProvided,
    dormAddress: dormProvided === 'yes' ? text(source.dormAddress, 300) : '',
  };
}

// 回傳第一個錯誤訊息；沒有錯誤回傳空字串。電話與地址是雇主資料表原有欄位，一併在此檢查。
export function employerRecordError({ employerType, phone, address, profile }) {
  if (!String(phone || '').trim() || !String(address || '').trim()) return MESSAGES.contact;
  const cleaned = cleanEmployerProfile(profile);
  if (isHomeEmployer(employerType)) {
    if (!cleaned.gender) return MESSAGES.gender;
    if (!cleaned.age) return MESSAGES.age;
    if (!cleaned.livesAlone && cleaned.familyMembers.length === 0) return MESSAGES.family;
  }
  if (cleaned.familyMembers.some(member => !member.relation || !member.age || !member.gender)) return MESSAGES.familyRow;
  if (employerType === 'factory' && (!cleaned.companyRegNo || !cleaned.responsiblePerson)) return MESSAGES.company;
  return '';
}

// 提醒元件用：列出尚未補齊的雇主補充資料（電話、地址等原有欄位由提醒元件自己檢查）。
export function employerMissingLabels(employer) {
  const cleaned = cleanEmployerProfile(employer?.employer_profile);
  const missing = [];
  if (isHomeEmployer(employer?.employer_type)) {
    if (!cleaned.gender) missing.push('性別');
    if (!cleaned.age) missing.push('年齡');
    if (!cleaned.livesAlone && cleaned.familyMembers.length === 0) missing.push('家庭成員');
  }
  if (employer?.employer_type === 'factory') {
    if (!cleaned.companyRegNo) missing.push('統一編號');
    if (!cleaned.responsiblePerson) missing.push('負責人姓名');
  }
  return missing;
}

export const EMPTY_CARE_RECIPIENT = { relation: '', age: '', gender: '', conditions: [], diagnosis: '' };

export function cleanCareRecipient(value) {
  const source = isObject(value) ? value : {};
  const keys = new Set(HEALTH_CONDITION_OPTIONS.map(([key]) => key));
  let conditions = Array.isArray(source.conditions) ? [...new Set(source.conditions.filter(key => keys.has(key)))] : [];
  // 「身體健康」與其他狀況互斥；兩者同時出現時，以具體的狀況為準。
  if (conditions.length > 1) conditions = conditions.filter(key => key !== 'healthy');
  return {
    relation: optionKey(source.relation, CARE_RELATION_OPTIONS),
    age: intInRange(source.age, 0, 120),
    gender: optionKey(source.gender, GENDER_OPTIONS),
    conditions,
    diagnosis: text(source.diagnosis, 500),
  };
}

export function careRecipientError(value) {
  const cleaned = cleanCareRecipient(value);
  return cleaned.relation && cleaned.age && cleaned.gender && cleaned.conditions.length ? '' : MESSAGES.care;
}

// 月薪（新臺幣，選填）。回傳 { ok, value }；空字串代表沒填，value 為 null。
export function parseMonthlySalary(value) {
  const raw = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  if (!raw) return { ok: true, value: null };
  if (!/^\d{1,7}$/.test(raw)) return { ok: false, value: null };
  const number = Number(raw);
  return number >= 1 && number <= 1000000 ? { ok: true, value: number } : { ok: false, value: null };
}

// 需求單附加欄位（月薪、被照顧人）的共用檢查；回傳第一個錯誤訊息，沒有錯誤回傳空字串。
export function jobOrderExtrasError({ jobType, monthlySalary, careRecipient }) {
  if (!parseMonthlySalary(monthlySalary).ok) return MESSAGES.salary;
  if (needsCareRecipient(jobType)) return careRecipientError(careRecipient);
  return '';
}
