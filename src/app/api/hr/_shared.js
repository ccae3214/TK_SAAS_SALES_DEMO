// /api/hr 各 method 共用的小工具（POST 拆檔後，route.js 與 _post/*.js 都從這裡取用）。
import pool, { query } from '@/lib/db';
import { refreshCaseStage as refreshStage, refreshWorkerCases as refreshStagesForWorker } from '@/lib/hr-case-stage';
import { WORKER_PROGRESS_STEPS } from '@/lib/hr-worker-progress';
import { cleanEmployerProfile, employerRecordError } from '@/lib/hr-employer-profile';
// 履歷欄位的長度上限與選項清單放在同一支檔案，只維護這一份。
import { WORKER_RESUME_FIELD_LIMITS as WORKER_RESUME_FIELDS } from '@/lib/hr-resume-fields';
import { WORKER_PHOTO, ensureWorkerPhotoSchema, saveWorkerPhoto } from '@/lib/hr-worker-photo';

const EMPLOYER_TYPES = new Set(['home_care', 'factory', 'domestic_helper', 'nursing_home', 'other']);
const TASK_CATEGORIES = new Set(['document', 'medical', 'training', 'other']);
// 申請程序清單與工作者層級進度共用同一份定義（hr-worker-progress.js），避免兩邊不同步。
const APPLICATION_STEPS = WORKER_PROGRESS_STEPS;

const clean = (value, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const WORKER_JOB_PREFERENCES = new Set(['家庭幫傭','家庭看護','工廠技術工','農工','機構看護工']);
function cleanWorkerResumeProfile(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const profile=Object.fromEntries(Object.entries(WORKER_RESUME_FIELDS).map(([field, limit]) => [field, clean(value[field], limit)]));
  for(const field of ['overseasExperiences','employmentExperiences'])profile[field]=Array.isArray(value[field])?value[field].slice(0,30).filter(row=>row&&typeof row==='object').map(row=>({workplace:clean(row.workplace,180),period:clean(row.period,100),title:clean(row.title,120),content:clean(row.content,4000)})):[];
  // 照片不放進 JSONB：掛在 Symbol 上（JSON.stringify 會略過），寫入履歷後由 persistWorkerPhoto 加密另存。
  // 已經整理過的 profile 再整理一次（workerProfileWithReference）時沿用原本的照片值。
  if(value[WORKER_PHOTO]!==undefined){profile[WORKER_PHOTO]=value[WORKER_PHOTO];return profile;}
  const photo=typeof value.photoDataUrl==='string'?value.photoDataUrl:'';
  if(Object.prototype.hasOwnProperty.call(value,'photoDataUrl')&&!photo)profile[WORKER_PHOTO]='';
  else if(photo.length<=2100000&&/^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(photo))profile[WORKER_PHOTO]=photo;
  return profile;
}
// 履歷寫入 hr_workers 之後呼叫。replace=true：整份履歷覆蓋（沒送照片代表移除）。
async function persistWorkerPhoto(runner, workerId, profile, options = {}) {
  await ensureWorkerPhotoSchema(pool);
  await saveWorkerPhoto(runner, workerId, profile, options);
}
function workerGenderCode(value) {
  const gender=String(value||'').trim().toLowerCase();
  if(['male','m','男','男性'].includes(gender))return 'M';
  if(['female','f','女','女性'].includes(gender))return 'F';
  return '';
}
function workerReferenceCode(jobPreference, gender, workerId) {
  const category=jobPreference==='家庭看護'||jobPreference==='家庭幫傭'?'CT':jobPreference==='工廠技術工'?'SW':jobPreference==='農工'?'FM':jobPreference==='機構看護工'?'CG':'';
  const sex=workerGenderCode(gender);
  if(!category||!sex||!validId(workerId))return '';
  const sequence=String(workerId).padStart(3,'0');
  const number=category==='CT'?sequence:`${String(new Date().getFullYear()).slice(-2)}${sequence}`;
  return `${category}${sex}-${number}`;
}
function workerProfileWithReference(value, jobPreference, workerId) {
  const profile=cleanWorkerResumeProfile(value);
  const referenceNo=workerReferenceCode(jobPreference,profile.gender,workerId);
  if(referenceNo&&!profile.referenceNo)profile.referenceNo=referenceNo;
  return profile;
}
const validId = value => /^\d+$/.test(String(value ?? '')) && Number(value) > 0;
// 雇主補充資料：client 沒送 employerProfile 時回傳 { profile: null }（保留資料庫原值）；有送就驗證並整理後轉成 JSON。
function employerProfileFromBody(body) {
  if (body.employerProfile === undefined) return { profile: null };
  const error = employerRecordError({ employerType: body.employerType, phone: clean(body.phone, 50), address: clean(body.address, 300), profile: body.employerProfile });
  if (error) return { error };
  return { profile: JSON.stringify(cleanEmployerProfile(body.employerProfile)) };
}
const validDate = value => {
  if (!value) return true;
  const text = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text;
};

async function recordActivity(caseId, actor, action, detail) {
  await pool.query('INSERT INTO hr_case_activity(case_id, actor_email, action, detail) VALUES($1,$2,$3,$4)', [caseId, actor, action, detail]);
}

// 文件屬於工人，沒有案件時就沒有案件動態可記；有案件的話，每個案件的動態裡都會看到這筆紀錄。
async function recordWorkerActivity(runner, workerId, actor, action, detail) {
  await runner.query('INSERT INTO hr_case_activity(case_id,actor_email,action,detail) SELECT id,$2,$3,$4 FROM hr_cases WHERE worker_id=$1', [workerId, actor, action, detail]);
}

const run = (sql, params) => query(sql, params);

async function refreshCaseStage(caseId) {
  await refreshStage(run, caseId);
}

// 工人的文件有變動時，重算他所有案件的階段。
async function refreshWorkerCases(workerId) {
  await refreshStagesForWorker(run, workerId);
}

export { EMPLOYER_TYPES, TASK_CATEGORIES, APPLICATION_STEPS, clean, WORKER_JOB_PREFERENCES, WORKER_RESUME_FIELDS, cleanWorkerResumeProfile, persistWorkerPhoto, workerGenderCode, workerReferenceCode, workerProfileWithReference, validId, employerProfileFromBody, validDate, recordActivity, recordWorkerActivity, run, refreshCaseStage, refreshWorkerCases };
