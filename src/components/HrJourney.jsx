"use client";

import { MATCH_STEPS, orderJourney, workspaceTasks } from '@/lib/hr-workflow';
import styles from './HrJourney.module.css';

export function OrderJourney({ order, data }) {
  const flow = orderJourney(order, data.orderAgencies, data.orderRoutes, data.orderCandidates);
  return <div className={styles.journey} aria-label="配對進度">
    <ol>{MATCH_STEPS.map((label, index) => <li key={label} aria-current={order.status !== 'cancelled' && index === flow.step ? 'step' : undefined} className={index < flow.step ? styles.done : index === flow.step ? styles.current : ''}><span>{index + 1}</span>{label}</li>)}</ol>
    <p role="status">{flow.next}</p>
  </div>;
}

export function WorkspaceStart({ data, onNavigate }) {
  const task = workspaceTasks(data);
  return <section className={styles.start} aria-label="工作起點"><div><span className={styles.eyebrow}>下一步</span><h2>{task.title}</h2><p>{task.hint}</p></div><div className={styles.nextAction}><strong>{task.count} <small>{data.role === 'worker' ? '項待準備文件' : '張進行中需求'}</small></strong><button type="button" onClick={() => onNavigate(task.tab)}>{task.action}</button>{data.role === 'worker' && <button type="button" onClick={() => onNavigate('basic')}>完善本人履歷</button>}</div></section>;
}
