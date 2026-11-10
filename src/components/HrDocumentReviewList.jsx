"use client";

import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';

// 仲介／雇主查看多位工作者的必要文件。
// 目標是減少手機上的捲動：依「需要處理」排序工作者、預設收合、可用狀態篩選，
// 已核准與不適用的文件預設收起。卡片內容由 renderItem 提供（沿用工作者頁面的文件卡片）。

const STATUS_FILTERS = [
  ['submitted', '待審核'],
  ['returned', '被退回'],
  ['missing', '待上傳'],
  ['all', '全部'],
];
const GROUP_ORDER = [
  ['submitted', '審核中'],
  ['returned', '被退回，請補件'],
  ['missing', '待上傳'],
  ['approved', '已核准'],
  ['na', '不適用'],
];
const COLLAPSED_GROUPS = new Set(['approved', 'na']);
const groupOf = item => (!item.applicable ? 'na' : item.status);

export default function HrDocumentReviewList({ workers, requirements, renderItem }) {
  const [filter, setFilter] = useState(null); // null＝尚未手動選擇，改用預設
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState({});

  const summaries = useMemo(() => workers.map(person => {
    const rows = requirements.filter(item => Number(item.worker_id) === Number(person.id));
    const counts = { submitted: 0, returned: 0, missing: 0, approved: 0, na: 0 };
    for (const item of rows) counts[groupOf(item)] = (counts[groupOf(item)] || 0) + 1;
    return { person, rows, counts, applicable: rows.length - counts.na };
  }).sort((a, b) => b.counts.submitted - a.counts.submitted
    || b.counts.returned - a.counts.returned
    || b.counts.missing - a.counts.missing
    || String(a.person.name || '').localeCompare(String(b.person.name || ''), 'zh-Hant')), [workers, requirements]);

  const totals = summaries.reduce((sum, row) => ({
    submitted: sum.submitted + row.counts.submitted,
    returned: sum.returned + row.counts.returned,
    missing: sum.missing + row.counts.missing,
  }), { submitted: 0, returned: 0, missing: 0 });

  // 預設：有待審文件就先看待審，否則看全部。
  const activeFilter = filter ?? (totals.submitted > 0 ? 'submitted' : 'all');
  const needle = query.trim().toLowerCase();
  const visible = summaries.filter(row =>
    (activeFilter === 'all' || row.counts[activeFilter] > 0)
    && (!needle || String(row.person.name || '').toLowerCase().includes(needle)));

  return <div className="doc-review">
    <div className="doc-filter-bar" role="group" aria-label="文件狀態篩選">
      {STATUS_FILTERS.map(([key, label]) => <button type="button" key={key}
        className={`doc-filter${activeFilter === key ? ' is-active' : ''}`}
        aria-pressed={activeFilter === key} onClick={() => setFilter(key)}>
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
            {GROUP_ORDER.filter(([key]) => activeFilter === 'all' || key === activeFilter).map(([key, label]) => {
              const items = rows.filter(item => groupOf(item) === key).sort((x, y) => Number(y.entry_gate) - Number(x.entry_gate));
              if (!items.length) return null;
              const cards = items.map(item => renderItem(item));
              return COLLAPSED_GROUPS.has(key)
                ? <details className={`doc-group doc-group-${key}`} key={key}>
                  <summary><span>{label}</span><b>{items.length}</b><ChevronDown size={16} aria-hidden="true" /></summary>
                  {cards}
                </details>
                : <div className={`doc-group doc-group-${key}`} key={key}>
                  <h4><span>{label}</span><b>{items.length}</b></h4>
                  {cards}
                </div>;
            })}
          </div>}
        </section>;
      })}
  </div>;
}
