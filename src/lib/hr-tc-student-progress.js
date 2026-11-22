// 訓練中心「學員學習狀況與測驗成績」：把班別、報名名單、課程單元、學習進度與測驗紀錄整理成每個班別的學員清單。
// 純函式（不碰資料庫），方便測試；資料由 /api/hr/training-center 的 GET 提供。
import { learningProgress } from './hr-learning.js';

const sum = (list, pick) => list.reduce((total, item) => total + (Number(pick(item)) || 0), 0);
const latestOf = values => values.filter(Boolean).reduce((best, value) => (!best || Date.parse(value) > Date.parse(best) ? value : best), null);

// 學習狀態：課程沒有單元 / 尚未開始 / 學習中 / 已完成（所有單元都讀完）。
export function learningStatus({ total, done, quiz }) {
  if (!total) return 'no_units';
  if (done >= total) return 'done';
  return done > 0 || quiz.taken > 0 ? 'learning' : 'not_started';
}

// progress：{ worker_id, unit_id, completed_at }；quizzes：每位工人每個單元一列的彙總
// { worker_id, unit_id, attempts, best_percent, passed, last_percent, last_correct, last_total, last_at }。
export function buildStudentProgress({ classes = [], enrollments = [], units = [], progress = [], quizzes = [] } = {}) {
  const unitsByCourse = new Map();
  for (const unit of units) {
    const key = Number(unit.course_id);
    if (!unitsByCourse.has(key)) unitsByCourse.set(key, []);
    unitsByCourse.get(key).push(unit);
  }
  const key = (workerId, unitId) => `${Number(workerId)}:${Number(unitId)}`;
  const completedAt = new Map(progress.map(row => [key(row.worker_id, row.unit_id), row.completed_at || true]));
  const quizOf = new Map(quizzes.map(row => [key(row.worker_id, row.unit_id), row]));

  return classes.map(cls => {
    const courseUnits = unitsByCourse.get(Number(cls.course_id)) || [];
    const students = enrollments.filter(item => Number(item.class_id) === Number(cls.id)).map(item => {
      const rows = courseUnits.map(unit => {
        const done = completedAt.get(key(item.worker_id, unit.id));
        return { unit, completed: Boolean(done), completedAt: typeof done === 'string' ? done : null, quiz: quizOf.get(key(item.worker_id, unit.id)) || null };
      });
      const progressStat = learningProgress(courseUnits, rows.filter(row => row.completed).map(row => row.unit.id));
      const taken = rows.filter(row => row.quiz);
      const quiz = {
        taken: taken.length,
        passed: taken.filter(row => row.quiz.passed).length,
        attempts: sum(taken, row => row.quiz.attempts),
        // 平均：每個有測驗的單元取最佳一次成績再平均；還沒測驗過是 null。
        average: taken.length ? Math.round(sum(taken, row => row.quiz.best_percent) / taken.length) : null,
      };
      return {
        enrollmentId: item.id, workerId: item.worker_id, name: item.worker_name, units: rows, ...progressStat, quiz,
        lastActivity: latestOf([...rows.map(row => row.completedAt), ...taken.map(row => row.quiz.last_at)]),
        status: learningStatus({ total: progressStat.total, done: progressStat.done, quiz }),
      };
    });
    return { cls, totalUnits: courseUnits.length, students };
  });
}
