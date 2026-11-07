import { getHrPrincipal } from '@/lib/hr-access';
import { query } from '@/lib/db';
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

const ADMIN_FIELD_LABELS = {
  worker: { name:'姓名',nationality:'國籍',gender:'性別（male／female）',phone:'電話',email:'Email',jobPreference:'工作意向',agencyId:'所屬仲介 ID',status:'狀態',notes:'備註' },
  employer: { name:'雇主名稱',contactName:'聯絡人',phone:'電話',email:'Email',address:'地址',employerType:'雇主類型',agencyId:'所屬仲介 ID',status:'狀態',notes:'備註' },
  agency: { name:'仲介名稱',agencyType:'仲介類型（taiwan／philippines）',active:'狀態（active／inactive）' },
  training_center: { name:'中心名稱',email:'登入 Email',active:'狀態（啟用／停用）' },
};

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

function formatAdminValue(key, value) {
  if (value === null || value === undefined || value === '') return '—';
  if (key === 'status') return value === 'active' ? '啟用' : '停用';
  if (key === 'active') return value ? '啟用' : '停用';
  if (key === 'agencyType') return value === 'taiwan' ? '台灣仲介' : value === 'philippines' ? '菲律賓仲介' : value;
  if (key === 'employerType') return ({home_care:'家庭看護',factory:'工廠',domestic_helper:'家庭幫傭',other:'其他'})[value] || value;
  if (key === 'agencyId') return String(value);
  if (key === 'resume_profile') {
    const profile = { ...value };
    delete profile.photoDataUrl;
    delete profile.sourcePdfText;
    return JSON.stringify(profile);
  }
  return String(value);
}

function adminRecordText(type, record) {
  const common = {
    worker: ['姓名','name'], employer: ['名稱','name'], agency: ['仲介名稱','name'], training_center: ['中心名稱','display_name'],
  }[type];
  const lines = [`${ADMIN_DATA_TYPES[type].label} #${record.id}`, `${common[0]}：${record[common[1]] || '—'}`];
  const fields = {
    worker: [['國籍','nationality'],['性別','gender'],['電話','phone'],['Email','email'],['工作意向','job_preference'],['所屬仲介','agency_name'],['狀態','status'],['備註','notes']],
    employer: [['聯絡人','contact_name'],['電話','phone'],['Email','email'],['雇主類型','employer_type'],['地址','address'],['所屬仲介','agency_name'],['狀態','status'],['備註','notes']],
    agency: [['仲介類型','agency_type'],['國家／地區','country'],['狀態','active']],
    training_center: [['Email','email'],['LINE User ID','line_user_id'],['狀態','active'],['建立時間','created_at']],
  }[type];
  for (const [label, key] of fields) lines.push(`${label}：${formatAdminValue(key,record[key])}`);
  if (type === 'worker' && record.resume_profile && Object.keys(record.resume_profile).length) {
    lines.push(`履歷：${formatAdminValue('resume_profile',record.resume_profile)}`);
  }
  return lines.join('\n').slice(0,4900);
}

function adminDetailActions(type, id) {
  return [
    { label:'編輯資料',text:`管理編輯:${type}:${id}` },
    { label:'停用資料',text:`管理刪除:${type}:${id}` },
    { label:'返回清單',text:`管理清單:${type}:0` },
  ];
}

function adminCreatePrompt(type, key, initial = false) {
  const instructions = {
    'worker:gender':'請輸入 male、female、男或女。',
    'worker:jobPreference':'請輸入：家庭幫傭、家庭看護、工廠技術工、農工或機構看護工。',
    'employer:employerType':'請輸入 home_care、factory、domestic_helper 或 other。',
    'agency:agencyType':'請輸入 taiwan 或 philippines。',
  };
  const prefix = initial ? `新增${ADMIN_DATA_TYPES[type].label}，` : '';
  return adminQuickReply(`${prefix}請輸入${ADMIN_FIELD_LABELS[type][key]}${instructions[`${type}:${key}`] ? `（${instructions[`${type}:${key}`]}）` : '（不適用請輸入「無」）'}`,[
    {label:'取消',text:'管理取消'},
  ]);
}

async function adminListReply(type, offset = 0) {
  const limit = 8;
  const { rows, count } = await loadAdminRows(type, limit, offset);
  const title = ADMIN_DATA_TYPES[type].label;
  if (!rows.length) {
    return adminQuickReply(`${title}資料目前為空。可先新增資料。`, [
      { label:`新增${title}`,text:`管理新增:${type}` },
      { label:'返回管理選單',text:'管理選單' },
    ]);
  }
  const items = rows.map(row => {
    const name = row.name || row.display_name || '未命名';
    return `${row.id}. ${name} · ${row.status || (row.active ? '啟用' : '停用')}`;
  });
  const actions = rows.map(row => ({
    label:`#${row.id} ${(row.name || row.display_name || '').slice(0,13)}`,
    text:`管理選取:${type}:${row.id}`,
  }));
  actions.push({ label:`新增${title}`,text:`管理新增:${type}` });
  if (offset > 0) actions.push({ label:'上一頁',text:`管理清單:${type}:${Math.max(0,offset-limit)}` });
  if (offset + limit < count) actions.push({ label:'下一頁',text:`管理清單:${type}:${offset+limit}` });
  actions.push({ label:'返回選單',text:'管理選單' });
  return adminQuickReply(`${title}清單（${count} 筆，顯示 ${offset+1}–${Math.min(offset+rows.length,count)}）\n${items.join('\n')}\n點選下方項目查看完整資料。`, actions);
}

async function updateAdminRecord(type, id, key, value) {
  if (!ADMIN_DATA_TYPES[type] || !ADMIN_DATA_TYPES[type].fields.includes(key)) throw new Error('invalid_admin_field');
  if (key === 'name' && !value.trim()) throw new Error('名稱不能空白。');
  const column = ADMIN_FIELD_COLUMNS[type][key];
  if (type === 'training_center') {
    const sqlColumn = key === 'name' ? 'display_name' : key;
    if (key === 'email' && !/^\S+@\S+\.\S+$/.test(value.trim())) throw new Error('請輸入有效 Email，且不可留空。');
    if (key === 'active' && !['active','inactive','啟用','停用'].includes(value)) throw new Error('狀態請輸入「啟用」或「停用」。');
    const normalized = key === 'active' ? value === 'active' || value === '啟用' : value.trim();
    const rows = await query(`UPDATE hr_members SET ${sqlColumn}=$2,updated_at=NOW() WHERE id=$1 AND role='training_center' RETURNING id`, [id,normalized]);
    return rows[0];
  }
  if (type === 'agency' && key === 'agencyType') {
    if (!['taiwan','philippines'].includes(value)) throw new Error('請輸入 taiwan 或 philippines。');
    const country = value === 'taiwan' ? '台灣' : '菲律賓';
    const rows = await query('UPDATE hr_agencies SET agency_type=$2,country=$3,updated_at=NOW() WHERE id=$1 RETURNING id', [id,value,country]);
    return rows[0];
  }
  if (type === 'worker' && key === 'gender') {
    const gender = value.trim().toLowerCase();
    if (!['male','female','m','f','男','女','男性','女性'].includes(gender)) throw new Error('性別請輸入 male、female、男或女。');
    const normalized = ['male','m','男','男性'].includes(gender) ? 'male' : 'female';
    const rows = await query(`UPDATE hr_workers SET resume_profile=jsonb_set(COALESCE(resume_profile,'{}'::jsonb),'{gender}',to_jsonb($2::text),true),updated_at=NOW() WHERE id=$1 RETURNING id`, [id,normalized]);
    return rows[0];
  }
  if (key === 'status') {
    if (!['active','inactive','啟用','停用'].includes(value)) throw new Error('狀態請輸入「啟用」或「停用」。');
    const status = value === 'active' || value === '啟用' ? 'active' : 'inactive';
    const statement = type === 'worker'
      ? `WITH changed AS (UPDATE hr_workers SET status=$2,updated_at=NOW() WHERE id=$1 RETURNING id),
        disabled AS (UPDATE hr_members SET active=FALSE,updated_at=NOW() FROM changed WHERE changed.id=hr_members.worker_id AND $2='inactive') SELECT id FROM changed`
      : `WITH changed AS (UPDATE hr_employers SET status=$2,updated_at=NOW() WHERE id=$1 RETURNING id),
        disabled AS (UPDATE hr_members SET active=FALSE,updated_at=NOW() FROM changed WHERE changed.id=hr_members.employer_id AND $2='inactive') SELECT id FROM changed`;
    const rows = await query(statement, [id,status]);
    return rows[0];
  }
  if (type === 'agency' && key === 'active' || type === 'training_center' && key === 'active') {
    if (!['active','inactive','啟用','停用'].includes(value)) throw new Error('狀態請輸入「啟用」或「停用」。');
    const active = value === 'active' || value === '啟用';
    const statement = type === 'agency'
      ? `WITH changed AS (UPDATE hr_agencies SET active=$2,updated_at=NOW() WHERE id=$1 RETURNING id),
        disabled AS (UPDATE hr_members SET active=FALSE,updated_at=NOW() FROM changed WHERE changed.id=hr_members.agency_id AND $2=FALSE) SELECT id FROM changed`
      : "UPDATE hr_members SET active=$2,updated_at=NOW() WHERE id=$1 AND role='training_center' RETURNING id";
    const rows = await query(statement, [id,active]);
    return rows[0];
  }
  if (key === 'agencyId') {
    const agencyId = value.trim() && value.trim() !== '無' ? Number(value) : null;
    if (agencyId !== null && (!Number.isSafeInteger(agencyId) || agencyId < 1)) throw new Error('仲介 ID 請輸入正整數，或輸入「無」清空。');
    const rows = await query(`UPDATE ${ADMIN_DATA_TYPES[type].table} SET ${column}=$2,updated_at=NOW() WHERE id=$1 RETURNING id`, [id,agencyId]);
    return rows[0];
  }
  if (key === 'email') {
    const email = value.trim().toLowerCase();
    if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new Error('請輸入有效 Email。');
    if (type === 'training_center' && !email) throw new Error('訓練中心 Email 不能空白。');
    const rows = await query(`UPDATE ${ADMIN_DATA_TYPES[type].table} SET ${column}=$2,updated_at=NOW() WHERE id=$1 RETURNING id`, [id,email]);
    return rows[0];
  }
  const limits = {name:160,display_name:160,nationality:80,phone:50,email:254,job_preference:120,notes:2000,contact_name:120,address:300,employer_type:30};
  const max = limits[column] || 500;
  if (value.length > max) throw new Error(`內容過長，最多 ${max} 個字元。`);
  if (type === 'employer' && key === 'employerType' && !['home_care','factory','domestic_helper','other'].includes(value)) {
    throw new Error('雇主類型請輸入 home_care、factory、domestic_helper 或 other。');
  }
  const rows = await query(`UPDATE ${ADMIN_DATA_TYPES[type].table} SET ${column}=$2,updated_at=NOW() WHERE id=$1 RETURNING id`, [id,value]);
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
    if (!values.name?.trim()) throw new Error('姓名不能空白。');
    if (!['家庭幫傭','家庭看護','工廠技術工','農工','機構看護工'].includes(values.jobPreference)) throw new Error('工作意向請輸入：家庭幫傭、家庭看護、工廠技術工、農工或機構看護工。');
    if (!['male','female','m','f','男','女','男性','女性'].includes(String(values.gender||'').trim().toLowerCase())) throw new Error('性別請輸入 male、female、男或女。');
    const gender = ['male','m','男','男性'].includes(String(values.gender).trim().toLowerCase()) ? 'male' : 'female';
    const created = await query(`INSERT INTO hr_workers(name,nationality,phone,email,job_preference,notes,resume_profile)
      VALUES($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING id`,
    [values.name.trim(),values.nationality||'',values.phone||'',values.email||'',values.jobPreference,values.notes||'',JSON.stringify({gender})]);
    const category = values.jobPreference === '家庭看護' || values.jobPreference === '家庭幫傭' ? 'CT' : values.jobPreference === '工廠技術工' ? 'SW' : values.jobPreference === '農工' ? 'FM' : 'CG';
    const sex = gender === 'male' ? 'M' : 'F';
    const sequence = String(created[0].id).padStart(3,'0');
    const referenceNo = `${category}${sex}-${category === 'CT' ? sequence : `${String(new Date().getFullYear()).slice(-2)}${sequence}`}`;
    await query("UPDATE hr_workers SET resume_profile=jsonb_set(resume_profile,'{referenceNo}',to_jsonb($2::text),true) WHERE id=$1", [created[0].id,referenceNo]);
    return created;
  }
  if (type === 'employer') {
    if (!values.name?.trim()) throw new Error('雇主名稱不能空白。');
    return query(`INSERT INTO hr_employers(name,contact_name,phone,email,address,notes,employer_type)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [values.name.trim(),values.contactName||'',values.phone||'',values.email||'',values.address||'',values.notes||'',values.employerType||'other']);
  }
  if (type === 'agency') {
    if (!values.name?.trim() || !['taiwan','philippines'].includes(values.agencyType)) throw new Error('請填名稱，並將仲介類型設為 taiwan 或 philippines。');
    const country = values.agencyType === 'taiwan' ? '台灣' : '菲律賓';
    return query('INSERT INTO hr_agencies(name,agency_type,country) VALUES($1,$2,$3) RETURNING id', [values.name.trim(),values.agencyType,country]);
  }
  if (type === 'training_center') {
    const email = String(values.email||'').trim().toLowerCase();
    if (!values.name?.trim() || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('請輸入訓練中心名稱及有效 Email。');
    return query(`INSERT INTO hr_members(display_name,email,role,active)
      VALUES($1,$2,'training_center',TRUE) RETURNING id`, [values.name.trim(),email]);
  }
  throw new Error('不支援的資料類型。');
}

async function handleAdminManagement(lineUserId, text, principal) {
  if (principal?.role !== 'admin') return null;
  const command = text.trim();
  const typeNames = {
    '管理工作者':'worker','管理工作者':'worker','管理雇主':'employer','管理仲介':'agency','管理訓練中心':'training_center',
    'manage workers':'worker','manage employers':'employer','manage agencies':'agency','training centers':'training_center',
    'pamahalaan ang mga manggagawa':'worker','pamahalaan ang mga employer':'employer','pamahalaan ang mga ahensya':'agency','pamahalaan ang mga training center':'training_center',
  };
  const selectedType = typeNames[command] || typeNames[command.toLowerCase()];
  if (selectedType) {
    await saveAdminSession(lineUserId,{type:selectedType,mode:'list'});
    return adminListReply(selectedType);
  }
  if (command === '管理選單') {
    await saveAdminSession(lineUserId,null);
    return adminQuickReply('管理者資料管理選單：',['管理工作者','管理雇主','管理仲介','管理訓練中心'].map(label=>({label,text:label})));
  }

  const listMatch = command.match(/^管理清單:(worker|employer|agency|training_center):(\d+)$/);
  if (listMatch) {
    const [,type,offset] = listMatch;
    await saveAdminSession(lineUserId,{type,mode:'list',offset:Number(offset)});
    return adminListReply(type,Number(offset));
  }
  const selectMatch = command.match(/^管理選取:(worker|employer|agency|training_center):(\d+)$/);
  if (selectMatch) {
    const [,type,id] = selectMatch;
    const record = await loadAdminRecord(type,Number(id));
    if (!record) return adminQuickReply('找不到該筆資料，請重新選擇。',[{label:'返回清單',text:`管理清單:${type}:0`}]);
    await saveAdminSession(lineUserId,{type,mode:'detail',id:Number(id)});
    return adminQuickReply(adminRecordText(type,record),adminDetailActions(type,id));
  }
  const createMatch = command.match(/^管理新增:(worker|employer|agency|training_center)$/);
  if (createMatch) {
    const [,type] = createMatch;
    const firstField = type === 'worker' || type === 'employer' || type === 'agency' || type === 'training_center' ? 'name' : null;
    await saveAdminSession(lineUserId,{type,mode:'create',step:0,values:{}});
    return adminCreatePrompt(type,firstField,true);
  }
  const editMatch = command.match(/^管理編輯:(worker|employer|agency|training_center):(\d+)$/);
  if (editMatch) {
    const [,type,id] = editMatch;
    const record = await loadAdminRecord(type,Number(id));
    if (!record) return adminQuickReply('找不到該筆資料。',[{label:'返回清單',text:`管理清單:${type}:0`}]);
    const actions = ADMIN_DATA_TYPES[type].fields.map(key=>({label:ADMIN_FIELD_LABELS[type][key],text:`管理欄位:${type}:${id}:${key}`}));
    actions.push({label:'返回資料',text:`管理選取:${type}:${id}`});
    await saveAdminSession(lineUserId,{type,mode:'edit',id:Number(id)});
    return adminQuickReply(`選擇要修改的${ADMIN_DATA_TYPES[type].label}欄位：`,actions);
  }
  const deleteMatch = command.match(/^管理刪除:(worker|employer|agency|training_center):(\d+)$/);
  if (deleteMatch) {
    const [,type,id] = deleteMatch;
    await saveAdminSession(lineUserId,{type,mode:'confirm_delete',id:Number(id)});
    return adminQuickReply(`確定停用${ADMIN_DATA_TYPES[type].label} #${id}？資料及關聯紀錄會保留，不會永久刪除。`,[
      {label:'確定停用',text:`管理確認刪除:${type}:${id}`},
      {label:'取消',text:`管理選取:${type}:${id}`},
    ]);
  }
  const fieldMatch = command.match(/^管理欄位:(worker|employer|agency|training_center):(\d+):([A-Za-z]+)$/);
  if (fieldMatch) {
    const [,type,id,key] = fieldMatch;
    if (!ADMIN_DATA_TYPES[type].fields.includes(key)) return adminQuickReply('欄位無效，請重新選擇。',[{label:'返回資料',text:`管理選取:${type}:${id}`}]);
    await saveAdminSession(lineUserId,{type,mode:'edit_value',id:Number(id),key});
    return `請輸入「${ADMIN_FIELD_LABELS[type][key]}」的新值（文字「無」會清空欄位）：`;
  }
  if (command === '管理取消') {
    await saveAdminSession(lineUserId,null);
    return '已取消目前操作。輸入「管理工作者」、「管理雇主」、「管理仲介」或「管理訓練中心」開始管理。';
  }
  const confirmDelete = command.match(/^管理確認刪除:(worker|employer|agency|training_center):(\d+)$/);
  if (confirmDelete) {
    const [,type,id] = confirmDelete;
    const pending = await adminSession(lineUserId);
    if (pending?.mode !== 'confirm_delete' || pending.type !== type || Number(pending.id) !== Number(id)) {
      return adminQuickReply('此停用確認已逾期或取消，請重新選取資料再操作。',[{label:'返回清單',text:`管理清單:${type}:0`}]);
    }
    const result = await deactivateAdminRecord(type,Number(id));
    await saveAdminSession(lineUserId,{type,mode:'list'});
    return result ? `已停用${ADMIN_DATA_TYPES[type].label} #${id}。` : '找不到該筆資料。';
  }

  const session = await adminSession(lineUserId);
  if (!session) return null;
  if (session.mode === 'edit_value') {
    const value = command === '無' ? '' : command;
    let updated;
    try { updated = await updateAdminRecord(session.type,session.id,session.key,value); }
    catch (error) {
      if (error?.code === '23505') return `資料已存在，請改用其他值。${ADMIN_FIELD_LABELS[session.type][session.key]}：`;
      if (error?.code === '23503') return '所屬仲介不存在，請確認仲介 ID 後重試。';
      if (error?.message && !error.code) return `${error.message}\n請重新輸入：`;
      throw error;
    }
    if (!updated) return adminQuickReply('找不到資料，可能已被移除。',[{label:'回清單',text:`管理清單:${session.type}:0`}]);
    await saveAdminSession(lineUserId,{type:session.type,mode:'detail',id:session.id});
    const record = await loadAdminRecord(session.type,session.id);
    return adminQuickReply('資料已更新。\n'+adminRecordText(session.type,record),adminDetailActions(session.type,session.id));
  }
  if (session.mode === 'confirm_delete') return '請使用「確定停用」或「取消」按鈕完成此操作。';
  if (session.mode === 'create') {
    const fields = session.type === 'worker' ? ['name','nationality','gender','phone','email','jobPreference','notes']
      : session.type === 'employer' ? ['name','contactName','phone','email','address','employerType','notes']
        : session.type === 'agency' ? ['name','agencyType']
          : ['name','email'];
    const key = fields[session.step];
    if (!key) throw new Error('invalid_admin_create_state');
    const values = { ...session.values, [key]: command === '無' ? '' : command };
    const maxLength = ({name:160,nationality:80,gender:40,phone:50,email:254,jobPreference:120,notes:2000,contactName:120,address:300,employerType:30,agencyType:30})[key] || 500;
    if (values[key].length > maxLength) return adminQuickReply(`內容過長，最多 ${maxLength} 個字元。請重新輸入。`,[{label:'取消',text:'管理取消'}]);
    if (key === 'name' && !values[key].trim()) return adminCreatePrompt(session.type,key);
    if (key === 'email' && values[key] && !/^\S+@\S+\.\S+$/.test(values[key])) return adminCreatePrompt(session.type,key);
    if (session.type === 'worker' && key === 'jobPreference' && !['家庭幫傭','家庭看護','工廠技術工','農工','機構看護工'].includes(values[key])) return adminCreatePrompt(session.type,key);
    if (session.type === 'worker' && key === 'gender' && !['male','female','m','f','男','女','男性','女性'].includes(values[key].toLowerCase())) return adminCreatePrompt(session.type,key);
    if (session.type === 'employer' && key === 'employerType' && !['home_care','factory','domestic_helper','other'].includes(values[key])) return adminCreatePrompt(session.type,key);
    if (session.type === 'agency' && key === 'agencyType' && !['taiwan','philippines'].includes(values[key])) return adminCreatePrompt(session.type,key);
    if (session.step + 1 < fields.length) {
      const next = fields[session.step + 1];
      await saveAdminSession(lineUserId,{...session,step:session.step+1,values});
      return adminCreatePrompt(session.type,next);
    }
    await saveAdminSession(lineUserId,{...session,values});
    let created;
    try { created = await createAdminRecord(session.type,values); }
    catch (error) {
      if (error?.code === '23505') return adminQuickReply('資料已存在（例如 Email 或名稱重複），請輸入新的資料重新開始。',[{label:'重新新增',text:`管理新增:${session.type}`},{label:'返回清單',text:`管理清單:${session.type}:0`}]);
      if (error?.message && !error.code) return adminQuickReply(`${error.message}\n請重新輸入${ADMIN_FIELD_LABELS[session.type][key]}：`,[{label:'取消',text:'管理取消'}]);
      throw error;
    }
    await saveAdminSession(lineUserId,{type:session.type,mode:'list'});
    return `已新增${ADMIN_DATA_TYPES[session.type].label} #${created[0].id}。`;
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
    const adminReply = await handleAdminManagement(lineUserId,text,principal);
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
    if (!rows.length) return activeLanguage === 'en' ? 'There is no case document progress available.' : activeLanguage === 'tl' ? 'Walang available na progreso ng dokumento para sa kaso.' : '目前沒有可查看的案件文件進度。';
    const docLabels = activeLanguage === 'en'
      ? {missing:'Not received',submitted:'Pending review',approved:'Approved',returned:'Returned for update'}
      : activeLanguage === 'tl'
        ? {missing:'Hindi pa natatanggap',submitted:'Naghihintay ng pagsusuri',approved:'Naaprubahan',returned:'Ibinalik para ayusin'}
        : DOC_LABELS;
    const header = activeLanguage === 'en' ? 'Document progress:' : activeLanguage === 'tl' ? 'Progreso ng dokumento:' : '文件進度：';
    return [header, ...rows.map(item => `${item.case_number}｜${item.name}: ${docLabels[item.status] || item.status}${item.status === 'returned' && item.review_reason ? ` (${item.review_reason})` : ''}`)].join('\n');
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
