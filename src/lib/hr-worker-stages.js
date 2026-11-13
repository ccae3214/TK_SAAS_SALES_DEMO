// 工人「必要文件」分頁的階段分組。
// 依「菲律賓移工來台工作：五方實務指南」指南一（工人）的 A–G 階段，把系統既有的文件與申辦步驟歸組；
// 不新增文件項目。費用與時間多為估計值，tag: 'estimate'＝估計、'verified'＝官方公告或新聞可查證。

export const WORKER_STAGES = [
  {
    key: 'A', title: '簽約前', duration: '約 1–2 週',
    summary: '確認仲介合法、完成線上 PEOS、看懂契約。',
    documents: ['PEOS', 'E-registration（建立線上資料）', 'DMW Info Sheet'],
    steps: ['match_date'],
    acks: [
      { key: 'agency_verified', text: '我已到 DMW 網站確認仲介持有合法執照。' },
      { key: 'contract_read', text: '我已讀懂契約：月薪、工時、加班費、食宿、機票由誰負擔都寫清楚，也沒有簽任何空白文件。' },
    ],
    tips: [{ text: '出發前請先到 DMW 網站確認仲介執照。' }, { text: '契約上的月薪、工時、加班費、食宿與機票負擔都要寫清楚；不要簽空白文件。' }],
  },
  {
    key: 'B', title: '備齊個人文件', duration: '約 2–6 週（主要看預約等候）',
    summary: '護照、PSA、NBI、體檢等個人文件，未列在其他階段的文件也放在這裡。',
    documents: [
      '新護照', '舊護照', 'ARC', '國民身分證（EgovPH下載）', 'PSA出生證明（附收據）', 'PSA結婚證明（附收據）',
      '子女PSA出生證明（附收據）', 'PSA CENOMAR', 'CAV／NC2 TESDA', 'NBI（確認有效期限）', '照片（2x2 16張及護照尺寸2張）',
      'Voter ID／Voter Certificate', '體檢 Medical', 'LCR Form 1-A', 'Health Card', 'BOI旅行紀錄（單身及已婚）',
      '出生逾10年補登證明（洗禮證明；未受洗提供學校紀錄）', 'TIN ID',
    ],
    steps: ['passport', 'document_arrival', 'personal_documents', 'medical', 'medical_expiry', 'training', 'umid'],
    acks: [{ key: 'passport_valid', text: '我已確認護照效期涵蓋合約期，且至少還有 6 個月以上。' }],
    tips: [{ text: '體檢報告在簽證申請時需為 3 個月內。', tag: 'verified' }],
    fallback: true, // 清單以外（例如管理者自訂）的文件預設歸到這個階段
  },
  {
    key: 'C', title: '契約與簽證', duration: '約 2–4 週（多由仲介辦理，你要審閱並簽名）',
    summary: '勞動契約與工資切結書要經 MECO 認證、DMW 審核；簽證由雇主或仲介申請。',
    documents: ['合約 Contract（掃描檔）', '簽證 Visa'],
    steps: ['accr_in', 'accr_out', 'contract_arrival', 'contract_issue', 'wage_attestation', 'visa'],
    acks: [
      { key: 'contract_reviewed', text: '我已審閱勞動契約與工資切結書，兩份文件的薪資與費用數字一致，並在簽名前自己對照過一次。' },
      { key: 'passport_custody', text: '我知道護照不應長期交給仲介或雇主；若必須暫借，一定要有書面與收據。' },
    ],
    tips: [{ text: '簽證由雇主或仲介向駐菲律賓代表處（TECO）申請，簽證費請向仲介確認。' }],
  },
  {
    key: 'D', title: '出境前', duration: '約 1–2 週',
    summary: 'OWWA、PDOS、OEC 與社會保險登記。',
    documents: ['SSS contribution', 'OEC 出國認證'],
    steps: ['pdos', 'owwa', 'oec', 'ticket', 'expected_entry'],
    acks: [{ key: 'ticket_payer', text: '我已確認機票由誰負擔，且與合約內容一致。' }],
    tips: [
      { text: 'OWWA 會員每份合約繳一次，約 USD 25。', tag: 'estimate' },
      { text: 'PDOS 由 OWWA 辦理，通常免費；若有人向你收費，請撥 OWWA 1348 檢舉。', tag: 'estimate' },
      { text: 'OEC 或 OFW Pass 是出境許可，可免旅遊稅與機場稅，費用請以 DMW 公告為準。', tag: 'estimate' },
    ],
  },
  {
    key: 'E', title: '抵台 3 日內', duration: '',
    summary: '接機後的健檢、入國通報與加保。',
    documents: [],
    steps: ['actual_entry'],
    acks: [{ key: 'documents_received', text: '我已簽收並保存聘僱許可、居留證、勞動契約副本與薪資單。' }],
    info: [
      { text: '機場接機後，雇主或台灣仲介會安排你在入國後 3 個工作日內到指定醫院健檢。', tag: 'verified' },
      { text: '雇主要在 3 日內辦理勞健保加保與入國通報。', tag: 'verified' },
    ],
  },
  {
    key: 'F', title: '在台期間', duration: '',
    summary: '居留證、定期健檢、服務費與所得稅。',
    documents: [], steps: [],
    info: [
      { title: '居留證', text: '每年約 NTD 1,000，原則上由工人負擔或依契約另訂（資料較舊）。', tag: 'verified' },
      { title: '定期健檢', text: '入國後第 6、18、30 個月各一次，前後 30 日內完成。', tag: 'verified' },
      { title: '台灣仲介服務費', text: '第 1 年每月不超過 NTD 1,800，第 2 年不超過 NTD 1,700，第 3 年起不超過 NTD 1,500；必須有書面契約且有提供服務才能收，不得預收。', tag: 'verified' },
      { title: '所得稅', text: '一個年度居留滿 183 天要申報，次年 5 月 1 日至 31 日辦理。', tag: 'verified' },
    ],
  },
  {
    key: 'G', title: '期滿', duration: '',
    summary: '續聘、轉換雇主或返國。',
    documents: [], steps: [],
    info: [
      { text: '期滿續聘或轉換雇主時，仲介只能向新雇主收登記費與介紹費，不得向你收費。', tag: 'verified' },
      { text: '製造等類別累計在台工作上限為 12 年；符合規定的家庭看護特殊表現者為 14 年。', tag: 'verified' },
    ],
  },
];

// 文件的辦理單位、時間與費用（來自指南；多為估計）
export const DOCUMENT_GUIDE = {
  'PEOS': { cost: '通常免費', tag: 'estimate' },
  '新護照': { agency: 'DFA', time: '數週，需預約', cost: '約 ₱950–1,200', tag: 'estimate', note: '護照效期要涵蓋合約期，至少 6 個月以上。' },
  'PSA出生證明（附收據）': { agency: 'PSA', time: '約 1–2 週', cost: '約 ₱155–365', tag: 'estimate' },
  'PSA結婚證明（附收據）': { agency: 'PSA', time: '約 1–2 週', cost: '約 ₱155–365', tag: 'estimate' },
  'NBI（確認有效期限）': { agency: 'NBI', time: '預約後數日', cost: '約 ₱130–200', tag: 'estimate' },
  '照片（2x2 16張及護照尺寸2張）': { agency: '照相館', time: '當天', cost: '數十至百餘披索', tag: 'estimate' },
  'CAV／NC2 TESDA': { agency: 'TESDA', time: '視情況', cost: 'NC 測驗約 ₱1,500–3,000', tag: 'estimate', note: '只有看護相關職業（家庭看護、機構看護工、家庭幫傭）需要，其他工種不需要。' },
  '體檢 Medical': { agency: 'DMW 或台灣認可醫院', time: '3–5 天', cost: '約 ₱3,400–7,000', tag: 'estimate', note: '簽證申請時需為 3 個月內的報告。' },
  'SSS contribution': { cost: 'OFW 通常要登記或繳款', tag: 'estimate' },
};

export const STAGE_NOTICE = '費用與時間多為估計，實際以主管機關公告與你的合約為準；製造與漁撈類的海外招募費、機票等費用，未來可能改由雇主負擔。以上資訊不是法律意見。';
export const STAGE_HELP = '遇到問題：台灣勞動部 1955 勞工諮詢申訴專線；菲律賓 OWWA 24 小時專線 1348。紅旗：要求先付大筆現金、不給收據、扣留護照、承諾保證出國時間、要你簽空白文件。';

export const ACK_TEXT = new Map(WORKER_STAGES.flatMap(stage => (stage.acks || []).map(ack => [ack.key, ack.text])));
export const ACK_KEYS = new Set(WORKER_STAGES.flatMap(stage => (stage.acks || []).map(ack => ack.key)));

const documentStage = new Map();
WORKER_STAGES.forEach(stage => stage.documents.forEach(name => documentStage.set(name, stage.key)));
const stepStage = new Map();
WORKER_STAGES.forEach(stage => stage.steps.forEach(key => stepStage.set(key, stage.key)));
const FALLBACK_STAGE = WORKER_STAGES.find(stage => stage.fallback).key;

// 必要文件的狀態篩選（工人頁與雇主／仲介的文件審核清單共用）。
export const DOCUMENT_STATUS_FILTERS = [
  ['submitted', '待審核'],
  ['returned', '被退回'],
  ['missing', '待上傳'],
  ['approved', '已核准'],
  ['all', '全部'],
];
// 不適用的文件獨立成一組，其餘直接用審核狀態。
export const documentGroup = item => (!item.applicable ? 'na' : item.status);

export function stageOfRequirement(name) { return documentStage.get(name) || FALLBACK_STAGE; }
export function stageOfStep(key) { return stepStage.get(key) || FALLBACK_STAGE; }

// 英文介面翻譯（合併進 hr-translations 的字典）
export const WORKER_STAGE_EN = {
  '簽約前': 'Before signing', '備齊個人文件': 'Prepare personal documents', '契約與簽證': 'Contract & visa', '出境前': 'Before departure',
  '抵台 3 日內': 'Within 3 days of arrival', '在台期間': 'While in Taiwan', '期滿': 'End of contract',
  '約 1–2 週': 'About 1–2 weeks', '約 2–6 週（主要看預約等候）': 'About 2–6 weeks (mostly appointment waiting time)',
  '約 2–4 週（多由仲介辦理，你要審閱並簽名）': 'About 2–4 weeks (usually handled by the agency; you review and sign)',
  '確認仲介合法、完成線上 PEOS、看懂契約。': 'Confirm the agency is legitimate, complete the online PEOS, and understand the contract.',
  '護照、PSA、NBI、體檢等個人文件，未列在其他階段的文件也放在這裡。': 'Personal documents such as passport, PSA, NBI and medical exam. Documents not listed in other stages are also placed here.',
  '勞動契約與工資切結書要經 MECO 認證、DMW 審核；簽證由雇主或仲介申請。': 'The labor contract and wage affidavit must be authenticated by MECO and reviewed by DMW; the employer or agency applies for the visa.',
  'OWWA、PDOS、OEC 與社會保險登記。': 'OWWA, PDOS, OEC and social insurance registration.',
  '接機後的健檢、入國通報與加保。': 'Medical exam, entry notification and insurance enrollment after pick-up.',
  '居留證、定期健檢、服務費與所得稅。': 'Residence permit, periodic medical exams, service fees and income tax.',
  '續聘、轉換雇主或返國。': 'Renewal, changing employers, or returning home.',
  '我已到 DMW 網站確認仲介持有合法執照。': 'I have checked on the DMW website that the agency holds a valid license.',
  '我已讀懂契約：月薪、工時、加班費、食宿、機票由誰負擔都寫清楚，也沒有簽任何空白文件。': 'I understand the contract: monthly wage, working hours, overtime pay, food and housing, and who pays for the plane ticket are all clearly written, and I have not signed any blank documents.',
  '出發前請先到 DMW 網站確認仲介執照。': 'Before departure, check the agency license on the DMW website.',
  '契約上的月薪、工時、加班費、食宿與機票負擔都要寫清楚；不要簽空白文件。': 'The monthly wage, working hours, overtime pay, food and housing, and ticket costs must be clearly written in the contract. Do not sign blank documents.',
  '我已確認護照效期涵蓋合約期，且至少還有 6 個月以上。': 'I have confirmed my passport is valid for the whole contract period and has at least 6 months remaining.',
  '體檢報告在簽證申請時需為 3 個月內。': 'The medical report must be within 3 months when applying for the visa.',
  '我已審閱勞動契約與工資切結書，兩份文件的薪資與費用數字一致，並在簽名前自己對照過一次。': 'I have reviewed the labor contract and the wage affidavit; the wage and fee figures in both documents match, and I checked them myself before signing.',
  '我知道護照不應長期交給仲介或雇主；若必須暫借，一定要有書面與收據。': 'I know my passport should not be left with the agency or employer long-term; if it must be lent temporarily, I must get it in writing with a receipt.',
  '簽證由雇主或仲介向駐菲律賓代表處（TECO）申請，簽證費請向仲介確認。': 'The employer or agency applies for the visa at the Taipei Economic and Cultural Office (TECO) in the Philippines. Please confirm the visa fee with the agency.',
  '我已確認機票由誰負擔，且與合約內容一致。': 'I have confirmed who pays for the plane ticket, and it matches the contract.',
  'OWWA 會員每份合約繳一次，約 USD 25。': 'OWWA membership is paid once per contract, about USD 25.',
  'PDOS 由 OWWA 辦理，通常免費；若有人向你收費，請撥 OWWA 1348 檢舉。': 'PDOS is run by OWWA and is usually free; if anyone charges you, report it to OWWA at 1348.',
  'OEC 或 OFW Pass 是出境許可，可免旅遊稅與機場稅，費用請以 DMW 公告為準。': 'The OEC or OFW Pass is your exit permit and exempts you from travel tax and airport tax; check DMW announcements for the fee.',
  '我已簽收並保存聘僱許可、居留證、勞動契約副本與薪資單。': 'I have received and kept my employment permit, residence permit, a copy of the labor contract and my pay slips.',
  '機場接機後，雇主或台灣仲介會安排你在入國後 3 個工作日內到指定醫院健檢。': 'After airport pick-up, the employer or Taiwan agency will arrange your medical exam at a designated hospital within 3 working days of arrival.',
  '雇主要在 3 日內辦理勞健保加保與入國通報。': 'The employer must enroll you in labor and health insurance and file the entry notification within 3 days.',
  '居留證': 'Residence permit', '定期健檢': 'Periodic medical exam', '台灣仲介服務費': 'Taiwan agency service fee', '所得稅': 'Income tax',
  '每年約 NTD 1,000，原則上由工人負擔或依契約另訂（資料較舊）。': 'About NTD 1,000 per year; generally paid by the worker or as set in the contract (older data).',
  '入國後第 6、18、30 個月各一次，前後 30 日內完成。': 'Once at months 6, 18 and 30 after arrival, completed within 30 days before or after.',
  '第 1 年每月不超過 NTD 1,800，第 2 年不超過 NTD 1,700，第 3 年起不超過 NTD 1,500；必須有書面契約且有提供服務才能收，不得預收。': 'Up to NTD 1,800 per month in year 1, NTD 1,700 in year 2, and NTD 1,500 from year 3; it may only be charged with a written contract and actual services, and never in advance.',
  '一個年度居留滿 183 天要申報，次年 5 月 1 日至 31 日辦理。': 'If you stay 183 days or more in a tax year, file your return between May 1 and 31 of the following year.',
  '期滿續聘或轉換雇主時，仲介只能向新雇主收登記費與介紹費，不得向你收費。': 'When renewing or changing employers, the agency may only charge registration and referral fees to the new employer, not to you.',
  '製造等類別累計在台工作上限為 12 年；符合規定的家庭看護特殊表現者為 14 年。': 'The cumulative limit for working in Taiwan is 12 years for manufacturing and similar categories, and 14 years for eligible home caregivers with special performance.',
  '通常免費': 'Usually free', '數週，需預約': 'Several weeks, appointment required', '約 ₱950–1,200': 'About ₱950–1,200',
  '護照效期要涵蓋合約期，至少 6 個月以上。': 'The passport must be valid for the whole contract period, with at least 6 months remaining.',
  '約 1–2 週': 'About 1–2 weeks', '約 ₱155–365': 'About ₱155–365', '預約後數日': 'A few days after booking', '約 ₱130–200': 'About ₱130–200',
  '照相館': 'Photo studio', '當天': 'Same day', '數十至百餘披索': 'Tens to over a hundred pesos', '視情況': 'Depends on the case',
  'NC 測驗約 ₱1,500–3,000': 'NC assessment about ₱1,500–3,000', 'DMW 或台灣認可醫院': 'DMW or Taiwan-accredited hospital', '3–5 天': '3–5 days',
  '約 ₱3,400–7,000': 'About ₱3,400–7,000', '簽證申請時需為 3 個月內的報告。': 'The report must be within 3 months when applying for the visa.',
  'OFW 通常要登記或繳款': 'OFWs usually need to register or pay contributions',
  [`費用與時間多為估計，實際以主管機關公告與你的合約為準；製造與漁撈類的海外招募費、機票等費用，未來可能改由雇主負擔。以上資訊不是法律意見。`]: 'Costs and timings are mostly estimates; the competent authorities\' announcements and your contract prevail. Overseas recruitment fees, plane tickets and similar costs for manufacturing and fishing may shift to employers in future. This information is not legal advice.',
  '遇到問題：台灣勞動部 1955 勞工諮詢申訴專線；菲律賓 OWWA 24 小時專線 1348。紅旗：要求先付大筆現金、不給收據、扣留護照、承諾保證出國時間、要你簽空白文件。': 'If you run into problems: Taiwan\'s Ministry of Labor 1955 hotline; OWWA 24-hour hotline 1348 in the Philippines. Red flags: demands for large upfront cash, no receipts, passport withheld, guaranteed departure dates, or being asked to sign blank documents.',
  // 新增的文件欄位、步驟與欄位名稱
  '合約 Contract（掃描檔）': 'Contract (scan)', '簽證 Visa': 'Visa', 'OEC 出國認證': 'OEC (overseas employment certificate)',
  '只有看護相關職業（家庭看護、機構看護工、家庭幫傭）需要，其他工種不需要。': 'Only care-related jobs (home caregiver, institutional caregiver, domestic helper) need this; other job types do not.',
  '看護相關職業（家庭看護、機構看護工、家庭幫傭）': 'Care-related jobs (home caregiver, institutional caregiver, domestic helper)',
  'PDOS 台灣文化講習（1 日）': 'PDOS Taiwan culture seminar (1 day)', '體檢過期日': 'Medical exam expiry date', '合約到達菲律賓': 'Contract arrived in the Philippines',
  '核准函（合約）發函日': 'Approval letter (contract) issue date', '來華工資切結書認證': 'Wage affidavit attestation',
  '訓練（60 日；中文 A1 共 240 小時）': 'Training (60 days; Chinese A1 course, 240 study hours in total)', 'OEC（當日可領）': 'OEC (same-day release)', '機票／出境': 'Air ticket / departure',
  'PDOS 講習日': 'PDOS seminar date', '體檢過期日期': 'Medical exam expiry date', '到達菲律賓日期': 'Date arrived in the Philippines', '核准函發函日期': 'Approval letter issue date',
  '認證領出日期': 'Attestation release date', '實際出境日期': 'Actual departure date',
  '送件日期': 'Submission date', '取得日期': 'Date obtained', '開課日期': 'Course start date', '結業日期': 'Course completion date',
  '簽證類型': 'Visa type', '一般件（5 個工作天）': 'Regular (5 working days)', '加急件（3 個工作天）': 'Expedited (3 working days)',
  '雇主': 'Employer', '機票資訊（航班／備註）': 'Ticket information (flight / notes)', '尚未選擇': 'Not selected',
  // 介面文字
  '整體進度': 'Overall progress', '目前階段': 'Current stage', '請你確認': 'Please confirm', '辦理進度': 'Progress', '注意事項': 'Things to note', '須知': 'Good to know',
  '我已確認': 'I confirm', '取消確認': 'Undo confirmation', '已確認': 'Confirmed', '辦理單位': 'Handled by', '預估時間': 'Estimated time', '費用': 'Cost',
  '估計': 'Estimate', '查證': 'Verified', '尚未開始': 'Not started', '進行中': 'In progress', '遇到問題怎麼辦': 'What to do if something goes wrong',
  '此階段沒有需要你處理的項目。': 'Nothing to do for this stage.', '確認失敗': 'Confirmation failed',
  // 既有文件名稱（補齊英文介面）
  '新護照': 'New passport', '舊護照': 'Old passport', 'ARC': 'ARC', '國民身分證（EgovPH下載）': 'National ID (downloaded from EGovPH)',
  'PSA出生證明（附收據）': 'PSA birth certificate (with receipt)', 'PSA結婚證明（附收據）': 'PSA marriage certificate (with receipt)',
  '子女PSA出生證明（附收據）': 'PSA birth certificates of children (with receipts)', 'PSA CENOMAR': 'PSA CENOMAR',
  'CAV／NC2 TESDA': 'CAV / NC II TESDA', 'NBI（確認有效期限）': 'NBI clearance (check validity)', '照片（2x2 16張及護照尺寸2張）': 'Photos (16 pcs 2x2 and 2 passport-size)',
  'Voter ID／Voter Certificate': 'Voter ID / Voter Certificate', '體檢 Medical': 'Medical exam', 'LCR Form 1-A': 'LCR Form 1-A', 'DMW Info Sheet': 'DMW Info Sheet',
  'Health Card': 'Health Card', 'BOI旅行紀錄（單身及已婚）': 'BOI travel record (single and married)', 'TIN ID': 'TIN ID',
  '出生逾10年補登證明（洗禮證明；未受洗提供學校紀錄）': 'Late registration proof for births over 10 years ago (baptismal certificate; school records if not baptized)',
  'E-registration（建立線上資料）': 'E-registration (create online profile)', 'PEOS': 'PEOS', 'SSS contribution': 'SSS contribution',
  '曾在台灣工作者': 'For those who have worked in Taiwan', '已婚者': 'For married workers', '有子女者': 'For workers with children', '未婚者': 'For unmarried workers',
  '曾在海外工作者': 'For those who have worked overseas', '出生登記逾10年補登者': 'For births registered more than 10 years late',
};
