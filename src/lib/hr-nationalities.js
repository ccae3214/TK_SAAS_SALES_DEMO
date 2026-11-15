// 工作者「國籍」的下拉選項（菲律賓仲介新增／編輯工作者時使用）。
// 資料庫仍存中文文字（和「工作意向」一樣），所以舊資料、LINE bot 與 PDF 履歷匯入都不受影響；
// 英文顯示靠 NATIONALITY_EN，由 hr-translations.jsx 的 translateHrText 查表（排在最後，不會覆蓋既有翻譯）。

export const NATIONALITY_OPTIONS = ['菲律賓', '韓國', '日本', '中國', '中國香港', '印度', '印尼'];

// 下拉選單裡的分組標題（停用選項）。網站的翻譯機制不會翻 <optgroup label>，所以用一個可翻譯的停用選項當標題。
export const MIDDLE_EAST_HEADING = '—— 中東各國 ——';
export const MIDDLE_EAST_COUNTRIES = [
  '沙烏地阿拉伯', '阿拉伯聯合大公國', '卡達', '科威特', '巴林', '阿曼', '約旦', '以色列', '黎巴嫩',
  '伊拉克', '伊朗', '土耳其', '葉門', '敘利亞', '巴勒斯坦', '埃及', '賽普勒斯',
];
export const ALL_NATIONALITIES = [...NATIONALITY_OPTIONS, ...MIDDLE_EAST_COUNTRIES];

export const NATIONALITY_EN = {
  '菲律賓': 'Philippines', '韓國': 'South Korea', '日本': 'Japan', '中國': 'China', '中國香港': 'Hong Kong, China',
  '印度': 'India', '印尼': 'Indonesia', [MIDDLE_EAST_HEADING]: '—— Middle East ——',
  '沙烏地阿拉伯': 'Saudi Arabia', '阿拉伯聯合大公國': 'United Arab Emirates', '卡達': 'Qatar', '科威特': 'Kuwait',
  '巴林': 'Bahrain', '阿曼': 'Oman', '約旦': 'Jordan', '以色列': 'Israel', '黎巴嫩': 'Lebanon', '伊拉克': 'Iraq',
  '伊朗': 'Iran', '土耳其': 'Türkiye', '葉門': 'Yemen', '敘利亞': 'Syria', '巴勒斯坦': 'Palestine', '埃及': 'Egypt',
  '賽普勒斯': 'Cyprus',
};

// 舊資料／PDF 履歷匯入可能是英文或不同寫法（Filipino、菲律賓籍、Hong Kong…）；對應到選項，對應不到就原樣保留。
const ALIASES = {
  '菲律賓': ['philippines', 'philippine', 'filipino', 'filipina', 'pilipino', 'the philippines', 'ph', '菲律宾', '菲'],
  '韓國': ['korea', 'south korea', 'republic of korea', 'korean', 'rok', '南韓', '韩国'],
  '日本': ['japan', 'japanese'],
  '中國': ['china', 'prc', "people's republic of china", 'chinese', '中國大陸', '大陸', '中国'],
  '中國香港': ['hong kong', 'hongkong', 'hong kong, china', 'hk', '香港', '中国香港'],
  '印度': ['india', 'indian'],
  '印尼': ['indonesia', 'indonesian', '印度尼西亞', '印度尼西亚'],
  '沙烏地阿拉伯': ['saudi arabia', 'saudi', 'ksa', '沙特阿拉伯', '沙地阿拉伯'],
  '阿拉伯聯合大公國': ['united arab emirates', 'uae', 'emirates', '阿聯酋', '阿拉伯聯合酋長國'],
  '卡達': ['qatar', '卡塔爾'], '科威特': ['kuwait'], '巴林': ['bahrain'], '阿曼': ['oman'], '約旦': ['jordan'],
  '以色列': ['israel'], '黎巴嫩': ['lebanon'], '伊拉克': ['iraq'], '伊朗': ['iran'],
  '土耳其': ['turkey', 'türkiye', 'turkiye'], '葉門': ['yemen'], '敘利亞': ['syria'], '巴勒斯坦': ['palestine'],
  '埃及': ['egypt'], '賽普勒斯': ['cyprus', '塞浦路斯'],
};
const LOOKUP = new Map();
for (const [canonical, names] of Object.entries(ALIASES)) {
  LOOKUP.set(canonical.toLowerCase(), canonical);
  for (const name of names) LOOKUP.set(name.toLowerCase(), canonical);
}

/** 把任意寫法的國籍轉成選項值；對應不到時回傳原字串（不丟失資料）。 */
export function normalizeNationality(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const key = raw.toLowerCase();
  if (LOOKUP.has(key)) return LOOKUP.get(key);
  const stripped = key.replace(/[籍人]$/u, '');
  if (stripped !== key && LOOKUP.has(stripped)) return LOOKUP.get(stripped);
  return raw;
}
