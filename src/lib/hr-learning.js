// 學習系統共用工具（工人學習頁、訓練中心預覽與測試共用）。
import { parseVocabularyEntries } from './hr-vocabulary.js';

// 詞彙、例句、對話都是「每行一筆」：中文 | 拼音 | 英文（拼音、英文可省略）。
// 對話每行最前面可加講話的人，例如「A：你好！ | Nǐ hǎo! | Hello!」。
export function parseLessonLines(text, { speaker = false } = {}) {
  return String(text || '').split('\n').map(line => line.trim()).filter(Boolean).map(line => {
    let who = '';
    if (speaker) {
      const match = /^([A-Za-z])\s*[：:]\s*/.exec(line);
      if (match) { who = match[1].toUpperCase(); line = line.slice(match[0].length); }
    }
    const [zh = '', pinyin = '', en = ''] = line.split(/\s*[|｜]\s*/);
    return { speaker: who, zh, pinyin, en };
  });
}

// 學習進度：已讀完幾個單元、時數、下一個要讀的單元（依順序第一個未讀完的）。
export function learningProgress(units = [], completedIds = []) {
  const done = new Set(completedIds.map(Number));
  const total = units.length;
  const finished = units.filter(unit => done.has(Number(unit.id)));
  return {
    total,
    done: finished.length,
    percent: total ? Math.round((finished.length / total) * 100) : 0,
    hoursDone: finished.reduce((sum, unit) => sum + (Number(unit.hours) || 0), 0),
    hoursTotal: units.reduce((sum, unit) => sum + (Number(unit.hours) || 0), 0),
    nextUnitId: units.find(unit => !done.has(Number(unit.id)))?.id ?? null,
  };
}

// ---- 單元小測驗：用單元的「詞彙」自動出題（看中文選英文意思），不需要額外建立題庫，成績不會被記錄。 ----
// 多義字（英文欄用「；」分隔多個意思）用第一個意思當選項；其他選項不會挑到同一個詞的任何一個意思。
export const QUIZ_QUESTION_COUNT = 5;
export const QUIZ_PASS_PERCENT = 60;

const vocabularyEntries = text => parseVocabularyEntries(text).filter(entry => entry.zh && entry.senses.length);

function shuffle(list, random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// 這個單元能不能出題：至少要有一個「中文＋英文」詞彙，而且整門課的英文意思至少有兩種（才有選項可選）。
export function quizAvailable(vocabulary, poolText = '') {
  const own = vocabularyEntries(vocabulary);
  if (!own.length) return false;
  const meanings = new Set([...own, ...vocabularyEntries(poolText)].map(entry => entry.senses[0].toLowerCase()));
  return meanings.size >= 2;
}

// 出題：從單元詞彙抽最多 count 個，每題 1 個正確答案 + 最多 optionCount - 1 個不重複的錯誤選項
// （先用本單元其他詞彙，不夠再用整門課的詞彙 poolText）。random 可注入，方便測試。
export function buildUnitQuiz(vocabulary, { poolText = '', count = QUIZ_QUESTION_COUNT, optionCount = 4, random = Math.random } = {}) {
  const own = vocabularyEntries(vocabulary);
  const pool = vocabularyEntries(poolText);
  const questions = [];
  for (const entry of shuffle(own, random).slice(0, count)) {
    const answer = entry.senses[0];
    const seen = new Set(entry.senses.map(sense => sense.toLowerCase()));
    const wrong = [];
    for (const candidate of [...shuffle(own, random), ...shuffle(pool, random)]) {
      const label = candidate.senses[0];
      if (seen.has(label.toLowerCase())) continue;
      seen.add(label.toLowerCase());
      wrong.push(label);
      if (wrong.length >= optionCount - 1) break;
    }
    if (!wrong.length) continue;
    const options = shuffle([answer, ...wrong], random);
    questions.push({ zh: entry.zh, pinyin: entry.pinyin, options, answer: options.indexOf(answer) });
  }
  return questions;
}

// 計分：answers 是「題號 → 選了第幾個選項」。答對比例達 QUIZ_PASS_PERCENT 以上算通過。
export function scoreQuiz(questions = [], answers = {}) {
  const total = questions.length;
  const correct = questions.filter((question, i) => answers[i] === question.answer).length;
  const percent = total ? Math.round((correct / total) * 100) : 0;
  return { total, correct, percent, passed: total > 0 && percent >= QUIZ_PASS_PERCENT };
}

// 驗證並整理工人送出的測驗成績（答對題數／總題數），格式不對回傳 null。
// 題目是在畫面上隨機出的，伺服器無法重算答案，所以只檢查數字合理：總題數 1～QUIZ_QUESTION_COUNT、答對題數 0～總題數的整數。
export function quizResultOf(input) {
  const correct = Number(input?.correct), total = Number(input?.total);
  if (!Number.isInteger(correct) || !Number.isInteger(total)) return null;
  if (total < 1 || total > QUIZ_QUESTION_COUNT || correct < 0 || correct > total) return null;
  const percent = Math.round((correct / total) * 100);
  return { correct, total, percent, passed: percent >= QUIZ_PASS_PERCENT };
}
