"use client";

import { groupUnitsByCategory } from '@/lib/hr-learning-units';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { learningProgress, parseLessonLines } from '@/lib/hr-learning';
import { SPEECH_RATES, SPEECH_TEXT, buildUnitSpeechQueue, rowSpeechItems } from '@/lib/hr-speech';
import { useLessonSpeech } from '@/lib/use-lesson-speech';
import { parseVocabularyEntries } from '@/lib/hr-vocabulary';
import HrLessonVocabulary from '@/components/HrLessonVocabulary';
import HrUnitQuiz from '@/components/HrUnitQuiz';
import styles from './HrWorkerLearning.module.css';
import { pickLang, copyFor } from '@/lib/language';
import { tlText } from '@/lib/language';
import { useLessonTl } from '@/lib/use-lesson-tl';

const LEGACY_UNIT_MEDIA = {
  1: { video: '/videos/mandarin-a1-unit-1.mp4', audio: '/videos/mandarin-a1-unit-1.mp3' },
  2: { video: '/videos/mandarin-a1-unit-2.mp4', audio: '/videos/mandarin-a1-unit-2.mp3' },
  3: { video: '/videos/mandarin-a1-unit-3.mp4', audio: '/videos/mandarin-a1-unit-3.mp3' },
};
const filipinoUnitMediaUrls = position => ({
  video: `/videos/mandarin-a1-unit-${position}-fil.mp4`,
  audio: `/videos/mandarin-a1-unit-${position}-fil.mp3`,
  captions: `/videos/mandarin-a1-unit-${position}-fil.vtt`,
});
const unitMediaUrls = position => LEGACY_UNIT_MEDIA[position] || {
  video: `/videos/mandarin-a1-unit-${position}.mp4`,
  audio: `/videos/mandarin-a1-unit-${position}.mp3`,
};

// 工人的學習頁：單元清單（含進度）→ 單元內容（學習重點、詞彙、例句、對話）→ 標記讀完。
// 系統管理者與訓練中心預覽時為唯讀（不能標記進度）。
// 單元內容可朗讀：每個詞彙／例句／對話旁有播放鈕，也可以朗讀整個單元（瀏覽器內建語音）。
export default function HrWorkerLearning({ courseId, onClose }) {
  const { lang } = useLanguage();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [unitId, setUnitId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState([]);
  const speech = useLessonSpeech();
  const { stop: stopSpeech } = speech;
  const [includeEnglish, setIncludeEnglish] = useState(true);
  const [slow, setSlow] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [unitVideoLanguage, setUnitVideoLanguage] = useState('zh');
  const speechText = copyFor(SPEECH_TEXT, lang);
  const lessonTl = useLessonTl(lang);

  const isMandarinA1Course = /mandarin a1 course|中文a1/i.test(`${data?.course?.name || ''} ${data?.course?.certification_name || ''}`);

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

  // 換單元或回到清單時停止朗讀。
  useEffect(() => { stopSpeech(); }, [unitId, stopSpeech]);
  useEffect(() => {
    setShowVideo(false);
    setUnitVideoLanguage('zh');
  }, [unitId]);

  const pick = (zh, en) => lang !== 'zh' && en ? (lang === 'tl' ? lessonTl(en) || tlText(en) : en) : zh;
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

  // 工人送出小測驗後，把成績記錄下來給訓練中心查看；失敗時丟出錯誤，由測驗元件顯示。
  async function recordQuiz(target, result) {
    const response = await fetch('/api/hr/learning', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'quiz', unitId: target.id, correct: result.correct, total: result.total }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || '無法記錄測驗成績，請稍後再試。');
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
    const vocabulary = parseVocabularyEntries(unit.vocabulary);
    const examples = parseLessonLines(unit.examples);
    const dialogue = parseLessonLines(unit.dialogue, { speaker: true });
    const topics = pick(unit.topics, unit.topics_en);

    const isUnit1 = Number(unit.position) === 1 || String(unit.name).includes('發音') || String(unit.name_en || '').toLowerCase().includes('pronunciation');
    const isUnit2 = Number(unit.position) === 2 || String(unit.name).includes('問候') || String(unit.name_en || '').toLowerCase().includes('greetings');
    const isUnit3 = Number(unit.position) === 3 || String(unit.name).includes('數字') || String(unit.name_en || '').toLowerCase().includes('numbers');
    const unitPosition = Number(unit.position);
    const isAvailableA1Video = isMandarinA1Course && Number.isInteger(unitPosition) && unitPosition >= 1 && unitPosition <= 20;
    const videoUnitPosition = isAvailableA1Video ? unitPosition : isUnit1 ? 1 : isUnit2 ? 2 : isUnit3 ? 3 : null;
    const isFilipinoMedia = isAvailableA1Video && unitVideoLanguage === 'fil';
    const unitMedia = isFilipinoMedia
      ? filipinoUnitMediaUrls(videoUnitPosition)
      : videoUnitPosition ? unitMediaUrls(videoUnitPosition) : null;
    const unitVideoUrl = unitMedia?.video || null;
    const unitAudioUrl = unitMedia?.audio || null;

    const rate = slow ? SPEECH_RATES.slow : SPEECH_RATES.normal;
    const hasSpeakable = [...vocabulary, ...examples, ...dialogue].some(row => row.zh);
    const isSpeaking = (section, i) => speech.playingKey === `${section}-${i}`;
    const playUnit = () => speech.play(buildUnitSpeechQueue({ vocabulary, examples, dialogue }, { includeEnglish }), { rate });
    const playRow = (section, i, row, part) => {
      if (isSpeaking(section, i)) return speech.stop();
      speech.play(rowSpeechItems(section, i, row, part), { rate });
    };
    const speakButtons = (section, i, row) => speech.supported ? <span className={styles.speakGroup}>
      <button type="button" className={`${styles.speakButton} ${isSpeaking(section, i) ? styles.speakActive : ''}`} aria-label={speechText.playZh} title={speechText.playZh} disabled={!row.zh} onClick={() => playRow(section, i, row, 'zh')}>
        <span aria-hidden="true">🔊</span>
      </button>
      {row.en && <button type="button" className={`${styles.speakButton} ${isSpeaking(section, i) ? styles.speakActive : ''}`} aria-label={speechText.playEn} title={speechText.playEn} onClick={() => playRow(section, i, row, 'en')}>
        <span aria-hidden="true">EN</span>
      </button>}
    </span> : null;

    return <div className={styles.panel}>
      {header}
      <p className={styles.muted}>{`${index + 1} / ${units.length}${unit.hours ? ` · ${unit.hours} 小時` : ''}`}{vocabulary.length ? <>{' '}<span>{`· ${vocabulary.length} 個詞彙`}</span></> : null}</p>
      {pick(unit.category, unit.category_en) && <p className={styles.category}>{pick(unit.category, unit.category_en)}</p>}
      <h3>{pick(unit.name, unit.name_en)}</h3>
      {unitVideoUrl && <div style={{ margin: '12px 0 8px' }}>
        <button type="button" className={`${styles.button} ${showVideo ? styles.buttonPrimary : ''}`} onClick={() => setShowVideo(v => !v)}>
          🎬 {showVideo ? (pickLang(lang, '收合單元教學影片', 'Hide lesson video')) : (isFilipinoMedia ? 'Watch lesson video (Filipino)' : pickLang(lang, '觀看單元教學影片（Kokoro 配音）', 'Watch lesson video (Kokoro)'))}
        </button>
      </div>}
      {unitVideoUrl && showVideo && <div className={styles.videoCard}>
        <div className={styles.videoHeader}>
          <h4>🎬 {isFilipinoMedia
            ? `Mandarin A1 Unit ${videoUnitPosition} - Filipino explanations with Mandarin examples`
            : pickLang(lang, `華語 A1 第 ${unit.position} 單元教學影片（Kokoro 本地語音合成）`, `Mandarin A1 Unit ${unit.position} - Lesson Video (Kokoro AI Voiceover)`)}</h4>
          <button type="button" className={styles.button} style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => setShowVideo(false)}>✕ {pickLang(lang, '關閉', 'Close')}</button>
        </div>
        {isAvailableA1Video && <div role="group" aria-label="Lesson video language" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '0 0 10px' }}>
          <button type="button" aria-pressed={!isFilipinoMedia} className={`${styles.button} ${!isFilipinoMedia ? styles.buttonPrimary : ''}`} onClick={() => setUnitVideoLanguage('zh')}>中文旁白</button>
          <button type="button" aria-pressed={isFilipinoMedia} className={`${styles.button} ${isFilipinoMedia ? styles.buttonPrimary : ''}`} onClick={() => setUnitVideoLanguage('fil')}>Filipino na paliwanag</button>
        </div>}
        <video key={unitVideoUrl} src={unitVideoUrl} controls autoPlay playsInline className={styles.videoPlayer}>
          {isFilipinoMedia && <track kind="captions" src={unitMedia.captions} srcLang="fil" label="Filipino" default />}
        </video>
        <p style={{ margin: '10px 0 4px', fontSize: 13, color: '#93c5fd' }}>
          {isFilipinoMedia ? 'Filipino narration and Mandarin examples (MP3):' : pickLang(lang, '單元音訊串流 (MP3)：', 'MP3 Audio Stream:')}
        </p>
        <audio key={unitAudioUrl} src={unitAudioUrl} controls className={styles.videoAudio} />
      </div>}
      {speech.supported && hasSpeakable && <div className={styles.speechBar}>
        <button type="button" className={`${styles.button} ${speech.playingKey ? '' : styles.buttonPrimary}`} onClick={speech.playingKey ? speech.stop : playUnit}>
          <span aria-hidden="true">{speech.playingKey ? '⏹' : '🔊'}</span>{' '}<span>{speech.playingKey ? speechText.stop : speechText.playUnit}</span>
        </button>
        <label className={styles.speechOption}><input type="checkbox" checked={includeEnglish} onChange={event => setIncludeEnglish(event.target.checked)} /><span>{speechText.includeEnglish}</span></label>
        <label className={styles.speechOption}><span>{speechText.speed}</span>
          <select value={slow ? 'slow' : 'normal'} onChange={event => setSlow(event.target.value === 'slow')}>
            <option value="normal">{speechText.speedNormal}</option>
            <option value="slow">{speechText.speedSlow}</option>
          </select>
        </label>
      </div>}
      {speech.checked && !speech.supported && hasSpeakable && <p className={styles.muted}>{speechText.unsupported}</p>}
      {speech.missingChineseVoice && hasSpeakable && <p className={styles.muted}>{speechText.noChineseVoice}</p>}
      {speech.error && <p className={styles.error}>{speechText.failed}</p>}
      {topics && <div className={styles.section}><h4>學習重點</h4><p translate="no">{topics}</p></div>}
      {vocabulary.length > 0 && <div className={styles.section}><h4>詞彙</h4><HrLessonVocabulary entries={vocabulary} speechOn={speech.supported} listenLabel={speechText.listen} isSpeaking={isSpeaking} speakButtons={speakButtons} /></div>}
      {examples.length > 0 && <div className={styles.section}><h4>例句</h4><div className={styles.dialogue}>
        {examples.map((row, i) => <div className={`${styles.line} ${isSpeaking('examples', i) ? styles.speaking : ''}`} key={i}>
          <div className={styles.lineText} translate="no"><span className={styles.zh}>{row.zh}</span> {row.pinyin}<small>{row.en}</small>{lessonTl(row.en) && <small lang="fil">{lessonTl(row.en)}</small>}</div>
          {speakButtons('examples', i, row)}
        </div>)}
      </div></div>}
      {dialogue.length > 0 && <div className={styles.section}><h4>對話</h4><div className={styles.dialogue}>
        {dialogue.map((row, i) => <div className={`${styles.line} ${isSpeaking('dialogue', i) ? styles.speaking : ''}`} key={i}>
          <span className={styles.speaker}>{row.speaker || '•'}</span>
          <div className={styles.lineText} translate="no"><span className={styles.zh}>{row.zh}</span> {row.pinyin}<small>{row.en}</small>{lessonTl(row.en) && <small lang="fil">{lessonTl(row.en)}</small>}</div>
          {speakButtons('dialogue', i, row)}
        </div>)}
      </div></div>}
      {!topics && !vocabulary.length && !examples.length && !dialogue.length && <p className={styles.muted}>這個單元還沒有學習內容。</p>}
      <HrUnitQuiz key={unit.id} vocabulary={unit.vocabulary} poolText={units.map(item => item.vocabulary).join('\n')} onResult={data.readOnly ? undefined : result => recordQuiz(unit, result)} />
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
    {groupUnitsByCategory(units, item => pick(item.category, item.category_en)).map((group, groupIndex) => <div key={groupIndex}>
      {group.category && <h4 className={styles.categoryHeading}>{group.category}</h4>}
      <ol className={styles.unitList}>
        {group.items.map(({ unit: item, index: i }) => {
          const isDone = completed.includes(Number(item.id));
          const itemPosition = Number(item.position);
          const hasVideo = (isMandarinA1Course && Number.isInteger(itemPosition) && itemPosition >= 1 && itemPosition <= 20)
            || [1, 2, 3].includes(itemPosition)
            || ['發音', '問候', '數字'].some(term => String(item.name).includes(term));
          return <li key={item.id} className={`${styles.unitRow} ${isDone ? styles.unitDone : ''}`}>
            <span className={styles.unitNo}>{i + 1}</span>
            <span className={styles.unitTitle}><strong>{pick(item.name, item.name_en)}</strong>{item.hours ? <small>{`${item.hours} 小時`}</small> : null}{parseVocabularyEntries(item.vocabulary).length ? <small>{`${parseVocabularyEntries(item.vocabulary).length} 個詞彙`}</small> : null}{hasVideo ? <span className={styles.unitBadgeVideo}>🎬 {pickLang(lang, '教學影音', 'Video')}</span> : null}</span>
            {!data.readOnly && <span className={`${styles.badge} ${isDone ? styles.badgeDone : ''}`}>{isDone ? '已讀完' : '未讀'}</span>}
            <button type="button" className={`${styles.button} ${!isDone && item.id === progress.nextUnitId ? styles.buttonPrimary : ''}`} onClick={() => setUnitId(item.id)}>{isDone ? '複習' : item.id === progress.nextUnitId && progress.done > 0 ? '繼續學習' : '開始學習'}</button>
          </li>;
        })}
      </ol>
    </div>)}
  </div>;
}
