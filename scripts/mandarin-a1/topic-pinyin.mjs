// 學習重點（English／Filipino 版）裡的中文要附拼音，菲律賓學員看不懂漢字也能唸。
// 產生課程時（build-mandarin-a1-course.mjs）自動在中文後面加上「（拼音）」：
//   1. 先找課程裡同一句／同一個詞的拼音（例句、詞彙、對話）；
//   2. 找不到的寫在下面 TOPIC_PINYIN（「……」是填空，拼音寫成「…」）。
// 已經緊接著拼音的中文（例如「不是 (bú shì)」「一個 is yí ge」）不會重複加。

export const TOPIC_PINYIN = {
  '了': 'le',
  '個': 'ge',
  '著': 'zháo', // 「著火了」的「著」
  '嗎？': 'ma?',
  '您': 'nín',
  '血': 'xiě', // 台灣口語
  '掃': 'sǎo',
  '和': 'hàn', // 台灣口語
  '寶': 'bǎo',
  '朵': 'duǒ',
  '我是': 'wǒ shì',
  '我叫': 'wǒ jiào',
  '……呢？': '… ne?',
  '今天星期幾？': 'Jīntiān xīngqí jǐ?',
  '……是多少？': '… shì duōshǎo?',
  '幾月幾號': 'jǐ yuè jǐ hào',
  '一個': 'yí ge',
  '兩個人': 'liǎng ge rén',
  '這是我的': 'zhè shì wǒ de',
  '我的……不見了': 'wǒ de … bújiàn le',
  '我要找': 'wǒ yào zhǎo',
  '……在哪裡？': '… zài nǎlǐ?',
  '……壞了': '… huài le',
  '我要': 'wǒ yào',
  '我要一個便當': 'wǒ yào yí ge biàndāng',
  '……還是……？': '… háishì …?',
  '我不吃': 'wǒ bù chī',
  '請幫我': 'qǐng bāng wǒ',
  '一杯': 'yì bēi',
  '我吃素': 'wǒ chīsù',
  '要袋子嗎？': 'Yào dàizi ma?',
  '請問，……在哪裡？': 'Qǐngwèn, … zài nǎlǐ?',
  '……怎麼走？': '… zěnme zǒu?',
  '往前直走，在……左轉': 'wǎng qián zhí zǒu, zài … zuǒ zhuǎn',
  '右轉': 'yòu zhuǎn',
  '……多少錢？': '… duōshǎo qián?',
  '一千': 'yìqiān',
  '一百': 'yìbǎi',
  '一次': 'yí cì',
  '先……再……': 'xiān … zài …',
  '完了': 'wán le',
  '我做完了': 'wǒ zuò wán le',
  '一定要': 'yídìng yào',
  '一定要戴安全帽': 'yídìng yào dài ānquánmào',
  '……了！': '… le!',
  '著火了！': 'Zháohuǒ le!',
  '我想請假': 'wǒ xiǎng qǐngjià',
  '……好像不對': '… hǎoxiàng búduì',
  '為什麼……？': 'wèishénme …?',
  '發薪水': 'fā xīnshuǐ',
  '我扶您': 'wǒ fú nín',
  '慢慢吃': 'mànmàn chī',
  '飯後吃藥': 'fàn hòu chī yào',
  '您要不要……？': 'nín yào bú yào …?',
  '我幫您': 'wǒ bāng nín',
  '有點高': 'yǒudiǎn gāo',
  '如果……，就……': 'rúguǒ …, jiù …',
  '一百四十': 'yìbǎi sìshí',
  '好了': 'hǎo le',
  '掃好了': 'sǎo hǎo le',
  '卡住了': 'qiǎzhù le',
  '一箱放': 'yì xiāng fàng',
  '一箱': 'yì xiāng',
  '可以採了': 'kěyǐ cǎi le',
  '要戴': 'yào dài',
  '我頭痛': 'wǒ tóu tòng',
  '我有一點': 'wǒ yǒu yìdiǎn',
  '我對……過敏': 'wǒ duì … guòmǐn',
  '一天三次': 'yì tiān sān cì',
  '有一點': 'yǒu yìdiǎn',
  '可以充電嗎？': 'Kěyǐ chōngdiàn ma?',
  '……的密碼是什麼？': '… de mìmǎ shì shénme?',
  '要下雨了': 'yào xià yǔ le',
  '明天有颱風': 'míngtiān yǒu táifēng',
  '我的……被偷了': 'wǒ de … bèi tōu le',
  '這裡是': 'zhèlǐ shì',
};

// 一段中文（可含「……」與標點）。
export const CHINESE_RUN = /[…一-鿿、，？！。]*[一-鿿][…一-鿿、，？！。]*/g;
// 中文後面已經有拼音：「(拼音」「is 拼音」「ay 拼音」或直接接拼音。
// 輕聲音節（de、ma、le…）沒有聲調符號，另外列出。
const PINYIN_AFTER = /^\s*(?:\(|is\s+|ay\s+)?\s*…?\s*(?:[A-Za-z'ü-]*[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]|(?:de|ma|le|ge|ne|zhe|ba|me|men|zi)(?![a-z]))/i;

const trimRun = run => run.replace(/^[，、。]+|[，、]+$/g, '');

// 回傳加好拼音的文字；查不到拼音的中文放進 missing。
export function annotateChinese(text, lookup, missing = []) {
  let out = '';
  let last = 0;
  for (const match of String(text).matchAll(CHINESE_RUN)) {
    const run = trimRun(match[0]);
    const end = match.index + match[0].length;
    const runEnd = match.index + match[0].indexOf(run) + run.length;
    if (!run || PINYIN_AFTER.test(text.slice(end))) continue;
    const pinyin = lookup(run);
    if (!pinyin) { missing.push(run); continue; }
    const before = text.slice(0, match.index);
    const insideParens = (before.match(/\(/g) || []).length > (before.match(/\)/g) || []).length;
    out += text.slice(last, runEnd) + (insideParens ? ` ${pinyin}` : ` (${pinyin})`);
    last = runEnd;
  }
  return out + text.slice(last);
}

// 檢查用：還沒附拼音的中文。
export function chineseWithoutPinyin(text) {
  return [...String(text).matchAll(CHINESE_RUN)]
    .filter(match => trimRun(match[0]) && !PINYIN_AFTER.test(text.slice(match.index + match[0].length)))
    .map(match => trimRun(match[0]));
}
