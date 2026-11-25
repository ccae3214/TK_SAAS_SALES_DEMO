"use client";

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, RotateCcw, UserRound, Check, List, Layers } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { translateHrText } from '@/lib/hr-translations';
import { decideWorker, shortlistView, swipeDecision, shortlistExperience } from '@/lib/hr-employer-shortlist';
import styles from './HrEmployerShortlist.module.css';
import { pickLang, copyFor } from '@/lib/language';

const COPY = {
  zh: { title: '為這張需求挑選人選', hint: '右滑加入待確認，左滑先略過。滑動不會送出，也不會安排面試。', temporary: '初選只暫存在此頁，離開或重新整理後會清空。',
    cards: '卡片瀏覽', list: '清單瀏覽', keep: '加入待確認', skip: '先略過', undo: '復原上一筆', profile: '查看完整履歷', pdf: '下載履歷 PDF',
    selected: '待確認人選', confirm: '確認挑選', sending: '送出中…', remove: '移出待確認', empty: '目前沒有可挑選的人選。人選或需求狀態變更後，名單也會更新。',
    finished: '已看完目前的人選', revisit: '重新瀏覽略過的人選', review: '請在下方確認要挑選的人選。尚未確認前不會送出。',
    none: '尚未加入人選。可以左右滑，或使用下方按鈕。', failed: '未能確認挑選。請查看頁面提示、更新名單後再試；此人選仍留在待確認中。',
    success: '已確認挑選，請到下方推薦人選查看後續進度。', unavailable: '部分人選已不在可選名單，已從本次初選移除。',
    language: '語言', experience: '工作經驗', training: '修習課程', unknown: '尚未填寫', agency: '所屬仲介', remaining: n => `還有 ${n} 位可瀏覽`, count: n => `${n} 位待確認`,
    order: (id, type) => `需求單 #${id}｜${type}`, keyboard: '可使用左右方向鍵，或下方的操作按鈕。', more: '顯示更多人選',
  },
  en: { title: 'Choose candidates for this request', hint: 'Swipe right to shortlist, left to skip. Swiping does not submit a selection or schedule an interview.', temporary: 'This shortlist is kept only on this page. Leaving or reloading clears it.',
    cards: 'Card view', list: 'List view', keep: 'Add to shortlist', skip: 'Skip for now', undo: 'Undo last choice', profile: 'View full resume', pdf: 'Download resume PDF',
    selected: 'Shortlist to confirm', confirm: 'Confirm selection', sending: 'Submitting…', remove: 'Remove from shortlist', empty: 'No candidates are available. The list updates when candidate or request availability changes.',
    finished: 'You have viewed all available candidates', revisit: 'Review skipped candidates', review: 'Confirm candidates below when ready. Nothing is submitted before you confirm.',
    none: 'No candidates shortlisted yet. Swipe or use the buttons below.', failed: 'Selection was not confirmed. Check the page message, refresh the list and try again. The candidate remains shortlisted.',
    success: 'Selection confirmed. See the recommended candidates below for next steps.', unavailable: 'Some candidates are no longer available and were removed from this shortlist.',
    language: 'Languages', experience: 'Work experience', training: 'Courses completed', unknown: 'Not provided', agency: 'Agency', remaining: n => `${n} left to review`, count: n => `${n} shortlisted`,
    order: (id, type) => `Request #${id} | ${type}`, keyboard: 'Use the left and right arrow keys, or the buttons below.', more: 'Show more candidates',
  },
};

export default function HrEmployerShortlist({ order, workers, onProfile, onDownload, downloading = false, onConfirm }) {
  const { lang } = useLanguage();
  const t = copyFor(COPY, lang);
  const [history, setHistory] = useState([]);
  const [mode, setMode] = useState('cards');
  const [limit, setLimit] = useState(12);
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState('');
  const [photo, setPhoto] = useState({ id: null, url: '' });
  const [offset, setOffset] = useState(0);
  const lock = useRef(false);
  const gesture = useRef(null);
  const card = useRef(null);
  const view = shortlistView(workers, history);
  const worker = view.current;
  const unavailable = history.length !== view.history.length;
  const eligibleKey = JSON.stringify(workers.map(item => String(item.id)));
  useEffect(() => {
    const allowed = new Set(JSON.parse(eligibleKey));
    setHistory(current => {
      const kept = current.filter(item => allowed.has(item.id));
      return kept.length === current.length ? current : kept;
    });
  }, [eligibleKey]);
  useEffect(() => {
    if (!worker) return;
    const controller = new AbortController();
    fetch(`/api/hr/workers/${worker.id}/resume-photo`, { cache: 'no-store', signal: controller.signal })
      .then(async response => response.ok ? response.json() : {}).then(body => {
        if (!controller.signal.aborted) setPhoto({ id: worker.id, url: body.photoDataUrl || '' });
      }).catch(() => {});
    return () => controller.abort();
  }, [worker?.id]);
  function choose(item, decision) {
    if (lock.current) return;
    setHistory(current => decideWorker(current, workers, item.id, decision));
    setOffset(0); gesture.current = null; setNotice('');
    // Preserve keyboard focus when the old card or its action buttons are replaced.
    requestAnimationFrame(() => card.current?.focus({ preventScroll: true }));
  }
  async function confirm(item) {
    if (lock.current || !workers.some(row => String(row.id) === String(item.id))) return;
    lock.current = true; setBusy(item.id); setNotice('');
    try {
      const result = await onConfirm(item);
      if (!result) { setNotice('failed'); return; }
      setHistory(current => current.filter(row => row.id !== String(item.id)));
      setNotice('success');
    } catch { setNotice('failed'); }
    finally { lock.current = false; setBusy(null); }
  }
  function pointerDown(event) {
    if (!worker || lock.current || !event.isPrimary || event.button !== 0 || event.target.closest('button,a,input,select,textarea')) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX - rect.left < 24 || rect.right - event.clientX < 24) return;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, workerId: worker.id };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event) {
    const start = gesture.current;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (Math.abs(dy) > 16 && Math.abs(dy) > Math.abs(dx)) { gesture.current = null; setOffset(0); return; }
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.4) setOffset(Math.max(-140, Math.min(140, dx)));
  }
  function pointerUp(event) {
    const start = gesture.current; gesture.current = null; setOffset(0);
    if (!start || !worker || start.workerId !== worker.id) return;
    const decision = swipeDecision(event.clientX - start.x, event.clientY - start.y);
    if (decision) choose(worker, decision);
  }
  const facts = item => {
    const profile = item.resume_profile || {};
    return <dl className={styles.facts}>
      <div><dt>{t.language}</dt><dd>{profile.languageOptions || t.unknown}</dd></div>
      <div><dt>{t.experience}</dt><dd>{shortlistExperience(profile) || t.unknown}</dd></div>
      {profile.coursesCompleted && <div><dt>{t.training}</dt><dd>{profile.coursesCompleted}</dd></div>}
    </dl>;
  };
  return <section className={styles.root} aria-label={t.title}>
    <header className={styles.heading}><div><p className={styles.order}>{t.order(order.id, translateHrText(order.job_type, lang))}</p><h5>{t.title}</h5><p>{t.hint}</p></div>
      <div className={styles.modes}><button type="button" aria-pressed={mode === 'cards'} onClick={() => setMode('cards')}><Layers aria-hidden="true" size={18}/>{t.cards}</button><button type="button" aria-pressed={mode === 'list'} onClick={() => setMode('list')}><List aria-hidden="true" size={18}/>{t.list}</button></div>
    </header>
    <p className={styles.temporary}>{t.temporary}</p>
    <div className={styles.progress}><span aria-live="polite">{t.remaining(view.remaining)}</span><span>{t.count(view.selected.length)}</span><button type="button" disabled={!view.history.length || busy !== null} onClick={() => { setHistory(view.history.slice(0, -1)); setNotice(''); }}><RotateCcw aria-hidden="true" size={16}/>{t.undo}</button></div>
    {unavailable && <p role="status">{t.unavailable}</p>}
    {notice && <p className={notice === 'failed' ? styles.error : styles.notice} role={notice === 'failed' ? 'alert' : 'status'}>{t[notice]}</p>}
    {mode === 'cards' && (worker ? <>
      <article ref={card} tabIndex={0} aria-label={worker.name} className={styles.card}
        onKeyDown={event => { if (event.target !== event.currentTarget) return; if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); choose(worker, event.key === 'ArrowRight' ? 'keep' : 'skip'); } }}
        onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { gesture.current = null; setOffset(0); }}
        style={{ transform: `translateX(${offset}px) rotate(${offset / 35}deg)`, userSelect: offset ? 'none' : undefined }}>
        <div className={styles.identity}><div className={styles.photo}>{photo.id === worker.id && photo.url ? <img src={photo.url} width="96" height="120" alt="" draggable="false"/> : <UserRound aria-hidden="true" size={40}/>}</div><div><p>{translateHrText(worker.job_preference, lang)}</p><h6>{worker.name}</h6><p>{worker.nationality || '—'}</p></div></div>
        {Math.abs(offset) > 24 && <span aria-hidden="true" className={styles.swipeHint}>{offset > 0 ? t.keep : t.skip}</span>}
        {facts(worker)}
        <div className={styles.detailActions}><button type="button" onClick={() => onProfile(worker)}>{t.profile}</button><button type="button" disabled={downloading} onClick={() => onDownload(worker)}>{t.pdf}</button></div>
      </article>
      <div className={styles.actions}><button type="button" disabled={busy !== null} onClick={() => choose(worker, 'skip')}><ArrowLeft aria-hidden="true" size={20}/>{t.skip}</button><button type="button" className={styles.primary} disabled={busy !== null} onClick={() => choose(worker, 'keep')}>{t.keep}<ArrowRight aria-hidden="true" size={20}/></button></div>
      <p className={styles.keyboard}>{t.keyboard}</p>
    </> : <div className={styles.empty}><strong>{workers.length ? t.finished : t.empty}</strong>{workers.length > 0 && <button type="button" disabled={busy !== null} onClick={() => setHistory(view.history.filter(item => item.decision === 'keep'))}>{t.revisit}</button>}</div>)}
    {mode === 'list' && <div className={styles.list}>{!workers.length && <p>{t.empty}</p>}{workers.slice(0, limit).map(item => <article key={item.id} className={styles.listItem}><h6>{item.name}</h6>{facts(item)}<div className={styles.detailActions}><button type="button" onClick={() => onProfile(item)}>{t.profile}</button><button type="button" disabled={busy !== null || view.selected.some(row => row.id === item.id)} onClick={() => choose(item, 'keep')}>{t.keep}</button></div></article>)}{workers.length > limit && <button type="button" onClick={() => setLimit(value => value + 12)}>{t.more}</button>}</div>}
    <section className={styles.shortlist} aria-label={t.selected}><h6>{t.selected} ({view.selected.length})</h6><p>{view.selected.length ? t.review : t.none}</p>
      {view.selected.map(item => <div className={styles.selected} key={item.id}><strong>{item.name}</strong><div className={styles.detailActions}><button type="button" onClick={() => onProfile(item)}>{t.profile}</button><button type="button" disabled={busy !== null} onClick={() => setHistory(current => current.filter(row => row.id !== String(item.id)))}>{t.remove}</button><button type="button" className={styles.primary} disabled={busy !== null} onClick={() => void confirm(item)}>{busy === item.id ? t.sending : <><Check aria-hidden="true" size={18}/>{t.confirm}</>}</button></div></div>)}
    </section>
  </section>;
}
