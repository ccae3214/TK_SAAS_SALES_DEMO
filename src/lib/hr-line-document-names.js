// LINE 回覆用的「文件名稱」翻譯（純函式，不碰資料庫）。
//
// 資料庫（hr_worker_documents.name）存的是中文名稱，所以 LINE 機器人用英文或 Filipino 回覆時，
// 文件清單、退件通知裡的「護照」「照片」等名稱會一直是中文。這裡依回覆語言換成對應名稱；
// 找不到對照（例如日後新增的文件種類）就原樣顯示，不會讓回覆壞掉。
// 英文名稱與網頁端（hr-translations.jsx）一致。

export const DOCUMENT_NAME_TEXT = {
  en: {
    '新護照': 'New passport',
    '舊護照': 'Old passport',
    'ARC': 'ARC',
    '國民身分證（EgovPH下載）': 'National ID (download from EgovPH)',
    'PSA出生證明（附收據）': 'PSA birth certificate with receipt',
    'PSA結婚證明（附收據）': 'PSA marriage certificate with receipt',
    '子女PSA出生證明（附收據）': 'Child PSA birth certificate with receipt',
    'PSA CENOMAR': 'PSA CENOMAR',
    'CAV／NC2 TESDA': 'CAV / NC2 TESDA',
    'NBI（確認有效期限）': 'NBI (check expiry)',
    'E-registration（建立線上資料）': 'E-registration (create online)',
    'PEOS': 'PEOS',
    '照片（2x2 16張及護照尺寸2張）': '16 2x2 photos and 2 passport-size photos',
    'Voter ID／Voter Certificate': 'Voter ID / Voter Certificate',
    'SSS contribution': 'SSS contribution',
    '體檢 Medical': 'Medical examination',
    'LCR Form 1-A': 'Local Civil Registry Form 1-A',
    'DMW Info Sheet': 'DMW information sheet',
    'Health Card': 'Health card',
    'BOI旅行紀錄（單身及已婚）': 'BOI travel records (single and married)',
    '出生逾10年補登證明（洗禮證明；未受洗提供學校紀錄）': 'Late birth registration (over 10 years): baptismal certificate or school records if not baptized',
    'TIN ID': 'TIN ID',
    '合約 Contract（掃描檔）': 'Contract (scanned copy)',
    '簽證 Visa': 'Visa',
    'OEC 出國認證': 'OEC (Overseas Employment Certificate)',
  },
  tl: {
    '新護照': 'Bagong pasaporte',
    '舊護照': 'Lumang pasaporte',
    'ARC': 'ARC',
    '國民身分證（EgovPH下載）': 'National ID (i-download sa EgovPH)',
    'PSA出生證明（附收據）': 'PSA birth certificate (kasama ang resibo)',
    'PSA結婚證明（附收據）': 'PSA marriage certificate (kasama ang resibo)',
    '子女PSA出生證明（附收據）': 'PSA birth certificate ng anak (kasama ang resibo)',
    'PSA CENOMAR': 'PSA CENOMAR',
    'CAV／NC2 TESDA': 'CAV / NC2 TESDA',
    'NBI（確認有效期限）': 'NBI (tingnan ang expiry)',
    'E-registration（建立線上資料）': 'E-registration (gumawa ng online na datos)',
    'PEOS': 'PEOS',
    '照片（2x2 16張及護照尺寸2張）': '16 na 2x2 na larawan at 2 passport-size na larawan',
    'Voter ID／Voter Certificate': 'Voter ID / Voter Certificate',
    'SSS contribution': 'SSS contribution',
    '體檢 Medical': 'Medical examination',
    'LCR Form 1-A': 'Local Civil Registry Form 1-A',
    'DMW Info Sheet': 'DMW Info Sheet',
    'Health Card': 'Health Card',
    'BOI旅行紀錄（單身及已婚）': 'BOI travel records (single at may asawa)',
    '出生逾10年補登證明（洗禮證明；未受洗提供學校紀錄）': 'Late birth registration (mahigit 10 taon): baptismal certificate o school records kung hindi bininyagan',
    'TIN ID': 'TIN ID',
    '合約 Contract（掃描檔）': 'Contract (na-scan)',
    '簽證 Visa': 'Visa',
    'OEC 出國認證': 'OEC (Overseas Employment Certificate)',
  },
};

// language：'zh' 或沒有對照時回傳原本的中文名稱。
export function documentDisplayName(name, language) {
  return DOCUMENT_NAME_TEXT[language]?.[name] || name;
}
