"use client";

import { canWithdrawRecommendation, isWithdrawnRecommendation, recommendationStatus } from '@/lib/hr-candidate-withdrawal';

export default function HrRecommendationHistory({ candidates, onWithdraw, busy, readOnly = false }) {
  const active = candidates.filter(candidate => candidate.status !== 'rejected');
  const history = candidates.filter(candidate => candidate.status === 'rejected');
  function row(candidate) {
    return <div key={candidate.id} role="group" aria-label={`推薦紀錄 ${candidate.id}`} style={{ padding: '10px 0', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <div><strong>{candidate.worker_name}</strong><p>{recommendationStatus(candidate)}</p>{isWithdrawnRecommendation(candidate) && <small>僅撤回推薦，工作者與原推薦紀錄均已保留。</small>}</div>
      {!readOnly && canWithdrawRecommendation(candidate) && <button type="button" disabled={busy != null} onClick={() => onWithdraw(candidate)}>{busy === candidate.id ? '撤回中…' : '撤回推薦'}</button>}
    </div>;
  }
  return <section aria-label="推薦紀錄">
    <p>{readOnly ? '需求已結束，推薦與撤回紀錄僅供查閱。' : '推薦錯誤時，可在安排面試前撤回；不會刪除工作者、履歷或文件。'}</p>
    {active.map(row)}
    {history.length > 0 && <details open><summary>推薦歷史（{history.length}）</summary>{history.map(row)}</details>}
  </section>;
}
