"use client";

import { useLanguage } from '@/context/LanguageContext';
import { orderJourney } from '@/lib/hr-workflow';
import { caseNextSteps, orderNextSteps } from '@/lib/hr-agency-next-steps';
import styles from './HrNextSteps.module.css';
import { pickLang, copyFor } from '@/lib/language';

// 給台灣／菲律賓仲介看的「下一步」提醒：目前走到哪裡、接下來要做什麼、要聯絡誰。只是提示，不會改動任何資料。
// kind="order"：需求單（雇主下單到錄用）；kind="case"：案件的來台程序。
const COPY = {
  zh: {
    eyebrow: '下一步', now: '目前狀態：', contact: '要聯絡', footer: '更新進度後，這裡的提示會自動更新。', allDone: '這個案件入境後的文件都已完成，不需要再處理。',
    who: { employer: '雇主', taiwan: '台灣仲介', philippines: '菲律賓仲介', notification: '台灣入國通報流程' },
    states: {
      order_placed: '雇主已下單', candidate_proposed: '已有人選，等待雇主確認', interview_scheduled: '面試已安排', hired: '雇主已錄用',
      case_started: '案件已建立', match_done: '配工／面試日期已登錄', docs_ready: '護照與個人文件已備齊', one_route_done: 'VISA 或 OEC 已完成其中一項',
      visa_oec_done: 'OEC 與簽證都已完成', flight_set: '機票或預定入境日已登錄', arrived: '工人已入境', all_done: '入境後的在台文件都已完成',
    },
    actions: {
      confirm_eta: '與菲律賓仲介確認：工人最快何時能備齊文件、完成訓練、OEC 與簽證，再回覆雇主預估到職日。',
      reply_eta: '回覆台灣仲介：可推薦的工人，以及每位工人預計何時能備齊文件、完成訓練、OEC 與簽證。',
      remind_employer: '提醒雇主查看推薦的人選並安排面試。',
      confirm_candidate_docs: '請菲律賓仲介確認人選目前的文件狀況與可面試的時間。',
      prepare_candidate: '備妥人選的履歷與文件，並把可面試的時間回報台灣仲介。',
      confirm_interview: '確認面試時間與方式；面試後向雇主收錄用結果，並通知菲律賓仲介。',
      worker_attend: '確保工人準時參加面試，面試後把結果回報台灣仲介。',
      start_case: '與菲律賓仲介對齊文件時程；到「赴台申請程序」追蹤每個步驟，並把預計時程回報雇主。',
      start_docs: '開始備齊工人文件（護照、PSA 出生證明、LCR Form 1-A 等），並安排訓練。',
      confirm_docs_date: '向菲律賓仲介確認護照與個人文件最快何時備齊，並更新預估到職日。',
      gather_docs: '備齊護照與個人文件，並把預計完成日回報台灣仲介。',
      confirm_routes_plan: '與菲律賓仲介確認 VISA 與 OEC 兩條路線各自的預計完成日（兩條可同時進行），並告知雇主預估時程。',
      run_routes: '同步進行 VISA 路線（ACCR、核准函、簽證）與 OEC 路線（訓練、PDOS、OWWA、OEC），並回報預計完成日。',
      confirm_missing_route: '另一條路線（VISA 或 OEC）還沒完成：向菲律賓仲介確認預計完成日，避免卡住出境。',
      finish_missing_route: '儘快完成還沒辦完的路線（VISA 或 OEC），並把預計完成日回報台灣仲介。',
      confirm_entry_date: '與雇主、菲律賓仲介確認工人何時能出境、何時入境，並確認入國通報由誰在入境後辦理；確認後登錄「預定入境」日期。',
      book_ticket: '與台灣仲介、雇主確認出境日期並訂機票，把航班資訊登錄到「機票／出境」。',
      prepare_arrival: '把航班與預定入境日告知雇主安排接機，並備妥入國通報與勞健保加保所需資料（入境後 3 日內辦理）。',
      confirm_departure: '確認工人已依航班出境，並把實際出境日期通知台灣仲介。',
      post_arrival_docs: '登錄實際入境日，並在 3 日內完成入國通報與勞健保加保；接著安排抵台體檢與居留證（ARC）。',
      followup_worker: '確認工人平安抵台並已和台灣仲介聯絡上，必要時協助溝通。',
    },
  },
  en: {
    eyebrow: 'Next step', now: 'Current status: ', contact: 'Contact', footer: 'Once you update the progress, these hints update automatically.', allDone: 'All of this case’s in-Taiwan documents after entry are done. Nothing more to handle.',
    who: { employer: 'Employer', taiwan: 'Taiwan agency', philippines: 'Philippine agency', notification: 'Taiwan entry notification process' },
    states: {
      order_placed: 'The employer placed an order', candidate_proposed: 'Candidates proposed, waiting for the employer', interview_scheduled: 'Interview scheduled', hired: 'The employer hired the worker',
      case_started: 'Case created', match_done: 'Match / interview date recorded', docs_ready: 'Passport and personal documents ready', one_route_done: 'One of VISA or OEC is done',
      visa_oec_done: 'Both OEC and visa are done', flight_set: 'Ticket or expected entry date recorded', arrived: 'The worker has entered Taiwan', all_done: 'In-Taiwan documents after entry are done',
    },
    actions: {
      confirm_eta: 'Check with the Philippine agency how soon the worker can finish the documents, training, OEC and visa, then give the employer an estimated arrival date.',
      reply_eta: 'Reply to the Taiwan agency with the workers you can recommend and when each one can finish the documents, training, OEC and visa.',
      remind_employer: 'Remind the employer to review the proposed candidates and arrange an interview.',
      confirm_candidate_docs: 'Ask the Philippine agency to confirm the candidate’s current document status and interview availability.',
      prepare_candidate: 'Prepare the candidate’s resume and documents, and report their interview availability to the Taiwan agency.',
      confirm_interview: 'Confirm the interview time and format; after the interview, collect the employer’s decision and tell the Philippine agency.',
      worker_attend: 'Make sure the worker attends the interview on time, then report the result to the Taiwan agency.',
      start_case: 'Align the document timeline with the Philippine agency, track each step under “Application steps”, and report the expected timeline to the employer.',
      start_docs: 'Start gathering the worker’s documents (passport, PSA birth certificate, LCR Form 1-A, etc.) and arrange training.',
      confirm_docs_date: 'Ask the Philippine agency when the passport and personal documents can be ready, and update the estimated arrival date.',
      gather_docs: 'Gather the passport and personal documents and report the expected completion date to the Taiwan agency.',
      confirm_routes_plan: 'Confirm with the Philippine agency the expected completion date of both the VISA and OEC routes (they can run in parallel), and tell the employer the estimated timeline.',
      run_routes: 'Run the VISA route (ACCR, approval letter, visa) and the OEC route (training, PDOS, OWWA, OEC) in parallel, and report expected completion dates.',
      confirm_missing_route: 'The other route (VISA or OEC) is not finished yet: ask the Philippine agency for its expected completion date so departure is not held up.',
      finish_missing_route: 'Finish the remaining route (VISA or OEC) as soon as possible and report the expected completion date to the Taiwan agency.',
      confirm_entry_date: 'Confirm with the employer and the Philippine agency when the worker can leave and enter Taiwan, and confirm who will handle the entry notification after arrival; then record the “expected entry” date.',
      book_ticket: 'Confirm the departure date with the Taiwan agency and the employer, book the ticket, and record the flight details under “Ticket / departure”.',
      prepare_arrival: 'Give the employer the flight and expected entry date to arrange pickup, and prepare what the entry notification and labor/health insurance enrolment need (due within 3 days after entry).',
      confirm_departure: 'Confirm the worker left on the booked flight and tell the Taiwan agency the actual departure date.',
      post_arrival_docs: 'Record the actual entry date and complete the entry notification and labor/health insurance within 3 days; then arrange the post-arrival medical exam and the ARC.',
      followup_worker: 'Check that the worker arrived safely and has reached the Taiwan agency, and help with communication if needed.',
    },
  },
};

export default function HrNextSteps({ kind, order, data, steps, agencyType }) {
  const { lang } = useLanguage();
  const t = copyFor(COPY, lang);
  const guide = kind === 'order'
    ? orderNextSteps(order, order && data ? orderJourney(order, data.orderAgencies, data.orderRoutes, data.orderCandidates) : null, agencyType)
    : caseNextSteps(steps, agencyType);
  if (!guide) return null;
  return <aside className={styles.card} aria-label={t.eyebrow}>
    <span className={styles.eyebrow}>{t.eyebrow}</span>
    <p className={styles.state}><b>{t.now}</b>{t.states[guide.id]}</p>
    {guide.actions.length
      ? <ol className={styles.actions}>{guide.actions.map(item => <li key={item.id}>
          <span>{t.actions[item.id]}</span>
          {item.with.length > 0 && <span className={styles.chips}><small>{t.contact}</small>{item.with.map(who => <b key={who}>{t.who[who]}</b>)}</span>}
        </li>)}</ol>
      : <p className={styles.done}>{t.allDone}</p>}
    {guide.actions.length > 0 && <p className={styles.footer}>{t.footer}</p>}
  </aside>;
}
