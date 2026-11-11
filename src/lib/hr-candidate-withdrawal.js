// Existing rejected status is reused to avoid schema changes. The append-only marker
// distinguishes agency withdrawal from an employer rejection; it never grants access.
export const WITHDRAWAL_MARKER = '\n[agency-withdrawal] ';

export function isWithdrawnRecommendation(candidate) {
  return candidate?.status === 'rejected' && String(candidate.notes || '').includes(WITHDRAWAL_MARKER);
}

export function canWithdrawRecommendation(candidate) {
  return candidate?.agency_recommendation === true && candidate.status === 'proposed'
    && !candidate.interview_at && !candidate.case_id;
}

export function recommendationStatus(candidate) {
  if (isWithdrawnRecommendation(candidate)) return '已撤回推薦';
  return ({ proposed: '待面試', scheduled: '已安排面試', passed: '已錄用', rejected: '未錄用' })[candidate?.status] || candidate?.status || '';
}
