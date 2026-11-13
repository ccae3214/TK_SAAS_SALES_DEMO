// 工人的訓練課程：把班別日期與證照辦件日期整理成時間軸與提醒（工人頁面與提醒面板共用）。

export const TRAINING_REMINDER_DAYS = 30;
export const BATCH_STATUS_LABELS = { preparing: '準備中', submitted: '已送件', issued: '已發證' };

const parseDate = value => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
};
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
export const daysUntil = (value, today = startOfToday()) => {
  const date = parseDate(value);
  return date ? Math.round((date.getTime() - today.getTime()) / 86400000) : null;
};
export const whenLabel = days => days === 0 ? '今天' : days > 0 ? `${days} 天後` : `已過 ${-days} 天`;

// 依日期排出課程的重要事件；證照辦件日期來自該班別最新的證照批次。
export function trainingEvents(course) {
  const batchLabel = BATCH_STATUS_LABELS[course.batch_status] || '';
  return [
    { key: 'start', label: '開訓日期', date: course.training_start_date },
    { key: 'end', label: '結訓日期', date: course.training_end_date },
    { key: 'exam', label: course.exam_location ? `考證日期（${course.exam_location}）` : '考證日期', date: course.exam_date },
    { key: 'applied', label: batchLabel ? `證照辦件日期（${batchLabel}）` : '證照辦件日期', date: course.batch_applied_date },
    { key: 'issue', label: '預計取證日期', date: course.certificate_issue_date },
  ].filter(event => event.date);
}

// 近期（含今天）要提醒工人的事件，依日期由近到遠。
export function collectTrainingReminders(courses = [], today = startOfToday()) {
  return courses.flatMap(course => trainingEvents(course).flatMap(event => {
    const days = daysUntil(event.date, today);
    if (days === null || days < 0 || days > TRAINING_REMINDER_DAYS) return [];
    if (event.key === 'issue' && course.batch_status === 'issued') return [];
    return [{ id: `${course.id}:${event.key}`, days, title: event.label, course: course.certification_name || course.course_name, className: course.class_name, date: String(event.date).slice(0, 10) }];
  })).sort((a, b) => a.days - b.days);
}
