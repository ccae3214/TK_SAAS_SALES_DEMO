import { NextResponse } from 'next/server';
import pool, { query } from '@/lib/db';
import { auth } from '@/auth';
import { getHrPrincipal } from '@/lib/hr-access';
import { ensureTrainingCenterSchema } from '@/lib/hr-training-center';
import { recordAdminAction } from '@/lib/hr-audit';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 系統管理者的「訓練中心工作區」API：管理各訓練中心的老師證照、課程、班別日期與證照批次。

const clean = (value, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const validId = value => /^\d+$/.test(String(value ?? '')) && Number(value) > 0;
const dateOf = value => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? undefined : value;
};
const intOf = (value, max = 100000) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= max ? n : undefined;
};
const BATCH_STATUSES = new Set(['preparing', 'submitted', 'issued']);
const BATCH_STATUS_NAMES = { preparing: '準備中', submitted: '已送件', issued: '已發證' };

class Refuse extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
const fail = (message, status = 400) => NextResponse.json({ error: message }, { status });

function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const allowed = new Set([new URL(request.url).origin]);
    for (const value of [process.env.APP_ORIGIN, process.env.NEXTAUTH_URL]) { if (value) allowed.add(new URL(value).origin); }
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || new URL(request.url).protocol.slice(0, -1);
    if (host) allowed.add(`${protocol.split(',')[0].trim()}://${host}`);
    return allowed.has(new URL(origin).origin);
  } catch { return false; }
}

// 系統管理者可管理所有訓練中心；訓練中心會員只能管理自己（self=true，centerId 固定為自己）。
async function accessContext() {
  const session = await auth();
  if (!session?.user) return { error: fail('Authentication required', 401) };
  const principal = await getHrPrincipal(session);
  if (principal?.role === 'admin') return { session, principal, self: false };
  if (principal?.role === 'training_center' && principal.id) return { session, principal, self: true, centerId: principal.id };
  return { error: fail('僅系統管理者或訓練中心會員可使用訓練中心工作區。', 403) };
}
const scope = (ctx, centerId) => {
  if (ctx.self && Number(centerId) !== Number(ctx.centerId)) throw new Refuse('沒有權限操作其他訓練中心的資料。', 403);
};

const one = async (sql, params) => (await query(sql, params))[0] || null;
// pg 會把 DATE 欄位轉成本機時間的 Date；統一轉回 YYYY-MM-DD 字串，避免時區造成差一天。
const fmtDate = value => value instanceof Date ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}` : value;
const withDates = (rows, keys) => rows.map(row => ({ ...row, ...Object.fromEntries(keys.map(key => [key, fmtDate(row[key])])) }));
const requireCenter = async id => {
  if (!validId(id)) throw new Refuse('請先選擇訓練中心。');
  const row = await one("SELECT id, display_name FROM hr_members WHERE id=$1 AND role='training_center'", [id]);
  if (!row) throw new Refuse('找不到這個訓練中心。', 404);
  return row;
};
// 取得屬於該訓練中心的資料列，避免跨中心引用。
const owned = async (table, id, centerId) => {
  if (!validId(id)) return null;
  return one(`SELECT * FROM ${table} WHERE id=$1 AND center_id=$2`, [id, centerId]);
};

export async function GET(request) {
  const ctx = await accessContext();
  if (ctx.error) return ctx.error;
  try {
    await ensureTrainingCenterSchema();
    const centers = ctx.self
      ? await query("SELECT id, display_name, email, active FROM hr_members WHERE id=$1 AND role='training_center'", [ctx.centerId])
      : await query("SELECT id, display_name, email, active FROM hr_members WHERE role='training_center' ORDER BY active DESC, display_name, id");
    const requested = ctx.self ? ctx.centerId : new URL(request.url).searchParams.get('centerId');
    const center = centers.find(item => String(item.id) === String(requested)) || centers.find(item => item.active) || centers[0] || null;
    if (!center) return NextResponse.json({ centers, center: null });
    const [certifications, teachers, holdings, courses, classes, batches] = await Promise.all([
      query('SELECT * FROM hr_tc_certifications WHERE center_id=$1 ORDER BY active DESC, name', [center.id]),
      query('SELECT * FROM hr_tc_teachers WHERE center_id=$1 ORDER BY active DESC, name', [center.id]),
      query(`SELECT tc.*, c.name AS certification_name FROM hr_tc_teacher_certifications tc
             JOIN hr_tc_teachers t ON t.id=tc.teacher_id JOIN hr_tc_certifications c ON c.id=tc.certification_id
             WHERE t.center_id=$1 ORDER BY c.name`, [center.id]),
      query(`SELECT co.*, c.name AS certification_name FROM hr_tc_courses co JOIN hr_tc_certifications c ON c.id=co.certification_id
             WHERE co.center_id=$1 ORDER BY co.active DESC, c.name, co.name`, [center.id]),
      query(`SELECT cl.*, c.name AS certification_name, co.name AS course_name, t.name AS teacher_name
             FROM hr_tc_classes cl JOIN hr_tc_certifications c ON c.id=cl.certification_id JOIN hr_tc_courses co ON co.id=cl.course_id
             LEFT JOIN hr_tc_teachers t ON t.id=cl.teacher_id
             WHERE cl.center_id=$1 ORDER BY cl.training_start_date DESC, cl.id DESC`, [center.id]),
      query(`SELECT b.*, cl.name AS class_name FROM hr_tc_batches b JOIN hr_tc_classes cl ON cl.id=b.class_id
             WHERE cl.center_id=$1 ORDER BY b.applied_date DESC NULLS LAST, b.id DESC`, [center.id]),
    ]);
    return NextResponse.json({
      centers, center, certifications, teachers, courses,
      holdings: withDates(holdings, ['issued_date', 'expires_date']),
      classes: withDates(classes, ['training_start_date', 'training_end_date', 'exam_date', 'certificate_issue_date']),
      batches: withDates(batches, ['applied_date']),
    });
  } catch (error) {
    console.error('hr_training_center_read_failed', error?.name || 'Error');
    return fail('讀取訓練中心資料失敗，請稍後再試。', 500);
  }
}

// 各資源的欄位驗證，回傳要寫入的欄位；驗證失敗丟出 Refuse。
async function buildRecord(resource, body, centerId, existing) {
  const name = clean(body.name, 120);
  if (resource === 'certification') {
    if (!name) throw new Refuse('請輸入證照名稱。');
    return { name, description: clean(body.description, 500), active: body.active === false ? false : true };
  }
  if (resource === 'teacher') {
    if (!name) throw new Refuse('請輸入老師姓名。');
    const email = clean(body.email, 254);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Refuse('老師 Email 格式不正確。');
    return { name, phone: clean(body.phone, 40), email, active: body.active === false ? false : true };
  }
  if (resource === 'course') {
    if (!name) throw new Refuse('請輸入課程名稱。');
    if (!(await owned('hr_tc_certifications', body.certificationId, centerId))) throw new Refuse('請選擇這個訓練中心的證照。');
    const hours = intOf(body.hours, 10000);
    if (hours === undefined) throw new Refuse('課程時數必須是 0 以上的整數。');
    return { name, certification_id: Number(body.certificationId), hours, description: clean(body.description, 500), active: body.active === false ? false : true };
  }
  if (resource === 'class') {
    if (!name) throw new Refuse('請輸入班別名稱。');
    const course = await owned('hr_tc_courses', body.courseId, centerId);
    if (!course) throw new Refuse('請選擇這個訓練中心的課程。');
    const certificationId = course.certification_id; // 班別的證照依課程而定，確保「依照證照」開班。
    let teacherId = null;
    if (body.teacherId !== undefined && body.teacherId !== null && body.teacherId !== '') {
      const teacher = await owned('hr_tc_teachers', body.teacherId, centerId);
      if (!teacher) throw new Refuse('請選擇這個訓練中心的老師。');
      const holds = await one('SELECT 1 FROM hr_tc_teacher_certifications WHERE teacher_id=$1 AND certification_id=$2', [teacher.id, certificationId]);
      if (!holds) throw new Refuse(`${teacher.name}老師尚未持有這門課程的證照，請先到「老師與證照」登記。`);
      teacherId = teacher.id;
    }
    const start = dateOf(body.trainingStartDate), end = dateOf(body.trainingEndDate);
    const exam = dateOf(body.examDate), issue = dateOf(body.certificateIssueDate);
    if (!start || !end) throw new Refuse('請輸入正確的訓練開始與結束日期。');
    if (exam === undefined || issue === undefined) throw new Refuse('考證日期或取證日期格式不正確。');
    if (end < start) throw new Refuse('訓練結束日期不可早於開始日期。');
    if (exam && exam < start) throw new Refuse('考證日期不可早於訓練開始日期。');
    if (issue && !exam) throw new Refuse('請先安排考證日期，再填寫取證日期。');
    if (issue && exam && issue < exam) throw new Refuse('取證日期不可早於考證日期。');
    const capacity = intOf(body.capacity, 10000);
    if (capacity === undefined) throw new Refuse('招生人數必須是 0 以上的整數。');
    return { name, certification_id: certificationId, course_id: course.id, teacher_id: teacherId, training_start_date: start, training_end_date: end,
      exam_date: exam, exam_location: clean(body.examLocation, 200), certificate_issue_date: issue, capacity, note: clean(body.note, 500) };
  }
  if (resource === 'batch') {
    const batchNo = clean(body.batchNo, 60);
    if (!batchNo) throw new Refuse('請輸入批次編號或名稱。');
    const applied = dateOf(body.appliedDate);
    if (applied === undefined) throw new Refuse('辦理日期格式不正確。');
    const count = intOf(body.studentCount, 10000);
    if (count === undefined) throw new Refuse('人數必須是 0 以上的整數。');
    const status = BATCH_STATUSES.has(body.status) ? body.status : 'preparing';
    return { batch_no: batchNo, applied_date: applied, student_count: count, status, note: clean(body.note, 500) };
  }
  throw new Refuse('不支援的項目。');
}

const TABLES = { certification: 'hr_tc_certifications', teacher: 'hr_tc_teachers', course: 'hr_tc_courses', class: 'hr_tc_classes', batch: 'hr_tc_batches' };
const LABELS = { certification: '證照', teacher: '老師', course: '課程', class: '班別', batch: '證照批次' };
const nameOf = (resource, row) => resource === 'batch' ? row.batch_no : row.name;

function friendly(error) {
  if (error instanceof Refuse) return fail(error.message, error.status);
  if (error?.code === '23505') return fail('已有相同名稱的資料，請換一個名稱。', 409);
  if (error?.code === '23503') return fail('這筆資料還被課程、班別或其他資料使用，請先移除相關資料。', 409);
  console.error('hr_training_center_write_failed', error?.name || 'Error', error?.code || '');
  return fail('儲存失敗，請稍後再試。', 500);
}

// 操作紀錄只記錄系統管理員的操作；訓練中心會員自己維護自己的資料不記在這裡。
async function audit(ctx, action, resource, row, phrase) {
  if (ctx.self) return;
  await recordAdminAction({ principal: ctx.principal, session: ctx.session, action, type: `training-${resource}`, id: row?.id, name: nameOf(resource, row || {}), phrase });
}

export async function POST(request) {
  if (!sameOrigin(request)) return fail('Invalid request origin', 403);
  const ctx = await accessContext();
  if (ctx.error) return ctx.error;
  let body;
  try { body = await request.json(); } catch { return fail('資料格式不正確。'); }
  const resource = body?.resource;
  try {
    await ensureTrainingCenterSchema();
    // 老師持有證照：新增或更新一筆持證紀錄。
    if (resource === 'teacher-certification') {
      const center = await requireCenter(ctx.self ? ctx.centerId : body.centerId);
      const teacher = await owned('hr_tc_teachers', body.teacherId, center.id);
      const certification = await owned('hr_tc_certifications', body.certificationId, center.id);
      if (!teacher || !certification) throw new Refuse('請選擇這個訓練中心的老師與證照。');
      const issued = dateOf(body.issuedDate), expires = dateOf(body.expiresDate);
      if (issued === undefined || expires === undefined) throw new Refuse('發證日期或有效期限格式不正確。');
      if (issued && expires && expires < issued) throw new Refuse('有效期限不可早於發證日期。');
      const saved = await one(`INSERT INTO hr_tc_teacher_certifications(teacher_id,certification_id,certificate_no,issued_date,expires_date)
        VALUES($1,$2,$3,$4,$5) ON CONFLICT(teacher_id,certification_id)
        DO UPDATE SET certificate_no=EXCLUDED.certificate_no, issued_date=EXCLUDED.issued_date, expires_date=EXCLUDED.expires_date RETURNING id`,
        [teacher.id, certification.id, clean(body.certificateNo, 80), issued, expires]);
      if (!ctx.self) await recordAdminAction({ principal: ctx.principal, session: ctx.session, action: '更新', type: 'training-teacher-certification', id: saved.id, name: teacher.name,
        phrase: `登記${center.display_name}的${teacher.name}老師持有${certification.name}證照` });
      return NextResponse.json({ ok: true, id: saved.id });
    }
    if (!TABLES[resource]) throw new Refuse('不支援的項目。');
    let centerId;
    if (resource === 'batch') {
      const cls = await one('SELECT id, center_id, name FROM hr_tc_classes WHERE id=$1', [validId(body.classId) ? body.classId : 0]);
      if (!cls) throw new Refuse('請選擇班別。');
      scope(ctx, cls.center_id);
      centerId = cls.center_id;
    } else centerId = (await requireCenter(ctx.self ? ctx.centerId : body.centerId)).id;
    const record = await buildRecord(resource, body, centerId, null);
    const parent = resource === 'batch' ? { class_id: Number(body.classId) } : { center_id: centerId };
    const all = { ...parent, ...record };
    const keys = Object.keys(all);
    const created = await one(`INSERT INTO ${TABLES[resource]}(${keys.join(',')}) VALUES(${keys.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`, keys.map(key => all[key]));
    const center = await one("SELECT display_name FROM hr_members WHERE id=$1", [centerId]);
    await audit(ctx, '新增', resource, created, `新增了${center?.display_name || ''}的${nameOf(resource, created)}${LABELS[resource]}`);
    return NextResponse.json({ ok: true, id: created.id });
  } catch (error) { return friendly(error); }
}

export async function PATCH(request) {
  if (!sameOrigin(request)) return fail('Invalid request origin', 403);
  const ctx = await accessContext();
  if (ctx.error) return ctx.error;
  let body;
  try { body = await request.json(); } catch { return fail('資料格式不正確。'); }
  const resource = body?.resource;
  try {
    await ensureTrainingCenterSchema();
    if (!TABLES[resource]) throw new Refuse('不支援的項目。');
    if (!validId(body.id)) throw new Refuse('資料編號不正確。');
    const existing = await one(`SELECT * FROM ${TABLES[resource]} WHERE id=$1`, [body.id]);
    if (!existing) throw new Refuse('找不到這筆資料。', 404);
    const centerId = resource === 'batch' ? (await one('SELECT center_id FROM hr_tc_classes WHERE id=$1', [existing.class_id])).center_id : existing.center_id;
    scope(ctx, centerId);
    // 只切換啟用狀態（證照、老師、課程）。
    const record = body.toggleActive && ['certification', 'teacher', 'course'].includes(resource)
      ? { active: !existing.active }
      : await buildRecord(resource, body, centerId, existing);
    if (resource === 'course' && record.certification_id && Number(record.certification_id) !== Number(existing.certification_id)) {
      const used = await one('SELECT 1 FROM hr_tc_classes WHERE course_id=$1', [existing.id]);
      if (used) throw new Refuse('這門課程已有班別，無法更換證照。');
    }
    const keys = Object.keys(record);
    const updated = await one(`UPDATE ${TABLES[resource]} SET ${keys.map((key, i) => `${key}=$${i + 2}`).join(',')}, updated_at=NOW() WHERE id=$1 RETURNING *`, [existing.id, ...keys.map(key => record[key])]);
    const label = LABELS[resource], n = nameOf(resource, updated);
    if (body.toggleActive) await audit(ctx, updated.active ? '啟用' : '停用', resource, updated, `${updated.active ? '啟用' : '停用'}了${n}${label}`);
    else if (resource === 'batch') await audit(ctx, '更新', resource, updated, `將證照批次 ${n} 的狀態設為${BATCH_STATUS_NAMES[updated.status]}`);
    else await audit(ctx, '編輯', resource, updated, `編輯了${n}${label}的資料`);
    return NextResponse.json({ ok: true });
  } catch (error) { return friendly(error); }
}

export async function DELETE(request) {
  if (!sameOrigin(request)) return fail('Invalid request origin', 403);
  const ctx = await accessContext();
  if (ctx.error) return ctx.error;
  const url = new URL(request.url);
  const resource = url.searchParams.get('resource');
  const id = url.searchParams.get('id');
  try {
    await ensureTrainingCenterSchema();
    if (!validId(id)) throw new Refuse('資料編號不正確。');
    if (resource === 'teacher-certification') {
      const row = await one(`SELECT tc.id, tc.teacher_id, tc.certification_id, t.center_id, t.name AS teacher_name, c.name AS certification_name
        FROM hr_tc_teacher_certifications tc JOIN hr_tc_teachers t ON t.id=tc.teacher_id JOIN hr_tc_certifications c ON c.id=tc.certification_id WHERE tc.id=$1`, [id]);
      if (!row) throw new Refuse('找不到這筆持證紀錄。', 404);
      scope(ctx, row.center_id);
      const inUse = await one('SELECT name FROM hr_tc_classes WHERE teacher_id=$1 AND certification_id=$2 LIMIT 1', [row.teacher_id, row.certification_id]);
      if (inUse) throw new Refuse(`${row.teacher_name}老師仍是「${inUse.name}」班的授課老師，請先更換授課老師後再移除證照。`, 409);
      await pool.query('DELETE FROM hr_tc_teacher_certifications WHERE id=$1', [id]);
      if (!ctx.self) await recordAdminAction({ principal: ctx.principal, session: ctx.session, action: '刪除', type: 'training-teacher-certification', id: row.id, name: row.teacher_name,
        phrase: `移除了${row.teacher_name}老師的${row.certification_name}證照` });
      return NextResponse.json({ ok: true });
    }
    if (!TABLES[resource]) throw new Refuse('不支援的項目。');
    const existing = await one(`SELECT * FROM ${TABLES[resource]} WHERE id=$1`, [id]);
    if (!existing) throw new Refuse('找不到這筆資料。', 404);
    scope(ctx, resource === 'batch' ? (await one('SELECT center_id FROM hr_tc_classes WHERE id=$1', [existing.class_id]))?.center_id : existing.center_id);
    await pool.query(`DELETE FROM ${TABLES[resource]} WHERE id=$1`, [id]);
    await audit(ctx, '刪除', resource, existing, `刪除了${nameOf(resource, existing)}${LABELS[resource]}`);
    return NextResponse.json({ ok: true });
  } catch (error) { return friendly(error); }
}
