import { NextResponse } from 'next/server';
import pool, { query } from '@/lib/db';
import { auth } from '@/auth';
import { getHrPrincipal } from '@/lib/hr-access';
import { ensureTrainingCenterSchema } from '@/lib/hr-training-center';
import { requestIsSameOrigin } from '@/lib/request-origin';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 學習系統（閱讀）：工人讀自己已報名課程的單元內容並標記讀完。
// 系統管理者與訓練中心會員可以預覽（唯讀），訓練中心只能看自己的課程。

const validId = value => /^\d+$/.test(String(value ?? '')) && Number(value) > 0;
const fail = (message, status = 400) => NextResponse.json({ error: message }, { status });

async function accessContext() {
  const session = await auth();
  if (!session?.user) return { error: fail('Authentication required', 401) };
  const principal = await getHrPrincipal(session);
  if (principal?.role === 'worker' && principal.worker_id) return { role: 'worker', workerId: principal.worker_id };
  if (principal?.role === 'admin') return { role: 'admin' };
  if (principal?.role === 'training_center' && principal.id) return { role: 'training_center', centerId: principal.id };
  return { error: fail('僅工人、系統管理者或訓練中心會員可使用學習系統。', 403) };
}

// 只回傳這個身分看得到的課程：工人必須已報名該課程的班別。
async function readableCourse(ctx, courseId) {
  if (!validId(courseId)) return null;
  const base = `SELECT co.id, co.name, co.hours, c.name AS certification_name, ctr.display_name AS center_name
    FROM hr_tc_courses co JOIN hr_tc_certifications c ON c.id=co.certification_id JOIN hr_members ctr ON ctr.id=co.center_id WHERE co.id=$1`;
  if (ctx.role === 'worker') {
    return (await query(`${base} AND EXISTS(SELECT 1 FROM hr_tc_enrollments e JOIN hr_tc_classes cl ON cl.id=e.class_id WHERE e.worker_id=$2 AND cl.course_id=co.id)`, [courseId, ctx.workerId]))[0] || null;
  }
  if (ctx.role === 'training_center') return (await query(`${base} AND co.center_id=$2`, [courseId, ctx.centerId]))[0] || null;
  return (await query(base, [courseId]))[0] || null;
}

const UNIT_COLUMNS = 'id, course_id, position, name, name_en, hours, topics, topics_en, examples, vocabulary, dialogue';
const completedIdsOf = async (ctx, courseId) => ctx.role !== 'worker' ? [] : (await query(
  `SELECT p.unit_id FROM hr_tc_unit_progress p JOIN hr_tc_course_units u ON u.id=p.unit_id WHERE p.worker_id=$1 AND u.course_id=$2`,
  [ctx.workerId, courseId])).map(row => Number(row.unit_id));

export async function GET(request) {
  const ctx = await accessContext();
  if (ctx.error) return ctx.error;
  try {
    await ensureTrainingCenterSchema();
    const courseId = new URL(request.url).searchParams.get('courseId');
    const course = await readableCourse(ctx, courseId);
    if (!course) return fail('找不到這門課程，或您沒有報名這門課程。', 404);
    const units = await query(`SELECT ${UNIT_COLUMNS} FROM hr_tc_course_units WHERE course_id=$1 ORDER BY position, id`, [course.id]);
    return NextResponse.json({ course, units, completedUnitIds: await completedIdsOf(ctx, course.id), readOnly: ctx.role !== 'worker' });
  } catch (error) {
    console.error('hr_learning_read_failed', error?.code || error?.name || 'Error');
    return fail('無法讀取學習內容，請稍後再試。', 500);
  }
}

// 工人標記單元「已讀完」或取消標記。
export async function POST(request) {
  if (!requestIsSameOrigin(request)) return fail('Invalid origin', 403);
  const ctx = await accessContext();
  if (ctx.error) return ctx.error;
  if (ctx.role !== 'worker') return fail('只有工人可以記錄學習進度。', 403);
  let body;
  try { body = await request.json(); } catch { return fail('Invalid JSON'); }
  if (!validId(body?.unitId) || typeof body?.completed !== 'boolean') return fail('資料格式不正確。');
  try {
    await ensureTrainingCenterSchema();
    const unit = (await query('SELECT id, course_id FROM hr_tc_course_units WHERE id=$1', [body.unitId]))[0];
    // 單元所屬課程必須是這位工人已報名的課程。
    if (!unit || !(await readableCourse(ctx, unit.course_id))) return fail('找不到這個單元，或您沒有報名這門課程。', 404);
    if (body.completed) {
      await pool.query('INSERT INTO hr_tc_unit_progress(worker_id, unit_id) VALUES($1,$2) ON CONFLICT(worker_id, unit_id) DO NOTHING', [ctx.workerId, unit.id]);
    } else {
      await pool.query('DELETE FROM hr_tc_unit_progress WHERE worker_id=$1 AND unit_id=$2', [ctx.workerId, unit.id]);
    }
    return NextResponse.json({ ok: true, completedUnitIds: await completedIdsOf(ctx, unit.course_id) });
  } catch (error) {
    console.error('hr_learning_write_failed', error?.code || error?.name || 'Error');
    return fail('無法記錄學習進度，請稍後再試。', 500);
  }
}
