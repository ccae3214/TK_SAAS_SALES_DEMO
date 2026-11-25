"use client";

import { useState } from 'react';
import { trainingEvents, daysUntil, whenLabel, TRAINING_REMINDER_DAYS } from '@/lib/hr-worker-training';
import HrWorkerLearning from '@/components/HrWorkerLearning';
import { useLanguage } from '@/context/LanguageContext';
import { pickLang } from '@/lib/language';

// 工人頁面的「訓練課程」：列出報名的班別、課程日期與證照辦件日期，近期日期會標示提醒。
export default function HrWorkerTraining({ courses = [] }) {
  const { lang } = useLanguage();
  const [learningCourseId, setLearningCourseId] = useState(null);
  // 句子中間有變數時要整句組成一個字串；JSX 的 {變數} 會把文字拆成多個節點，英文翻譯就比對不到。
  const intro = pickLang(lang, `顯示您報名的證照課程日期與證照辦件日期；${TRAINING_REMINDER_DAYS} 天內的日期會出現在上方提醒。`, `Shows the certification course dates and certification application dates you are enrolled in. Dates within ${TRAINING_REMINDER_DAYS} days appear in the reminders above.`);
  if (learningCourseId) return <section className="hr-member-card"><HrWorkerLearning courseId={learningCourseId} onClose={() => setLearningCourseId(null)} /></section>;
  return <section className="hr-member-card">
    <h2>訓練課程</h2>
    <p>{intro}</p>
    {courses.length === 0 && <p>目前尚未報名訓練課程。文件核准後，訓練中心或仲介會為您安排班別。</p>}
    {courses.map(course => {
      const events = trainingEvents(course);
      return <div className="worker-case" key={course.id}>
        <h3>{course.certification_name} · {course.class_name}</h3>
        <p>{course.center_name}{course.course_name ? ` · ${course.course_name}` : ''}{course.hours ? ` · ${course.hours} 小時` : ''}</p>
        {course.course_id && <p><button type="button" className="table-action" onClick={() => setLearningCourseId(course.course_id)}>開始學習</button></p>}
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
