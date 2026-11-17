"use client";

import { useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { learningProgress, parseLessonLines } from '@/lib/hr-learning';
import styles from './HrWorkerLearning.module.css';

// 工人的學習頁：單元清單（含進度）→ 單元內容（學習重點、詞彙、例句、對話）→ 標記讀完。
// 系統管理者與訓練中心預覽時為唯讀（不能標記進度）。
export default function HrWorkerLearning({ courseId, onClose }) {
  const { lang } = useLanguage();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [unitId, setUnitId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setData(null); setError(''); setUnitId(null);
    fetch(`/api/hr/learning?courseId=${encodeURIComponent(courseId)}`, { cache: 'no-store' })
      .then(async response => ({ ok: response.ok, body: await response.json().catch(() => ({})) }))
      .then(({ ok, body }) => {
        if (cancelled) return;
        if (!ok) return setError(body.error || '無法讀取學習內容，請稍後再試。');
        setData(body); setCompleted(body.completedUnitIds || []);
      })
      .catch(() => { if (!cancelled) setError('無法讀取學習內容，請稍後再試。'); });
    return () => { cancelled = true; };
  }, [courseId]);

  const pick = (zh, en) => lang === 'en' && en ? en : zh;
  const units = data?.units || [];
  const progress = learningProgress(units, completed);
  const unit = units.find(item => Number(item.id) === Number(unitId)) || null;
  const index = unit ? units.indexOf(unit) : -1;

  async function toggle(target) {
    const next = !completed.includes(Number(target.id));
    setSaving(true); setError('');
    try {
      const response = await fetch('/api/hr/learning', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unitId: target.id, completed: next }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || '無法記錄學習進度，請稍後再試。');
      setCompleted(body.completedUnitIds || []);
    } catch (err) { setError(err.message || '無法記錄學習進度，請稍後再試。'); }
    finally { setSaving(false); }
  }

  const header = <div className={styles.header}>
    <h3>{`學習：${data?.course?.name || ''}`}</h3>
    <button type="button" className={styles.button} onClick={onClose}>回到課程</button>
  </div>;
  if (error && !data) return <div className={styles.panel}>{header}<p className={styles.error}>{error}</p></div>;
  if (!data) return <div className={styles.panel}>{header}<p className={styles.muted}>讀取中…</p></div>;

  if (unit) {
    const isDone = completed.includes(Number(unit.id));
    const next = units[index + 1];
    const prev = units[index - 1];
    const vocabulary = parseLessonLines(unit.vocabulary);
    const examples = parseLessonLines(unit.examples);
    const dialogue = parseLessonLines(unit.dialogue, { speaker: true });
    const topics = pick(unit.topics, unit.topics_en);
    return <div className={styles.panel}>
      {header}
      <p className={styles.muted}>{`${index + 1} / ${units.length}${unit.hours ? ` · ${unit.hours} 小時` : ''}`}</p>
      <h3>{pick(unit.name, unit.name_en)}</h3>
      {topics && <div className={styles.section}><h4>學習重點</h4><p>{topics}</p></div>}
      {vocabulary.length > 0 && <div className={styles.section}><h4>詞彙</h4><div className={styles.tableWrap}><table className={styles.lessonTable}><thead><tr><th>詞彙</th><th>拼音</th><th>英文</th></tr></thead><tbody>
        {vocabulary.map((row, i) => <tr key={i}><td className={styles.zh}>{row.zh}</td><td>{row.pinyin}</td><td>{row.en}</td></tr>)}
      </tbody></table></div></div>}
      {examples.length > 0 && <div className={styles.section}><h4>例句</h4><div className={styles.dialogue}>
        {examples.map((row, i) => <div className={styles.lineText} key={i}><span className={styles.zh}>{row.zh}</span> {row.pinyin}<small>{row.en}</small></div>)}
      </div></div>}
      {dialogue.length > 0 && <div className={styles.section}><h4>對話</h4><div className={styles.dialogue}>
        {dialogue.map((row, i) => <div className={styles.line} key={i}>
          <span className={styles.speaker}>{row.speaker || '•'}</span>
          <div className={styles.lineText}><span className={styles.zh}>{row.zh}</span> {row.pinyin}<small>{row.en}</small></div>
        </div>)}
      </div></div>}
      {!topics && !vocabulary.length && !examples.length && !dialogue.length && <p className={styles.muted}>這個單元還沒有學習內容。</p>}
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={() => setUnitId(null)}>回到單元清單</button>
        {prev && <button type="button" className={styles.button} onClick={() => setUnitId(prev.id)}>上一單元</button>}
        {!data.readOnly && <button type="button" className={`${styles.button} ${isDone ? '' : styles.buttonPrimary}`} disabled={saving} onClick={() => toggle(unit)}>{isDone ? '取消已讀完標記' : '標記為已讀完'}</button>}
        {next && <button type="button" className={styles.button} onClick={() => setUnitId(next.id)}>下一單元</button>}
      </div>
    </div>;
  }

  return <div className={styles.panel}>
    {header}
    <p className={styles.muted}>{[data.course.certification_name, data.course.center_name].filter(Boolean).join(' · ')}</p>
    {units.length > 0 && !data.readOnly && <div className={styles.progress}>
      <div className={styles.bar} role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress.percent}><div className={styles.barFill} style={{ width: `${progress.percent}%` }} /></div>
      <p className={styles.muted}>{`已讀完 ${progress.done} / ${progress.total} 個單元`}</p>
    </div>}
    {units.length === 0 && <p className={styles.muted}>這門課程還沒有單元內容，訓練中心建立後就能在這裡學習。</p>}
    {error && <p className={styles.error}>{error}</p>}
    <ol className={styles.unitList}>
      {units.map((item, i) => {
        const isDone = completed.includes(Number(item.id));
        return <li key={item.id} className={`${styles.unitRow} ${isDone ? styles.unitDone : ''}`}>
          <span className={styles.unitNo}>{i + 1}</span>
          <span className={styles.unitTitle}><strong>{pick(item.name, item.name_en)}</strong>{item.hours ? <small>{`${item.hours} 小時`}</small> : null}</span>
          {!data.readOnly && <span className={`${styles.badge} ${isDone ? styles.badgeDone : ''}`}>{isDone ? '已讀完' : '未讀'}</span>}
          <button type="button" className={`${styles.button} ${!isDone && item.id === progress.nextUnitId ? styles.buttonPrimary : ''}`} onClick={() => setUnitId(item.id)}>{isDone ? '複習' : item.id === progress.nextUnitId && progress.done > 0 ? '繼續學習' : '開始學習'}</button>
        </li>;
      })}
    </ol>
  </div>;
}
