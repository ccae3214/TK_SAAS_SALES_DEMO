"use client";

import { useEffect, useState } from 'react';
import styles from './HrReminders.module.css';
import { employerMissingLabels } from '@/lib/hr-employer-profile';
import { collectTrainingReminders, whenLabel } from '@/lib/hr-worker-training';

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

export default function HrReminders({ onOpenChat, onOpenProgress, onOpenProfile, onOpenTraining }) {
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
        const [hr, chat] = await Promise.all([hrResponse.json(), chatResponse.json()]);
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

  const unreadCount = unreadRooms.reduce((sum, room) => sum + Number(room.unreadCount || 0), 0);
  const reminderCount = unreadCount + dateReminders.length + trainingReminders.length + profileReminders.length;
  return <section className={styles.panel} aria-label="提醒">
    <header className={styles.header}><div><span>提醒</span><h2>需要留意</h2></div><strong>{loading ? '…' : reminderCount}</strong></header>
    {!loading && reminderCount === 0 && <p className={styles.empty}>目前沒有未讀訊息、近期重要日期或待補資料。</p>}
    {unreadRooms.length > 0 && <div className={styles.group}><h3>聊天室未讀</h3>{unreadRooms.map(room => <button type="button" className={styles.item} key={room.id} onClick={() => onOpenChat?.(Number(room.id))}><span className={styles.dotChat}/><span className={styles.itemText}><strong>{room.title}</strong><small>{room.lastMessage || '有新訊息'}</small></span><b>{room.unreadCount}</b></button>)}</div>}
    {trainingReminders.length > 0 && <div className={styles.group}><h3>訓練課程與證照日期</h3>{trainingReminders.map(item => <button type="button" className={styles.item} key={item.id} onClick={() => onOpenTraining?.()}><span className={styles.dotDate}/><span className={styles.itemText}><strong>{whenLabel(item.days)} · {item.title}</strong><small>{item.course} · {item.className} · {item.date}</small></span></button>)}</div>}
    {dateReminders.length > 0 && <div className={styles.group}><h3>近期案件日期</h3>{dateReminders.map(item => <button type="button" className={styles.item} key={item.id} onClick={() => onOpenProgress?.(item.workerId)}><span className={item.days < 0 ? styles.dotOverdue : styles.dotDate}/><span className={styles.itemText}><strong>{item.days < 0 ? `逾期 ${Math.abs(item.days)} 天` : item.days === 0 ? '今天' : `${item.days} 天後`} · {item.step}</strong><small>{item.worker} · {item.caseNumber} · {item.date}</small></span></button>)}</div>}
    {profileReminders.length > 0 && <div className={styles.group}><h3>基本資料待補</h3>{profileReminders.map(item => <button type="button" className={styles.item} key={item.id} onClick={() => onOpenProfile?.(item)}><span className={styles.dotProfile}/><span className={styles.itemText}><strong>{item.title}</strong><small>{item.detail}</small></span><b>補資料</b></button>)}</div>}
  </section>;
}
