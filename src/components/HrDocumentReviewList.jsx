"use client";

import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { WORKER_STAGES, DOCUMENT_STATUS_FILTERS, documentGroup, stageOfRequirement } from '@/lib/hr-worker-stages';

// 仲介／雇主查看多位工作者的必要文件。
// 目標是減少手機上的捲動：依「需要處理」排序工作者、預設收合、可用狀態篩選。
// 每位工作者的文件和工人頁面一樣依 A–G 階段分組；還有待處理文件的階段預設展開，全部核准的階段預設收起。
// 卡片內容由 renderItem 提供（沿用工作者頁面的文件卡片）。

const STATUS_ORDER = { submitted: 0, returned: 1, missing: 2, approved: 3, na: 4 };

// 排序用的快照：工作者與文件的先後順序只在畫面開啟、或使用者切換篩選時決定一次。
// 如果跟著資料即時排序，上傳／審核後那位工作者會因為「待審數增加」被排到最上面、
// 該文件也會被移到階段最前面，使用者正在看的位置就被推走。
// 顯示的數字與狀態仍然是即時的，只有順序被固定。
function takeOrderSnapshot(summaries) {
  const workers = new Map();
  const items = new Map();
  for (const { person, rows, counts } of summaries) {
    workers.set(person.id, [counts.submitted, counts.returned, counts.missing]);
    for (const item of rows) items.set(item.id, STATUS_ORDER[documentGroup(item)]);
  }
  return { workers, items };
}

function StageGroup({ stage, items, approved, applicable, pending, defaultOpen, renderItem }) {
  const [open, setOpen] = useState(defaultOpen);
  return <section className={`doc-stage${pending === 0 ? ' doc-stage-done' : ''}`}>
    <button type="button" className="doc-stage-toggle" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <span className="stage-badge">{stage.key}</span>
      <span className="doc-stage-title">{stage.title}</span>
      <span className="doc-stage-count" title="已核准／適用文件">{approved}/{applicable}</span>
      <ChevronDown size={16} aria-hidden="true" className="doc-stage-chevron" />
    </button>
    {open&&<div className="doc-stage-body">{items.map(item => renderItem(item))}</div>}
  </section>;
}

export default function HrDocumentReviewList({ workers, requirements, renderItem }) {
  const [filter, setFilter] = useState(null); // null＝尚未手動選擇，改用預設
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState({});

  const summaries = useMemo(() => workers.map(person => {
    const rows = requirements.filter(item => Number(item.worker_id) === Number(person.id));
    const counts = { submitted: 0, returned: 0, missing: 0, approved: 0, na: 0 };
    for (const item of rows) counts[documentGroup(item)] = (counts[documentGroup(item)] || 0) + 1;
    return { person, rows, counts, applicable: rows.length - counts.na };
  }), [workers, requirements]);

  // 依「需要處理」排序（待審多的在前），順序用快照固定，見 takeOrderSnapshot。
  const [order, setOrder] = useState(() => takeOrderSnapshot(summaries));
  const sortedSummaries = useMemo(() => {
    const rank = row => order.workers.get(row.person.id) || [row.counts.submitted, row.counts.returned, row.counts.missing];
    return [...summaries].sort((a, b) => {
      const ra = rank(a), rb = rank(b);
      return rb[0] - ra[0] || rb[1] - ra[1] || rb[2] - ra[2]
        || String(a.person.name || '').localeCompare(String(b.person.name || ''), 'zh-Hant');
    });
  }, [summaries, order]);
  const itemRank = item => order.items.get(item.id) ?? STATUS_ORDER[documentGroup(item)];
  function changeFilter(key) { setFilter(key); setOrder(takeOrderSnapshot(summaries)); }

  const totals = summaries.reduce((sum, row) => ({
    submitted: sum.submitted + row.counts.submitted,
    returned: sum.returned + row.counts.returned,
    missing: sum.missing + row.counts.missing,
    approved: sum.approved + row.counts.approved,
  }), { submitted: 0, returned: 0, missing: 0, approved: 0 });

  // 預設：有待審文件就先看待審，否則看全部。
  // 只在畫面剛開啟時決定一次，不能跟著資料即時重算：上傳文件後待審數會從 0 變 1，
  // 預設若跟著從「全部」換成「待審核」，清單會瞬間縮成只剩有待審文件的工作者，
  // 各階段也會被重新建立，畫面就像跳回最上面。使用者按了篩選才會改變。
  const [initialFilter] = useState(() => (totals.submitted > 0 ? 'submitted' : 'all'));
  const activeFilter = filter ?? initialFilter;
  const needle = query.trim().toLowerCase();
  const visible = sortedSummaries.filter(row =>
    (activeFilter === 'all' || row.counts[activeFilter] > 0)
    && (!needle || String(row.person.name || '').toLowerCase().includes(needle)));
  const matchesFilter = item => activeFilter === 'all' || documentGroup(item) === activeFilter;

  return <div className="doc-review">
    <div className="doc-filter-bar" role="group" aria-label="文件狀態篩選">
      {DOCUMENT_STATUS_FILTERS.map(([key, label]) => <button type="button" key={key}
        className={`doc-filter${activeFilter === key ? ' is-active' : ''}`}
        aria-pressed={activeFilter === key} onClick={() => changeFilter(key)}>
        <span>{label}</span>{key !== 'all'&&<b>{totals[key]}</b>}
      </button>)}
    </div>
    {summaries.length > 4&&<label className="doc-search">
      <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜尋工作者" aria-label="搜尋工作者" />
    </label>}
    {visible.length === 0
      ? <p className="doc-review-empty">目前沒有符合的文件。</p>
      : visible.map(({ person, rows, counts, applicable }) => {
        const expanded = person.id in open ? open[person.id] : (activeFilter !== 'all' || summaries.length === 1);
        const pending = counts.submitted + counts.returned + counts.missing;
        const stageRows = WORKER_STAGES.map(stage => {
          const stageDocs = rows.filter(item => stageOfRequirement(item.name) === stage.key);
          const stageApplicable = stageDocs.filter(item => item.applicable);
          const items = stageDocs.filter(matchesFilter)
            .sort((x, y) => itemRank(x) - itemRank(y) || Number(y.entry_gate) - Number(x.entry_gate));
          return {
            stage, items, applicable: stageApplicable.length,
            approved: stageApplicable.filter(item => item.status === 'approved').length,
            pending: stageApplicable.filter(item => item.status !== 'approved').length,
          };
        }).filter(row => row.items.length);
        return <section className="doc-worker" key={person.id}>
          <button type="button" className="doc-worker-toggle" aria-expanded={expanded}
            onClick={() => setOpen(prev => ({ ...prev, [person.id]: !expanded }))}>
            <span className="doc-worker-name">{person.name}</span>
            <span className="doc-worker-badges">
              {counts.submitted > 0&&<span className="doc-badge doc-badge-submitted"><span>待審核</span><b>{counts.submitted}</b></span>}
              {counts.returned > 0&&<span className="doc-badge doc-badge-returned"><span>被退回</span><b>{counts.returned}</b></span>}
              {counts.missing > 0&&<span className="doc-badge doc-badge-missing"><span>待上傳</span><b>{counts.missing}</b></span>}
              {pending === 0&&<span className="doc-badge doc-badge-done"><span>文件齊全</span></span>}
            </span>
            <span className="doc-worker-progress" title="已核准／適用文件">{counts.approved}/{applicable}</span>
            <ChevronDown size={18} aria-hidden="true" className="doc-worker-chevron" />
          </button>
          {expanded&&<div className="doc-worker-body">
            {stageRows.map(row => <StageGroup key={`${row.stage.key}:${activeFilter}`} {...row}
              defaultOpen={activeFilter !== 'all' || row.pending > 0} renderItem={renderItem} />)}
          </div>}
        </section>;
      })}
  </div>;
}
