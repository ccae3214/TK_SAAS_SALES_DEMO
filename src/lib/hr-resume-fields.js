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

export const WORKER_RESUME_SELECTS = {
  height:['145以下',...Array.from({length:36},(_,index)=>String(index+145)),'181以上'],
  weight:['39以下',...Array.from({length:31},(_,index)=>String(index+40)),'71以上'],
  maritalStatus:['單身','有伴侶','已結婚'],
  numberOfChildren:Array.from({length:11},(_,index)=>String(index)),
  brotherCount:Array.from({length:11},(_,index)=>String(index)),
  sisterCount:Array.from({length:11},(_,index)=>String(index)),
  educationLevels:['小學','國中','高中','專科','大學'],
};

export const WORKER_RESUME_SKIN_COMPLEXIONS = ['白','黃','黑'];

export function resumeChoiceList(value) { return String(value||'').split(/[,，、;；|]/).map(item=>item.trim()).filter(Boolean); }

export function readLanguageLevels(value,selected) {
  try{const parsed=JSON.parse(value||'{}');if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))return Object.fromEntries(selected.map(language=>[language,['basic','medium','native'].includes(parsed[language])?parsed[language]:'basic']));}catch{}
  return Object.fromEntries(selected.map(language=>[language,'basic']));
}
