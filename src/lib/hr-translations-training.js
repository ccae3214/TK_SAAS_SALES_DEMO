// 訓練中心工作區（開班管理、工人訓練安排）的英文翻譯。
// 與 hr-translations.jsx 的 translateHrText 搭配使用：完整比對的字典 + 含變數的句型。
// 這裡的詞彙：證照 = certification、班別 = class、批次 = batch、取證 = certificate issue、考證 = certification exam。

export const TRAINING_CENTER_EN = {
  // 工作區標題與說明
  '管理訓練中心老師持有的證照、證照課程、依證照開班的訓練／考證／取證日期，以及班別的證照批次。': 'Manage the certifications held by training center teachers, certification courses, the training / exam / certificate issue dates of classes by certification, and each class\'s certification batches.',
  '正在載入訓練中心資料。': 'Loading training center data.',
  '讀取中': 'Loading',
  '讀取訓練中心資料失敗。': 'Failed to load training center data.',
  '操作失敗': 'Operation failed',
  '尚無訓練中心': 'No training centers yet',
  '請先到「會員帳號」把會員類型設為訓練中心，再回來管理老師、課程與班別。': 'First set the member type to Training Center under "Member accounts", then come back to manage teachers, courses and classes.',

  // 總覽
  '近 60 天日程': 'Schedule for the next 60 days',
  '近 60 天沒有日程': 'Nothing scheduled in the next 60 days',
  '即將開訓、考證與取證的班別。': 'Classes about to start training, take the exam or receive certificates.',
  '到「開班與日期」排定班別的訓練、考證與取證日期後，會顯示在這裡。': 'Once you schedule training, exam and certificate issue dates for a class under "Classes & Dates", they will appear here.',
  '倒數': 'Countdown',
  '事項': 'Event',
  '開訓': 'Training start',
  '考證': 'Certification exam',
  '取證': 'Certificate issue',
  '項': 'items',
  '訓練中班別': 'Classes in training',
  '待考證': 'Awaiting exam',
  '待取證': 'Awaiting certificate',
  '已取證': 'Certified',
  '未開班': 'Not started',
  '訓練結束、尚未到考證日': 'Training finished, exam date not reached',
  '老師證照到期提醒': 'Teacher certification expiry reminders',
  '已到期或 60 天內到期的老師證照，請提早換證。': 'Teacher certifications that have expired or expire within 60 days. Please renew early.',
  '老師證照有效期限在 60 天內時會提醒你。': 'You will be reminded when a teacher\'s certification expires within 60 days.',
  '沒有即將到期的證照': 'No certifications expiring soon',
  '啟用中的證照與課程': 'Active certifications and courses',

  // 老師與證照
  '老師與證照': 'Teachers & Certifications',
  '老師': 'Teacher',
  '老師姓名': 'Teacher name',
  '尚無老師': 'No teachers yet',
  '聯絡方式': 'Contact',
  '持有證照': 'Certifications held',
  '老師持有的證照': 'Certifications held by teacher',
  '登記證照': 'Register certification',
  '已登記老師證照': 'Teacher certification registered',
  '已登記過的證照再次送出會更新證號與日期。': 'Submitting an already registered certification again updates its certificate number and dates.',
  '登記每位老師持有哪些證照，開班時只能指定持有該證照的老師。': 'Register which certifications each teacher holds. Only teachers holding the certification can be assigned when creating a class.',
  '尚未登記': 'Not registered',
  '證照': 'Certification',
  '證照名稱': 'Certification name',
  '證照課程': 'Certification courses',
  '證號': 'Certificate no.',
  '發證日期': 'Issue date',
  '有效期限': 'Valid until',
  '尚無證照': 'No certifications yet',
  '可開課的證照種類。': 'Types of certifications that can be offered.',
  '先新增這個訓練中心可開課的證照。': 'First add the certifications this training center can offer.',
  '請先到「老師與證照」新增證照。': 'First add certifications under "Teachers & Certifications".',
  '（停用）': '(inactive)',
  '移除': 'Remove',

  // 課程
  '課程': 'Course',
  '課程名稱': 'Course name',
  '課程時數': 'Course hours',
  '時數': 'Hours',
  '尚無課程': 'No courses yet',
  '對應證照': 'Linked certification',
  '課程（依證照）': 'Courses (by certification)',
  '證照／課程': 'Certification / Course',
  '每門課程對應一張證照，開班時依課程帶入證照。': 'Each course maps to one certification, which is filled in automatically when a class is created.',
  '課程隸屬於一張證照，開班時會依課程帶入證照。': 'A course belongs to one certification, which is filled in automatically when a class is created.',
  '請先新增課程，才能開班。': 'Add a course first before creating a class.',

  // 開班與日期
  '開班與日期': 'Classes & Dates',
  '班別': 'Class',
  '班別名稱': 'Class name',
  '尚無班別': 'No classes yet',
  '授課老師': 'Instructor',
  '授課老師必須持有該課程對應的證照。': 'The instructor must hold the certification linked to the course.',
  '訓練日期': 'Training dates',
  '訓練開始日期': 'Training start date',
  '訓練結束日期': 'Training end date',
  '考證日期': 'Exam date',
  '考證地點': 'Exam location',
  '取證日期': 'Certificate issue date',
  '日期': 'Date',
  '招生': 'Enrollment',
  '招生人數': 'Enrollment capacity',
  '依證照排定班別的訓練日期、考證日期與取證日期；進度依日期自動判斷。': 'Schedule each class\'s training, exam and certificate issue dates by certification. Progress is determined automatically from the dates.',
  '請先到「開班與日期」建立班別。': 'First create a class under "Classes & Dates".',

  // 證照批次
  '證照批次': 'Certification batches',
  '批次': 'Batch',
  '批次編號或名稱': 'Batch number or name',
  '辦理人數': 'Number processed',
  '辦理狀態': 'Processing status',
  '尚無證照批次': 'No certification batches yet',
  '準備中': 'Preparing',
  '已送件': 'Submitted',
  '已發證': 'Issued',
  '一個班別可以分多個批次辦理證照。': 'One class can be processed in multiple certification batches.',
  '為班別新增辦理證照的批次。': 'Add a certification batch for the class.',
  '班別辦理證照的批次與辦理狀態；刪除班別時，該班別的批次會一併刪除。': 'Certification batches and their status for each class. Deleting a class also deletes its batches.',

  // 編輯視窗與操作結果
  '編輯班別': 'Edit class',
  '編輯老師': 'Edit teacher',
  '編輯課程': 'Edit course',
  '編輯證照': 'Edit certification',
  '編輯證照批次': 'Edit certification batch',
  '已新增班別': 'Class added',
  '已新增老師': 'Teacher added',
  '已新增課程': 'Course added',
  '已新增證照': 'Certification added',
  '已新增證照批次': 'Certification batch added',
  '已更新班別': 'Class updated',
  '已更新老師': 'Teacher updated',
  '已更新課程': 'Course updated',
  '已更新證照': 'Certification updated',
  '已更新證照批次': 'Certification batch updated',

  // 伺服器回傳的錯誤訊息（/api/hr/training-center）
  '不支援的項目。': 'Unsupported item.',
  '人數必須是 0 以上的整數。': 'The count must be an integer of 0 or more.',
  '招生人數必須是 0 以上的整數。': 'Enrollment capacity must be an integer of 0 or more.',
  '課程時數必須是 0 以上的整數。': 'Course hours must be an integer of 0 or more.',
  '僅系統管理者或訓練中心會員可使用訓練中心工作區。': 'Only system administrators or training center members can use the training center workspace.',
  '儲存失敗，請稍後再試。': 'Save failed. Please try again later.',
  '取證日期不可早於考證日期。': 'The certificate issue date cannot be earlier than the exam date.',
  '已有相同名稱的資料，請換一個名稱。': 'A record with the same name already exists. Please use a different name.',
  '找不到這個訓練中心。': 'Training center not found.',
  '找不到這筆持證紀錄。': 'Certification holding record not found.',
  '找不到這筆資料。': 'Record not found.',
  '有效期限不可早於發證日期。': 'The expiry date cannot be earlier than the issue date.',
  '沒有權限操作其他訓練中心的資料。': 'You do not have permission to modify another training center\'s data.',
  '發證日期或有效期限格式不正確。': 'The issue date or expiry date format is invalid.',
  '老師 Email 格式不正確。': 'The teacher\'s email format is invalid.',
  '考證日期不可早於訓練開始日期。': 'The exam date cannot be earlier than the training start date.',
  '考證日期或取證日期格式不正確。': 'The exam date or certificate issue date format is invalid.',
  '訓練結束日期不可早於開始日期。': 'The training end date cannot be earlier than the start date.',
  '請先安排考證日期，再填寫取證日期。': 'Set the exam date before entering the certificate issue date.',
  '請先選擇訓練中心。': 'Please select a training center first.',
  '請輸入批次編號或名稱。': 'Please enter a batch number or name.',
  '請輸入正確的訓練開始與結束日期。': 'Please enter valid training start and end dates.',
  '請輸入班別名稱。': 'Please enter a class name.',
  '請輸入老師姓名。': 'Please enter the teacher\'s name.',
  '請輸入課程名稱。': 'Please enter a course name.',
  '請輸入證照名稱。': 'Please enter a certification name.',
  '請選擇班別。': 'Please select a class.',
  '請選擇這個訓練中心的老師。': 'Please select a teacher from this training center.',
  '請選擇這個訓練中心的老師與證照。': 'Please select a teacher and certification from this training center.',
  '請選擇這個訓練中心的課程。': 'Please select a course from this training center.',
  '請選擇這個訓練中心的證照。': 'Please select a certification from this training center.',
  '讀取訓練中心資料失敗，請稍後再試。': 'Failed to load training center data. Please try again later.',
  '資料格式不正確。': 'The data format is invalid.',
  '資料編號不正確。': 'The record ID is invalid.',
  '辦理日期格式不正確。': 'The processing date format is invalid.',
  '這筆資料還被課程、班別或其他資料使用，請先移除相關資料。': 'This record is still used by courses, classes or other records. Remove the related records first.',
  '這門課程已有班別，無法更換證照。': 'This course already has classes, so its certification cannot be changed.',

  // 訓練與來台文件流程（工人訓練安排）的規則訊息
  '初步文件審核（LCR Form 1-A、PSA 出生證明、護照三項中有兩項核准）通過後，才能安排訓練。': 'Training can be scheduled once the initial document review is passed (any two of LCR Form 1-A, PSA birth certificate and passport are approved).',
  '訓練狀態由訓練中心或管理者管理。': 'Training status is managed by the training center or an administrator.',
  '抵台體檢狀態由台灣仲介或管理者管理。': 'Arrival medical exam status is managed by the Taiwan agency or an administrator.',
  '請先由台灣仲介登錄實際入境日期，才能安排抵台體檢。': 'The Taiwan agency must record the actual entry date before the arrival medical exam can be scheduled.',
  '由訓練中心安排訓練': 'Training to be scheduled by the training center',
  '由菲律賓仲介辦理 OEC 與簽證': 'OEC and visa to be handled by the Philippines agency',
  '由台灣仲介安排抵台體檢並辦理在台文件': 'Arrival medical exam and Taiwan documents to be handled by the Taiwan agency',
  '僅菲律賓仲介與系統管理者可以管理工作者的文件與進度。': 'Only Philippines agencies and system administrators can manage workers\' documents and progress.',
  '只能管理所屬仲介的工作者。': 'You can only manage workers of your own agency.',
  '此狀態不能直接跳轉，請依流程逐步更新。': 'This status cannot be skipped to directly. Please update it step by step.',
  '訓練或抵台體檢狀態不正確。': 'The training or arrival medical exam status is invalid.',
  '訓練或抵台體檢項目不正確。': 'The training or arrival medical exam item is invalid.',
  '台灣仲介登錄實際入境日期後，才能安排抵台體檢。': 'The arrival medical exam can be scheduled only after the Taiwan agency records the actual entry date.',
  '訓練由訓練中心安排，這裡僅供查看。': 'Training is scheduled by the training center. View only here.',
  '抵台體檢由台灣仲介安排，這裡僅供查看。': 'The arrival medical exam is scheduled by the Taiwan agency. View only here.',
  '案件的訓練與抵台體檢狀態分別由訓練中心與台灣仲介維護，這裡僅供參考。': 'Training and arrival medical exam statuses are maintained by the training center and the Taiwan agency respectively. For reference only here.',
  '訓練與抵台體檢安排已更新。': 'Training and arrival medical exam arrangements updated.',
  '完成日不能早於開始日。': 'The completion date cannot be earlier than the start date.',
  '工作者編號不正確。': 'The worker ID is invalid.',
  '找不到工作者資料。': 'Worker record not found.',
  '更新項目不正確。': 'The update item is invalid.',
  '無法讀取工作者的文件與進度，請稍後再試。': 'Unable to load the worker\'s documents and progress. Please try again later.',
  '申請程序日期或項目不正確。': 'The application step date or item is invalid.',
  '表單資料格式不正確。': 'The form data format is invalid.',
  '入國通報（3 日內）': 'Entry notification (within 3 days)',
  '勞健保加保（3 日內）': 'Labor and health insurance enrollment (within 3 days)',
  '入國通報日期': 'Entry notification date',
  '加保日期': 'Insurance enrollment date',
  '居留證核發日期': 'ARC issue date',
  // 會員註冊審核畫面與工作者履歷編輯器
  '依工作類型與性別自動編號': 'Auto-numbered by job type and gender',
  '重新確認審核狀態': 'Check review status again',
  '履歷照片預覽': 'Resume photo preview',
  '履歷章節填寫進度': 'Resume section completion progress',
  '已填寫': 'Completed',
  '個章節': 'sections',
  '讀取履歷中…': 'Reading resume…',
  '讀取照片中…': 'Reading photo…',
};

const OWNER_EN = { 訓練中心: 'training center', 菲律賓仲介: 'Philippines agency', 台灣仲介: 'Taiwan agency', 指定單位: 'designated party' };
const plural = (n, one, many) => `${n} ${Number(n) === 1 ? one : many}`;

// 含變數的句型。translate 用來翻譯句型裡包含的子字串（例如「今天」「3 天後」）。
export function translateTrainingCenterPattern(text, translate = value => value) {
  let m;
  if ((m = text.match(/^(\d+) 天後$/))) return Number(m[1]) === 1 ? 'in 1 day' : `in ${m[1]} days`;
  if ((m = text.match(/^已過 (\d+) 天$/))) return Number(m[1]) === 1 ? '1 day ago' : `${m[1]} days ago`;
  if ((m = text.match(/^已過期（(.+)）$/))) return `Expired (${translate(m[1]).toLowerCase()})`;
  if ((m = text.match(/^· 有效至 (.+)$/))) return `· Valid until ${m[1]}`;
  if ((m = text.match(/^共 (\d+) 個班別$/))) return plural(m[1], 'class', 'classes') + ' in total';
  if ((m = text.match(/^共登記 (\d+) 筆持證$/))) return plural(m[1], 'certification holding', 'certification holdings') + ' registered';
  if ((m = text.match(/^證照批次 (\d+) 筆未發證$/))) return plural(m[1], 'certification batch', 'certification batches') + ' not yet issued';
  if ((m = text.match(/^已(停用|啟用)「(.+)」$/))) return `${m[1] === '停用' ? 'Deactivated' : 'Activated'} "${translateLabel(m[2])}"`;
  if ((m = text.match(/^已刪除「(.+)」$/))) return `Deleted "${translateLabel(m[1])}"`;
  if ((m = text.match(/^確定刪除「(.+)」？此操作無法復原。$/))) return `Delete "${translateLabel(m[1])}"? This cannot be undone.`;
  if ((m = text.match(/^(.+)老師持有的證照$/))) return `Certifications held by teacher ${m[1]}`;
  if ((m = text.match(/^(.+)老師仍是「(.+)」班的授課老師，請先更換授課老師後再移除證照。$/))) return `Teacher ${m[1]} is still the instructor of class "${m[2]}". Change the instructor before removing the certification.`;
  if ((m = text.match(/^(.+)老師尚未持有這門課程的證照，請先到「老師與證照」登記。$/))) return `Teacher ${m[1]} does not hold the certification for this course. Register it first under "Teachers & Certifications".`;
  if ((m = text.match(/^缺 (\d+) 份$/))) return `${m[1]} missing`;
  if ((m = text.match(/^入境 (.+)$/))) return `Entered ${m[1]}`;
  if ((m = text.match(/^(訓練中心|菲律賓仲介|台灣仲介|指定單位)辦理$/))) return `Handled by the ${OWNER_EN[m[1]]}`;
  if ((m = text.match(/^「(.+)」由(訓練中心|菲律賓仲介|台灣仲介|指定單位)辦理。$/))) return `"${translate(m[1])}" is handled by the ${OWNER_EN[m[2]]}.`;
  if ((m = text.match(/^送出成功！你的(.*)會員申請已送交管理團隊，審核完成後會開通你的工作區。$/))) return `Submitted! Your ${m[1] ? translate(m[1]) + ' ' : ''}membership application has been sent to the management team. Your workspace will be activated once the review is complete.`;
  return null;
}

// 刪除／停用的對象名稱：「{老師}的{證照}證照」這種組合名稱轉成英文語序，其餘（使用者輸入的名稱）維持原樣。
function translateLabel(label) {
  const holding = label.match(/^(.+)的(.+)證照$/);
  return holding ? `${holding[2]} certification of ${holding[1]}` : label;
}
