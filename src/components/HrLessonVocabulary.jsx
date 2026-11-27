"use client";

import { Fragment } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { LESSON_TEXT, senseMark } from '@/lib/hr-vocabulary';
import styles from './HrLessonVocabulary.module.css';
import { pickLang, copyFor } from '@/lib/language';
import { useLessonTl } from '@/lib/use-lesson-tl';

// 詞彙表：一個詞有多個意思時，逐一列出意思編號；每個詞下面可接造句（可標示是在示範第幾個意思）。
// 中文、拼音與英文／Filipino 說明都標 translate="no"：網站的自動翻譯不可把課文改掉（例如「是」變成 Oo）。
// 朗讀按鈕由學習頁傳入（speakButtons／isSpeaking），這裡只負責排版。
export default function HrLessonVocabulary({ entries, speechOn = false, listenLabel = '', isSpeaking = () => false, speakButtons = () => null }) {
  const { lang } = useLanguage();
  const text = copyFor(LESSON_TEXT, lang);
  const lessonTl = useLessonTl(lang);
  const columns = speechOn ? 4 : 3;
  return <div className={styles.tableWrap}><table className={styles.lessonTable}>
    <thead><tr><th>詞彙</th><th>拼音</th><th>{lang === 'tl' ? 'English / Filipino' : pickLang(lang, '英文', 'English')}</th>{speechOn && <th>{listenLabel}</th>}</tr></thead>
    <tbody>
      {entries.map((entry, i) => {
        const multi = entry.senses.length > 1;
        return <Fragment key={i}>
          <tr className={isSpeaking('vocabulary', i) ? styles.speaking : ''}>
            <td className={styles.zh} translate="no">{entry.zh}</td>
            <td translate="no">{entry.pinyin}</td>
            <td translate="no">{multi ? <>
              <span className={styles.multiBadge}>{text.multiMeaning(entry.senses.length)}</span>
              <ol className={styles.senses}>{entry.senses.map((sense, k) => <li key={k}><span className={styles.senseNo}>{senseMark(k + 1)}</span> {sense}</li>)}</ol>
            </> : entry.en}{lessonTl(entry.en) && <small lang="fil" className={styles.filipino}>{lessonTl(entry.en)}</small>}</td>
            {speechOn && <td>{speakButtons('vocabulary', i, entry)}</td>}
          </tr>
          {entry.examples.length > 0 && <tr className={styles.exampleRow}><td colSpan={columns}>
            <div className={styles.exampleTitle}>{text.examples}</div>
            <ul className={styles.exampleList}>
              {entry.examples.map((example, j) => <li key={j} className={`${styles.exampleItem} ${isSpeaking(`vocabulary-${i}-ex`, j) ? styles.speaking : ''}`}>
                <div className={styles.exampleText} translate="no">
                  {example.sense > 0 && <span className={styles.senseNo}>{senseMark(example.sense)}</span>}
                  <span className={styles.exampleZh}>{example.zh}</span> {example.pinyin}
                  {example.en && <small>{example.en}</small>}
                </div>
                {speakButtons(`vocabulary-${i}-ex`, j, example)}
              </li>)}
            </ul>
          </td></tr>}
        </Fragment>;
      })}
    </tbody>
  </table></div>;
}
