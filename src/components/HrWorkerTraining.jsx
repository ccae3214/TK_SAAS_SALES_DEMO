"use client";

import { trainingEvents, daysUntil, whenLabel, TRAINING_REMINDER_DAYS } from '@/lib/hr-worker-training';

// 工人頁面的「訓練課程」：列出報名的班別、課程日期與證照辦件日期，近期日期會標示提醒。
export default function HrWorkerTraining({ courses = [] }) {
  return <section className="hr-member-card">
    <h2>訓練課程</h2>
    <p>顯示您報名的證照課程日期與證照辦件日期；{TRAINING_REMINDER_DAYS} 天內的日期會出現在上方提醒。</p>
    {courses.length === 0 && <p>目前尚未報名訓練課程。文件核准後，訓練中心或仲介會為您安排班別。</p>}
    {courses.map(course => {
      const events = trainingEvents(course);
      return <div className="worker-case" key={course.id}>
        <h3>{course.certification_name} · {course.class_name}</h3>
        <p>{course.center_name}{course.course_name ? ` · ${course.course_name}` : ''}{course.hours ? ` · ${course.hours} 小時` : ''}</p>
        <div className="hr-member-table-wrap"><table><thead><tr><th>項目</th><th>日期</th><th>提醒</th></tr></thead><tbody>
          {events.map(event => {
            const days = daysUntil(event.date);
            const soon = days !== null && days >= 0 && days <= TRAINING_REMINDER_DAYS;
            return <tr key={event.key}><td>{event.label}</td><td>{String(event.date).slice(0, 10)}</td><td>{soon ? <strong>{whenLabel(days)}</strong> : days !== null && days < 0 ? '已過' : whenLabel(days)}</td></tr>;
          })}
          {!course.batch_applied_date && <tr><td>證照辦件日期</td><td>—</td><td>尚未安排</td></tr>}
        </tbody></table></div>
      </div>;
    })}
  </section>;
}
