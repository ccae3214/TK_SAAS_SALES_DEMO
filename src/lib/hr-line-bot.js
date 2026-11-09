import { getHrPrincipal } from '@/lib/hr-access';
import { query } from '@/lib/db';
import pool from '@/lib/db';
import { insertWorkerDocuments } from '@/lib/hr-requirements';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const STAGE_LABELS = {
  intake: '需求受理', matching: '媒合中', documents: '文件處理',
  medical_training: '體檢與訓練', application: '申請辦理',
  arrangement: '後續安排', completed: '完成',
};
const STATUS_LABELS = { open: '進行中', on_hold: '暫停', closed: '結案' };
const TASK_LABELS = { todo: '待處理', in_progress: '處理中', blocked: '受阻', done: '完成' };
const DOC_LABELS = { missing: '未收件', submitted: '待審核', approved: '已核准', returned: '退回補件' };
const LANGUAGE_NAMES = { zh: '中文', en: 'English', tl: 'Filipino' };
const RICH_MENU_DEFINITIONS = {
  worker: {
    image: 'worker.png',
    name: 'Kolecion Worker',
    actions: [
      { type: 'message', label: 'My case', text: '案件' },
      { type: 'message', label: 'My documents', text: '文件' },
      { type: 'message', label: 'My agency', text: '仲介' },
      { type: 'message', label: 'My employer', text: '雇主' },
      { type: 'message', label: 'To-do list', text: '待辦' },
      { type: 'uri', label: 'Web login', uri: '/hr/login' },
    ],
  },
  employer: {
    image: 'employer.png',
    name: 'Kolecion Employer',
    actions: [
      { type: 'message', label: 'My worker', text: '我的工作者' },
      { type: 'message', label: 'Contract progress', text: '雇主合約進度' },
      { type: 'message', label: 'Order matching', text: '雇主配對進度' },
      { type: 'message', label: 'Matched worker', text: '配對工作者進度' },
      { type: 'message', label: 'To-do list', text: '待辦' },
      { type: 'uri', label: 'Web login', uri: '/hr/login' },
    ],
  },
  agency_philippines: {
    image: 'philippines-agency.png',
    name: 'Kolecion Philippines Agency',
    actions: [
      { type: 'message', label: 'My workers', text: '我的工作者' },
      { type: 'message', label: 'Training schedule', text: '工作者訓練進度' },
      { type: 'message', label: 'Licence progress', text: '工作者證照進度' },
      { type: 'message', label: 'Match progress', text: '工作者配對進度' },
      { type: 'message', label: 'Employer progress', text: '工作者雇主進度' },
      { type: 'uri', label: 'Web login', uri: '/hr/login' },
    ],
  },
  agency_taiwan: {
    image: 'taiwan-agency.png',
    name: 'Kolecion Taiwan Agency',
    actions: [
      { type: 'message', label: 'My employers', text: '我的雇主' },
      { type: 'message', label: 'Contract progress', text: '雇主合約進度' },
      { type: 'message', label: 'Order matching', text: '雇主配對進度' },
      { type: 'message', label: 'Matched workers', text: '配對工作者進度' },
      { type: 'message', label: 'To-do list', text: '待辦' },
      { type: 'uri', label: 'Web login', uri: '/hr/login' },
    ],
  },
  training_center: {
    image: 'training-center.png',
    name: 'Kolecion Training Center',
    actions: [
      { type: 'message', label: 'My students', text: '我的學生' },
      { type: 'message', label: 'Training schedule', text: '學生訓練進度' },
      { type: 'message', label: 'Licence progress', text: '學生證照進度' },
      { type: 'message', label: 'Match progress', text: '學生配對進度' },
      { type: 'message', label: 'Agency progress', text: '學生仲介進度' },
      { type: 'uri', label: 'Web login', uri: '/hr/login' },
    ],
  },
  admin: {
    image: 'admin.png',
    name: 'Kolecion Administrator',
    actions: [
      { type: 'message', label: '管理工作者', text: '管理工作者' },
      { type: 'message', label: '管理雇主', text: '管理雇主' },
      { type: 'message', label: '管理仲介', text: '管理仲介' },
      { type: 'message', label: '管理訓練中心', text: '管理訓練中心' },
      { type: 'message', label: '管理案件進度', text: '管理案件進度' },
      { type: 'uri', label: 'Web login', uri: '/hr/login' },
    ],
  },
};

function richMenuKey(principal) {
  if (!principal?.role) return null;
  if (principal.role === 'agency') return principal.agency_type === 'philippines' ? 'agency_philippines' : 'agency_taiwan';
  if (principal.role === 'admin') return 'admin_v3';
  return RICH_MENU_DEFINITIONS[principal.role] ? principal.role : null;
}

function lineApiHeaders(accessToken, contentType = 'application/json') {
  return { Authorization: `Bearer ${accessToken}`, 'Content-Type': contentType };
}
async function lineApiRequest(url, options, errorCode) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    const details = (await response.text()).replace(/\s+/g, ' ').slice(0, 300);
    throw new Error(`${errorCode}_${response.status}${details ? `_${details}` : ''}`);
  }
  return response;
}

async function ensureRichMenu(menuKey) {
  const stored = await query('SELECT rich_menu_id FROM hr_line_rich_menus WHERE menu_key=$1', [menuKey]);
  if (stored.length) return stored[0].rich_menu_id;

  const accessToken = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
  if (!accessToken) throw new Error('missing_messaging_access_token');
  const definition = RICH_MENU_DEFINITIONS[menuKey.replace(/_v\d+$/, '')];
  if (!definition) throw new Error('unknown_line_rich_menu');
  if (definition.actions.some(({ label }) => [...label].length > 20)) {
    throw new Error(`line_rich_menu_action_label_too_long_${menuKey}`);
  }
  const areas = definition.actions.map((action, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = [0, 834, 1667][column];
    const right = [834, 1667, 2500][column];
    const y = row * 843;
    return {
      bounds: { x, y, width: right - x, height: 843 },
      action: action.type === 'uri'
        ? { type: 'uri', label: action.label, uri: `${websiteBase()}${action.uri}` }
        : { type: 'message', label: action.label, text: action.text },
    };
  });
  const created = await lineApiRequest('https://api.line.me/v2/bot/richmenu', {
    method: 'POST',
    headers: lineApiHeaders(accessToken),
    body: JSON.stringify({
      size: { width: 2500, height: 1686 },
      selected: true,
      name: definition.name,
      chatBarText: '功能選單',
      areas,
    }),
  }, 'line_rich_menu_create_failed');
  const { richMenuId } = await created.json();
  if (!richMenuId) throw new Error('line_rich_menu_id_missing');

  const image = await readFile(path.join(process.cwd(), 'public', 'line-rich-menus', definition.image));
  await lineApiRequest(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
    method: 'POST',
    headers: lineApiHeaders(accessToken, 'image/png'),
    body: image,
  }, 'line_rich_menu_upload_failed');

  await query(`INSERT INTO hr_line_rich_menus(menu_key,rich_menu_id)
    VALUES($1,$2) ON CONFLICT(menu_key) DO NOTHING`, [menuKey, richMenuId]);
  const saved = await query('SELECT rich_menu_id FROM hr_line_rich_menus WHERE menu_key=$1', [menuKey]);
  return saved[0].rich_menu_id;
}

export async function syncLineRichMenu(lineUserId, principal) {
  if (!lineUserId) return;
  const menuKey = richMenuKey(principal);
  const rows = await query('SELECT rich_menu_role FROM hr_line_member_settings WHERE line_user_id=$1', [lineUserId]);
  if ((rows[0]?.rich_menu_role || null) === menuKey) return;

  const accessToken = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
  if (!accessToken) throw new Error('missing_messaging_access_token');
  if (menuKey) {
    const richMenuId = await ensureRichMenu(menuKey);
    await lineApiRequest(`https://api.line.me/v2/bot/user/${encodeURIComponent(lineUserId)}/richmenu/${richMenuId}`, {
      method: 'POST',
      headers: lineApiHeaders(accessToken),
    }, 'line_rich_menu_link_failed');
  } else if (rows[0]?.rich_menu_role) {
    await lineApiRequest(`https://api.line.me/v2/bot/user/${encodeURIComponent(lineUserId)}/richmenu`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }, 'line_rich_menu_unlink_failed');
  }

  await query(`INSERT INTO hr_line_member_settings(line_user_id,preferred_language,rich_menu_role)
    VALUES($1,'zh',$2)
    ON CONFLICT(line_user_id) DO UPDATE SET rich_menu_role=EXCLUDED.rich_menu_role,updated_at=NOW()`, [lineUserId, menuKey]);
}

const ADMIN_DATA_TYPES = {
  worker: { label: '工作者',table:'hr_workers',fields: ['name','nationality','gender','phone','email','jobPreference','agencyId','status','notes'] },
  employer: { label: '雇主',table:'hr_employers',fields: ['name','contactName','phone','email','address','employerType','agencyId','status','notes'] },
  agency: { label: '仲介',table:'hr_agencies',fields: ['name','agencyType','active'] },
  training_center: { label: '訓練中心',table:'hr_members',fields: ['name','email','active'] },
};

// ── 管理者資料管理：LINE 回覆語言（zh／en／tl） ──────────────────────────────
// 按鈕送出的指令（adm-*）是機器讀的固定字串，與語言無關；舊版中文指令（管理清單…）仍然接受。
class AdminInputError extends Error {
  constructor(key, params = {}) { super(key); this.key = key; this.params = params; }
}

const ADMIN_TYPES = ['worker', 'employer', 'agency', 'training_center'];
const ADMIN_COMMAND_ALIASES = [
  ['管理確認刪除', 'adm-confirm-del'], ['管理選單', 'adm-menu'], ['管理取消', 'adm-cancel'],
  ['管理清單', 'adm-list'], ['管理選取', 'adm-select'], ['管理新增', 'adm-new'],
  ['管理編輯', 'adm-edit'], ['管理刪除', 'adm-del'], ['管理欄位', 'adm-field'],
];
function normalizeAdminCommand(command) {
  for (const [legacy, current] of ADMIN_COMMAND_ALIASES) {
    if (command === legacy || command.startsWith(`${legacy}:`)) return current + command.slice(legacy.length);
  }
  return command;
}

const ADMIN_CLEAR_WORDS = new Set(['無', 'none', 'wala']);
const isAdminClear = value => ADMIN_CLEAR_WORDS.has(String(value).trim().toLowerCase());
function parseAdminActive(value) {
  const v = String(value).trim().toLowerCase();
  if (['active', 'enabled', 'enable', '啟用'].includes(v)) return true;
  if (['inactive', 'disabled', 'disable', '停用'].includes(v)) return false;
  return null;
}
function parseAdminGender(value) {
  const v = String(value ?? '').trim().toLowerCase();
  if (['male', 'm', '男', '男性', 'lalaki'].includes(v)) return 'male';
  if (['female', 'f', '女', '女性', 'babae'].includes(v)) return 'female';
  return null;
}
// 資料庫存的是中文工作意向；三種語言的名稱都接受，一律換成中文再存。
const JOB_PREFERENCES = [
  { zh: '家庭幫傭', en: 'Domestic helper', tl: 'Kasambahay' },
  { zh: '家庭看護', en: 'Home caregiver', tl: 'Tagapag-alaga sa bahay' },
  { zh: '工廠技術工', en: 'Factory technician', tl: 'Technician sa pabrika' },
  { zh: '農工', en: 'Farm worker', tl: 'Manggagawa sa bukid' },
  { zh: '機構看護工', en: 'Institutional caregiver', tl: 'Caregiver sa institusyon' },
];
function parseJobPreference(value) {
  const v = String(value ?? '').trim().toLowerCase();
  return JOB_PREFERENCES.find(job => [job.zh, job.en, job.tl].some(name => name.toLowerCase() === v))?.zh || null;
}
const capitalize = value => value.charAt(0).toUpperCase() + value.slice(1);
const plainAdminLabel = label => label.replace(/\s*[（(].*$/, '');

const ADMIN_TEXT = {
  zh: {
    colon: '：', active: '啟用', inactive: '停用',
    genders: { male: '男', female: '女' },
    agencyTypes: { taiwan: '台灣仲介', philippines: '菲律賓仲介' },
    employerTypes: { home_care: '家庭看護', factory: '工廠', domestic_helper: '家庭幫傭', other: '其他' },
    countries: {},
    types: { worker: '工作者', employer: '雇主', agency: '仲介', training_center: '訓練中心' },
    plural: { worker: '工作者', employer: '雇主', agency: '仲介', training_center: '訓練中心' },
    nameLabel: { worker: '姓名', employer: '名稱', agency: '仲介名稱', training_center: '中心名稱' },
    resumeLabel: '履歷',
    recordLabels: {
      worker: { nationality: '國籍', gender: '性別', phone: '電話', email: 'Email', job_preference: '工作意向', agency_name: '所屬仲介', status: '狀態', notes: '備註' },
      employer: { contact_name: '聯絡人', phone: '電話', email: 'Email', employer_type: '雇主類型', address: '地址', agency_name: '所屬仲介', status: '狀態', notes: '備註' },
      agency: { agency_type: '仲介類型', country: '國家／地區', active: '狀態' },
      training_center: { email: 'Email', line_user_id: 'LINE User ID', active: '狀態', created_at: '建立時間' },
    },
    fields: {
      worker: { name: '姓名', nationality: '國籍', gender: '性別（male／female）', phone: '電話', email: 'Email', jobPreference: '工作意向', agencyId: '所屬仲介 ID', status: '狀態', notes: '備註' },
      employer: { name: '雇主名稱', contactName: '聯絡人', phone: '電話', email: 'Email', address: '地址', employerType: '雇主類型', agencyId: '所屬仲介 ID', status: '狀態', notes: '備註' },
      agency: { name: '仲介名稱', agencyType: '仲介類型（taiwan／philippines）', active: '狀態（active／inactive）' },
      training_center: { name: '中心名稱', email: '登入 Email', active: '狀態（啟用／停用）' },
    },
    hints: {
      'worker:gender': '請輸入 male、female、男或女。',
      'worker:jobPreference': '請輸入：家庭幫傭、家庭看護、工廠技術工、農工或機構看護工。',
      'employer:employerType': '請輸入 home_care、factory、domestic_helper 或 other。',
      'agency:agencyType': '請輸入 taiwan 或 philippines。',
    },
    menuTitle: '管理者資料管理選單：',
    menu: { worker: ['管理工作者', '管理工作者'], employer: ['管理雇主', '管理雇主'], agency: ['管理仲介', '管理仲介'], training_center: ['管理訓練中心', '管理訓練中心'] },
    prompt: (t, label, hint, initial) => `${initial ? `新增${t}，` : ''}請輸入${label}${hint ? `（${hint}）` : '（不適用請輸入「無」）'}`,
    emptyList: p => `${p}資料目前為空。可先新增資料。`,
    add: p => `新增${p}`,
    backToMenu: '返回選單', backToMenuLong: '返回管理選單',
    prev: '上一頁', next: '下一頁',
    listHeader: ({ title, count, from, to, items }) => `${title}清單（${count} 筆，顯示 ${from}–${to}）\n${items}\n點選下方項目查看完整資料。`,
    unnamed: '未命名',
    edit: '編輯資料', deactivate: '停用資料', backToList: '返回清單', backToListShort: '回清單', backToRecord: '返回資料', cancel: '取消',
    notFound: '找不到該筆資料，請重新選擇。', notFoundShort: '找不到該筆資料。', notFoundRemoved: '找不到資料，可能已被移除。',
    chooseField: t => `選擇要修改的${t}欄位：`,
    confirmDeactivate: (t, id) => `確定停用${t} #${id}？資料及關聯紀錄會保留，不會永久刪除。`,
    confirmButton: '確定停用',
    staleConfirm: '此停用確認已逾期或取消，請重新選取資料再操作。',
    deactivated: (t, id) => `已停用${t} #${id}。`,
    useButtons: '請使用「確定停用」或「取消」按鈕完成此操作。',
    invalidField: '欄位無效，請重新選擇。',
    enterNewValue: label => `請輸入「${label}」的新值（文字「無」會清空欄位）：`,
    updated: '資料已更新。',
    duplicate: label => `資料已存在，請改用其他值。${label}：`,
    agencyMissing: '所屬仲介不存在，請確認仲介 ID 後重試。',
    createDuplicate: '資料已存在（例如 Email 或名稱重複），請輸入新的資料重新開始。',
    recreate: '重新新增',
    created: (t, id) => `已新增${t} #${id}。`,
    reenter: label => `請重新輸入${label}：`,
    reenterShort: '請重新輸入：',
    cancelled: '已取消目前操作。輸入「管理工作者」、「管理雇主」、「管理仲介」或「管理訓練中心」開始管理。',
    errors: {
      invalidField: () => '欄位無效，請重新選擇。',
      nameRequired: () => '名稱不能空白。',
      emailInvalid: () => '請輸入有效 Email。',
      emailRequired: () => '請輸入有效 Email，且不可留空。',
      statusInvalid: () => '狀態請輸入「啟用」或「停用」。',
      agencyTypeInvalid: () => '請輸入 taiwan 或 philippines。',
      genderInvalid: () => '性別請輸入 male、female、男或女。',
      agencyIdInvalid: () => '仲介 ID 請輸入正整數，或輸入「無」清空。',
      tooLong: ({ max }) => `內容過長，最多 ${max} 個字元。`,
      employerTypeInvalid: () => '雇主類型請輸入 home_care、factory、domestic_helper 或 other。',
      jobInvalid: () => '工作意向請輸入：家庭幫傭、家庭看護、工廠技術工、農工或機構看護工。',
      agencyCreateInvalid: () => '請填名稱，並將仲介類型設為 taiwan 或 philippines。',
      tcCreateInvalid: () => '請輸入訓練中心名稱及有效 Email。',
      unsupportedType: () => '不支援的資料類型。',
    },
  },
  en: {
    colon: ': ', active: 'Active', inactive: 'Inactive',
    genders: { male: 'Male', female: 'Female' },
    agencyTypes: { taiwan: 'Taiwan agency', philippines: 'Philippines agency' },
    employerTypes: { home_care: 'Home care', factory: 'Factory', domestic_helper: 'Domestic helper', other: 'Other' },
    countries: { 台灣: 'Taiwan', 菲律賓: 'Philippines' },
    types: { worker: 'worker', employer: 'employer', agency: 'agency', training_center: 'training center' },
    plural: { worker: 'workers', employer: 'employers', agency: 'agencies', training_center: 'training centers' },
    nameLabel: { worker: 'Name', employer: 'Name', agency: 'Agency name', training_center: 'Center name' },
    resumeLabel: 'Resume',
    recordLabels: {
      worker: { nationality: 'Nationality', gender: 'Gender', phone: 'Phone', email: 'Email', job_preference: 'Job preference', agency_name: 'Agency', status: 'Status', notes: 'Notes' },
      employer: { contact_name: 'Contact person', phone: 'Phone', email: 'Email', employer_type: 'Employer type', address: 'Address', agency_name: 'Agency', status: 'Status', notes: 'Notes' },
      agency: { agency_type: 'Agency type', country: 'Country / region', active: 'Status' },
      training_center: { email: 'Email', line_user_id: 'LINE User ID', active: 'Status', created_at: 'Created' },
    },
    fields: {
      worker: { name: 'Name', nationality: 'Nationality', gender: 'Gender (male / female)', phone: 'Phone', email: 'Email', jobPreference: 'Job preference', agencyId: 'Agency ID', status: 'Status', notes: 'Notes' },
      employer: { name: 'Employer name', contactName: 'Contact person', phone: 'Phone', email: 'Email', address: 'Address', employerType: 'Employer type', agencyId: 'Agency ID', status: 'Status', notes: 'Notes' },
      agency: { name: 'Agency name', agencyType: 'Agency type (taiwan / philippines)', active: 'Status (active / inactive)' },
      training_center: { name: 'Center name', email: 'Login email', active: 'Status (enabled / disabled)' },
    },
    hints: {
      'worker:gender': 'male or female',
      'worker:jobPreference': 'one of: Domestic helper, Home caregiver, Factory technician, Farm worker, Institutional caregiver',
      'employer:employerType': 'home_care, factory, domestic_helper or other',
      'agency:agencyType': 'taiwan or philippines',
    },
    menuTitle: 'Administrator data management:',
    menu: { worker: ['Workers', 'manage workers'], employer: ['Employers', 'manage employers'], agency: ['Agencies', 'manage agencies'], training_center: ['Training centers', 'manage training centers'] },
    prompt: (t, label, hint, initial) => `${initial ? `Add ${t}. ` : ''}Please enter ${label}${hint ? ` (${hint})` : ' (send "none" if not applicable)'}`,
    emptyList: p => `There are no ${p} yet. Add one to get started.`,
    add: () => 'Add new',
    backToMenu: 'Back to menu', backToMenuLong: 'Back to menu',
    prev: 'Previous', next: 'Next',
    listHeader: ({ title, count, from, to, items }) => `${capitalize(title)} (${count} total, showing ${from}–${to})\n${items}\nTap an item below to see its full details.`,
    unnamed: 'Unnamed',
    edit: 'Edit', deactivate: 'Deactivate', backToList: 'Back to list', backToListShort: 'Back to list', backToRecord: 'Back to record', cancel: 'Cancel',
    notFound: 'Record not found. Please choose again.', notFoundShort: 'Record not found.', notFoundRemoved: 'Record not found. It may have been removed.',
    chooseField: t => `Choose the ${t} field to edit:`,
    confirmDeactivate: (t, id) => `Deactivate ${t} #${id}? The record and its related history are kept; nothing is permanently deleted.`,
    confirmButton: 'Deactivate',
    staleConfirm: 'This confirmation has expired or was cancelled. Please select the record again.',
    deactivated: (t, id) => `${capitalize(t)} #${id} has been deactivated.`,
    useButtons: 'Please use the "Deactivate" or "Cancel" button to finish this step.',
    invalidField: 'Invalid field. Please choose again.',
    enterNewValue: label => `Enter the new value for "${label}" (send "none" to clear the field):`,
    updated: 'Record updated.',
    duplicate: label => `That value already exists. Please use another one. ${label}:`,
    agencyMissing: 'That agency does not exist. Please check the agency ID and try again.',
    createDuplicate: 'That record already exists (for example a duplicate email or name). Please start again with new details.',
    recreate: 'Start again',
    created: (t, id) => `${capitalize(t)} #${id} has been added.`,
    reenter: label => `Please enter ${label} again:`,
    reenterShort: 'Please enter it again:',
    cancelled: 'Cancelled. Send "manage workers", "manage employers", "manage agencies" or "manage training centers" to start.',
    errors: {
      invalidField: () => 'Invalid field. Please choose again.',
      nameRequired: () => 'The name cannot be empty.',
      emailInvalid: () => 'Please enter a valid email address.',
      emailRequired: () => 'Please enter a valid email address; it cannot be empty.',
      statusInvalid: () => 'Status must be "active" or "inactive".',
      agencyTypeInvalid: () => 'Please enter taiwan or philippines.',
      genderInvalid: () => 'Gender must be male or female.',
      agencyIdInvalid: () => 'Agency ID must be a positive whole number, or send "none" to clear it.',
      tooLong: ({ max }) => `That is too long. The limit is ${max} characters.`,
      employerTypeInvalid: () => 'Employer type must be home_care, factory, domestic_helper or other.',
      jobInvalid: () => 'Job preference must be one of: Domestic helper, Home caregiver, Factory technician, Farm worker, Institutional caregiver.',
      agencyCreateInvalid: () => 'Please give a name and set the agency type to taiwan or philippines.',
      tcCreateInvalid: () => 'Please enter the training center name and a valid email address.',
      unsupportedType: () => 'This data type is not supported.',
    },
  },
  tl: {
    colon: ': ', active: 'Aktibo', inactive: 'Hindi aktibo',
    genders: { male: 'Lalaki', female: 'Babae' },
    agencyTypes: { taiwan: 'Ahensya sa Taiwan', philippines: 'Ahensya sa Pilipinas' },
    employerTypes: { home_care: 'Pangangalaga sa bahay', factory: 'Pabrika', domestic_helper: 'Kasambahay', other: 'Iba pa' },
    countries: { 台灣: 'Taiwan', 菲律賓: 'Pilipinas' },
    types: { worker: 'manggagawa', employer: 'employer', agency: 'ahensya', training_center: 'sentro ng pagsasanay' },
    plural: { worker: 'mga manggagawa', employer: 'mga employer', agency: 'mga ahensya', training_center: 'mga sentro ng pagsasanay' },
    nameLabel: { worker: 'Pangalan', employer: 'Pangalan', agency: 'Pangalan ng ahensya', training_center: 'Pangalan ng sentro' },
    resumeLabel: 'Resume',
    recordLabels: {
      worker: { nationality: 'Nasyonalidad', gender: 'Kasarian', phone: 'Telepono', email: 'Email', job_preference: 'Gustong trabaho', agency_name: 'Ahensya', status: 'Katayuan', notes: 'Tala' },
      employer: { contact_name: 'Contact person', phone: 'Telepono', email: 'Email', employer_type: 'Uri ng employer', address: 'Address', agency_name: 'Ahensya', status: 'Katayuan', notes: 'Tala' },
      agency: { agency_type: 'Uri ng ahensya', country: 'Bansa / rehiyon', active: 'Katayuan' },
      training_center: { email: 'Email', line_user_id: 'LINE User ID', active: 'Katayuan', created_at: 'Ginawa noong' },
    },
    fields: {
      worker: { name: 'Pangalan', nationality: 'Nasyonalidad', gender: 'Kasarian (male / female)', phone: 'Telepono', email: 'Email', jobPreference: 'Gustong trabaho', agencyId: 'ID ng ahensya', status: 'Katayuan', notes: 'Tala' },
      employer: { name: 'Pangalan ng employer', contactName: 'Contact person', phone: 'Telepono', email: 'Email', address: 'Address', employerType: 'Uri ng employer', agencyId: 'ID ng ahensya', status: 'Katayuan', notes: 'Tala' },
      agency: { name: 'Pangalan ng ahensya', agencyType: 'Uri ng ahensya (taiwan / philippines)', active: 'Katayuan (active / inactive)' },
      training_center: { name: 'Pangalan ng sentro', email: 'Login email', active: 'Katayuan (enabled / disabled)' },
    },
    hints: {
      'worker:gender': 'male o female',
      'worker:jobPreference': 'pumili ng isa: Kasambahay, Tagapag-alaga sa bahay, Technician sa pabrika, Manggagawa sa bukid, Caregiver sa institusyon',
      'employer:employerType': 'home_care, factory, domestic_helper o other',
      'agency:agencyType': 'taiwan o philippines',
    },
    menuTitle: 'Pamamahala ng data para sa administrator:',
    menu: { worker: ['Mga manggagawa', 'pamahalaan ang mga manggagawa'], employer: ['Mga employer', 'pamahalaan ang mga employer'], agency: ['Mga ahensya', 'pamahalaan ang mga ahensya'], training_center: ['Mga training center', 'pamahalaan ang mga training center'] },
    prompt: (t, label, hint, initial) => `${initial ? `Magdagdag ng ${t}. ` : ''}Ilagay ang ${label}${hint ? ` (${hint})` : ' (ipadala ang "wala" kung hindi naaangkop)'}`,
    emptyList: p => `Wala pang ${p}. Magdagdag muna.`,
    add: () => 'Magdagdag',
    backToMenu: 'Bumalik sa menu', backToMenuLong: 'Bumalik sa menu',
    prev: 'Nakaraan', next: 'Susunod',
    listHeader: ({ title, count, from, to, items }) => `${capitalize(title)} (${count} lahat, ipinapakita ang ${from}–${to})\n${items}\nPindutin ang item sa ibaba para makita ang buong detalye.`,
    unnamed: 'Walang pangalan',
    edit: 'I-edit', deactivate: 'I-deactivate', backToList: 'Bumalik sa listahan', backToListShort: 'Sa listahan', backToRecord: 'Bumalik sa tala', cancel: 'Kanselahin',
    notFound: 'Hindi nahanap ang tala. Pumili ulit.', notFoundShort: 'Hindi nahanap ang tala.', notFoundRemoved: 'Hindi nahanap ang tala. Maaaring natanggal na ito.',
    chooseField: t => `Piliin ang field ng ${t} na ie-edit:`,
    confirmDeactivate: (t, id) => `I-deactivate ang ${t} #${id}? Mananatili ang tala at kaugnay na kasaysayan; walang permanenteng buburahin.`,
    confirmButton: 'I-deactivate',
    staleConfirm: 'Nag-expire o nakansela na ang kumpirmasyong ito. Piliin muli ang tala.',
    deactivated: (t, id) => `Na-deactivate na ang ${t} #${id}.`,
    useButtons: 'Gamitin ang button na "I-deactivate" o "Kanselahin" para tapusin ito.',
    invalidField: 'Hindi wasto ang field. Pumili ulit.',
    enterNewValue: label => `Ilagay ang bagong value para sa "${label}" (ipadala ang "wala" para i-clear):`,
    updated: 'Na-update na ang tala.',
    duplicate: label => `Mayroon nang ganitong value. Gumamit ng iba. ${label}:`,
    agencyMissing: 'Walang ganitong ahensya. Pakitingnan ang ID ng ahensya at subukan muli.',
    createDuplicate: 'Mayroon nang ganitong tala (halimbawa, parehong email o pangalan). Magsimula muli gamit ang bagong detalye.',
    recreate: 'Magsimula muli',
    created: (t, id) => `Naidagdag na ang ${t} #${id}.`,
    reenter: label => `Ilagay muli ang ${label}:`,
    reenterShort: 'Pakilagay muli:',
    cancelled: 'Nakansela. Ipadala ang "pamahalaan ang mga manggagawa", "pamahalaan ang mga employer", "pamahalaan ang mga ahensya" o "pamahalaan ang mga training center" para magsimula.',
    errors: {
      invalidField: () => 'Hindi wasto ang field. Pumili ulit.',
      nameRequired: () => 'Hindi puwedeng walang laman ang pangalan.',
      emailInvalid: () => 'Maglagay ng wastong email address.',
      emailRequired: () => 'Maglagay ng wastong email address; hindi ito puwedeng walang laman.',
      statusInvalid: () => 'Ang katayuan ay dapat "active" o "inactive".',
      agencyTypeInvalid: () => 'Ilagay ang taiwan o philippines.',
      genderInvalid: () => 'Ang kasarian ay dapat male o female.',
      agencyIdInvalid: () => 'Ang ID ng ahensya ay dapat positibong buong numero, o ipadala ang "wala" para i-clear.',
      tooLong: ({ max }) => `Masyadong mahaba. Hanggang ${max} character lang.`,
      employerTypeInvalid: () => 'Ang uri ng employer ay dapat home_care, factory, domestic_helper o other.',
      jobInvalid: () => 'Pumili ng isa: Kasambahay, Tagapag-alaga sa bahay, Technician sa pabrika, Manggagawa sa bukid, Caregiver sa institusyon.',
      agencyCreateInvalid: () => 'Maglagay ng pangalan at itakda ang uri ng ahensya sa taiwan o philippines.',
      tcCreateInvalid: () => 'Ilagay ang pangalan ng training center at wastong email address.',
      unsupportedType: () => 'Hindi sinusuportahan ang uri ng data na ito.',
    },
  },
};

function adminText(language) {
  const lang = ADMIN_TEXT[language] ? language : 'zh';
  const base = ADMIN_TEXT[lang];
  return {
    ...base,
    lang,
    jobName: value => JOB_PREFERENCES.find(job => job.zh === value)?.[lang] || value,
    error: error => (base.errors[error.key] || (() => error.key))(error.params || {}),
  };
}

const ADMIN_FIELD_COLUMNS = {
  worker: { name:'name',nationality:'nationality',gender:'gender',phone:'phone',email:'email',jobPreference:'job_preference',agencyId:'agency_id',status:'status',notes:'notes' },
  employer: { name:'name',contactName:'contact_name',phone:'phone',email:'email',address:'address',employerType:'employer_type',agencyId:'agency_id',status:'status',notes:'notes' },
  agency: { name:'name',agencyType:'agency_type',active:'active' },
  training_center: { name:'display_name',email:'email',active:'active' },
};

async function adminSession(lineUserId) {
  await query("DELETE FROM hr_line_admin_sessions WHERE line_user_id=$1 AND updated_at<NOW()-INTERVAL '1 day'", [lineUserId]);
  const rows = await query('SELECT session_data FROM hr_line_admin_sessions WHERE line_user_id=$1', [lineUserId]);
  return rows[0]?.session_data || null;
}

async function saveAdminSession(lineUserId, sessionData) {
  if (!sessionData) {
    await query('DELETE FROM hr_line_admin_sessions WHERE line_user_id=$1', [lineUserId]);
    return;
  }
  await query(`INSERT INTO hr_line_admin_sessions(line_user_id,session_data,updated_at)
    VALUES($1,$2::jsonb,NOW()) ON CONFLICT(line_user_id) DO UPDATE SET session_data=EXCLUDED.session_data,updated_at=NOW()`,
  [lineUserId, JSON.stringify(sessionData)]);
}

function adminQuickReply(text, actions) {
  return {
    type: 'text',
    text,
    quickReply: { items: actions.slice(0,13).map(({ label, text: actionText }) => ({
      type: 'action', action: { type: 'message', label: [...label].slice(0,20).join(''), text: actionText },
    })) },
  };
}

async function loadAdminRows(type, limit, offset) {
  const statements = {
    worker: `SELECT w.id,w.name,w.nationality,w.phone,w.email,w.job_preference,w.agency_id,w.status,a.name AS agency_name
      FROM hr_workers w LEFT JOIN hr_agencies a ON a.id=w.agency_id ORDER BY w.id DESC LIMIT $1 OFFSET $2`,
    employer: `SELECT e.id,e.name,e.contact_name,e.phone,e.email,e.employer_type,e.agency_id,e.status,a.name AS agency_name
      FROM hr_employers e LEFT JOIN hr_agencies a ON a.id=e.agency_id ORDER BY e.id DESC LIMIT $1 OFFSET $2`,
    agency: 'SELECT id,name,agency_type,country,active FROM hr_agencies ORDER BY id DESC LIMIT $1 OFFSET $2',
    training_center: `SELECT id,display_name,email,active,created_at FROM hr_members
      WHERE role='training_center' ORDER BY id DESC LIMIT $1 OFFSET $2`,
  };
  const counts = {
    worker: 'SELECT COUNT(*)::int AS count FROM hr_workers',
    employer: 'SELECT COUNT(*)::int AS count FROM hr_employers',
    agency: 'SELECT COUNT(*)::int AS count FROM hr_agencies',
    training_center: "SELECT COUNT(*)::int AS count FROM hr_members WHERE role='training_center'",
  };
  const [rows, count] = await Promise.all([
    query(statements[type], [limit, offset]),
    query(counts[type]),
  ]);
  return { rows, count: count[0]?.count || 0 };
}

async function loadAdminRecord(type, id) {
  const statements = {
    worker: `SELECT w.*,w.resume_profile->>'gender' AS gender,a.name AS agency_name FROM hr_workers w LEFT JOIN hr_agencies a ON a.id=w.agency_id WHERE w.id=$1`,
    employer: `SELECT e.*,a.name AS agency_name FROM hr_employers e LEFT JOIN hr_agencies a ON a.id=e.agency_id WHERE e.id=$1`,
    agency: 'SELECT * FROM hr_agencies WHERE id=$1',
    training_center: "SELECT id,display_name,email,line_user_id,active,created_at FROM hr_members WHERE id=$1 AND role='training_center'",
  };
  const rows = await query(statements[type], [id]);
  return rows[0] || null;
}

function formatAdminValue(key, value, tx) {
  if (value === null || value === undefined || value === '') return '—';
  if (key === 'status') return value === 'active' ? tx.active : tx.inactive;
  if (key === 'active') return value ? tx.active : tx.inactive;
  if (key === 'agencyType' || key === 'agency_type') return tx.agencyTypes[value] || value;
  if (key === 'employerType' || key === 'employer_type') return tx.employerTypes[value] || value;
  if (key === 'gender') return tx.genders[value] || value;
  if (key === 'job_preference') return tx.jobName(value);
  if (key === 'country') return tx.countries[value] || value;
  if (key === 'agencyId') return String(value);
  if (key === 'resume_profile') {
    const profile = { ...value };
    delete profile.photoDataUrl;
    delete profile.sourcePdfText;
    return JSON.stringify(profile);
  }
  return String(value);
}

const ADMIN_RECORD_NAME_KEY = { worker: 'name', employer: 'name', agency: 'name', training_center: 'display_name' };
const ADMIN_RECORD_FIELDS = {
  worker: ['nationality', 'gender', 'phone', 'email', 'job_preference', 'agency_name', 'status', 'notes'],
  employer: ['contact_name', 'phone', 'email', 'employer_type', 'address', 'agency_name', 'status', 'notes'],
  agency: ['agency_type', 'country', 'active'],
  training_center: ['email', 'line_user_id', 'active', 'created_at'],
};

function adminRecordText(type, record, tx) {
  const lines = [
    `${capitalize(tx.types[type])} #${record.id}`,
    `${tx.nameLabel[type]}${tx.colon}${record[ADMIN_RECORD_NAME_KEY[type]] || '—'}`,
  ];
  for (const key of ADMIN_RECORD_FIELDS[type]) {
    lines.push(`${tx.recordLabels[type][key]}${tx.colon}${formatAdminValue(key, record[key], tx)}`);
  }
  if (type === 'worker' && record.resume_profile && Object.keys(record.resume_profile).length) {
    lines.push(`${tx.resumeLabel}${tx.colon}${formatAdminValue('resume_profile', record.resume_profile, tx)}`);
  }
  return lines.join('\n').slice(0, 4900);
}

function adminDetailActions(type, id, tx) {
  return [
    { label: tx.edit, text: `adm-edit:${type}:${id}` },
    { label: tx.deactivate, text: `adm-del:${type}:${id}` },
    { label: tx.backToList, text: `adm-list:${type}:0` },
  ];
}

function adminCreatePrompt(type, key, tx, initial = false) {
  const hint = tx.hints[`${type}:${key}`];
  const label = hint ? plainAdminLabel(tx.fields[type][key]) : tx.fields[type][key];
  return adminQuickReply(tx.prompt(tx.types[type], label, hint, initial), [
    { label: tx.cancel, text: 'adm-cancel' },
  ]);
}

async function adminListReply(type, offset, tx) {
  const limit = 8;
  const { rows, count } = await loadAdminRows(type, limit, offset);
  const plural = tx.plural[type];
  if (!rows.length) {
    return adminQuickReply(tx.emptyList(plural), [
      { label: tx.add(plural), text: `adm-new:${type}` },
      { label: tx.backToMenuLong, text: 'adm-menu' },
    ]);
  }
  const items = rows.map(row => {
    const name = row.name || row.display_name || tx.unnamed;
    const status = row.status ? row.status === 'active' : row.active;
    return `${row.id}. ${name} · ${status ? tx.active : tx.inactive}`;
  });
  const actions = rows.map(row => ({
    label: `#${row.id} ${(row.name || row.display_name || '').slice(0, 13)}`,
    text: `adm-select:${type}:${row.id}`,
  }));
  actions.push({ label: tx.add(plural), text: `adm-new:${type}` });
  if (offset > 0) actions.push({ label: tx.prev, text: `adm-list:${type}:${Math.max(0, offset - limit)}` });
  if (offset + limit < count) actions.push({ label: tx.next, text: `adm-list:${type}:${offset + limit}` });
  actions.push({ label: tx.backToMenu, text: 'adm-menu' });
  return adminQuickReply(tx.listHeader({
    title: plural, count, from: offset + 1, to: Math.min(offset + rows.length, count), items: items.join('\n'),
  }), actions);
}

async function updateAdminRecord(type, id, key, rawValue) {
  if (!ADMIN_DATA_TYPES[type] || !ADMIN_DATA_TYPES[type].fields.includes(key)) throw new AdminInputError('invalidField');
  let value = rawValue;
  if (key === 'name' && !value.trim()) throw new AdminInputError('nameRequired');
  const column = ADMIN_FIELD_COLUMNS[type][key];
  if (type === 'training_center') {
    const sqlColumn = key === 'name' ? 'display_name' : key;
    if (key === 'email' && !/^\S+@\S+\.\S+$/.test(value.trim())) throw new AdminInputError('emailRequired');
    let normalized = value.trim();
    if (key === 'active') {
      normalized = parseAdminActive(value);
      if (normalized === null) throw new AdminInputError('statusInvalid');
    }
    const rows = await query(`UPDATE hr_members SET ${sqlColumn}=$2,updated_at=NOW() WHERE id=$1 AND role='training_center' RETURNING id`, [id, normalized]);
    return rows[0];
  }
  if (type === 'agency' && key === 'agencyType') {
    value = value.trim().toLowerCase();
    if (!['taiwan', 'philippines'].includes(value)) throw new AdminInputError('agencyTypeInvalid');
    const country = value === 'taiwan' ? '台灣' : '菲律賓';
    const rows = await query('UPDATE hr_agencies SET agency_type=$2,country=$3,updated_at=NOW() WHERE id=$1 RETURNING id', [id, value, country]);
    return rows[0];
  }
  if (type === 'worker' && key === 'gender') {
    const normalized = parseAdminGender(value);
    if (!normalized) throw new AdminInputError('genderInvalid');
    const rows = await query(`UPDATE hr_workers SET resume_profile=jsonb_set(COALESCE(resume_profile,'{}'::jsonb),'{gender}',to_jsonb($2::text),true),updated_at=NOW() WHERE id=$1 RETURNING id`, [id, normalized]);
    return rows[0];
  }
  if (key === 'status') {
    const active = parseAdminActive(value);
    if (active === null) throw new AdminInputError('statusInvalid');
    const status = active ? 'active' : 'inactive';
    const statement = type === 'worker'
      ? `WITH changed AS (UPDATE hr_workers SET status=$2,updated_at=NOW() WHERE id=$1 RETURNING id),
        disabled AS (UPDATE hr_members SET active=FALSE,updated_at=NOW() FROM changed WHERE changed.id=hr_members.worker_id AND $2='inactive') SELECT id FROM changed`
      : `WITH changed AS (UPDATE hr_employers SET status=$2,updated_at=NOW() WHERE id=$1 RETURNING id),
        disabled AS (UPDATE hr_members SET active=FALSE,updated_at=NOW() FROM changed WHERE changed.id=hr_members.employer_id AND $2='inactive') SELECT id FROM changed`;
    const rows = await query(statement, [id, status]);
    return rows[0];
  }
  if (type === 'agency' && key === 'active') {
    const active = parseAdminActive(value);
    if (active === null) throw new AdminInputError('statusInvalid');
    const rows = await query(`WITH changed AS (UPDATE hr_agencies SET active=$2,updated_at=NOW() WHERE id=$1 RETURNING id),
        disabled AS (UPDATE hr_members SET active=FALSE,updated_at=NOW() FROM changed WHERE changed.id=hr_members.agency_id AND $2=FALSE) SELECT id FROM changed`, [id, active]);
    return rows[0];
  }
  if (key === 'agencyId') {
    const agencyId = value.trim() && !isAdminClear(value) ? Number(value) : null;
    if (agencyId !== null && (!Number.isSafeInteger(agencyId) || agencyId < 1)) throw new AdminInputError('agencyIdInvalid');
    const rows = await query(`UPDATE ${ADMIN_DATA_TYPES[type].table} SET ${column}=$2,updated_at=NOW() WHERE id=$1 RETURNING id`, [id, agencyId]);
    return rows[0];
  }
  if (key === 'email') {
    const email = value.trim().toLowerCase();
    if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new AdminInputError('emailInvalid');
    const rows = await query(`UPDATE ${ADMIN_DATA_TYPES[type].table} SET ${column}=$2,updated_at=NOW() WHERE id=$1 RETURNING id`, [id, email]);
    return rows[0];
  }
  if (type === 'worker' && key === 'jobPreference' && value.trim()) value = parseJobPreference(value) || value;
  if (type === 'employer' && key === 'employerType') value = value.trim().toLowerCase();
  const limits = { name: 160, display_name: 160, nationality: 80, phone: 50, email: 254, job_preference: 120, notes: 2000, contact_name: 120, address: 300, employer_type: 30 };
  const max = limits[column] || 500;
  if (value.length > max) throw new AdminInputError('tooLong', { max });
  if (type === 'employer' && key === 'employerType' && !['home_care', 'factory', 'domestic_helper', 'other'].includes(value)) {
    throw new AdminInputError('employerTypeInvalid');
  }
  const rows = await query(`UPDATE ${ADMIN_DATA_TYPES[type].table} SET ${column}=$2,updated_at=NOW() WHERE id=$1 RETURNING id`, [id, value]);
  return rows[0];
}

async function deactivateAdminRecord(type, id) {
  const statements = {
    worker: `WITH changed AS (
      UPDATE hr_workers SET status='inactive',updated_at=NOW() WHERE id=$1 RETURNING id
    ), disabled AS (
      UPDATE hr_members SET active=FALSE,updated_at=NOW() FROM changed WHERE hr_members.worker_id=changed.id
    ) SELECT id FROM changed`,
    employer: `WITH changed AS (
      UPDATE hr_employers SET status='inactive',updated_at=NOW() WHERE id=$1 RETURNING id
    ), disabled AS (
      UPDATE hr_members SET active=FALSE,updated_at=NOW() FROM changed WHERE hr_members.employer_id=changed.id
    ) SELECT id FROM changed`,
    agency: `WITH changed AS (
      UPDATE hr_agencies SET active=FALSE,updated_at=NOW() WHERE id=$1 RETURNING id
    ), disabled AS (
      UPDATE hr_members SET active=FALSE,updated_at=NOW() FROM changed WHERE hr_members.agency_id=changed.id
    ) SELECT id FROM changed`,
    training_center: "UPDATE hr_members SET active=FALSE,updated_at=NOW() WHERE id=$1 AND role='training_center' RETURNING id",
  };
  const rows = await query(statements[type], [id]);
  return rows[0];
}

async function createAdminRecord(type, values) {
  if (type === 'worker') {
    if (!values.name?.trim()) throw new AdminInputError('nameRequired');
    const job = parseJobPreference(values.jobPreference);
    if (!job) throw new AdminInputError('jobInvalid');
    const gender = parseAdminGender(values.gender);
    if (!gender) throw new AdminInputError('genderInvalid');
    const created = await query(`INSERT INTO hr_workers(name,nationality,phone,email,job_preference,notes,resume_profile)
      VALUES($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING id`,
    [values.name.trim(), values.nationality || '', values.phone || '', values.email || '', job, values.notes || '', JSON.stringify({ gender })]);
    const category = job === '家庭看護' || job === '家庭幫傭' ? 'CT' : job === '工廠技術工' ? 'SW' : job === '農工' ? 'FM' : 'CG';
    const sex = gender === 'male' ? 'M' : 'F';
    const sequence = String(created[0].id).padStart(3, '0');
    const referenceNo = `${category}${sex}-${category === 'CT' ? sequence : `${String(new Date().getFullYear()).slice(-2)}${sequence}`}`;
    await query("UPDATE hr_workers SET resume_profile=jsonb_set(resume_profile,'{referenceNo}',to_jsonb($2::text),true) WHERE id=$1", [created[0].id, referenceNo]);
    await insertWorkerDocuments(pool, created[0].id, { gender });
    return created;
  }
  if (type === 'employer') {
    if (!values.name?.trim()) throw new AdminInputError('nameRequired');
    return query(`INSERT INTO hr_employers(name,contact_name,phone,email,address,notes,employer_type)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [values.name.trim(), values.contactName || '', values.phone || '', values.email || '', values.address || '', values.notes || '', values.employerType || 'other']);
  }
  if (type === 'agency') {
    if (!values.name?.trim() || !['taiwan', 'philippines'].includes(values.agencyType)) throw new AdminInputError('agencyCreateInvalid');
    const country = values.agencyType === 'taiwan' ? '台灣' : '菲律賓';
    return query('INSERT INTO hr_agencies(name,agency_type,country) VALUES($1,$2,$3) RETURNING id', [values.name.trim(), values.agencyType, country]);
  }
  if (type === 'training_center') {
    const email = String(values.email || '').trim().toLowerCase();
    if (!values.name?.trim() || !/^\S+@\S+\.\S+$/.test(email)) throw new AdminInputError('tcCreateInvalid');
    return query(`INSERT INTO hr_members(display_name,email,role,active)
      VALUES($1,$2,'training_center',TRUE) RETURNING id`, [values.name.trim(), email]);
  }
  throw new AdminInputError('unsupportedType');
}

const ADMIN_CREATE_FIELDS = {
  worker: ['name', 'nationality', 'gender', 'phone', 'email', 'jobPreference', 'notes'],
  employer: ['name', 'contactName', 'phone', 'email', 'address', 'employerType', 'notes'],
  agency: ['name', 'agencyType'],
  training_center: ['name', 'email'],
};
const ADMIN_CREATE_MAX_LENGTH = { name: 160, nationality: 80, gender: 40, phone: 50, email: 254, jobPreference: 120, notes: 2000, contactName: 120, address: 300, employerType: 30, agencyType: 30 };

async function handleAdminManagement(lineUserId, text, principal, language = 'zh') {
  if (principal?.role !== 'admin') return null;
  const tx = adminText(language);
  const command = normalizeAdminCommand(text.trim());
  const typeNames = new Map(Object.entries({
    '管理工作者': 'worker', '管理雇主': 'employer', '管理仲介': 'agency', '管理訓練中心': 'training_center',
    'manage workers': 'worker', 'manage employers': 'employer', 'manage agencies': 'agency',
    'training centers': 'training_center', 'manage training centers': 'training_center',
    'pamahalaan ang mga manggagawa': 'worker', 'pamahalaan ang mga employer': 'employer',
    'pamahalaan ang mga ahensya': 'agency', 'pamahalaan ang mga training center': 'training_center',
  }));
  const selectedType = typeNames.get(command) || typeNames.get(command.toLowerCase());
  if (selectedType) {
    await saveAdminSession(lineUserId, { type: selectedType, mode: 'list' });
    return adminListReply(selectedType, 0, tx);
  }
  if (command === 'adm-menu') {
    await saveAdminSession(lineUserId, null);
    return adminQuickReply(tx.menuTitle, ADMIN_TYPES.map(type => ({ label: tx.menu[type][0], text: tx.menu[type][1] })));
  }

  const types = '(worker|employer|agency|training_center)';
  const listMatch = command.match(new RegExp(`^adm-list:${types}:(\\d+)$`));
  if (listMatch) {
    const [, type, offset] = listMatch;
    await saveAdminSession(lineUserId, { type, mode: 'list', offset: Number(offset) });
    return adminListReply(type, Number(offset), tx);
  }
  const selectMatch = command.match(new RegExp(`^adm-select:${types}:(\\d+)$`));
  if (selectMatch) {
    const [, type, id] = selectMatch;
    const record = await loadAdminRecord(type, Number(id));
    if (!record) return adminQuickReply(tx.notFound, [{ label: tx.backToList, text: `adm-list:${type}:0` }]);
    await saveAdminSession(lineUserId, { type, mode: 'detail', id: Number(id) });
    return adminQuickReply(adminRecordText(type, record, tx), adminDetailActions(type, id, tx));
  }
  const createMatch = command.match(new RegExp(`^adm-new:${types}$`));
  if (createMatch) {
    const [, type] = createMatch;
    await saveAdminSession(lineUserId, { type, mode: 'create', step: 0, values: {} });
    return adminCreatePrompt(type, ADMIN_CREATE_FIELDS[type][0], tx, true);
  }
  const editMatch = command.match(new RegExp(`^adm-edit:${types}:(\\d+)$`));
  if (editMatch) {
    const [, type, id] = editMatch;
    const record = await loadAdminRecord(type, Number(id));
    if (!record) return adminQuickReply(tx.notFoundShort, [{ label: tx.backToList, text: `adm-list:${type}:0` }]);
    const actions = ADMIN_DATA_TYPES[type].fields.map(key => ({
      label: plainAdminLabel(tx.fields[type][key]), text: `adm-field:${type}:${id}:${key}`,
    }));
    actions.push({ label: tx.backToRecord, text: `adm-select:${type}:${id}` });
    await saveAdminSession(lineUserId, { type, mode: 'edit', id: Number(id) });
    return adminQuickReply(tx.chooseField(tx.types[type]), actions);
  }
  const deleteMatch = command.match(new RegExp(`^adm-del:${types}:(\\d+)$`));
  if (deleteMatch) {
    const [, type, id] = deleteMatch;
    await saveAdminSession(lineUserId, { type, mode: 'confirm_delete', id: Number(id) });
    return adminQuickReply(tx.confirmDeactivate(tx.types[type], id), [
      { label: tx.confirmButton, text: `adm-confirm-del:${type}:${id}` },
      { label: tx.cancel, text: `adm-select:${type}:${id}` },
    ]);
  }
  const fieldMatch = command.match(new RegExp(`^adm-field:${types}:(\\d+):([A-Za-z]+)$`));
  if (fieldMatch) {
    const [, type, id, key] = fieldMatch;
    if (!ADMIN_DATA_TYPES[type].fields.includes(key)) return adminQuickReply(tx.invalidField, [{ label: tx.backToRecord, text: `adm-select:${type}:${id}` }]);
    await saveAdminSession(lineUserId, { type, mode: 'edit_value', id: Number(id), key });
    return tx.enterNewValue(tx.fields[type][key]);
  }
  if (command === 'adm-cancel') {
    await saveAdminSession(lineUserId, null);
    return tx.cancelled;
  }
  const confirmDelete = command.match(new RegExp(`^adm-confirm-del:${types}:(\\d+)$`));
  if (confirmDelete) {
    const [, type, id] = confirmDelete;
    const pending = await adminSession(lineUserId);
    if (pending?.mode !== 'confirm_delete' || pending.type !== type || Number(pending.id) !== Number(id)) {
      return adminQuickReply(tx.staleConfirm, [{ label: tx.backToList, text: `adm-list:${type}:0` }]);
    }
    const result = await deactivateAdminRecord(type, Number(id));
    await saveAdminSession(lineUserId, { type, mode: 'list' });
    return result ? tx.deactivated(tx.types[type], id) : tx.notFoundShort;
  }

  const session = await adminSession(lineUserId);
  if (!session) return null;
  if (session.mode === 'edit_value') {
    const value = isAdminClear(command) ? '' : command;
    let updated;
    try { updated = await updateAdminRecord(session.type, session.id, session.key, value); }
    catch (error) {
      if (error?.code === '23505') return tx.duplicate(tx.fields[session.type][session.key]);
      if (error?.code === '23503') return tx.agencyMissing;
      if (error instanceof AdminInputError) return `${tx.error(error)}\n${tx.reenterShort}`;
      throw error;
    }
    if (!updated) return adminQuickReply(tx.notFoundRemoved, [{ label: tx.backToListShort, text: `adm-list:${session.type}:0` }]);
    await saveAdminSession(lineUserId, { type: session.type, mode: 'detail', id: session.id });
    const record = await loadAdminRecord(session.type, session.id);
    return adminQuickReply(`${tx.updated}\n${adminRecordText(session.type, record, tx)}`, adminDetailActions(session.type, session.id, tx));
  }
  if (session.mode === 'confirm_delete') return tx.useButtons;
  if (session.mode === 'create') {
    const fields = ADMIN_CREATE_FIELDS[session.type];
    const key = fields[session.step];
    if (!key) throw new Error('invalid_admin_create_state');
    const values = { ...session.values, [key]: isAdminClear(command) ? '' : command };
    const maxLength = ADMIN_CREATE_MAX_LENGTH[key] || 500;
    if (values[key].length > maxLength) {
      return adminQuickReply(`${tx.errors.tooLong({ max: maxLength })}\n${tx.reenterShort}`, [{ label: tx.cancel, text: 'adm-cancel' }]);
    }
    if (key === 'agencyType' || key === 'employerType') values[key] = values[key].trim().toLowerCase();
    if (key === 'name' && !values[key].trim()) return adminCreatePrompt(session.type, key, tx);
    if (key === 'email' && values[key] && !/^\S+@\S+\.\S+$/.test(values[key])) return adminCreatePrompt(session.type, key, tx);
    if (session.type === 'worker' && key === 'jobPreference') {
      const job = parseJobPreference(values[key]);
      if (!job) return adminCreatePrompt(session.type, key, tx);
      values[key] = job;
    }
    if (session.type === 'worker' && key === 'gender' && !parseAdminGender(values[key])) return adminCreatePrompt(session.type, key, tx);
    if (session.type === 'employer' && key === 'employerType' && !['home_care', 'factory', 'domestic_helper', 'other'].includes(values[key])) return adminCreatePrompt(session.type, key, tx);
    if (session.type === 'agency' && key === 'agencyType' && !['taiwan', 'philippines'].includes(values[key])) return adminCreatePrompt(session.type, key, tx);
    if (session.step + 1 < fields.length) {
      const next = fields[session.step + 1];
      await saveAdminSession(lineUserId, { ...session, step: session.step + 1, values });
      return adminCreatePrompt(session.type, next, tx);
    }
    await saveAdminSession(lineUserId, { ...session, values });
    let created;
    try { created = await createAdminRecord(session.type, values); }
    catch (error) {
      if (error?.code === '23505') return adminQuickReply(tx.createDuplicate, [{ label: tx.recreate, text: `adm-new:${session.type}` }, { label: tx.backToList, text: `adm-list:${session.type}:0` }]);
      if (error instanceof AdminInputError) {
        return adminQuickReply(`${tx.error(error)}\n${tx.reenter(plainAdminLabel(tx.fields[session.type][key]))}`, [{ label: tx.cancel, text: 'adm-cancel' }]);
      }
      throw error;
    }
    await saveAdminSession(lineUserId, { type: session.type, mode: 'list' });
    return tx.created(tx.types[session.type], created[0].id);
  }
  return null;
}

const ROLE_MENU_FEATURES = {
  zh: {
    worker: ['我的案件／案件進度', '我的文件', '我的仲介', '我的雇主', '待辦事項', '前往網頁版'],
    employer: ['我的工作者', '前往網頁版'],
    philippines_agency: ['我的工作者', '工作者訓練進度', '工作者證照進度', '工作者配對進度', '工作者雇主進度', '前往網頁版'],
    taiwan_agency: ['我的雇主', '雇主合約進度', '雇主配對進度', '配對工作者進度', '代辦事項', '前往網頁版'],
    training_center: ['我的學生', '學生訓練進度', '學生證照進度', '學生配對進度', '學生仲介進度', '前往網頁版'],
    admin: ['管理工作者', '管理雇主', '管理仲介', '管理訓練中心', '管理案件進度', '前往網頁版'],
  },
  en: {
    worker: ['My case / case progress', 'My personal documents', 'My agency', 'My employer', 'To-do list', 'Go to web login'],
    employer: ['My worker', 'Go to web login'],
    philippines_agency: ['My workers', "Workers' training schedule", "Workers' licence progress", "Workers' match progress", "Workers' employer progress", 'Go to web login'],
    taiwan_agency: ['My employers', "Employer's contract schedule", "Employer order matching progress", "Matched workers' progress", 'To-do list', 'Go to web login'],
    training_center: ['My students', "Students' training schedule", "Students' licence progress", "Students' match progress", "Students' agency progress", 'Go to web login'],
    admin: ['Manage workers', 'Manage employers', 'Manage agencies', 'Manage training centers', 'Manage case progress', 'Go to web login'],
  },
  tl: {
    worker: ['Aking kaso / progreso ng kaso', 'Aking mga personal na dokumento', 'Aking ahensya', 'Aking employer', 'Listahan ng mga gawain', 'Mag-login sa website'],
    employer: ['Aking manggagawa', 'Mag-login sa website'],
    philippines_agency: ['Aking mga manggagawa', 'Iskedyul ng pagsasanay ng manggagawa', 'Progreso ng lisensya ng manggagawa', 'Progreso ng pagtutugma ng manggagawa', 'Progreso ng employer ng manggagawa', 'Mag-login sa website'],
    taiwan_agency: ['Aking mga employer', 'Iskedyul ng kontrata ng employer', 'Progreso ng pagtutugma ng order ng employer', 'Progreso ng mga naitugmang manggagawa', 'Listahan ng mga gawain', 'Mag-login sa website'],
    training_center: ['Aking mga estudyante', 'Iskedyul ng pagsasanay ng estudyante', 'Progreso ng lisensya ng estudyante', 'Progreso ng pagtutugma ng estudyante', 'Progreso ng ahensya ng estudyante', 'Mag-login sa website'],
    admin: ['Pamahalaan ang mga manggagawa', 'Pamahalaan ang mga employer', 'Pamahalaan ang mga ahensya', 'Pamahalaan ang mga training center', 'Pamahalaan ang progreso ng kaso', 'Mag-login sa website'],
  },
};

function roleMenuFeatures(principal, language) {
  if (!principal) return [];
  const role = principal.role === 'agency'
    ? principal.agency_type === 'philippines' ? 'philippines_agency' : 'taiwan_agency'
    : principal.role;
  return ROLE_MENU_FEATURES[language]?.[role] || [];
}

async function getPreferredLanguage(lineUserId) {
  if (!lineUserId) return null;
  const rows = await query('SELECT preferred_language FROM hr_line_member_settings WHERE line_user_id=$1', [lineUserId]);
  return rows[0]?.preferred_language || null;
}

async function setPreferredLanguage(lineUserId, language) {
  await query(`INSERT INTO hr_line_member_settings(line_user_id,preferred_language)
    VALUES($1,$2) ON CONFLICT(line_user_id) DO UPDATE
    SET preferred_language=EXCLUDED.preferred_language,updated_at=NOW()`, [lineUserId, language]);
}

function detectedLanguage(text) {
  if (/[\u3400-\u9fff]/.test(text)) return 'zh';
  return 'en';
}

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

// 文件屬於工人（不需要案件）。工人看自己的；雇主只看已與自己建案的工人；仲介看所屬工人與所屬雇主案件中的工人。
async function visibleRequirements(principal) {
  let where, params;
  if (principal.role === 'admin') { where = 'TRUE'; params = []; }
  else if (principal.role === 'worker') { where = 'w.id=$1'; params = [principal.worker_id]; }
  else if (principal.role === 'employer') { where = 'EXISTS(SELECT 1 FROM hr_cases c WHERE c.worker_id=w.id AND c.employer_id=$1)'; params = [principal.employer_id]; }
  else if (principal.role === 'agency') { where = '(w.agency_id=$1 OR EXISTS(SELECT 1 FROM hr_cases c JOIN hr_employers e ON e.id=c.employer_id WHERE c.worker_id=w.id AND e.agency_id=$1))'; params = [principal.agency_id]; }
  else return [];
  return query(`SELECT d.name,d.status,d.review_reason,w.name AS worker_name
    FROM hr_worker_documents d JOIN hr_workers w ON w.id=d.worker_id
    WHERE ${where} AND d.required AND d.applicable AND d.status<>'approved'
    ORDER BY CASE d.status WHEN 'returned' THEN 0 WHEN 'missing' THEN 1 ELSE 2 END,d.entry_gate DESC,w.id,d.id
    LIMIT 12`, params);
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

function caseReply(cases, principal, language) {
  const labels = {
    zh: { empty: '目前沒有與此會員帳號關聯的案件。', admin: '人力系統案件：', member: '與你帳號相關的案件：', status: STATUS_LABELS, stage: STAGE_LABELS },
    en: { empty: 'There are no cases linked to this account.', admin: 'HR cases:', member: 'Cases linked to your account:', status: {open:'In progress',on_hold:'On hold',closed:'Closed'}, stage: {intake:'Intake',matching:'Matching',documents:'Document processing',medical_training:'Medical & training',application:'Application',arrangement:'Placement',completed:'Completed'} },
    tl: { empty: 'Walang kasong naka-link sa account na ito.', admin: 'Mga kaso sa HR:', member: 'Mga kasong naka-link sa iyong account:', status: {open:'Isinasagawa',on_hold:'Naka-hold',closed:'Sarado'}, stage: {intake:'Pagtanggap ng kahilingan',matching:'Pagtutugma',documents:'Pagproseso ng dokumento',medical_training:'Medical at pagsasanay',application:'Aplikasyon',arrangement:'Paghahanda',completed:'Kumpleto'} },
  }[language];
  if (!cases.length) return labels.empty;
  const header = principal.role === 'admin' ? labels.admin : labels.member;
  return [header, ...cases.map(item => {
    const status = labels.status[item.status] || item.status;
    const stage = labels.stage[item.stage] || item.stage;
    if (principal.role === 'worker') return `${item.case_number}｜${item.employer_name}｜${stage}・${status}`;
    if (principal.role === 'employer') return `${item.case_number}｜${item.worker_name}｜${stage}・${status}`;
    if (principal.role === 'agency') return `${item.case_number}｜${item.worker_name}／${item.employer_name}｜${stage}・${status}`;
    return `${item.case_number}｜${item.worker_name}／${item.employer_name}｜${stage}・${status}`;
  })].join('\n');
}

function helpText(principal = null, language = 'zh') {
  const guest = {
    zh: '克雷迅人力仲介 LINE 服務。請先使用 LINE 登入會員網站並申請會員類型，核准後即可使用對應功能。輸入「語言」切換中文、英文或菲律賓文。',
    en: 'Kolecion HR LINE service. Sign in to the member website with LINE and submit a membership request. After approval, you can use the features for your member type. Send “language” to choose Chinese, English, or Filipino.',
    tl: 'Kolecion HR LINE service. Mag-sign in sa member website gamit ang LINE at magsumite ng membership request. Pagkatapos maaprubahan, magagamit mo ang mga feature para sa uri ng iyong membership. Ipadala ang “language” upang pumili ng Chinese, English, o Filipino.',
  }[language];
  if (!principal) return guest;
  if (!principal.role) return identityReply(principal, language);

  const memberType = memberTypeName(principal, language);
  const features = roleMenuFeatures(principal, language);
  const lineCommands = {
    zh: 'LINE 查詢：輸入「案件」、「文件」、「待辦」或「體檢／訓練」查詢帳號可存取的進度。',
    en: 'LINE queries: send “cases”, “documents”, “tasks”, or “medical / training” to check progress your account can access.',
    tl: 'Mga query sa LINE: ipadala ang “cases”, “documents”, “tasks”, o “medical / training” upang tingnan ang progreso na maa-access ng iyong account.',
  }[language];
  const scopedLineCommands = principal.role === 'training_center'
    ? {
      zh: 'LINE 查詢：此會員類型目前沒有案件資料查詢權限。',
      en: 'LINE queries: this member type currently has no access to case information.',
      tl: 'Mga query sa LINE: walang access sa impormasyon ng kaso ang uri ng miyembrong ito sa ngayon.',
    }[language]
    : lineCommands;
  const heading = {
    zh: `會員類型：${memberType}\n此類型圖文選單功能：`,
    en: `Member type: ${memberType}\nFeatures in your role menu:`,
    tl: `Uri ng miyembro: ${memberType}\nMga feature sa menu para sa iyong uri:`,
  }[language];
  const commands = {
    zh: '輸入「我的身分」查看會員資料；輸入「語言」切換語言。',
    en: 'Send “my identity” to view your member profile, or “language” to change the reply language.',
    tl: 'Ipadala ang “aking pagkakakilanlan” upang makita ang iyong profile, o “language” upang palitan ang wika ng mga sagot.',
  }[language];
  return [heading, ...features.map(item => `・${item}`), scopedLineCommands, commands].join('\n');
}

function websiteBase() {
  const origin = [process.env.APP_ORIGIN, process.env.NEXTAUTH_URL]
    .map(value => { try { return new URL(value).origin; } catch { return ''; } })
    .find(value => value && !/localhost|127\.0\.0\.1/i.test(value)) || 'https://kolecion.cc';
  return origin;
}

function memberWebsiteReply(language = 'zh', isNewMember = false) {
  const url = `${websiteBase()}/hr/login${isNewMember ? '?register=1' : ''}`;
  const copy = {
    zh: isNewMember
      ? ['註冊克雷迅人力仲介會員', '這個 LINE 帳號尚未註冊。使用 LINE 登入即可確認帳號，接著選擇會員類型並送交管理者審核。', '使用 LINE 立即註冊']
      : ['克雷迅人力仲介會員網站', '開啟人力仲介會員網站，使用 LINE 登入後查看與帳號關聯的案件及資料。', '開啟會員網站'],
    en: isNewMember
      ? ['Register for Kolecion HR', 'This LINE account is not registered yet. Continue with LINE to verify your account, then choose a member type to submit for review.', 'Register with LINE']
      : ['Kolecion HR member website', 'Open the HR member website and sign in with LINE to view the cases and information linked to your account.', 'Open member website'],
    tl: isNewMember
      ? ['Magparehistro sa Kolecion HR', 'Hindi pa rehistrado ang LINE account na ito. Magpatuloy gamit ang LINE, pagkatapos ay pumili ng uri ng miyembro at isumite para sa pagsusuri.', 'Magparehistro gamit ang LINE']
      : ['Website ng miyembro ng Kolecion HR', 'Buksan ang HR member website at mag-sign in gamit ang LINE upang makita ang mga kasong naka-link sa iyong account.', 'Buksan ang member website'],
  }[language];
  const [title, description, buttonLabel] = copy;
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
          { type: 'button', style: 'primary', color: '#176b54', action: { type: 'uri', label: buttonLabel, uri: url } },
        ],
      },
    },
  };
}

function languagePicker(language) {
  const text = language === 'en'
    ? 'Choose your preferred reply language. You can change it at any time.'
    : language === 'tl'
      ? 'Piliin ang wikang gagamitin sa mga sagot. Maaari mo itong baguhin anumang oras.'
      : '請選擇 LINE 回覆語言；之後可隨時再次輸入「語言」切換。';
  return {
    type: 'text',
    text,
    quickReply: {
      items: Object.entries(LANGUAGE_NAMES).map(([code, label]) => ({
        type: 'action',
        action: { type: 'message', label, text: `切換語言:${code}` },
      })),
    },
  };
}

function selectedLanguage(text) {
  const normalized = text.trim().toLowerCase();
  if (/^(切換語言\s*[:：]\s*zh|中文|繁體中文|chinese)$/.test(normalized)) return 'zh';
  if (/^(切換語言\s*[:：]\s*en|english|英文)$/.test(normalized)) return 'en';
  if (/^(切換語言\s*[:：]\s*tl|filipino|tagalog|菲律賓文|菲律賓語)$/.test(normalized)) return 'tl';
  return null;
}

function languageUpdated(language) {
  if (language === 'en') return 'Language updated to English. Future replies will use this language.';
  if (language === 'tl') return 'Napalitan na ang wika sa Filipino. Gagamitin ito sa mga susunod na sagot.';
  return '已切換為中文，之後的回覆會使用中文。';
}

function memberTypeName(principal, language) {
  const names = {
    zh: { admin: '管理者', worker: '工作者', employer: '雇主', training_center: '訓練中心' },
    en: { admin: 'Administrator', worker: 'Worker', employer: 'Employer', training_center: 'Training center' },
    tl: { admin: 'Administrator', worker: 'Manggagawa', employer: 'Employer', training_center: 'Sentro ng pagsasanay' },
  }[language];
  if (principal.role === 'agency') {
    const philippines = principal.agency_type === 'philippines';
    if (language === 'zh') return philippines ? '菲律賓仲介' : '台灣仲介';
    if (language === 'en') return philippines ? 'Philippines agency' : 'Taiwan agency';
    return philippines ? 'Ahensya sa Pilipinas' : 'Ahensya sa Taiwan';
  }
  return names[principal.role] || principal.role;
}

function memberMenuReply(principal, language) {
  const name = memberTypeName(principal, language);
  return language === 'en'
    ? `Member type confirmed: ${name}. Your LINE rich menu has been updated.`
    : language === 'tl'
      ? `Nakumpirma ang uri ng miyembro: ${name}. Na-update na ang LINE rich menu mo.`
      : `已確認會員類型：${name}，LINE 圖文選單已切換。`;
}

function identityReply(principal, language) {
  const pendingRoleNames = {
    zh: { worker: '工作者', employer: '雇主', agency: '仲介', training_center: '訓練中心' },
    en: { worker: 'Worker', employer: 'Employer', agency: 'Agency', training_center: 'Training center' },
    tl: { worker: 'Manggagawa', employer: 'Employer', agency: 'Ahensya', training_center: 'Sentro ng pagsasanay' },
  }[language];
  if (!principal) {
    return language === 'en'
      ? 'Your LINE account is not linked to a member profile yet. Sign in to the member website and submit a membership request to see your member type and available features.'
      : language === 'tl'
        ? 'Hindi pa naka-link ang LINE account mo sa profile ng miyembro. Mag-sign in sa member website at magsumite ng membership request upang makita ang uri ng miyembro at mga available na feature.'
        : '這個 LINE 帳號尚未連結會員資料。請先登入會員網站並申請會員，核准後即可查看會員類型與可用功能。';
  }
  if (!principal.role) {
    const requestedType = pendingRoleNames[principal.requested_role];
    return language === 'en'
      ? `Membership status: awaiting administrator review${requestedType ? ` (${requestedType})` : ''}. Member features will be available after approval. You can still use the member website and change your LINE reply language.`
      : language === 'tl'
        ? `Katayuan ng membership: naghihintay ng pagsusuri ng administrator${requestedType ? ` (${requestedType})` : ''}. Magiging available ang mga feature pagkatapos maaprubahan. Maaari mo pa ring gamitin ang member website at palitan ang wika ng mga sagot sa LINE.`
        : `會員狀態：等待管理者審核${requestedType ? `（申請類型：${requestedType}）` : ''}。核准後即可使用會員功能；目前仍可使用會員網站及切換 LINE 回覆語言。`;
  }

  const role = memberTypeName(principal, language);
  const items = roleMenuFeatures(principal, language);
  const heading = language === 'en' ? 'Your member profile' : language === 'tl' ? 'Profile ng iyong membership' : '你的會員身分';
  const typeLabel = language === 'en' ? 'Member type' : language === 'tl' ? 'Uri ng miyembro' : '會員類型';
  const website = language === 'en'
    ? 'Open the member website to use your role-specific workspace.'
    : language === 'tl'
      ? 'Buksan ang member website upang gamitin ang workspace para sa iyong uri ng miyembro.'
      : '登入會員網站可使用對應身分的工作區。';
  const menuHeading = language === 'en' ? 'Features in your role menu' : language === 'tl' ? 'Mga feature sa menu para sa iyong uri' : '此類型圖文選單功能';
  return [
    heading,
    `${typeLabel}：${role}`,
    menuHeading,
    ...items.map(item => `・${item}`),
    website,
    language === 'en' ? 'Send “language” to change the reply language.' : language === 'tl' ? 'Ipadala ang “language” upang palitan ang wika ng mga sagot.' : '輸入「語言」可切換回覆語言。',
  ].join('\n');
}

export async function replyForHrLineEvent(event) {
  if (event?.type === 'follow') {
    const lineUserId = event.source?.userId;
    const language = await getPreferredLanguage(lineUserId) || 'zh';
    const principal = lineUserId ? await getHrPrincipal({ user: { lineUserId, name: 'LINE 會員' } }) : null;
    await syncLineRichMenu(lineUserId, principal);
    return principal?.role ? memberMenuReply(principal, language) : memberWebsiteReply(language, true);
  }
  if (event?.type !== 'message' || event?.message?.type !== 'text') return null;
  const text = String(event.message.text || '').trim().replace(/\s+/g, ' ');
  const lower = text.toLowerCase();
  const lineUserId = event.source?.userId;
  const preference = await getPreferredLanguage(lineUserId);
  const language = preference || detectedLanguage(text);
  if (event.source?.type !== 'user') return language === 'en'
    ? 'For privacy, case queries are available only in a one-to-one chat with the official LINE account.'
    : language === 'tl'
      ? 'Para sa privacy, ang mga tanong tungkol sa kaso ay para lamang sa one-to-one chat sa opisyal na LINE account.'
      : '為保護會員資料，案件查詢只在 LINE 官方帳號的一對一聊天中提供。';
  if (/^(語言|語言設定|切換語言|language|languages|change language|switch language|wika)$/i.test(text)) return languagePicker(language);

  const principal = lineUserId ? await getHrPrincipal({ user: { lineUserId, name: 'LINE 會員' } }) : null;
  await syncLineRichMenu(lineUserId, principal);
  const chosenLanguage = selectedLanguage(text);
  if (chosenLanguage) {
    await setPreferredLanguage(lineUserId, chosenLanguage);
    return languageUpdated(chosenLanguage);
  }
  const activeLanguage = preference || language;
  if (/^(我的身分|我的身份|會員身分|會員身份|my identity|my membership|my member type|who am i|aking pagkakakilanlan|uri ng miyembro)$/i.test(text)) {
    return identityReply(principal, activeLanguage);
  }
  if (principal?.role === 'admin') {
    const adminReply = await handleAdminManagement(lineUserId,text,principal,activeLanguage);
    if (adminReply !== null) return adminReply;
  }
  if (!principal) return memberWebsiteReply(activeLanguage, true);
  if (['測試','test','ping'].includes(lower)) return helpText(principal, activeLanguage);
  if (/會員網站|人力網站|網站|登入|註冊|加入會員|website|register|sign ?in|portal/.test(lower)) return memberWebsiteReply(activeLanguage, false);
  if (/會員類型|會員身分|我的類型|member type|membership type|my role|rich menu|圖文選單|選單|^menu$/.test(lower)) {
    if (!principal.role) return activeLanguage === 'en'
      ? 'Your member type request is awaiting administrator review.'
      : activeLanguage === 'tl'
        ? 'Naghihintay pa ng pagsusuri ng administrator ang iyong kahilingan para sa uri ng miyembro.'
        : '你的會員類型申請正在等待管理者審核。';
    return memberMenuReply(principal, activeLanguage);
  }
  if (/^(說明|help)$/i.test(text)) return helpText(principal, activeLanguage);
  if (!principal.role) return activeLanguage === 'en'
    ? 'Your member type request is awaiting administrator review. You can check case information after approval.'
    : activeLanguage === 'tl'
      ? 'Naghihintay pa ng pagsusuri ng administrator ang iyong kahilingan. Maaari mong tingnan ang impormasyon ng kaso pagkatapos maaprubahan.'
      : '你的會員類型申請正在等待管理者審核。審核完成後即可查詢案件資料。';
  if (!['admin','worker','employer','agency','training_center'].includes(principal.role)) return activeLanguage === 'en'
    ? 'Unable to verify this LINE account’s permissions. Please contact an administrator.'
    : activeLanguage === 'tl'
      ? 'Hindi ma-verify ang pahintulot ng LINE account na ito. Makipag-ugnayan sa administrator.'
      : '目前無法確認這個 LINE 帳號的會員權限，請聯絡管理者。';

  if (/文件|護照|psa|出生證明|document|passport|birth certificate|dokumento|pasaporte/.test(lower)) {
    const rows = await visibleRequirements(principal);
    if (!rows.length) return activeLanguage === 'en' ? 'No documents are outstanding.' : activeLanguage === 'tl' ? 'Walang kulang na dokumento.' : '目前沒有待補或待審的文件。';
    const docLabels = activeLanguage === 'en'
      ? {missing:'Not received',submitted:'Pending review',approved:'Approved',returned:'Returned for update'}
      : activeLanguage === 'tl'
        ? {missing:'Hindi pa natatanggap',submitted:'Naghihintay ng pagsusuri',approved:'Naaprubahan',returned:'Ibinalik para ayusin'}
        : DOC_LABELS;
    const header = activeLanguage === 'en' ? 'Documents still needed:' : activeLanguage === 'tl' ? 'Mga dokumentong kailangan pa:' : '尚未完成的文件：';
    return [header, ...rows.map(item => `${principal.role === 'worker' ? '' : `${item.worker_name}｜`}${item.name}: ${docLabels[item.status] || item.status}${item.status === 'returned' && item.review_reason ? ` (${item.review_reason})` : ''}`)].join('\n');
  }
  if (/待辦|待處理|工作事項|task|to-do|pending work|gawain|nakabinbin/.test(lower)) {
    const rows = await visibleTasks(principal);
    if (!rows.length) return activeLanguage === 'en' ? 'There are no related open tasks.' : activeLanguage === 'tl' ? 'Walang kaugnay na nakabinbing gawain.' : '目前沒有未完成的相關待辦事項。';
    const taskLabels = activeLanguage === 'en'
      ? {todo:'To do',in_progress:'In progress',blocked:'Blocked'}
      : activeLanguage === 'tl'
        ? {todo:'Gagawin',in_progress:'Isinasagawa',blocked:'Naharang'}
        : TASK_LABELS;
    const header = activeLanguage === 'en' ? 'Open tasks:' : activeLanguage === 'tl' ? 'Mga nakabinbing gawain:' : '未完成待辦：';
    const dateLocale = activeLanguage === 'en' ? 'en-US' : activeLanguage === 'tl' ? 'fil-PH' : 'zh-TW';
    return [header, ...rows.map(item => `${item.case_number}｜${item.title}: ${taskLabels[item.status] || item.status}${item.due_date ? `${activeLanguage === 'zh' ? '，期限 ' : ', due '}${new Date(item.due_date).toLocaleDateString(dateLocale)}` : ''}`)].join('\n');
  }
  if (/體檢|訓練|medical|training|kalusugan|pagsasanay/.test(lower)) {
    const cases = await visibleCases(principal);
    if (!cases.length) return activeLanguage === 'en' ? 'There is no medical or training progress available.' : activeLanguage === 'tl' ? 'Walang available na progreso ng medical o pagsasanay.' : '目前沒有可查看的體檢或訓練進度。';
    const header = activeLanguage === 'en' ? 'Medical and training progress:' : activeLanguage === 'tl' ? 'Progreso ng medical at pagsasanay:' : '體檢與訓練進度：';
    const medical = activeLanguage === 'en' ? 'Medical' : activeLanguage === 'tl' ? 'Medical' : '體檢';
    const training = activeLanguage === 'en' ? 'Training' : activeLanguage === 'tl' ? 'Pagsasanay' : '訓練';
    const notScheduled = activeLanguage === 'en' ? 'Not scheduled' : activeLanguage === 'tl' ? 'Hindi nakaiskedyul' : '未安排';
    const workflowLabels = activeLanguage === 'en'
      ? { not_scheduled: notScheduled, scheduled: 'Scheduled', in_progress: 'In progress', passed: 'Passed', retest: 'Retest', failed: 'Failed', completed: 'Completed' }
      : activeLanguage === 'tl'
        ? { not_scheduled: notScheduled, scheduled: 'Naka iskedyul', in_progress: 'Isinasagawa', passed: 'Pumasa', retest: 'Ulit na pagsusuri', failed: 'Hindi pumasa', completed: 'Kumpleto' }
        : { not_scheduled: notScheduled, scheduled: '已安排', in_progress: '處理中', passed: '合格', retest: '複檢', failed: '未通過', completed: '已完成' };
    return [header, ...cases.map(item => `${item.case_number}｜${medical}: ${workflowLabels[item.medical_status] || item.medical_status || notScheduled}｜${training}: ${workflowLabels[item.training_status] || item.training_status || notScheduled}`)].join('\n');
  }
  if (/仲介|雇主|案件|進度|狀態|我的工作者|agency|employer|case|progress|status|worker|ahensya|employer|manggagawa|kaso/.test(lower)) {
    return caseReply(await visibleCases(principal), principal, activeLanguage);
  }
  return helpText(principal, activeLanguage);
}
export async function pushLineMessage(lineUserId, messages) {
  const accessToken = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
  if (!accessToken) throw new Error('missing_messaging_access_token');
  const list = Array.isArray(messages)
    ? messages
    : [typeof messages === 'string' ? { type: 'text', text: messages.slice(0, 4500) } : messages];
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: lineUserId, messages: list }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`line_push_failed_${response.status}`);
}

function memberApprovedMessage(language, { role, agencyType, agencyName }) {
  const type = memberTypeName({ role, agency_type: agencyType }, language);
  const copy = {
    zh: {
      text: `🎉 恭喜你，文件通過審核！\n\n以下文件已通過系統核准：\n・會員申請資料（類型：${type}${agencyName ? `｜所屬仲介：${agencyName}` : ''}）\n\n現在可以輸入「我的身分」取得會員選單。`,
      button: { label: '我的身分', text: '我的身分' },
    },
    en: {
      text: `🎉 Congratulations! Your documents have passed review.\n\nThe following documents have been approved by the system:\n・Membership application (type: ${type}${agencyName ? ` | agency: ${agencyName}` : ''})\n\nYou can now send “my identity” to get your member menu.`,
      button: { label: 'My identity', text: 'my identity' },
    },
    tl: {
      text: `🎉 Binabati kita! Pumasa na ang iyong mga dokumento sa pagsusuri.\n\nAng mga sumusunod na dokumento ay naaprubahan na ng system:\n・Aplikasyon sa membership (uri: ${type}${agencyName ? ` | ahensya: ${agencyName}` : ''})\n\nMaaari mo nang ipadala ang “aking pagkakakilanlan” para makuha ang iyong member menu.`,
      button: { label: 'Aking pagkakakilanlan', text: 'aking pagkakakilanlan' },
    },
  }[language] || null;
  const picked = copy || { text: '', button: null };
  return adminQuickReply(picked.text, [picked.button]); // 附一顆快捷按鈕，會員點一下就等於輸入指令
}

export async function notifyMemberApproved({ lineUserId, role, agencyType = null, agencyName = '' }) {
  if (!lineUserId) return;
  const language = (await getPreferredLanguage(lineUserId)) || (role === 'worker' ? 'en' : 'zh');
  await pushLineMessage(lineUserId, memberApprovedMessage(language, { role, agencyType, agencyName }));
}