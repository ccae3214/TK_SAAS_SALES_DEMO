"use client";

import { useLanguage } from '@/context/LanguageContext';
import { MATCH_STEPS, membershipState, orderJourney, workspaceTasks } from '@/lib/hr-workflow';
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

export function MembershipGuide({ data, selectedRole, setSelectedRole, requesting, onSubmit, onRefresh, error }) {
  const { lang } = useLanguage();
  const en = lang === 'en';
  const waiting = membershipState(data) === 'waiting';
  const names = { worker: en ? 'Worker' : '工人', employer: en ? 'Employer' : '雇主', agency: en ? 'Agency staff' : '仲介機構員工' };
  const descriptions = {
    worker: en ? 'Prepare your resume and documents; follow your own case after approval.' : '準備履歷與文件；核准後查看自己的案件及辦件進度。',
    employer: en ? 'Create hiring needs and review workers recommended by your agencies.' : '填寫聘工需求，由合作仲介推薦人選並安排面試。',
    agency: en ? 'Your administrator links you to a Taiwan or Philippines agency and assigns your work.' : '由管理者確認所屬台灣或菲律賓機構，指派業務或承辦工作。',
  };
  return <section className={styles.onboarding} aria-labelledby="membership-guide-title">
    <span className={styles.eyebrow}>{en ? 'GETTING STARTED' : '新會員起步'}</span>
    <h2 id="membership-guide-title">{waiting ? (en ? 'Request received — awaiting review' : '申請已送出，等待管理者審核') : (en ? 'Choose how you will use the service' : '先選擇你要使用的身分')}</h2>
    <ol className={styles.steps}>{[en ? 'Choose a role' : '選擇身分', en ? 'Administrator review' : '管理者確認與指派', en ? 'Enter your workspace' : '開始使用工作區'].map((label, i) => <li key={label} aria-current={i === (waiting ? 1 : 0) ? 'step' : undefined}><b>{i + 1}</b>{label}</li>)}</ol>
    {waiting ? <><p>{en ? 'Requested role:' : '申請類型：'} <strong>{names[data.requestedRole]}</strong></p><p>{descriptions[data.requestedRole]}</p><p>{en ? 'Contact the administrator or agency that invited you to confirm your organization. Review time is not guaranteed. Case access stays closed until approval.' : '請聯絡邀請你使用系統的管理者或所屬仲介，確認機構與資料歸屬。審核沒有固定完成時間；核准前不會開放案件資料。'}</p><button type="button" disabled={requesting} onClick={onRefresh}>{en ? 'Check review status' : '重新確認審核狀態'}</button></>
      : <form onSubmit={onSubmit}><fieldset><legend>{en ? 'Membership type' : '申請類型'}</legend>{Object.entries(names).map(([role, name]) => <label className={styles.roleChoice} key={role}><input type="radio" name="membership-role" value={role} checked={selectedRole === role} onChange={() => setSelectedRole(role)} /><span><strong>{name}</strong><small>{descriptions[role]}</small></span></label>)}</fieldset><p>{en ? 'Submitting a request does not approve it. An administrator must verify and link your records.' : '送出申請不等於核准；管理者會核對身分並指派所屬資料，不會自動開放權限。'}</p><button disabled={requesting}>{requesting ? (en ? 'Submitting…' : '送出中…') : (en ? 'Submit membership request' : '送出審核申請')}</button></form>}
    {error && <p className={styles.error} role="alert">{error}</p>}
  </section>;
}
