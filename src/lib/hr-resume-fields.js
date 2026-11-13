// Shared option lists and helpers for worker resume fields.
// Used by both the worker portal (HrMemberPortal) and the admin resume editor
// (HrManagement) so the dropdown / checkbox options never drift apart.

export const WORKER_RESUME_CHOICES = {
  cookingSkills:['台灣','廣東','中國','日本','泰國','印度','韓國','菲律賓'],
  applianceOptions:['Washing Machine','Oven','Vacuum Cleaner','Microwave Oven','Dish Washer','Others'],
  childcareSkills:['Bathing','Changing diapers','Sterilizing utensils','Feeding','Taking temperature','Others'],
};

export const WORKER_RESUME_LANGUAGES = ['English','Tagalog','Cantonese','Mandarin','Others'];

export const WORKER_RESUME_LANGUAGE_LEVELS = [['basic','基礎'],['medium','中等'],['native','本地']];

// 教育程度：菲律賓高中以上。值存中文，英文介面與 PDF 由翻譯表轉成英文全名與縮寫。
// 舊資料的「小學／國中／高中／專科／大學」仍可顯示，可用 scripts/migrate-education-levels.sql 一次轉換。
export const EDUCATION_LEVEL_OPTIONS = ['高中畢業','副學士 / 專科學位','學士學位（大學畢業）','碩士學位','博士學位'];

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

export function resumeChoiceList(value) { return String(value||'').split(/[,，、;；|]/).map(item=>item.trim()).filter(Boolean); }

export function readLanguageLevels(value,selected) {
  try{const parsed=JSON.parse(value||'{}');if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))return Object.fromEntries(selected.map(language=>[language,['basic','medium','native'].includes(parsed[language])?parsed[language]:'basic']));}catch{}
  return Object.fromEntries(selected.map(language=>[language,'basic']));
}
