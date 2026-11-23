"use client";

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './HrAdminCalendar.module.css';
import { useLanguage } from '@/context/LanguageContext';
import { buildCalendarEvents, groupEventsByDate, monthGrid, shiftMonth, toDateKey } from '@/lib/hr-admin-calendar';
import { taipeiToday } from '@/lib/hr-training-auto-status';

const KIND_LABELS = { step: '案件進度', task: '待辦到期', order: '需求單預計開始' };
const PHASE_LABELS = { start: '開始', done: '完成' };
const MAX_DOTS = 3;

// 管理端總覽的行事曆：案件進度日期、待辦到期日、需求單預計開始日。點選日期看當天事項，點事項開啟案件。
export default function HrAdminCalendar({ data, onOpenCase, onOpenOrders }) {
  const { lang } = useLanguage();
  const locale = lang === 'en' ? 'en-US' : 'zh-TW';
  const today = taipeiToday();
  const [view, setView] = useState(() => ({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 }));
  const [selected, setSelected] = useState(today);

  const events = useMemo(() => buildCalendarEvents({
    applicationSteps: data?.applicationSteps, cases: data?.cases, tasks: data?.tasks, jobOrders: data?.jobOrders,
  }), [data?.applicationSteps, data?.cases, data?.tasks, data?.jobOrders]);
  const byDate = useMemo(() => groupEventsByDate(events), [events]);
  const weeks = useMemo(() => monthGrid(view.year, view.month), [view.year, view.month]);
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2023, 0, 1 + index)))), [locale]);
  const monthLabel = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(view.year, view.month, 1)));
  const monthPrefix = toDateKey(view.year, view.month, 1).slice(0, 7);
  const monthCount = events.filter(event => event.date.startsWith(monthPrefix)).length;
  const dayEvents = byDate.get(selected) || [];

  const go = delta => setView(current => shiftMonth(current.year, current.month, delta));
  const goToday = () => { setView({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 }); setSelected(today); };
  const openEvent = event => {
    if (event.kind === 'order') return onOpenOrders?.();
    const item = (data?.cases || []).find(row => Number(row.id) === Number(event.caseId));
    if (item) onOpenCase?.(item);
  };

  return <section className={styles.calendar} aria-label="行事曆">
    <header className={styles.header}>
      <div><h2>行事曆</h2><p>案件進度日期、待辦到期日與需求單預計開始日</p></div>
      <div className={styles.nav}>
        <button type="button" className={styles.navButton} aria-label="上個月" onClick={() => go(-1)}><ChevronLeft size={17} /></button>
        <strong className={styles.month}>{monthLabel}</strong>
        <button type="button" className={styles.navButton} aria-label="下個月" onClick={() => go(1)}><ChevronRight size={17} /></button>
        <button type="button" className={styles.todayButton} onClick={goToday}>今天</button>
      </div>
    </header>
    <div className={styles.legend}>{Object.entries(KIND_LABELS).map(([kind, label]) => <span key={kind}><i className={styles[`dot_${kind}`]} />{label}</span>)}</div>
    <div className={styles.grid} role="grid" aria-label={monthLabel}>
      {weekdays.map(name => <div key={name} className={styles.weekday} role="columnheader">{name}</div>)}
      {weeks.flat().map(cell => {
        const list = byDate.get(cell.date) || [];
        const kinds = [...new Set(list.map(event => event.kind))];
        return <button type="button" key={cell.date} role="gridcell" aria-selected={cell.date === selected}
          className={`${styles.cell} ${cell.inMonth ? '' : styles.outside} ${cell.date === today ? styles.today : ''} ${cell.date === selected ? styles.selected : ''}`}
          onClick={() => setSelected(cell.date)}>
          <span className={styles.day}>{cell.day}</span>
          {list.length > 0 && <span className={styles.dots}>{kinds.slice(0, MAX_DOTS).map(kind => <i key={kind} className={styles[`dot_${kind}`]} />)}<b>{list.length}</b></span>}
        </button>;
      })}
    </div>
    <div className={styles.detail}>
      <h3>{selected}{selected === today && <small> · <span>今天</span></small>}</h3>
      {dayEvents.length === 0
        ? <p className={styles.empty}>{monthCount === 0 ? '這個月沒有排定的事項' : '這一天沒有排定的事項'}</p>
        : <ul>{dayEvents.map(event => <li key={event.id}>
          <button type="button" className={styles.event} onClick={() => openEvent(event)}>
            <i className={styles[`dot_${event.kind}`]} />
            <span className={styles.eventText}>
              <strong>{event.title}{event.phase && <em> · <span>{PHASE_LABELS[event.phase]}</span></em>}</strong>
              {event.detail && <small>{event.detail}</small>}
            </span>
            <span className={styles.kind}>{KIND_LABELS[event.kind]}</span>
          </button>
        </li>)}</ul>}
    </div>
  </section>;
}
