// Browser-only decisions. Nothing here grants eligibility or persists a recommendation.
export function shortlistExperience(profile = {}) {
  const rows = [...(Array.isArray(profile.employmentExperiences) ? profile.employmentExperiences : []), ...(Array.isArray(profile.overseasExperiences) ? profile.overseasExperiences : [])];
  const text = rows.filter(row => row && typeof row === 'object').map(row => [row.workplace, row.period, row.title, row.content].filter(value => typeof value === 'string' && value.trim()).join(' / ')).filter(Boolean).join('\n');
  return text || profile.employmentHistory || profile.overseasWorkDetails || '';
}
export function swipeDecision(dx, dy) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) < 72 || Math.abs(dx) < Math.abs(dy) * 1.4) return null;
  return dx > 0 ? 'keep' : 'skip';
}
export function shortlistView(workers, history) {
  const byId = new Map(workers.map(worker => [String(worker.id), worker]));
  const valid = history.filter(item => byId.has(item.id));
  const visited = new Set(valid.map(item => item.id));
  return { history: valid, current: workers.find(worker => !visited.has(String(worker.id))) || null,
    selected: valid.filter(item => item.decision === 'keep').map(item => byId.get(item.id)),
    remaining: workers.filter(worker => !visited.has(String(worker.id))).length };
}
export function decideWorker(history, workers, id, decision) {
  if (!['keep', 'skip'].includes(decision) || !workers.some(worker => String(worker.id) === String(id))) return history;
  return [...history.filter(item => item.id !== String(id)), { id: String(id), decision }];
}
