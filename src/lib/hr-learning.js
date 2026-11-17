// 學習系統共用工具（工人學習頁、訓練中心預覽與測試共用）。

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
