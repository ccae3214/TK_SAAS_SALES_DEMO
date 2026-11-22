"use client";

import { useMemo, useState } from 'react';
import { buildUnitQuiz, quizAvailable, scoreQuiz } from '@/lib/hr-learning';
import styles from './HrWorkerLearning.module.css';

// 單元小測驗：讀完單元內容後，用詞彙出題（看中文選英文意思），可以重複作答。
// 工人作答時傳入 onResult，每次送出都會把成績記錄下來給訓練中心查看；管理者與訓練中心預覽時沒有 onResult，成績只在畫面上顯示。
export default function HrUnitQuiz({ vocabulary, poolText, onResult }) {
  const available = useMemo(() => quizAvailable(vocabulary, poolText), [vocabulary, poolText]);
  const [questions, setQuestions] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [notice, setNotice] = useState('');
  if (!available) return null;

  const start = () => { setQuestions(buildUnitQuiz(vocabulary, { poolText })); setAnswers({}); setSubmitted(false); setNotice(''); };
  const submit = async () => {
    if (questions.some((_, i) => answers[i] === undefined)) return setNotice('請先回答所有題目。');
    setNotice(''); setSubmitted(true);
    if (!onResult) return;
    try { await onResult(scoreQuiz(questions, answers)); }
    catch (error) { setNotice(error.message || '無法記錄測驗成績，請稍後再試。'); }
  };
  const result = submitted ? scoreQuiz(questions, answers) : null;

  return <div className={styles.section}>
    <h4>小測驗</h4>
    {!questions && <>
      <p className={styles.muted}>看看自己記住了多少：每題選出正確的英文意思。</p>
      <p className={styles.muted}>{onResult ? '測驗成績會記錄給訓練中心，可以重複作答。' : '測驗成績不會被記錄，可以重複作答。'}</p>
      <div className={styles.actions}><button type="button" className={`${styles.button} ${styles.buttonPrimary}`} onClick={start}>開始小測驗</button></div>
    </>}
    {questions && <>
      <ol className={styles.quizList}>
        {questions.map((question, i) => <li key={i} className={styles.quizItem}>
          <p className={styles.quizPrompt}><span className={styles.zh}>{question.zh}</span>{question.pinyin ? <small>{question.pinyin}</small> : null}</p>
          <p className={styles.muted}>這個詞是什麼意思？</p>
          <div className={styles.quizOptions} role="radiogroup">
            {question.options.map((option, j) => {
              const picked = answers[i] === j;
              const state = !submitted ? '' : j === question.answer ? styles.quizRight : picked ? styles.quizWrong : '';
              return <label key={j} className={`${styles.quizOption} ${picked ? styles.quizPicked : ''} ${state}`}>
                <input type="radio" name={`quiz-${i}`} checked={picked} disabled={submitted} onChange={() => setAnswers(prev => ({ ...prev, [i]: j }))} />
                <span>{option}</span>
              </label>;
            })}
          </div>
          {submitted && (answers[i] === question.answer
            ? <p className={styles.quizGood}>答對了</p>
            : <p className={styles.quizBad}><span>答錯了</span> <span>正確答案：</span><strong>{question.options[question.answer]}</strong></p>)}
        </li>)}
      </ol>
      {notice && <p className={styles.error}>{notice}</p>}
      {result && <div className={styles.quizResult}>
        <strong>{`答對 ${result.correct} / ${result.total} 題`}</strong>
        <p className={styles.muted}>{result.passed ? '通過！你已經掌握這個單元的詞彙。' : '再複習一次詞彙後重新測驗吧。'}</p>
      </div>}
      <div className={styles.actions}>
        {!submitted && <button type="button" className={`${styles.button} ${styles.buttonPrimary}`} onClick={submit}>送出答案</button>}
        {submitted && <button type="button" className={styles.button} onClick={start}>重新測驗</button>}
      </div>
    </>}
  </div>;
}
