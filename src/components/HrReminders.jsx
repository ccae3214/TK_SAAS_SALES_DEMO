"use client";

import { useEffect, useState } from 'react';
import styles from './HrReminders.module.css';

const DAYS_AHEAD = 7;

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

export default function HrReminders({ onOpenChat, onOpenProgress }) {
  const [dateReminders, setDateReminders] = useState([]);
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
        setUnreadRooms((chat.rooms || []).filter(room => Number(room.unreadCount) > 0));
      } catch {
        if (active) setUnreadRooms([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const unreadCount = unreadRooms.reduce((sum, room) => sum + Number(room.unreadCount || 0), 0);
  return <section className={styles.panel} aria-label="提醒">
    <header className={styles.header}><div><span>提醒</span><h2>需要留意</h2></div><strong>{loading ? '…' : unreadCount + dateReminders.length}</strong></header>
    {!loading && unreadRooms.length === 0 && dateReminders.length === 0 && <p className={styles.empty}>目前沒有未讀訊息或近期重要日期。</p>}
    {unreadRooms.length > 0 && <div className={styles.group}><h3>聊天室未讀</h3>{unreadRooms.map(room => <button type="button" className={styles.item} key={room.id} onClick={() => onOpenChat?.(Number(room.id))}><span className={styles.dotChat}/><span className={styles.itemText}><strong>{room.title}</strong><small>{room.lastMessage || '有新訊息'}</small></span><b>{room.unreadCount}</b></button>)}</div>}
    {dateReminders.length > 0 && <div className={styles.group}><h3>近期案件日期</h3>{dateReminders.map(item => <button type="button" className={styles.item} key={item.id} onClick={() => onOpenProgress?.(item.workerId)}><span className={item.days < 0 ? styles.dotOverdue : styles.dotDate}/><span className={styles.itemText}><strong>{item.days < 0 ? `逾期 ${Math.abs(item.days)} 天` : item.days === 0 ? '今天' : `${item.days} 天後`} · {item.step}</strong><small>{item.worker} · {item.caseNumber} · {item.date}</small></span></button>)}</div>}
  </section>;
}
