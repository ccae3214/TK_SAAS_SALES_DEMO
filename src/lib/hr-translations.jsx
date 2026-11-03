"use client";

import React, { cloneElement, Fragment } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { useEffect } from 'react';

const EN = {
  '克雷迅人力管理': 'Kolecion HR', '克雷迅人力仲介管理系統': 'Kolecion Employment Agency Management',
  '克雷迅人力仲介': 'Kolecion Employment Agency', '總覽': 'Overview', '案件管理': 'Cases',
  '文件收件與審核': 'Documents & Reviews', '體檢與訓練': 'Medical & Training', '工作待辦': 'Tasks',
  '雇主／客戶': 'Employers / Clients', '工作者': 'Workers', '仲介機構': 'Agencies', '會員帳號': 'Member Accounts',
  '承辦人員': 'Staff', '操作紀錄': 'Activity Log', '案件': 'Cases', '文件': 'Documents',
  '體檢': 'Medical', '訓練': 'Training', '其他': 'Other', '待處理': 'To do', '處理中': 'In progress',
  '受阻': 'Blocked', '啟用': 'Active', '停用': 'Inactive', '未安排': 'Not scheduled', '已安排': 'Scheduled',
  '合格': 'Passed', '複檢': 'Retest', '未通過': 'Failed', '已完成': 'Completed', '未設定': 'Not set',
  '需求受理': 'Intake', '媒合中': 'Matching', '文件處理': 'Document processing', '申請辦理': 'Application',
  '後續安排': 'Placement', '完成': 'Complete', '進行中': 'In progress', '暫停': 'On hold', '結案': 'Closed',
  '工人': 'Worker', '雇主': 'Employer', '仲介': 'Agency', '管理者': 'Administrator', '尚未指派會員類型': 'No member type assigned',
  'LINE 登入': 'LINE sign-in', '待管理者指派': 'Awaiting administrator assignment', '待審核': 'Pending review',
  '前往': 'Go to ', '清單，共': ' list · ', '筆': ' records', '進行中案件': 'Active cases',
  '目前進行中的案件': 'Cases currently in progress', '待審文件': 'Documents awaiting review',
  '等待承辦人核准或退回': 'Awaiting staff approval or return', '待處理工作': 'Open tasks',
  '尚未完成的工作待辦': 'Tasks that are not complete', '已建立的客戶資料': 'Client records',
  '已建立的工作者資料': 'Worker records', '最近更新案件': 'Recently updated cases', '依最後更新時間排序': 'Sorted by most recently updated',
  '查看全部': 'View all', '案件編號': 'Case number', '雇主／客戶名稱': 'Employer / client name',
  '雇主／客戶': 'Employer / client', '案件階段': 'Case stage', '狀態': 'Status', '最近更新': 'Last updated',
  '最近更新案件': 'Recently updated cases', '需要留意': 'Needs attention', '逾期或受阻的待辦': 'Overdue or blocked tasks',
  '工作待辦': 'Tasks', '期限': 'Due', '尚未建立案件': 'No cases yet', '新增第一筆案件後，案件進度會顯示在這裡。': 'Case progress will appear here after you add the first case.',
  '目前沒有待處理提醒': 'No alerts right now', '待辦受阻或逾期時會列在這裡。': 'Blocked or overdue tasks will appear here.',
  '搜尋案件編號、人員或職類': 'Search case number, people, or job type', '搜尋名稱、聯絡人或電話': 'Search name, contact, or phone',
  '搜尋姓名、國籍、聯絡方式': 'Search name, nationality, or contact details', '搜尋待辦、案件編號或工作者': 'Search tasks, case number, or worker',
  '清除搜尋': 'Clear search', '未指派': 'Unassigned', '找不到符合的案件': 'No matching cases', '尚無案件資料': 'No case records',
  '請調整搜尋條件。': 'Try changing your search.', '建立雇主與工作者資料後，即可新增案件。': 'Add employer and worker records before creating a case.',
  '家庭看護': 'Home caregiver', '工廠': 'Factory', '家庭幫傭': 'Domestic helper', '工廠技術工': 'Factory technician', '其他': 'Other', '必要': 'Required', '選填': 'Optional',
  '尚無雇主／客戶資料': 'No employer or client records', '尚無工作者資料': 'No worker records', '尚無承辦人資料': 'No staff records',
  '建立資料後可在新增案件時選用。': 'Create records to select them when adding a case.', '新增工作者後可建立案件並追蹤進度。': 'Add workers to create cases and track progress.',
  '建立團隊資料後，即可將案件指派給負責人。': 'Add staff to assign cases to team members.', '新增承辦人': 'Add staff',
  '待辦事項': 'Task', '分類': 'Category', '期限': 'Due date', '說明': 'Description', '找不到符合的待辦': 'No matching tasks',
  '尚無工作待辦': 'No tasks yet', '在案件中新增文件、體檢、訓練或其他待辦。': 'Add document, medical, training, or other tasks to a case.',
  '新增待辦': 'Add task', '全部狀態': 'All statuses', '待審': 'Pending review', '已退回': 'Returned',
  '未收件': 'Not received', '已核准': 'Approved', '退回補件': 'Returned for updates', '尚未收件': 'Not received',
  '新增版本': 'Add version', '上傳文件': 'Upload document', '目前沒有符合條件的文件': 'No documents match this filter',
  '案件建立時會新增護照與 PSA 前置文件；其他文件可在這裡新增。': 'Passport and PSA requirements are added with each case; add other documents here.',
  '新增文件要求': 'Add document requirement', '啟動前置文件': 'Required before processing', '尚無案件': 'No cases yet',
  '建立案件後可追蹤體檢與訓練。': 'Create a case to track medical checks and training.', '台灣仲介': 'Taiwan agency',
  '菲律賓仲介': 'Philippines agency', '尚無仲介機構': 'No agencies yet', '建立仲介後可將工作者或雇主指派給所屬仲介。': 'Create an agency to assign workers or employers.',
  '變更類型': 'Change type', '審核／指派': 'Review / assign', '停用帳號': 'Deactivate account', '啟用帳號': 'Activate account',
  '尚無一般會員帳號': 'No member accounts yet', '會員登入並申請類型後會列於此，管理者可審核並指派所屬資料。': 'Members appear here after applying for a type; administrators can review and assign their records.',
  '尚無操作紀錄': 'No activity yet', '新增或更新案件資料後，操作歷程會顯示在這裡。': 'Activity appears here after cases are created or updated.',
  '人力案件操作歷程': 'HR case activity', '文件審核、進度變更與文件存取都會記錄在這裡。': 'Document reviews, progress changes, and document access are recorded here.',
  '會員可申請工人、雇主或仲介類型；管理者審核並指定所屬資料後才會啟用對應權限。': 'Members can apply as a worker, employer, or agency. Access starts after an administrator reviews and assigns the relevant record.',
  '會員': 'Member', '登入 Email': 'Sign-in email', '申請類型': 'Requested type', '會員類型': 'Member type', '所屬資料': 'Assigned record',
  '操作': 'Actions', '編輯資料': 'Edit details', '編輯': 'Edit', '審核已完成': 'Review complete', '核准': 'Approve', '退回': 'Return',
  '編輯仲介': 'Edit agency', '仲介名稱': 'Agency name', '仲介類型': 'Agency type', '所屬台灣仲介': 'Taiwan agency',
  '所屬菲律賓仲介': 'Philippines agency', '所屬工作者': 'Assigned worker', '所屬雇主': 'Assigned employer', '聯絡人': 'Contact',
  '聯絡電話': 'Phone', '電話': 'Phone', '地址': 'Address', '備註': 'Notes', '姓名': 'Name', '國籍': 'Nationality',
  '工作意向': 'Job preference', '會員名稱': 'Member name', '初始密碼（至少 10 字元）': 'Initial password (at least 10 characters)',
  'LINE User ID（選填）': 'LINE User ID (optional)', 'LINE User ID': 'LINE User ID', '所屬仲介': 'Assigned agency',
  '選擇要申請的會員類型': 'Choose a member type', '會員類型審核': 'Member type review', '申請已送出，等待管理者審核': 'Application submitted. Awaiting administrator review.',
  '管理者核准並指派所屬資料後，你就能使用對應的會員工作區。': 'You can access the matching workspace after an administrator approves and assigns your record.',
  '送出後會由管理者確認身分並指派所屬資料。審核完成前不會開放案件或會員資料。': 'An administrator will verify your identity and assign a record. Case and member data stay unavailable until approval.',
  '送出審核申請': 'Submit for review', '送出中…': 'Submitting…', '尚未選擇': 'Not selected', '工人工作區': 'Worker workspace',
  '雇主工作區': 'Employer workspace', '仲介工作區': 'Agency workspace', '僅顯示與此帳號關聯的資料': 'Only data linked to this account is shown',
  '我的案件': 'My cases', '關聯工作者': 'Linked workers', '雇主／客戶': 'Employers / clients', '案件雇主': 'Case employers',
  '我的雇主資料': 'My employer records', '可媒合與所屬工作者': 'Available and assigned workers', '我的工作者資料': 'My worker record',
  '案件文件進度': 'Case document progress', '案件待辦': 'Case tasks', '目前沒有關聯案件。': 'No cases are linked to this account.',
  '所屬工作者': 'Assigned workers', '所屬雇主': 'Assigned employers', '我的雇主資料': 'My employer records', '雇主': 'Employer',
  '必要文件與審核': 'Required documents & review', '赴台申請程序': 'Taiwan application process', '檢視': 'View', '不適用': 'Not applicable',
  '待收件': 'Awaiting submission', '待審核': 'Awaiting review', '已合格': 'Approved', '退件待修正': 'Correction required', '確認適用': 'Mark applicable', '標示不適用': 'Mark not applicable',
  '核准文件': 'Approve document', '退回補件': 'Return for correction', '補件原因：': 'Correction reason: ', '重新上傳': 'Resubmit', '上傳文件': 'Upload document',
  '辦件／開始日': 'Application / start date', '完成／出件日': 'Completion / issue date', '訓練開始日': 'Training start date', '訓練完成日': 'Training completion date',
  '預定入境日期': 'Expected arrival date', '實際入境日期': 'Actual arrival date', '儲存': 'Save', '儲存中…': 'Saving…', '備註': 'Notes',
  '新護照': 'New passport', '舊護照': 'Old passport', 'ARC': 'ARC', '國民身分證（EgovPH下載）': 'National ID (download from EgovPH)',
  'PSA出生證明（附收據）': 'PSA birth certificate with receipt', 'PSA結婚證明（附收據）': 'PSA marriage certificate with receipt',
  '子女PSA出生證明（附收據）': 'Child PSA birth certificate with receipt', 'PSA CENOMAR': 'PSA CENOMAR', 'CAV／NC2 TESDA': 'CAV / NC2 TESDA',
  'NBI（確認有效期限）': 'NBI (check expiry)', 'E-registration（建立線上資料）': 'E-registration (create online)', '照片（2x2 16張及護照尺寸2張）': '16 2x2 photos and 2 passport-size photos',
  'Voter ID／Voter Certificate': 'Voter ID / Voter Certificate', 'SSS contribution': 'SSS contribution', '體檢 Medical': 'Medical examination', 'LCR Form 1-A': 'Local Civil Registry Form 1-A',
  'DMW Info Sheet': 'DMW information sheet', 'Health Card': 'Health card', 'BOI旅行紀錄（單身及已婚）': 'BOI travel records (single and married)', '出生逾10年補登證明（洗禮證明；未受洗提供學校紀錄）': 'Late birth registration (over 10 years): baptismal certificate or school records if not baptized', 'TIN ID': 'TIN ID',
  '曾在台灣工作者': 'Previously worked in Taiwan', '已婚者': 'If married', '有子女者': 'If the applicant has children', '未婚者': 'If single', '曾在海外工作者': 'Previously worked abroad', '出生登記逾10年補登者': 'Birth registration was filed more than 10 years late',
  '文件寄達菲律賓': 'Documents received in the Philippines', '個人文件與證件確認': 'Personal documents and IDs verified', 'PDOS 簽立文件': 'PDOS documents signed', '體檢 MED': 'Medical examination (MED)', 'ACCR 入件': 'ACCR filed', 'ACCR 出件': 'ACCR released', 'UMID': 'UMID', '訓練（60 日）': 'Training (60 days)', 'OWWA（7 日）': 'OWWA (7 days)', 'VISA（7 日）': 'Visa (7 days)', 'OEC（4 日）': 'OEC (4 days)', '預定入境': 'Expected arrival', '實際入境': 'Actual arrival',
  '文件上傳': 'Document upload', '我的資料': 'My profile', '相關雇主': 'Related employers', '編輯工作者': 'Edit worker',
  '儲存工作者': 'Save worker', '新增工作者': 'Add worker', '返回工作者': 'Back to workers', '工作意向': 'Job preference',
  '審核中': 'Under review', '需補件': 'Additional documents required', '目前沒有可上傳的案件文件項目。': 'There are no case documents available to upload.','目前沒有所屬工作者。': 'No workers are assigned to this agency.',
  '無法載入會員資料': 'Unable to load member data', '載入中': 'Loading', '正在確認此帳號可存取的案件資料。': 'Checking which case data this account can access.',
  '無法讀取資料': 'Unable to load data', '儲存失敗': 'Save failed', '資料已儲存': 'Changes saved', '更新失敗': 'Update failed', '變更已儲存': 'Changes saved',
  '克雷迅人力仲介': 'Kolecion Employment Agency', '返回首頁': 'Back to home', '使用 LINE 登入': 'Continue with LINE', '使用 Google 登入': 'Continue with Google',
  '或使用會員帳號': 'Or sign in with a member account', '密碼': 'Password', '登入中…': 'Signing in…', '登入人力管理系統': 'Sign in to HR management',
  '帳號或密碼錯誤，或此會員帳號尚未啟用。': 'Invalid credentials or this member account is inactive.', '請選擇': 'Select',
  '新增案件': 'Add case', '新增雇主': 'Add employer', '新增工作者': 'Add worker', '新增仲介': 'Add agency', '新增會員帳號': 'Add member account',
  '儲存': 'Save', '儲存中': 'Saving…', '取消': 'Cancel', '登出': 'Sign out', '關閉': 'Close', '預計日期': 'Expected date',
  '職類': 'Job type', '案件備註': 'Case notes', '案件詳情': 'Case details', '案件階段（依文件、體檢與訓練進度更新）': 'Case stage (updated from document, medical, and training progress)',
  '案件狀態': 'Case status', '承辦人': 'Staff member', '尚未指派': 'Unassigned', '儲存案件變更': 'Save case changes',
  '項未完成': ' incomplete', '案件活動': 'Case activity', '此案件尚無待辦事項。': 'No tasks for this case yet.', '新增': 'Add',
  '目前無法連接資料庫': 'Unable to connect to the database', '重新連線': 'Reconnect', '正在讀取管理資料…': 'Loading management data…',
  '克雷迅人力管理系統': 'Kolecion HR Management', '資料保存在本機 PostgreSQL': 'Data is stored in local PostgreSQL', '資料庫連線': 'Database connected',
  '等待連線': 'Waiting for connection', '重新整理資料': 'Refresh data', '開啟導覽': 'Open navigation', '關閉導覽': 'Close navigation',
  '更新案件': 'Update case', '搜尋案件編號、人員或職類': 'Search case number, people, or job type', '工作者與雇主資料只能各自指派給一個會員，同一間仲介可指派給多個會員。': 'Each worker and employer record can be assigned to one member; an agency can be assigned to multiple members.',
  '註冊克雷迅會員': 'Register for Kolecion HR', '使用 LINE 確認身分，登入後選擇工人、雇主或仲介類型送交審核。': 'Verify your identity with LINE, then choose worker, employer, or agency membership and submit it for review.',
  '使用 LINE 授權並繼續註冊': 'Authorize LINE and continue registration',
  '媒合需求單': 'Job Orders', '會員聊天室': 'Member Chat', '機構群組與案件群組': 'Agency and Case Chats', '需求 #': 'Order #', '人': 'workers', '· 轉交': '· Forwarded to',
  '工作需求單': 'Job Orders', '需求歸屬仲介機構；可選由該機構的業務負責，或不指定業務。': 'Each job order is assigned to an agency. You can select a representative at that agency or leave the assignment open.', '未填工作說明': 'No job details provided',
  '工作類型': 'Job type', '需求人數': 'Number of workers', '預計到職日期': 'Expected start date', '工作內容／條件': 'Job details and requirements',
  '選擇仲介機構（可複選）': 'Select agencies (you can choose more than one)', '指定業務（選填）': 'Assign a representative (optional)',
  '不指定業務': 'No representative assigned', '建立需求單並分派': 'Create and dispatch job order',
  '我的需求與推薦人選': 'My Job Orders and Candidates', '需求狀態：': 'Order status: ', '尚未轉交': 'Not yet forwarded',
  '待面試': 'Interview pending', '已安排面試': 'Interview scheduled', '錄用': 'Hired', '未錄用': 'Not selected',
  '安排面試': 'Schedule interview', '錄用並建案件': 'Hire and create case', '待轉交的雇主需求': 'Employer Orders to Forward',
  '負責業務：': 'Assigned representative: ', '未指定，由機構分派': 'Unassigned; the agency will assign a representative',
  '轉交菲律賓仲介': 'Forward to Philippines agencies', '轉交選取仲介': 'Forward to selected agencies',
  '收到的工作需求與推薦工人': 'Work Orders and Worker Nominations', '承接機構：': 'Receiving agency: ', '（Staff 作業）': '(Staff)',
  '台灣 Broker：': 'Taiwan representative (Broker): ', '推薦所屬工人': 'Select an agency worker', '選擇工人': 'Select a worker',
  '未填意向': 'No preference listed', '推薦說明': 'Recommendation notes', '推薦給雇主面試': 'Recommend for employer interview',
  '尚未指定': 'Not assigned', '已送出': 'Sent', '已額滿': 'Filled', '已取消': 'Cancelled', '仲介機構員工': 'Agency staff', '台灣仲介業務': 'Taiwan agency representative',
  '菲律賓仲介 Staff': 'Philippines agency staff', '所屬台灣仲介機構': 'Taiwan agency', '業務工作區': 'Agency Representative Workspace',
  'Staff工作區': 'Staff Workspace', '業務': 'Representative', 'Broker': 'Broker', 'Staff': 'Staff',
  '仲介類型會員是仲介機構員工：台灣機構員工稱為「業務」，菲律賓機構員工稱為「Staff」；工人會稱台灣業務為「Broker」。管理者將會員綁定所屬機構後，該機構可有多位員工帳號。': 'Agency members are employees of their assigned organization. Taiwan agency employees are called representatives; Philippines agency employees are called staff. Workers refer to a Taiwan representative as a broker. An agency can have multiple employee accounts.',
  '此會員是所屬仲介機構的員工，可有多個員工帳號；台灣員工稱「業務」、菲律賓員工稱「Staff」，工人會稱台灣業務為「Broker」。': 'This member is an employee of the assigned agency. An agency can have multiple employee accounts. Taiwan employees are representatives; Philippines employees are staff. Workers call a Taiwan representative a broker.',
  '機構群組供同機構員工聯繫；案件群組依案件關係開放給業務、工人與雇主。': 'Agency chats are for employees at the same agency. Case chats are available to the assigned Taiwan representative, worker, and employer.',
  '提醒': 'Reminders', '需要留意': 'Needs attention', '聊天室未讀': 'Unread chats', '近期案件日期': 'Upcoming case dates',
  '目前沒有未讀訊息或近期重要日期。': 'No unread messages or upcoming case dates.', '有新訊息': 'New messages', '今天': 'Today',
  '天後': 'days from now', '逾期': 'Overdue',
  '重新整理': 'Refresh', '正在載入聊天室…': 'Loading chats…', '目前沒有可參與的聊天室。案件建立後會自動建立案件群組，仲介機構可使用機構內部群組。': 'No chats are available yet. Case chats are created when a case is opened. Agency employees can use their agency chat.',
  '聊天室清單': 'Chat list', '機構群組': 'Agency chat', '案件群組': 'Case chat', '機構內部聊天室': 'Agency staff chat', '案件對話': 'Case conversation',
  '最近 200 則訊息': 'Latest 200 messages', '尚無訊息，送出第一則訊息開始討論。': 'No messages yet. Send the first message to start the conversation.',
  '輸入訊息…': 'Write a message…', '送出': 'Send', '送出中': 'Sending…', '訊息不可空白，且最多 3000 字。': 'Messages cannot be empty and must be 3,000 characters or fewer.',
  '無法讀取聊天室，請稍後再試。': 'Could not load chats. Please try again.', '訊息未能送出，請稍後再試。': 'Message could not be sent. Please try again.',
  '你沒有權限查看此聊天室。': 'You do not have permission to view this chat.', '你沒有權限在此聊天室發言。': 'You do not have permission to send messages in this chat.', '聊天室編號不正確。': 'Invalid chat ID.',
  '訊息格式不正確。': 'Invalid message format.', '請從本站提交資料。': 'Please submit this form from the website.',
};
const EN_EXTRA = {
  '姓名：': 'Name: ', '國籍：': 'Nationality: ', '電話：': 'Phone: ', '工作意向：': 'Job preference: ', '承接機構：': 'Receiving agency: ', '台灣 Broker：': 'Taiwan representative (Broker): ', '負責業務：': 'Assigned representative: ', '申請類型：': 'Requested type: ', '需求狀態：': 'Order status: ',
  '所屬資料': 'Assigned record', '文件收件與審核': 'Document receipt and review', '體檢與訓練進度': 'Medical and training progress', '所屬工作者': 'Assigned workers', '所屬雇主': 'Assigned employers',
  '登入 Email': 'Sign-in email', 'LINE User ID（選填）': 'LINE User ID (optional)', '會員登入並申請類型後會列於此，管理者可審核並指派所屬資料。': 'Members appear here after applying for a type. Administrators can review and assign their records.',
  '管理者核准並指派所屬資料後，你就能使用對應的會員工作區。': 'You can access your workspace after an administrator approves and assigns your record.', '送出後會由管理者確認身分並指派所屬資料。審核完成前不會開放案件或會員資料。': 'An administrator will verify your identity and assign a record. Case and member data stay unavailable until approval.',
  '無法載入會員資料': 'Unable to load member data', '正在確認此帳號可存取的案件資料。': 'Checking which case data this account can access.', '目前沒有可上傳的案件文件項目。': 'There are no case documents available to upload.',
  '無法讀取會員資料': 'Could not load member data', '申請送出失敗': 'Could not submit the request', '登入失敗': 'Sign-in failed', '更新案件狀態失敗': 'Could not update case status', '更新雇主狀態失敗': 'Could not update employer status', '更新文件適用狀態失敗': 'Could not update document applicability', '更新面試結果失敗': 'Could not update interview result', '更新工作者狀態失敗': 'Could not update worker status', '更新所屬仲介失敗': 'Could not update assigned agency', '儲存工作者資料失敗': 'Could not save worker details', '儲存雇主資料失敗': 'Could not save employer details', '儲存申請程序失敗': 'Could not save application step', '文件上傳失敗': 'Document upload failed', '文件審核失敗': 'Document review failed', '刪除工作者失敗': 'Could not delete worker', '刪除失敗，請確認網路連線後再試。': 'Delete failed. Check your connection and try again.',
  '建立雇主與工作者資料後，即可新增案件。': 'Create employer and worker records before adding a case.', '案件建立時會新增完整收件清單；其他文件可在這裡新增。': 'A complete document checklist is created with each case. Add other documents here.', '新增工作者後可建立案件並追蹤進度。': 'Add workers to create cases and track progress.', '建立仲介後可將工作者或雇主指派給所屬仲介。': 'Create an agency to assign workers or employers to it.',
  '尚無所屬工作者。': 'No workers are assigned to this agency.', '目前沒有所屬工作者。': 'No workers are assigned to this agency.', '尚無工作者資料': 'No worker records yet', '尚無案件資料': 'No case records yet', '尚無仲介機構': 'No agencies yet', '尚無一般會員帳號': 'No member accounts yet', '尚無操作紀錄': 'No activity yet', '尚無媒合需求單': 'No job orders yet', '尚無推薦': 'No candidates recommended yet', '尚無訊息，送出第一則訊息開始討論。': 'No messages yet. Send the first message to start the conversation.',
  '案件建立時會新增護照與 PSA 前置文件；其他文件可在這裡新增。': 'Passport and PSA requirements are added with each case. Add other documents here.', '文件上傳': 'Document upload', '文件到達日期': 'Document received on', '文件名稱': 'Document name', '文件版本': 'Document version', '文件預覽': 'Document preview', '文件要求': 'Document requirement', '文件處理': 'Document processing', '文件收件': 'Document receipt', '收件備註': 'Receipt notes',
  '個人文件確認日期': 'Personal documents verified on', '護照確認日期': 'Passport verified on', '入件日期': 'Filing date', '出件日期': 'Release date', '辦理日期': 'Processing date', '配工／面試日期': 'Placement / interview date', '體檢日期': 'Medical examination date', '訓練開始日': 'Training start date', '訓練完成日': 'Training completion date', '完成／出件日': 'Completion / release date', '預定入境日期': 'Expected arrival date', '實際入境日期': 'Actual arrival date',
  '申請已送出，等待管理者審核': 'Request submitted. Awaiting administrator review.', '審核／指派': 'Review / assign', '管理者可將會員變更為其他類型。': 'Administrators can change a member’s type.', '變更類型': 'Change type', '會員類型審核': 'Member type review', '選擇要申請的會員類型': 'Choose a member type', '送出審核申請': 'Submit for review', '送出中…': 'Submitting…',
  '尚無案件': 'No cases yet', '尚無案件資料': 'No case records yet', '找不到符合的案件': 'No matching cases', '找不到符合的待辦': 'No matching tasks', '目前沒有待處理提醒': 'No alerts right now', '待辦受阻或逾期時會列在這裡。': 'Blocked or overdue tasks will appear here.', '請調整搜尋條件。': 'Try adjusting your search.',
  '體檢 Medical': 'Medical examination', '曾在台灣工作者': 'Previously worked in Taiwan', '已婚者': 'If married', '有子女者': 'If the applicant has children', '未婚者': 'If single', '曾在海外工作者': 'Previously worked abroad', '出生登記逾10年補登者': 'Birth registration filed more than 10 years late',
  '確認錄用並建立正式申辦案件？': 'Confirm hiring and create an application case?', '確認未錄用此人選？': 'Confirm this candidate was not selected?', '安排此人選面試？': 'Schedule an interview for this candidate?', '請輸入補件原因，申請人會看到這段說明。': 'Enter a correction reason. The applicant will see this note.', '請輸入退回原因，工作者會看到這段說明。': 'Enter a return reason. The worker will see this note.',
  '系統管理者': 'Administrator', '工作區': 'Workspace', '所屬案件': 'Assigned cases', '所屬工作者與申辦進度': 'Assigned workers and application progress',
  '尚無媒合需求單': 'No job orders yet', '尚無推薦': 'No candidates recommended yet', '尚無訊息，送出第一則訊息開始討論。': 'No messages yet. Send the first message to start the conversation.',
  '建立雇主與工作者資料後，即可新增案件。': 'Create employer and worker records before adding a case.', '建立仲介後可將工作者或雇主指派給所屬仲介。': 'Create an agency to assign workers or employers to it.', '建立需求單並分派': 'Create and dispatch job order',
  '新增第一筆案件後，案件進度會顯示在這裡。': 'Case progress will appear here after you add the first case.', '新增工作者後可建立案件並追蹤進度。': 'Add workers to create cases and track progress.', '新增或更新案件資料後，操作歷程會顯示在這裡。': 'Activity appears here after case records are created or updated.',
  '尚未指派台灣仲介': 'No Taiwan agency assigned', '尚未指派菲律賓仲介': 'No Philippines agency assigned', '尚未轉交菲律賓仲介': 'Not forwarded to a Philippines agency', '未指定業務': 'No representative assigned', '雇主未指定': 'No employer assigned', '尚未媒合': 'Not matched yet', '待護照／PSA': 'Waiting for passport / PSA documents',
  '工作者姓名': 'Worker name', '工作者 Email': 'Worker email', '案件相關工作者': 'Case worker', '所屬台灣仲介業務': 'Taiwan agency representative', '台灣仲介業務': 'Taiwan agency representative',
  '個人文件確認日期': 'Personal documents verified on', '護照確認日期': 'Passport verified on', '文件到達日期': 'Document received on', '文件名稱': 'Document name', '文件收件': 'Document receipt', '入件日期': 'Filing date', '出件日期': 'Release date', '辦理日期': 'Processing date', '配工／面試日期': 'Placement / interview date', '體檢日期': 'Medical examination date', '收件備註': 'Receipt notes', '文件版本': 'Document version', '文件要求': 'Document requirement', '文件處理': 'Document processing', '文件預覽': 'Document preview',
  '文件上傳失敗': 'Document upload failed', '文件審核失敗': 'Document review failed', '上傳中…': 'Uploading…', '儲存工作者資料失敗': 'Could not save worker details', '儲存雇主資料失敗': 'Could not save employer details', '儲存申請程序失敗': 'Could not save application step', '儲存仲介': 'Save agency', '刪除工作者失敗': 'Could not delete worker', '刪除失敗，請確認網路連線後再試。': 'Delete failed. Check your connection and try again.', '更新工作者狀態失敗': 'Could not update worker status', '更新所屬仲介失敗': 'Could not update assigned agency', '更新文件適用狀態失敗': 'Could not update document applicability', '更新案件狀態失敗': 'Could not update case status', '更新雇主狀態失敗': 'Could not update employer status', '更新面試結果失敗': 'Could not update interview result', '提醒暫時無法載入': 'Reminders are temporarily unavailable',
  '管理者可將會員變更為其他類型。': 'Administrators can change a member’s type.', '會員登入並申請類型後會列於此，管理者可審核並指派所屬資料。': 'Members appear here after applying for a type. Administrators can review and assign their records.', '使用人力仲介管理系統專用帳號登入。': 'Sign in with an account created for the HR management system.',
  '請輸入補件原因，申請人會看到這段說明。': 'Enter a correction reason. The applicant will see this note.', '請輸入退回原因，工作者會看到這段說明。': 'Enter a return reason. The worker will see this note.', '補件說明（選填）': 'Correction notes (optional)',
  '安排此人選面試？': 'Schedule an interview for this candidate?', '確認未錄用此人選？': 'Confirm that this candidate was not selected?', '確認錄用並建立正式申辦案件？': 'Confirm hiring and create an application case?', '開啟群組可查看群組會員，點選會員即可開始單獨聊天。': 'Open a group to view its members, then select a member to start a private chat.',
  '所屬仲介': 'Assigned agency', '仲介機構': 'Agency', '仲介機構員工': 'Agency staff', '會員帳號': 'Member account', '會員資料': 'Member details', '會員名稱': 'Member name', '登入 Email': 'Sign-in email',
  '查看資料': 'View details', '查看進度': 'View progress', '關閉工作者表單': 'Close worker form', '關閉工作者資料': 'Close worker details', '關閉進度視窗': 'Close progress window', '關閉刪除確認': 'Close delete confirmation', '關閉訊息': 'Close message',
  '確認適用': 'Mark as applicable', '標示不適用': 'Mark as not applicable', '等待文件審核': 'Waiting for document review', '尚未收件': 'Not received yet', '待收件': 'Awaiting submission', '待審核': 'Awaiting review', '已合格': 'Approved', '退件待修正': 'Returned for correction',
  '已放行': 'Cleared', '尚未設定': 'Not set', '資料僅供授權帳號查閱。': 'Data is available to authorized accounts only.', '請確認 Docker PostgreSQL 與網站服務正在執行。': 'Make sure Docker PostgreSQL and the website service are running.',
  '預定入境': 'Expected arrival', '實際入境': 'Actual arrival', '訓練開始日': 'Training start date', '訓練完成日': 'Training completion date', '完成／出件日': 'Completion / release date', '家庭看護': 'Home caregiver', '家庭幫傭': 'Domestic helper', '工廠': 'Factory', '工廠技術工': 'Factory technician', '菲律賓': 'Philippines', '台灣': 'Taiwan',
  '台灣': 'Taiwan', '菲律賓': 'Philippines', '雇主類型': 'Employer type', '雇主／客戶名稱': 'Employer / client name', '新增雇主': 'Add employer', '新增會員帳號': 'Add member account', '新增仲介': 'Add agency',
  '新增': 'Add', '編輯雇主': 'Edit employer', '編輯工作者': 'Edit worker', '編輯資料': 'Edit details', '編輯': 'Edit', '儲存工作者': 'Save worker', '儲存雇主': 'Save employer', '取消': 'Cancel', '儲存': 'Save', '儲存中…': 'Saving…', '送出': 'Send', '送出中': 'Sending…', '關閉': 'Close', '登出': 'Sign out',
  '姓名': 'Name', '國籍': 'Nationality', '聯絡人': 'Contact person', '電話': 'Phone', '地址': 'Address', '備註': 'Notes', '工作意向': 'Job preference', '說明': 'Description', '期限': 'Due date', '分類': 'Category', '狀態／備註': 'Status / notes',
  '案件管理': 'Case management', '案件': 'Case', '案件備註': 'Case notes', '案件狀態': 'Case status', '案件對話': 'Case conversation', '案件群組': 'Case group', '案件文件進度': 'Case document progress', '案件待辦': 'Case tasks', '文件': 'Documents', '文件上傳': 'Document upload', '文件上傳失敗': 'Document upload failed', '新增文件要求': 'Add document requirement', '上傳文件': 'Upload document', '重新上傳': 'Upload again', '待審文件': 'Documents pending review',
  '確認錄用並建立正式申辦案件？': 'Confirm hiring and create an application case?', '安排此人選面試？': 'Schedule an interview for this candidate?', '確認未錄用此人選？': 'Confirm this candidate was not selected?', '媒合中': 'Matching', '待面試': 'Interview pending', '已安排面試': 'Interview scheduled', '錄用': 'Hired', '未錄用': 'Not selected', '已額滿': 'Filled', '已取消': 'Cancelled',
  '單獨聊天': 'Private chat', '私訊': 'Private message', '群組會員': 'Group members', '機構群組': 'Agency group', '案件群組': 'Case group', '機構內部聊天室': 'Agency chat', '會員聊天室': 'Member chat', '聊天室': 'Chat', '聊天室清單': 'Chat list', '無法載入聊天室': 'Could not load chats', '無法載入訊息': 'Could not load messages', '無法開啟私訊': 'Could not open private chat',
  '會員類型': 'Member type', '會員名稱': 'Member name', '所屬資料': 'Assigned record', '所屬工作者': 'Assigned workers', '所屬雇主': 'Assigned employers', '所屬仲介': 'Assigned agency', '所屬台灣仲介': 'Assigned Taiwan agency', '所屬菲律賓仲介': 'Assigned Philippines agency', '會員': 'Member', '仲介': 'Agency', '雇主': 'Employer', '工作者': 'Worker', '管理者': 'Administrator', '業務': 'Representative', '承辦人': 'Staff member', '仲介名稱': 'Agency name', '仲介類型': 'Agency type',
  '啟用': 'Active', '停用': 'Inactive', '啟用帳號': 'Activate account', '停用帳號': 'Deactivate account', '待管理者指派': 'Awaiting administrator assignment', '審核／指派': 'Review / assign', '審核已完成': 'Review complete', '更新失敗': 'Update failed', '資料已儲存': 'Changes saved', '變更已儲存': 'Changes saved',
  '尚無工作者資料': 'No worker records yet', '尚無雇主／客戶資料': 'No employer or client records yet', '尚無案件資料': 'No case records yet', '尚無案件': 'No cases yet', '尚無仲介機構': 'No agencies yet', '尚無工作待辦': 'No tasks yet', '尚無操作紀錄': 'No activity yet', '尚無承辦人資料': 'No staff records yet', '尚無一般會員帳號': 'No member accounts yet', '尚無所屬工作者。': 'No workers assigned to this agency.', '目前沒有所屬工作者。': 'No workers assigned to this agency.', '找不到符合的案件': 'No matching cases', '找不到符合的待辦': 'No matching tasks', '請調整搜尋條件。': 'Try adjusting your search.',
  '工作需求單': 'Job order', '需求 #': 'Order #', '需求人數': 'Number of workers', '工作類型': 'Job type', '工作內容／條件': 'Job details and requirements', '預計到職日期': 'Expected start date', '預計日期': 'Expected date', '建立需求單並分派': 'Create and dispatch job order', '我的需求與推薦人選': 'My job orders and candidates', '待轉交的雇主需求': 'Employer orders to forward', '收到的工作需求與推薦工人': 'Received job orders and worker nominations', '轉交選取仲介': 'Forward to selected agencies', '推薦給雇主面試': 'Recommend for employer interview', '選擇工人': 'Select a worker', '推薦說明': 'Recommendation notes',
  '登入人力管理系統': 'Sign in to HR management', '登入中…': 'Signing in…', '使用 LINE 登入': 'Sign in with LINE', '使用 Google 登入': 'Sign in with Google', '註冊克雷迅會員': 'Register for Kolecion HR', '返回首頁': 'Back to home', '重設密碼（選填，至少 10 字元）': 'Reset password (optional, at least 10 characters)', '初始密碼（至少 10 字元）': 'Initial password (at least 10 characters)',
  '提醒': 'Reminders', '近期案件日期': 'Upcoming case dates', '聊天室未讀': 'Unread chats', '目前沒有未讀訊息或近期重要日期。': 'No unread messages or upcoming case dates.', '今天': 'Today', '今天': 'Today', '已完成': 'Completed', '已安排': 'Scheduled', '未安排': 'Not scheduled', '進行中': 'In progress', '暫停': 'On hold', '結案': 'Closed', '未設定': 'Not set', '未指派': 'Unassigned', '未指定': 'Unassigned', '其他': 'Other', '家庭幫傭': 'Domestic helper', '家庭看護': 'Home caregiver', '工廠': 'Factory', '工廠技術工': 'Factory technician',
};
const EN_MORE = {
  '姓氏': 'Surname', '名字': 'Given name', '中間名': 'Middle name', '請填寫其他宗教': 'Enter other religion', '天主教': 'Catholic', '基督教': 'Christian', '其他：': 'Other: ',
  '仲介／雇主資料': 'Agency / employer records', '來台程序': 'Taiwan application process', '目前沒有必要文件項目。': 'There are no required documents yet.', '目前沒有來台申請程序。': 'There is no Taiwan application process yet.', '所屬仲介業務': 'Taiwan agency representative', '菲律賓仲介 Staff': 'Philippines agency staff',
  '下載履歷 PDF': 'Download resume PDF', '下載 PDF': 'Download PDF', '編輯履歷': 'Edit resume', '履歷照片': 'Resume photo', '履歷編號': 'Resume reference number', '家庭資料': 'Family information', '個人資料問答': 'Personal questionnaire', '膚色': 'Complexion', '家庭狀況': 'Family status', '配偶姓名': 'Spouse name', '配偶職業': 'Spouse occupation', '配偶年齡': 'Spouse age', '子女人數': 'Number of children', '子女年齡': 'Children’s ages', '父親姓名': 'Father’s name', '父親職業': 'Father’s occupation', '父親出生日期': 'Father’s date of birth', '母親姓名': 'Mother’s name', '母親職業': 'Mother’s occupation', '母親出生日期': 'Mother’s date of birth', '兄弟人數': 'Number of brothers', '兄弟年齡': 'Brothers’ ages', '姊妹人數': 'Number of sisters', '姊妹年齡': 'Sisters’ ages', '家中排行': 'Birth order in family', '出國工作期間子女照顧者': 'Who will care for children while abroad', '完成課程': 'Courses completed', '是否有刺青': 'Do you have a tattoo?', '是否吸菸': 'Do you smoke?', '是否飲酒': 'Do you drink alcohol?', '寵物照護經驗與種類': 'Pet care experience and types of pets', '是否願意在有寵物的家庭工作': 'Willing to work in a home with pets?', '是否曾有重大疾病': 'History of serious illness?', '過去 12 個月是否接受手術': 'Surgery in the past 12 months?', '是否有過敏': 'Do you have allergies?', '休假日是否願意完成家務': 'Willing to complete household chores on a day off?', '外出前是否完成家務': 'Will you finish household chores before going out?', '休假日是否可於晚上 8 點前返家': 'Can you return home by 8 PM on a day off?', '工作時是否化妝': 'Do you wear makeup at work?', '是否願意於休假日加班': 'Willing to work overtime on a day off?', '是否曾在海外工作': 'Have you worked abroad before?', '海外工作地點與期間': 'Overseas work location and dates', '雇主、職務、期間、離職原因與工作內容': 'Employer, position, dates, reason for leaving, and duties', '備註': 'Notes', '產生中…': 'Generating…', '履歷照片請使用 JPG 或 PNG，檔案需小於 1.5 MB。': 'Resume photo must be a JPG or PNG under 1.5 MB.', '讀取履歷照片失敗。': 'Could not read resume photo.',
  '編輯履歷': 'Edit resume', '完善履歷資料，讓合作仲介與雇主了解你的技能和工作經驗。': 'Complete your resume so partner agencies and employers can learn about your skills and work experience.', '基本聯絡資料': 'Contact details', '基本資料': 'Personal details', '教育與語言': 'Education and languages', '技能與照護經驗': 'Skills and care experience', '工作經歷': 'Work experience', '尚未填寫履歷資料。': 'No resume details added yet.',
  '出生日期': 'Date of birth', '性別': 'Gender', '出生地': 'Place of birth', '身高': 'Height', '體重': 'Weight', '膚色': 'Complexion', '白': 'White', '黃': 'Yellow', '黑': 'Black', '宗教': 'Religion', '興趣': 'Hobbies', '子女人數': 'Number of children', '教育背景': 'Education', '教育程度': 'Education level', '身高（cm）': 'Height (cm)', '體重（kg）': 'Weight (kg)', '國中': 'Junior high school', '專科': 'Associate degree', '研究所': 'Graduate school', '單身': 'Single', '有伴侶': 'In a relationship', '已結婚': 'Married', '145以下': 'Below 145 cm', '181以上': 'Above 180 cm', '39以下': 'Below 40 kg', '71以上': 'Above 70 kg', '小學': 'Elementary', '高中': 'High school', '大學': 'College', '職業培訓': 'Vocational training', '農工': 'Farm worker', '機構看護工': 'Institutional caregiver', 'Male': 'Male', 'Female': 'Female', '語言能力': 'Languages', 'English': 'English', 'Tagalog': 'Tagalog', 'Cantonese': 'Cantonese', 'Mandarin': 'Mandarin', 'Others': 'Others', '基礎': 'Basic', '中等': 'Medium', '本地': 'Native', '台灣': 'Taiwanese', '廣東': 'Cantonese', '中國': 'Chinese', '日本': 'Japanese', '泰國': 'Thai', '印度': 'Indian', '韓國': 'Korean', '菲律賓': 'Filipino', 'Washing Machine': 'Washing machine', 'Oven': 'Oven', 'Vacuum Cleaner': 'Vacuum cleaner', 'Microwave Oven': 'Microwave oven', 'Dish Washer': 'Dishwasher', 'Bathing': 'Bathing', 'Changing diapers': 'Changing diapers', 'Sterilizing utensils': 'Sterilizing utensils', 'Feeding': 'Feeding', 'Taking temperature': 'Taking temperature', '烹飪技能': 'Cooking skills', '家電操作': 'Home appliance skills', '嬰幼兒照護技能': 'Baby and childcare skills', '新生兒照護經驗': 'Newborn care experience', '兒童照護經驗': 'Childcare experience', '長者照護經驗': 'Elder care experience', '身心障礙者照護經驗': 'Care experience for people with disabilities', '聯絡電話': 'Phone number', '儲存工作者': 'Save worker', '編輯工作者': 'Edit worker', '新增工作者': 'Add worker',
  '配工／雇主面試日期': 'Placement / employer interview date', '護照確認': 'Passport verification', '文件到達 D/C': 'Document arrival (D/C)', '個人文件和證件 P/D': 'Personal documents and IDs (P/D)', 'ACCR 引進權入件': 'ACCR work permit filing', 'ACCR 引進權出件': 'ACCR work permit release', 'PDOS 日期': 'PDOS date', '辦件／開始日': 'Processing / start date', '核准文件': 'Approve document', '退回補件': 'Return for correction', '合格': 'Passed', '審核中': 'Under review',
  'EMPLOYER PORTAL': 'EMPLOYER PORTAL', '張需求單': 'orders', '需求單 #': 'Order #', '預計到職': 'Expected start', '合作仲介': 'Partner agencies', '台灣仲介機構': 'Taiwan agency', '台灣仲介機構': 'Taiwan agency', '菲律賓媒合：': 'Philippines matching: ', '等待仲介轉交': 'Waiting for agency referral', '等待仲介機構接單': 'Waiting for an agency to accept', '需求已建立，仲介受理後會顯示在這裡。': 'Once an agency accepts this order, it will appear here.', '目前還沒有需求單': 'You do not have any job orders yet.', '填寫上方需求並選擇仲介，送出後即可在這裡追蹤進度。': 'Complete the form above and select an agency to submit and track your order here.', '建立工作需求，選擇合作的台灣仲介，並追蹤推薦與面試進度。': 'Create a job request, choose Taiwan agencies, and track worker recommendations and interviews.', '工作需求單': 'Job order', '我的需求與推薦人選': 'My orders and recommended candidates', '推薦人選與面試': 'Candidates and interviews', '業務：': 'Representative: ', '尚未指定業務': 'No representative assigned', '轉交': 'Forward', '等待仲介轉交': 'Waiting for agency referral',
  '上傳 PDF 履歷更新資料': 'Upload PDF resume to update your profile', '讀取到的欄位會先填入表單；確認內容後按「儲存工作者」才會更新。支援可選取文字的 PDF，檔案上限 15 MB。': 'Extracted fields will be filled into the form first. Review them and select Save Worker to update your profile. Text-based PDFs up to 15 MB are supported.', '上傳履歷原文': 'Imported resume text', '教育程度': 'Education level', '語言選擇': 'Languages to include', '家電選擇': 'Appliances operated', '小學': 'Elementary', '高中': 'High school', '大學': 'College', '職業培訓': 'Vocational training', '其他': 'Other', '已讀取履歷文字並自動擷取照片；請檢查資料與照片後再儲存。': 'Resume text and photo were imported. Review the details and photo before saving.', '已讀取履歷文字並填入可辨識欄位；未找到可用照片，請確認並手動上傳。': 'Resume text was imported, but no usable photo was found. Review the details and upload a photo manually if needed.', '已讀取履歷文字並填入可辨識欄位；請檢查、補齊後再儲存。': 'Resume text was imported and recognized fields were filled in. Review and complete them before saving.', '正在讀取履歷 PDF…': 'Reading resume PDF…', '請選擇 PDF 履歷檔。': 'Please select a PDF resume.', 'PDF 檔案需小於 15 MB。': 'PDF files must be under 15 MB.', '履歷 PDF 最多可有 20 頁。': 'Resume PDFs can have up to 20 pages.', '這份 PDF 沒有可讀取的文字，可能是掃描影像；請改用可選取文字的 PDF，或直接填寫欄位。': 'This PDF has no extractable text. It may be a scan; use a text-based PDF or fill in the fields manually.', '無法讀取此 PDF，請確認檔案未加密且格式正確。': 'Could not read this PDF. Make sure it is not encrypted and is a valid PDF.', 'Name': 'Name', 'Full Name': 'Full Name', 'Applicant Name': 'Applicant Name', 'Other notes': 'Other notes',
  '· 第': '· Version ', '件': 'items', '件案件': 'cases', '儲存指派': 'Save assignment', '克雷迅': 'Kolecion', '共': 'Total: ', '刪除': 'Delete', '刪除工作者': 'Delete worker', '台灣仲介 Broker': 'Taiwan agency representative (Broker)', '台灣仲介：': 'Taiwan agency: ', '名稱': 'Name', '啟動體檢／訓練前必須核准': 'Must be approved before medical checks / training', '天': 'days', '尚無': 'None yet', '工作者資料': 'Worker details', '工作者／雇主': 'Worker / employer', '張需求單': 'orders', '待辦': 'Tasks', '必要文件': 'Required documents', '所屬仲介：': 'Assigned agency: ', '所屬單位': 'Assigned organization', '最近': 'Recent', '查看工作者進度': 'View worker progress', '案件進度': 'Case progress', '案件／工作者': 'Case / worker', '案件：': 'Case: ', '業務：': 'Representative: ', '版': 'version', '版 ·': 'version · ', '確定刪除「': 'Confirm delete “', '確認刪除': 'Confirm deletion', '第': 'No. ', '筆待審 ·': ' pending ·', '筆待審 · ': ' pending · ', '筆案件': ' cases', '筆資料': ' records', '管理': 'Manage', '至菲律賓仲介': 'to Philippines agency', '請只填寫辦件必要資料，不要在備註放入護照號碼、銀行或醫療等敏感資訊。': 'Enter only information needed for processing. Do not include passport numbers, bank details, or medical information in notes.', '負責業務': 'Assigned representative', '資料': 'Details', '轉交': 'Forward', '退件：': 'Returned: ', '進度': 'Progress', '開始日': 'Start date', '間仲介': 'agencies', '需求單': 'Job order', '需求單 #': 'Order #', '預覽 (': 'Preview (', '預計開始': 'Expected start',
  'Email 或 LINE User ID 至少要保留一項；密碼留空時會維持原設定。': 'Keep at least one of email or LINE User ID. Leave the password blank to keep the current password.',
  '· 尚未指派會員類型': '· No member type assigned', '· 操作者': '· Operator', '· 期限': '· Due date', '· 案件 #': '· Case #', '· 業務：': '· Representative: ', '· 轉交': '· Forwarded to ',
  '← 返回首頁': '← Back to home', '。請核對資料並指派所屬對象。': '. Check the details and assign a related record.', '下載': 'Download', '下載文件': 'Download document', '人數': 'Headcount', '人力仲介資料': 'Employment agency records', '人力管理': 'HR management', '仲介會員只能查看所屬工作者與相關雇主。': 'Agency members can only view assigned workers and related employers.', '位工作者': 'workers', '依最後更新時間排序': 'Sorted by most recently updated', '個會員帳號': 'member accounts', '個版本': 'versions', '全部狀態': 'All statuses', '前置文件': 'Prerequisite documents',
  '只接受 PDF、JPG、PNG，單檔上限 10 MB。審核與下載均會留下案件活動紀錄。': 'PDF, JPG, and PNG only; 10 MB max per file. Reviews and downloads are recorded in case activity.', '台灣仲介機構／業務': 'Taiwan agency / representative', '台灣仲介機構：': 'Taiwan agency: ', '國家／地區': 'Country / region', '國籍：': 'Nationality: ', '媒合管理': 'Matching management', '完成日': 'Completion date',
  '已有案件或會員帳號的工作者無法刪除': 'Workers with cases or member accounts cannot be deleted', '帳號密碼會以加鹽雜湊儲存。管理者帳號只能由伺服器 ADMIN_EMAILS 設定。': 'Passwords are stored using salted hashes. Administrator accounts are configured with server-side ADMIN_EMAILS.', '建立新的工作者資料並直接綁定此會員': 'Create a worker record and link it directly to this member', '建立時間': 'Created', '我的工作者與未媒合人選': 'My workers and unmatched candidates', '我的資料': 'My profile', '我的雇主': 'My employers',
  '指派台灣仲介／業務': 'Assign Taiwan agency / representative', '推薦人選與面試': 'Candidates and interviews', '整體階段': 'Overall stage', '文件審核、進度變更與文件存取都會記錄在這裡。': 'Document reviews, progress changes, and access are recorded here.', '文件項目': 'Document item', '文件項目：': 'Document item: ', '最近收件': 'Latest submission', '會員申請類型：': 'Requested member type: ',
  '核准後會員才會取得所選類型的資料權限；工人與雇主資料各自綁定一個會員，同一間仲介可指派給多個會員。': 'Members receive access after approval. Worker and employer records can each be linked to one member; an agency can be assigned to multiple members.', '業務由雇主所屬台灣仲介會員擔任；未指定時案件仍歸屬仲介機構。': 'The representative belongs to the employer’s Taiwan agency. Without one, the case stays assigned to the agency.',
  '此工作者目前沒有申辦案件。': 'This worker has no application cases yet.', '此案件尚無待辦事項。': 'There are no tasks for this case yet.', '此案件尚無必要文件資料。': 'There are no required documents for this case yet.', '此檔案格式無法直接預覽。': 'This file format cannot be previewed.', '狀態／審核原因': 'Status / review reason', '狀態：': 'Status: ', '申請案件': 'Application cases', '申請類型：': 'Requested type: ',
  '目前尚無所屬雇主。': 'No employers are assigned to this account yet.', '目前沒有尚未建立案件的可用工人。': 'There are no available workers without an existing case.', '目前沒有尚未指派的啟用資料。可先建立工作者資料，或勾選上方選項直接新增並綁定新工人。': 'There are no active unassigned records. Create a worker record, or select the option above to create and link one directly.', '目前沒有尚未指派的資料；工人帳號請由會員申請後，使用「審核／指派」建立並綁定工作者資料。': 'There are no unassigned records. Worker accounts must apply first; use “Review / assign” to create and link a worker record.', '目前沒有相關工作者。': 'There are no related workers.', '尚無活動紀錄。': 'No activity yet.',
  '管理者可設定台灣仲介、業務與轉交的菲律賓仲介': 'Administrators can assign Taiwan agencies, representatives, and Philippines agencies to forward orders to', '菲律賓仲介機構：': 'Philippines agency: ', '菲律賓仲介：': 'Philippines agency: ', '菲律賓轉介': 'Philippines referrals', '所屬仲介案件與配工工作者': 'Agency cases and placed workers', '資料僅供授權帳號查閱。': 'Data is available to authorized accounts only.',
  '護照資料頁與 PSA 出生證明是預設前置文件。這裡新增的文件可與體檢、訓練同步辦理。': 'Passport bio page and PSA birth certificate are prerequisite documents. Other documents added here can be processed alongside medical checks and training.', '護照資料頁與 PSA 出生證明核准後，才能安排體檢與訓練。': 'Medical checks and training can be scheduled after the passport bio page and PSA birth certificate are approved.',
  '選擇仲介': 'Select an agency', '選擇台灣仲介': 'Select a Taiwan agency', '選擇轉交機構': 'Select agencies to forward to', '雇主案件與工作者進度': 'Employer cases and worker progress', '雇主／工作類型': 'Employer / job type', '項已更新': 'items updated', '項文件要求': 'document requirements', '預覽': 'Preview', '類型': 'Type', '階段': 'Stage', '（Staff 作業） · 台灣 Broker：': '(Staff) · Taiwan representative (Broker): ', '｜合作台灣仲介：': ' · Partner Taiwan agencies: ',
};
const HR_TEXT_ORIGINALS = new WeakMap();

export function translateHrText(value, lang = 'zh') {
  if (lang !== 'en' || typeof value !== 'string') return value;
  const trimmed = value.trim();
  let translated = EN[trimmed] || EN_EXTRA[trimmed] || EN_MORE[trimmed];
  if (!translated) {
    const orderMatch=trimmed.match(/^需求 #(\d+) · (.+) · (\d+) 人$/);
    const agencyMatch=trimmed.match(/^(.+) · 機構群組$/);
    const candidateMatch=trimmed.match(/^(.+?)（(.+?)）· (待面試|已安排面試|錄用|未錄用)$/);
    const agencyRole=trimmed.match(/^(.+?)(業務)$/);
    const orderStatus=trimmed.match(/^需求狀態：(.*?) · 轉交 (.*)$/);
    const representative=trimmed.match(/^· 業務：(.*)$/);
    const reminderDate=trimmed.match(/^(今天|\d+ 天後|逾期 \d+ 天) · (.+)$/);
    if(orderMatch)translated=`Order #${orderMatch[1]} · ${translateHrText(orderMatch[2],'en')} · ${orderMatch[3]} position${orderMatch[3]==='1'?'':'s'}`;
    else if(agencyMatch)translated=`${agencyMatch[1]} · Agency chat`;
    else if(candidateMatch)translated=`${candidateMatch[1]} (${candidateMatch[2]}) · ${translateHrText(candidateMatch[3],'en')}`;
    else if(agencyRole)translated=`${translateHrText(agencyRole[1],'en')} representative`;
    else if(orderStatus)translated=`Order status: ${translateHrText(orderStatus[1],'en')} · Forwarded to ${orderStatus[2]}`;
    else if(representative)translated=`· Representative: ${representative[1]||'Unassigned'}`;
    else if(reminderDate)translated=`${reminderDate[1]==='今天'?'Today':reminderDate[1].startsWith('逾期')?`Overdue ${reminderDate[1].match(/\d+/)?.[0]} days`:`${reminderDate[1].match(/\d+/)?.[0]} days from now`} · ${reminderDate[2]}`;
  }
  if (!translated && trimmed.startsWith('管理') && trimmed.endsWith('，資料會儲存在 PostgreSQL。')) {
    translated = `Manage ${translateHrText(trimmed.slice(2, -'，資料會儲存在 PostgreSQL。'.length), 'en')}; data is stored in PostgreSQL.`;
  }
  if (!translated && trimmed.startsWith('尚無') && trimmed.endsWith('資料')) {
    const kind = trimmed.slice(2, -2);
    translated = `No ${translateHrText(kind, 'en').toLowerCase()} records yet`;
  }
  if (!translated && trimmed.startsWith('新增')) translated = `Add ${translateHrText(trimmed.slice(2), 'en').toLowerCase()}`;
  if (!translated && trimmed.startsWith('前往') && trimmed.includes('清單，共')) {
    const [section, count] = trimmed.slice(2).split('清單，共');
    translated = `Go to ${translateHrText(section, 'en')} list · ${count.replace('筆', ' records')}`;
  }
  if (!translated && trimmed.includes('筆待審 · ')) translated = trimmed.replace('筆待審 · ', ' pending · ').replace(' 個會員帳號', ' member accounts');
  if (!translated && trimmed.endsWith(' 間仲介')) translated = trimmed.replace(' 間仲介', ' agencies');
  if (!translated && trimmed.endsWith(' 位工作者')) translated = trimmed.replace(' 位工作者', ' workers');
  if (!translated && trimmed.endsWith(' 筆資料')) translated = trimmed.replace(' 筆資料', ' records');
  if (!translated && trimmed.endsWith(' 筆案件')) translated = trimmed.replace(' 筆案件', ' cases');
  if (!translated && trimmed.includes('項未完成')) translated = trimmed.replace('項未完成', ' incomplete');
  if (!translated && trimmed.includes('待辦受阻或逾期')) translated = 'Blocked or overdue tasks will appear here.';
  if (!translated && trimmed.includes('家庭看護') && trimmed.includes('測試')) translated = 'Home care test employer';
  if (!translated) return value;
  const leading = value.match(/^\s*/)?.[0] || '';
  const trailing = value.match(/\s*$/)?.[0] || '';
  return `${leading}${translated}${trailing}`;
}

function transform(node, lang) {
  if (typeof node === 'string') return translateHrText(node, lang);
  if (Array.isArray(node)) return node.map(child => transform(child, lang));
  if (!React.isValidElement(node)) return node;
  const props = {};
  for (const key of ['aria-label','aria-description','placeholder','title']) {
    if (typeof node.props[key] === 'string') props[key] = translateHrText(node.props[key], lang);
  }
  if (node.props.children !== undefined) props.children = transform(node.props.children, lang);
  return cloneElement(node, props);
}

export function HrLocalizedContent({ children }) {
  const { lang } = useLanguage();
  return <>{lang === 'en' ? transform(children, lang) : children}</>;
}

export function HrLanguageToggle({ style = {} }) {
  const { lang, setLang } = useLanguage();
  const toggleLanguage = () => {
    const nextLang = lang === 'en' ? 'zh' : 'en';
    setLang(nextLang);
    if (document.querySelector('[data-hr-language-profile="philippines-agency"]')) {
      localStorage.setItem('hr-language:philippines-agency', nextLang);
    }
  };
  return <button type="button" onClick={toggleLanguage} aria-label={lang === 'en' ? 'Switch to Chinese' : '切換為英文'} style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '7px 10px', background: '#fff', color: '#334155', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', ...style }}>{lang === 'en' ? '中文' : 'EN'}</button>;
}

export function HrLanguageTools() {
  const { lang, setLang } = useLanguage();
  const toggleLanguage = () => {
    const nextLang = lang === 'en' ? 'zh' : 'en';
    setLang(nextLang);
    if (document.querySelector('[data-hr-language-profile="philippines-agency"]')) {
      localStorage.setItem('hr-language:philippines-agency', nextLang);
    }
  };
  useEffect(() => {
    const root = document.querySelector('[data-hr-translatable-root]') || document.body;
    const translateNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const saved = HR_TEXT_ORIGINALS.get(node);
        if (lang === 'en') {
          const original = saved && node.nodeValue === saved.translated ? saved.original : node.nodeValue;
          const translated = translateHrText(original, 'en');
          if (translated !== node.nodeValue) {
            HR_TEXT_ORIGINALS.set(node, { original, translated });
            node.nodeValue = translated;
          } else if (saved && node.nodeValue !== saved.translated) {
            HR_TEXT_ORIGINALS.delete(node);
          }
        } else if (saved) {
          if (node.nodeValue === saved.translated) node.nodeValue = saved.original;
          HR_TEXT_ORIGINALS.delete(node);
        }
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      for (const key of ['placeholder', 'title', 'aria-label']) {
        const dataKey = `hrOriginal${key.replace(/(^|-)(\w)/g, (_, _dash, c) => c.toUpperCase())}`;
        const original = node.dataset[dataKey] || node.getAttribute(key);
        if (!original) continue;
        const translated = lang === 'en' ? translateHrText(original, lang) : original;
        if (translated !== original && !node.dataset[dataKey]) node.dataset[dataKey] = original;
        if (node.getAttribute(key) !== translated) node.setAttribute(key, translated);
      }
      node.childNodes.forEach(translateNode);
    };
    translateNode(root);
    if (lang !== 'en') return;
    const pending = new Set();
    const queue = [];
    let frame = 0;
    const translateAddedNodes = () => {
      frame = 0;
      if (pending.size) {
        queue.push(...pending);
        pending.clear();
      }
      // Walk newly mounted workspace content in small batches so a large table
      // cannot monopolize the main thread when navigating in English.
      const deadline = performance.now() + 5;
      let visited = 0;
      while (queue.length && visited < 300 && performance.now() < deadline) {
        const node = queue.pop();
        if (!root.contains(node)) continue;
        visited += 1;
        if (node.nodeType === Node.TEXT_NODE) {
          const saved = HR_TEXT_ORIGINALS.get(node);
          const original = saved && node.nodeValue === saved.translated ? saved.original : node.nodeValue;
          const translated = translateHrText(original, 'en');
          if (translated !== node.nodeValue) {
            HR_TEXT_ORIGINALS.set(node, { original, translated });
            node.nodeValue = translated;
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          for (const key of ['placeholder', 'title', 'aria-label']) {
            const dataKey = `hrOriginal${key.replace(/(^|-)(\w)/g, (_, _dash, c) => c.toUpperCase())}`;
            const original = node.dataset[dataKey] || node.getAttribute(key);
            if (!original) continue;
            const translated = translateHrText(original, 'en');
            if (translated !== original && !node.dataset[dataKey]) node.dataset[dataKey] = original;
            if (node.getAttribute(key) !== translated) node.setAttribute(key, translated);
          }
          queue.push(...node.childNodes);
        }
      }
      if (queue.length || pending.size) frame = requestAnimationFrame(translateAddedNodes);
    };
    let observer;
    observer = new MutationObserver(records => {
      for (const record of records) {
        record.addedNodes.forEach(node => pending.add(node));
      }
      if (!frame && pending.size) frame = requestAnimationFrame(translateAddedNodes);
    });
    observer.observe(root, { subtree: true, childList: true });
    return () => { observer.disconnect(); if (frame) cancelAnimationFrame(frame); };
  }, [lang]);

  return <button type="button" onClick={toggleLanguage} aria-label={lang === 'en' ? 'Switch to Chinese' : '切換為英文'} style={{ position: 'fixed', zIndex: 10000, right: 18, top: 16, border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 12px', background: '#fff', color: '#334155', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px #0002' }}>{lang === 'en' ? '中文' : 'EN'}</button>;
}
