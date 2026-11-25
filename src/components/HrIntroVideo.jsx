"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check, Clapperboard, FileText, GraduationCap, Languages, LayoutDashboard, MessagesSquare, Pause, Play,
  RotateCcw, Route, SkipBack, SkipForward, TriangleAlert, Upload, UserRound, Volume2, X,
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useHrDialog } from '@/lib/use-hr-dialog';
import {
  INTRO_SCENE_STARTS, INTRO_VIDEO_DURATION, INTRO_VIDEO_FILES, INTRO_VIDEO_SCENES, introVideoText, sceneIndexAt,
} from '@/lib/hr-intro-video';
import { HR_VIDEO_OPEN_EVENT } from '@/lib/hr-help-events';
import styles from './HrIntroVideo.module.css';
import { pickLang } from '@/lib/language';

// 工作者介紹影片：按工作起點裡的「介紹影片」開啟。
// 預設播放網站內建的動畫導覽（中英文隨網站語言切換）；
// 如果 public/videos/ 底下有錄好的影片檔（見 hr-intro-video.js），就改播真實影片。

const TICK = 100;

// 畫面裡模擬的介面文字（跟網站實際的中英文名稱一致）。
const MOCK = {
  zh: {
    brand: '克雷迅人力管理', steps: ['申請', '審核', '開始使用'],
    roles: ['工作者', '雇主', '仲介'], agency: '所屬仲介', agencyValue: '請選擇仲介', submit: '送出審核申請', waiting: '等待管理者審核',
    tabs: { start: '工作起點', basic: '基本資料', documents: '必要文件', process: '來台程序', training: '訓練課程', chat: '聊天室' },
    nextTask: '下一步', nextTaskBody: '完成基本資料', go: '前往',
    fields: ['姓名', '生日', '工作經驗'], photo: '照片', complete: '完成度',
    docs: [['護照', 'ok', '已核准'], ['體檢報告', 'wait', '審核中'], ['良民證', 'back', '被退回']], reupload: '重新上傳',
    stages: ['文件準備', '訓練', '簽證', '來台'], you: '你在這裡',
    course: '中文 A1 課程', unit: '單元 1：你好', listen: '播放發音',
    agencyName: '仲介', msgIn: '請上傳良民證', msgOut: '好的，我現在上傳', tourBtn: '使用導覽',
  },
  en: {
    brand: 'Kolecion HR', steps: ['Apply', 'Approval', 'Start'],
    roles: ['Worker', 'Employer', 'Agency'], agency: 'Your agency', agencyValue: 'Choose an agency', submit: 'Submit application', waiting: 'Waiting for administrator review',
    tabs: { start: 'Start here', basic: 'Basic information', documents: 'Required documents', process: 'Process to Taiwan', training: 'Training courses', chat: 'Chat' },
    nextTask: 'Next step', nextTaskBody: 'Complete basic information', go: 'Go',
    fields: ['Name', 'Birthday', 'Work experience'], photo: 'Photo', complete: 'Complete',
    docs: [['Passport', 'ok', 'Approved'], ['Medical report', 'wait', 'In review'], ['Police clearance', 'back', 'Returned']], reupload: 'Upload again',
    stages: ['Documents', 'Training', 'Visa', 'Arrival'], you: 'You are here',
    course: 'Mandarin A1 course', unit: 'Unit 1: Hello', listen: 'Play pronunciation',
    agencyName: 'Agency', msgIn: 'Please upload your police clearance', msgOut: 'OK, uploading now', tourBtn: 'Quick tour',
  },
};

const TAB_ICONS = { start: LayoutDashboard, basic: UserRound, documents: FileText, process: Route, training: GraduationCap, chat: MessagesSquare };

function TabBar({ m, active }) {
  return <div className={styles.tabs} aria-hidden="true">
    {Object.keys(m.tabs).map(id => {
      const Icon = TAB_ICONS[id];
      return <span key={id} className={`${styles.tab} ${id === active ? styles.tabOn : ''}`}><Icon size={13} />{m.tabs[id]}</span>;
    })}
  </div>;
}

function Screen({ m, active, children }) {
  return <div className={styles.screen} aria-hidden="true"><TabBar m={m} active={active} /><div className={styles.body}>{children}</div></div>;
}

function SceneVisual({ id, m }) {
  switch (id) {
    case 'welcome':
      return <div className={styles.welcome} aria-hidden="true">
        <span className={styles.logo}><Clapperboard size={34} /></span>
        <strong>{m.brand}</strong>
        <div className={styles.chips}>{m.steps.map((label, i) => <span key={label} className={styles.chip} style={{ animationDelay: `${0.8 + i * 0.9}s` }}><b>{i + 1}</b>{label}</span>)}</div>
      </div>;
    case 'apply':
      return <div className={styles.screen} aria-hidden="true"><div className={styles.body}>
        <div className={styles.roleRow}>{m.roles.map((label, i) => <span key={label} className={`${styles.role} ${i === 0 ? styles.rolePick : ''}`}>{label}</span>)}</div>
        <div className={styles.select}><small>{m.agency}</small><span>{m.agencyValue}</span></div>
        <span className={styles.submit}>{m.submit}</span>
        <span className={styles.cursor} />
        <p className={styles.wait}>{m.waiting}</p>
      </div></div>;
    case 'start':
      return <Screen m={m} active="start">
        <div className={`${styles.card} ${styles.pulse}`}><small>{m.nextTask}</small><strong>{m.nextTaskBody}</strong><span className={styles.go}>{m.go}</span></div>
      </Screen>;
    case 'basic':
      return <Screen m={m} active="basic">
        <div className={styles.formGrid}>
          <span className={styles.photo}><UserRound size={26} /><small>{m.photo}</small></span>
          <div className={styles.fields}>{m.fields.map((label, i) => <div key={label} className={styles.field}><small>{label}</small><i style={{ animationDelay: `${0.8 + i * 1.2}s` }} /></div>)}</div>
        </div>
        <div className={styles.meter}><small>{m.complete}</small><span><i /></span></div>
      </Screen>;
    case 'documents':
      return <Screen m={m} active="documents">
        <ul className={styles.docs}>{m.docs.map(([name, state, label], i) => <li key={name} className={styles[`doc_${state}`]} style={{ animationDelay: `${0.4 + i * 0.7}s` }}>
          <span className={styles.docIcon}>{state === 'ok' ? <Check size={14} /> : state === 'back' ? <TriangleAlert size={14} /> : <FileText size={14} />}</span>
          <b>{name}</b><em>{label}</em>
          {state === 'back' && <span className={styles.reupload}><Upload size={12} />{m.reupload}</span>}
        </li>)}</ul>
      </Screen>;
    case 'process':
      return <Screen m={m} active="process">
        <ol className={styles.stages}>{m.stages.map((label, i) => <li key={label} style={{ animationDelay: `${0.5 + i * 0.8}s` }}><span>{i + 1}</span>{label}{i === 1 && <em>{m.you}</em>}</li>)}</ol>
      </Screen>;
    case 'training':
      return <Screen m={m} active="training">
        <div className={styles.card}><small>{m.course}</small><strong>{m.unit}</strong><span className={styles.go}><Volume2 size={13} />{m.listen}</span></div>
      </Screen>;
    case 'chat':
      return <Screen m={m} active="chat">
        <div className={styles.chat}>
          <p className={styles.msgIn}><small>{m.agencyName}</small>{m.msgIn}</p>
          <p className={styles.msgOut} style={{ animationDelay: '1.6s' }}>{m.msgOut}</p>
        </div>
      </Screen>;
    case 'tips':
      return <div className={styles.screen} aria-hidden="true"><div className={styles.body}>
        <div className={styles.tips}>
          <span className={styles.tipLang}><Languages size={18} />中文 / English</span>
          <span className={styles.tipTour}>{m.tourBtn}</span>
        </div>
      </div></div>;
    default:
      return null;
  }
}

function Player({ onClose }) {
  const { lang } = useLanguage();
  const key = (lang === 'zh' ? 'zh' : 'en');
  const text = introVideoText(key);
  const m = MOCK[key];
  const dialogRef = useRef(null);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(() => !(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches));
  // 'checking'：確認有沒有真實影片檔；'file'：播放真實影片；'none'：播放內建動畫。
  const [source, setSource] = useState({ lang: key, state: 'checking' });
  const state = source.lang === key ? source.state : 'checking';

  const handleKeyDown = useHrDialog(dialogRef, onClose);

  useEffect(() => {
    let live = true;
    const url = INTRO_VIDEO_FILES[key];
    fetch(url, { method: 'HEAD', cache: 'no-store' })
      .then(response => { if (live) setSource({ lang: key, state: response.ok && /^video\//.test(response.headers.get('content-type') || '') ? 'file' : 'none' }); })
      .catch(() => { if (live) setSource({ lang: key, state: 'none' }); });
    return () => { live = false; };
  }, [key]);

  const ended = elapsed >= INTRO_VIDEO_DURATION;
  const running = state === 'none' && playing && !ended;
  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => {
      if (document.hidden) return;
      setElapsed(previous => Math.min(INTRO_VIDEO_DURATION, previous + TICK));
    }, TICK);
    return () => clearInterval(timer);
  }, [running]);

  const index = sceneIndexAt(elapsed);
  const scene = INTRO_VIDEO_SCENES[index];
  const sceneProgress = useMemo(() => (elapsed - INTRO_SCENE_STARTS[index]) / scene.duration, [elapsed, index, scene]);
  const seekScene = useCallback(next => {
    const target = Math.max(0, Math.min(INTRO_VIDEO_SCENES.length - 1, next));
    setElapsed(INTRO_SCENE_STARTS[target]);
    setPlaying(true);
  }, []);
  const toggle = () => {
    if (ended) { setElapsed(0); setPlaying(true); return; }
    setPlaying(value => !value);
  };

  const onKeyDown = event => {
    if (state === 'none' && event.target?.type !== 'range') {
      if (event.key === 'ArrowRight') { event.preventDefault(); seekScene(index + 1); return; }
      if (event.key === 'ArrowLeft') { event.preventDefault(); seekScene(index - 1); return; }
    }
    handleKeyDown(event);
  };

  return <div className={styles.backdrop} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} tabIndex={-1} className={styles.dialog} role="dialog" aria-modal="true" aria-label={text.dialog} onKeyDown={onKeyDown}>
      <button type="button" className={styles.close} onClick={onClose} aria-label={text.close}><X size={20} aria-hidden="true" /></button>
      {state === 'checking' && <div className={styles.stage}><p className={styles.loading} role="status">{text.loading}</p></div>}
      {state === 'file' && <video className={styles.video} src={INTRO_VIDEO_FILES[key]} controls autoPlay playsInline onError={() => setSource({ lang: key, state: 'none' })} />}
      {state === 'none' && <>
        <div className={`${styles.stage} ${running ? '' : styles.paused}`}>
          <div key={`${scene.id}-${key}`} className={styles.scene}><SceneVisual id={scene.id} m={m} /></div>
        </div>
        <div className={styles.caption} aria-live="polite">
          <h2>{scene.title[key]}</h2>
          <p>{scene.caption[key]}</p>
        </div>
        <input className={styles.seek} type="range" min={0} max={INTRO_VIDEO_DURATION} step={TICK} value={elapsed} aria-label={text.progress}
          aria-valuetext={`${index + 1} / ${INTRO_VIDEO_SCENES.length} · ${scene.title[key]}`} style={{ '--p': `${(elapsed / INTRO_VIDEO_DURATION) * 100}%` }}
          onChange={event => setElapsed(Number(event.target.value))} />
        <div className={styles.controls}>
          <button type="button" className={styles.ctl} onClick={() => seekScene(index - 1)} disabled={index === 0} aria-label={text.previous}><SkipBack size={18} aria-hidden="true" /></button>
          <button type="button" className={`${styles.ctl} ${styles.main}`} onClick={toggle} aria-label={ended ? text.replay : running ? text.pause : text.play}>
            {ended ? <RotateCcw size={20} aria-hidden="true" /> : running ? <Pause size={20} aria-hidden="true" /> : <Play size={20} aria-hidden="true" />}
          </button>
          <button type="button" className={styles.ctl} onClick={() => seekScene(index + 1)} disabled={index === INTRO_VIDEO_SCENES.length - 1} aria-label={text.next}><SkipForward size={18} aria-hidden="true" /></button>
          <div className={styles.dots} role="group" aria-label={text.scenes}>
            {INTRO_VIDEO_SCENES.map((item, i) => <button key={item.id} type="button" className={`${styles.dot} ${i === index ? styles.dotOn : ''} ${i < index ? styles.dotDone : ''}`}
              aria-label={`${text.scene.replace('{n}', i + 1)}：${item.title[key]}`} aria-current={i === index ? 'step' : undefined} onClick={() => seekScene(i)}>
              {i === index && <i style={{ width: `${Math.min(100, Math.max(0, sceneProgress * 100))}%` }} />}
            </button>)}
          </div>
        </div>
      </>}
    </section>
  </div>;
}

export default function HrIntroVideo() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  // 工作起點裡的「介紹影片」按鈕會發出事件，這裡接到就開啟播放器。
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(HR_VIDEO_OPEN_EVENT, show);
    return () => window.removeEventListener(HR_VIDEO_OPEN_EVENT, show);
  }, []);
  return open && typeof document !== 'undefined' ? createPortal(<Player onClose={close} />, document.body) : null;
}
