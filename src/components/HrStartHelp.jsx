"use client";

import { CircleHelp, Clapperboard } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { introVideoText } from '@/lib/hr-intro-video';
import { HR_INLINE_HELP_ROLES, HR_TOUR_START_EVENT, HR_VIDEO_OPEN_EVENT } from '@/lib/hr-help-events';
import styles from './HrJourney.module.css';

const COPY = {
  zh: { group: '使用說明', tour: '使用導覽' },
  en: { group: 'Help', tour: 'Quick tour' },
};

// 工作起點裡的「使用導覽」與「介紹影片」按鈕。介紹影片只有工作者看得到。
export default function HrStartHelp({ role }) {
  const { lang } = useLanguage();
  const text = COPY[lang === 'en' ? 'en' : 'zh'];
  if (!HR_INLINE_HELP_ROLES.includes(role)) return null;
  const fire = name => window.dispatchEvent(new CustomEvent(name));
  return <div className={styles.helpRow} role="group" aria-label={text.group}>
    <button type="button" className={styles.helpBtn} onClick={() => fire(HR_TOUR_START_EVENT)} data-tour="tour-help"><CircleHelp size={17} aria-hidden="true" />{text.tour}</button>
    {role === 'worker' && <button type="button" className={styles.helpBtn} onClick={() => fire(HR_VIDEO_OPEN_EVENT)} aria-haspopup="dialog" data-tour="intro-video"><Clapperboard size={17} aria-hidden="true" />{introVideoText(lang).open}</button>}
  </div>;
}
