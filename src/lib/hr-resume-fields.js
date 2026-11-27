// Shared option lists, per-field length limits and helpers for worker resume fields.
// Used by both the worker portal (HrMemberPortal) and the admin resume editor
// (HrManagement) so the dropdown / checkbox options never drift apart.
// The server-side sanitizer (src/app/api/hr/_shared.js) imports the limits from here,
// so there is exactly one list of resume fields to maintain.

export const WORKER_RESUME_CHOICES = {
  cookingSkills:['台灣','廣東','中國','日本','泰國','印度','韓國','菲律賓'],
  applianceOptions:['Washing Machine','Oven','Vacuum Cleaner','Microwave Oven','Dish Washer','Others'],
  childcareSkills:['Bathing','Changing diapers','Sterilizing utensils','Feeding','Taking temperature','Others'],
};

export const WORKER_RESUME_LANGUAGES = ['English','Tagalog','Cantonese','Mandarin','Others'];

export const WORKER_RESUME_LANGUAGE_LEVELS = [['basic','基礎'],['medium','中等'],['native','本地']];

// 教育程度：菲律賓高中以上。值存中文，英文介面與 PDF 由翻譯表轉成英文全名與縮寫。
// 「高中」= High School（舊制四年中學／未取得 SHS 文憑）；「高中畢業」= Senior High School Diploma (SHS)。
// 舊資料的「小學／國中／專科／大學」仍可顯示，可用 scripts/migrate-education-levels.sql 一次轉換。
export const EDUCATION_LEVEL_OPTIONS = ['高中','高中畢業','副學士 / 專科學位','學士學位（大學畢業）','碩士學位','博士學位'];

export const WORKER_RESUME_SELECTS = {
  height:['145以下',...Array.from({length:36},(_,index)=>String(index+145)),'181以上'],
  weight:['39以下',...Array.from({length:31},(_,index)=>String(index+40)),'71以上'],
  maritalStatus:['單身','有伴侶','已結婚'],
  numberOfChildren:Array.from({length:11},(_,index)=>String(index)),
  brotherCount:Array.from({length:11},(_,index)=>String(index)),
  sisterCount:Array.from({length:11},(_,index)=>String(index)),
  educationLevels:EDUCATION_LEVEL_OPTIONS,
};

export const WORKER_RESUME_SKIN_COMPLEXIONS = ['白','黃','黑'];

// 每個履歷欄位可儲存的最大字元數；超過的內容在儲存前會被截斷。
export const WORKER_RESUME_FIELD_LIMITS = {
  referenceNo: 80, birthDate: 30, gender: 40, birthplace: 120, address: 300, height: 20, weight: 20,
  skinComplexion: 80, maritalStatus: 50, religion: 80, hobby: 300,
  spouseName: 120, spouseOccupation: 120, spouseAge: 20, numberOfChildren: 20, childrenAges: 100,
  fatherName: 120, fatherOccupation: 120, fatherBirthDate: 30, motherName: 120, motherOccupation: 120, motherBirthDate: 30,
  brotherCount: 20, brotherAges: 100, sisterCount: 20, sisterAges: 100, familyRank: 40, caregiverDuringOverseas: 200,
  educationLevels: 200, education: 2000, coursesCompleted: 1000, languageOptions: 200, languages: 2000, cookingSkills: 700, applianceOptions: 300, applianceSkills: 700, childcareSkills: 1000,
  experienceNewborn: 1500, experienceChildren: 1500, experienceElderly: 1500, experienceDisabled: 1500,
  hasTattoo: 20, smokes: 20, drinksAlcohol: 20, petExperience: 500, willingToWorkWithPets: 20, seriousIllness: 20,
  operationLast12Months: 20, allergies: 20, dayOffChores: 20, finishChoresBeforeOuting: 20, returnBy8PM: 20,
  makeupAtWork: 20, workOnDaysOff: 20, workedAbroad: 20, overseasWorkDetails: 1000, employmentHistory: 5000, remarks: 2000,
};

export function resumeChoiceList(value) { return String(value||'').split(/[,，、;；|]/).map(item=>item.trim()).filter(Boolean); }

export function readLanguageLevels(value,selected) {
  try{const parsed=JSON.parse(value||'{}');if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))return Object.fromEntries(selected.map(language=>[language,['basic','medium','native'].includes(parsed[language])?parsed[language]:'basic']));}catch{}
  return Object.fromEntries(selected.map(language=>[language,'basic']));
}
