"use client";

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell } from 'lucide-react';
import styles from './HrReminders.module.css';
import { REMINDER_LABELS } from '@/lib/hr-expiry-reminders';
import { employerMissingLabels } from '@/lib/hr-employer-profile';
import { collectTrainingReminders, whenLabel } from '@/lib/hr-worker-training';
import { readJson } from '@/lib/hr-read-json';
import { useLanguage } from '@/context/LanguageContext';
import { translateHrText } from '@/lib/hr-translations';
import { translateChatSystemMessage } from '@/lib/hr-translations-chat';

const DAYS_AHEAD = 7;
const WORKER_RESUME_FIELDS = [
  ['birthDate', '出生日期'],
  ['gender', '性別'],
  ['birthplace', '出生地'],
  ['address', '地址'],
  ['height', '身高'],
  ['weight', '體重'],
  ['maritalStatus', '婚姻狀況'],
  ['educationLevels', '教育程度'],
  ['languageOptions', '語言能力'],
  ['workedAbroad', '是否曾在海外工作'],
];
const EMPLOYER_FIELDS = [
  ['name', '雇主／客戶名稱'],
  ['contact_name', '聯絡人'],
  ['phone', '電話'],
  ['email', 'Email'],
  ['address', '地址'],
];
const AGENCY_FIELDS = [['name', '仲介名稱'], ['country', '國家／地區']];

function isFilled(value) {
  return Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && String(value).trim() !== '';
}

function hasLanguageInfo(profile) {
  if (isFilled(profile.languageOptions)) return true;
  const legacy = String(profile.languages || '').trim();
  if (!legacy) return false;
  try {
    const parsed = JSON.parse(legacy);
    return parsed && typeof parsed === 'object' ? Object.keys(parsed).length > 0 : isFilled(parsed);
  } catch {
    return true;
  }
}

function collectProfileReminders(data) {
  const reminders = [];
  const workers = data.role === 'worker'
    ? data.workers || []
    : ['admin', 'agency'].includes(data.role) ? data.workers || [] : [];
  const workerMembers = new Set((data.members || [])
    .filter(member => member.role === 'worker' && member.active && member.worker_id)
    .map(member => Number(member.worker_id)));

  workers.filter(worker => worker.status === 'active' && (data.role !== 'admin' || workerMembers.has(Number(worker.id))))
    .forEach(worker => {
      const profile = worker.resume_profile || {};
      const missing = [
        ...(!isFilled(worker.nationality) ? ['國籍'] : []),
        ...(!isFilled(worker.phone) ? ['聯絡電話'] : []),
        ...(!isFilled(worker.job_preference) ? ['工作意向'] : []),
        ...WORKER_RESUME_FIELDS.filter(([field]) => !(
          field === 'educationLevels' ? isFilled(profile.educationLevels || profile.education)
            : field === 'languageOptions' ? hasLanguageInfo(profile)
              : isFilled(profile[field])
        )).map(([, label]) => label),
      ];
      if (missing.length) reminders.push({
        id: `worker:${worker.id}`,
        type: 'worker',
        entityId: Number(worker.id),
        title: `${worker.name} · 履歷尚未完成`,
        detail: `待補：${missing.join('、')}`,
      });
    });

  const employers = data.role === 'admin'
    ? data.employers || []
    : data.role === 'employer' ? data.employers || []
      : data.role === 'agency' && data.agencyType === 'taiwan'
        ? (data.employers || []).filter(employer => Number(employer.agency_id) === Number(data.agencyId))
        : [];
  employers.filter(employer => employer.status === 'active').forEach(employer => {
    const missing = [...EMPLOYER_FIELDS.filter(([field]) => !isFilled(employer[field])).map(([, label]) => label), ...employerMissingLabels(employer)];
    if (missing.length) reminders.push({
      id: `employer:${employer.id}`,
      type: 'employer',
      entityId: Number(employer.id),
      title: `${employer.name || '雇主／客戶'} · 基本資料未完成`,
      detail: `待補：${missing.join('、')}`,
    });
  });

  const agencies = data.role === 'admin'
    ? data.agencies || []
    : data.role === 'agency' ? (data.agencies || []).filter(agency => Number(agency.id) === Number(data.agencyId))
      : [];
  agencies.filter(agency => agency.active).forEach(agency => {
    const missing = AGENCY_FIELDS.filter(([field]) => !isFilled(agency[field])).map(([, label]) => label);
    if (missing.length) reminders.push({
      id: `agency:${agency.id}`,
      type: 'agency',
      entityId: Number(agency.id),
      title: `${agency.name || '仲介機構'} · 基本資料未完成`,
      detail: `待補：${missing.join('、')}`,
    });
  });
  return reminders;
}

function localDate(value) {
  const dateText = String(value || '').slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

function collectDateReminders(data) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cases = new Map((data.cases || []).map(item => [Number(item.id), item]));
  return (data.applicationSteps || []).flatMap(step => {
    const start = localDate(step.started_on);
    const completed = localDate(step.completed_on);
    if (completed && completed < today) return [];
    const target = start && start >= today ? start : (!completed ? start : completed >= today ? completed : null);
    if (!target) return [];
    const days = Math.round((target.getTime() - today.getTime()) / 86400000);
    if (days > DAYS_AHEAD || (days < 0 && completed)) return [];
    const item = cases.get(Number(step.case_id));
    if (!item) return [];
    return [{
      id: `${step.case_id}:${step.step_key}`,
      workerId: Number(item.worker_id),
      worker: item.worker_name,
      caseNumber: item.case_number,
      step: step.label,
      days,
      date: target.toLocaleDateString('zh-TW'),
    }];
  }).sort((a, b) => a.days - b.days || a.date.localeCompare(b.date));
}

// variant="panel"（預設）：直接顯示提醒視窗；variant="bell"：頁首的小鈴鐺，點開才出現提醒清單。
export default function HrReminders({ onOpenChat: openChat, onOpenProgress: openProgress, onOpenProfile: openProfile, onOpenTraining: openTraining, wide = false, variant = 'panel' }) {
  const { lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const bellRef = useRef(null);
  const popoverRef = useRef(null);
  const [popoverPosition, setPopoverPosition] = useState({ top: 72, left: 16, right: 16 });
  // 在鈴鐺的清單裡點選提醒後，先收起清單再前往對應頁面。
  const onOpenChat = (...args) => { setOpen(false); return openChat?.(...args); };
  const onOpenProgress = (...args) => { setOpen(false); return openProgress?.(...args); };
  const onOpenProfile = (...args) => { setOpen(false); return openProfile?.(...args); };
  const onOpenTraining = (...args) => { setOpen(false); return openTraining?.(...args); };
  const [trainingReminders, setTrainingReminders] = useState([]);
  const [dateReminders, setDateReminders] = useState([]);
  const [expiryReminders, setExpiryReminders] = useState([]);
  const [profileReminders, setProfileReminders] = useState([]);
  const [unreadRooms, setUnreadRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const [hrResponse, chatResponse] = await Promise.all([
          fetch('/api/hr', { cache: 'no-store' }),
          fetch('/api/hr/chat', { cache: 'no-store' }),
        ]);
        const [hr, chat] = await Promise.all([readJson(hrResponse), readJson(chatResponse)]);
        if (!hrResponse.ok || !chatResponse.ok) throw new Error('提醒暫時無法載入');
        if (!active) return;
        setDateReminders(collectDateReminders(hr));
        setExpiryReminders(hr.expiryReminders || []);
        setProfileReminders(collectProfileReminders(hr));
        setTrainingReminders(hr.role === 'worker' ? collectTrainingReminders(hr.trainingCourses) : []);
        setUnreadRooms((chat.rooms || []).filter(room => Number(room.unreadCount) > 0));
      } catch {
        if (active) {
          setDateReminders([]);
          setProfileReminders([]);
          setTrainingReminders([]);
          setUnreadRooms([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const close = event => {
      if (!rootRef.current?.contains(event.target) && !popoverRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = event => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', onKey); };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const updatePosition = () => {
      const trigger = bellRef.current?.getBoundingClientRect();
      if (!trigger) return;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      if (viewportWidth <= 720) {
        setPopoverPosition({ top: 72, left: 16, right: 16 });
        return;
      }
      const panelWidth = Math.min(420, viewportWidth - 32);
      const right = Math.max(16, Math.min(viewportWidth - panelWidth - 16, viewportWidth - trigger.right));
      const panelHeight = Math.min(640, viewportHeight * 0.7);
      const below = trigger.bottom + 10;
      const top = below + panelHeight <= viewportHeight - 16
        ? below
        : Math.max(16, trigger.top - panelHeight - 10);
      setPopoverPosition({ top, left: 'auto', right });
    };
    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  const unreadCount = unreadRooms.reduce((sum, room) => sum + Number(room.unreadCount || 0), 0);
  const reminderCount = unreadCount + dateReminders.length + expiryReminders.length + trainingReminders.length + profileReminders.length;
  const bell = variant === 'bell';
  // 一般模式：沒有任何提醒（或還在讀取）時不顯示整個提醒視窗；有提醒時才出現。鈴鐺模式一律顯示鈴鐺。
  if (!bell) {
    if (loading || reminderCount === 0) return null;
  }
  const shownCount = loading ? 0 : reminderCount;
  const body = <>
    {unreadRooms.length > 0 && <div className={styles.group}><h3>聊天室未讀</h3>{unreadRooms.map(room => <button type="button" className={styles.item} key={room.id} onClick={() => onOpenChat?.(Number(room.id))}><span className={styles.dotChat}/><span className={styles.itemText}><strong>{room.title}</strong><small>{translateChatSystemMessage(room.lastMessage, lang, text => translateHrText(text, 'en')) || '有新訊息'}</small></span><b>{room.unreadCount}</b></button>)}</div>}
    {expiryReminders.length > 0 && <div className={styles.group}><h3>到期提醒</h3>{expiryReminders.map(item => <button type="button" className={styles.item} key={`${item.kind}:${item.workerId}`} onClick={() => onOpenProgress?.(item.workerId)}><span className={item.overdue ? styles.dotOverdue : styles.dotDate}/><span className={styles.itemText}><strong>{REMINDER_LABELS[item.kind][item.overdue ? 'overdue' : 'upcoming']}</strong><small>{item.workerName} · {item.dueOn} · {item.overdue ? `逾期 ${Math.abs(item.daysLeft)} 天` : item.daysLeft === 0 ? '今天' : `剩 ${item.daysLeft} 天`}</small></span></button>)}</div>}
    {trainingReminders.length > 0 && <div className={styles.group}><h3>訓練課程與證照日期</h3>{trainingReminders.map(item => <button type="button" className={styles.item} key={item.id} onClick={() => onOpenTraining?.()}><span className={styles.dotDate}/><span className={styles.itemText}><strong>{whenLabel(item.days)} · {item.title}</strong><small>{item.course} · {item.className} · {item.date}</small></span></button>)}</div>}
    {dateReminders.length > 0 && <div className={styles.group}><h3>近期案件日期</h3>{dateReminders.map(item => <button type="button" className={styles.item} key={item.id} onClick={() => onOpenProgress?.(item.workerId)}><span className={item.days < 0 ? styles.dotOverdue : styles.dotDate}/><span className={styles.itemText}><strong>{item.days < 0 ? `逾期 ${Math.abs(item.days)} 天` : item.days === 0 ? '今天' : `${item.days} 天後`} · {item.step}</strong><small>{item.worker} · {item.caseNumber} · {item.date}</small></span></button>)}</div>}
    {profileReminders.length > 0 && <div className={styles.group}><h3>基本資料待補</h3>{profileReminders.map(item => <button type="button" className={styles.item} key={item.id} onClick={() => onOpenProfile?.(item)}><span className={styles.dotProfile}/><span className={styles.itemText}><strong>{item.title}</strong><small>{item.detail}</small></span><b>補資料</b></button>)}</div>}
  </>;
  if (!bell) return <section className={`${styles.panel} ${wide ? styles.panelWide : ''}`} aria-label="提醒">
    <header className={styles.header}><div><span>提醒</span><h2>需要留意</h2></div><strong>{reminderCount}</strong></header>
    {body}
  </section>;
  return <div className={styles.bellRoot} ref={rootRef}>
    <button ref={bellRef} type="button" className={styles.bellButton} aria-label="提醒" title="提醒" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(current => !current)}>
      <Bell size={17} />{shownCount > 0 && <b className={styles.bellBadge}>{shownCount > 99 ? '99+' : shownCount}</b>}
    </button>
    {open && typeof document !== 'undefined' && createPortal(<section ref={popoverRef} className={styles.popover} style={{ position: 'fixed', top: popoverPosition.top, left: popoverPosition.left, right: popoverPosition.right, zIndex: 2147483000 }} role="dialog" aria-label="提醒">
      <header className={styles.header}><div><span>提醒</span><h2>需要留意</h2></div>{shownCount > 0 && <strong>{shownCount}</strong>}</header>
      {shownCount === 0 ? <p className={styles.empty}>{loading ? '正在讀取…' : '目前沒有提醒'}</p> : body}
    </section>, document.body)}
  </div>;
}
