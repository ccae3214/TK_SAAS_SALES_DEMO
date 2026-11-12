"use client";

import { useState } from 'react';
import { agencySnapshot } from '@/lib/hr-workflow';
import HrAgencyCertifications from '@/components/HrAgencyCertifications';
import styles from './HrJourney.module.css';

export default function HrAgencyDirectory({ data, edit, update, navigate }) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const agencies = data.agencies || [];
  const visible = agencies.filter(agency => (type === 'all' || agency.agency_type === type) && [agency.name, agency.country, agency.agency_type === 'taiwan' ? '台灣仲介' : '菲律賓仲介'].join(' ').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const selected = visible.find(agency => String(agency.id) === String(selectedId));
  const detail = selected ? agencySnapshot(selected, data) : null;
  return <section className={styles.directory} aria-label="仲介關係總覽">
    <p>先找到機構，再確認成員、負責業務與相關需求。以下只整理目前帳號已獲授權的資料。</p>
    <div className={styles.tools}><label>搜尋仲介<input type="search" placeholder="輸入機構名稱" value={search} onChange={event => setSearch(event.target.value)} /></label><label>仲介類型<select value={type} onChange={event => setType(event.target.value)}><option value="all">全部機構</option><option value="taiwan">台灣仲介</option><option value="philippines">菲律賓仲介</option></select></label><span>{visible.length} 間仲介</span></div>
    <HrAgencyCertifications role="admin" />
    <div className={styles.agencyCards}>{visible.map(agency => {
      const snapshot = agencySnapshot(agency, data);
      return <article key={agency.id} className={styles.agencyCard}><small>{agency.agency_type === 'taiwan' ? '台灣仲介' : '菲律賓仲介'} · {agency.active ? '啟用' : '停用'}</small><h3>{agency.name}</h3><div className={styles.facts}><span>{snapshot.members.length} 位機構成員</span><span>{snapshot.orders.filter(order => order.status === 'open').length} 張進行中需求</span><span>{snapshot.cases.length} 件相關案件</span></div>{snapshot.unassigned > 0 && <p className={styles.notice}>{snapshot.unassigned} 張需求尚未指定負責業務</p>}<div className={styles.actions}><button type="button" aria-expanded={String(selectedId) === String(agency.id)} onClick={() => setSelectedId(agency.id)}>查看機構詳情</button><button type="button" onClick={() => edit(agency)}>編輯</button><button type="button" onClick={() => update({ type: 'agency', id: agency.id, active: !agency.active })}>{agency.active ? '停用' : '啟用'}</button></div></article>;
    })}</div>
    {!visible.length && <p className={styles.empty}>找不到符合條件的機構，請調整名稱或類型。</p>}
    {selected && detail && <section className={styles.detail} aria-label="機構詳情"><div className={styles.detailHeader}><div><span className={styles.eyebrow}>機構詳情</span><h2>{selected.name}</h2><p>{selected.agency_type === 'taiwan' ? '台灣業務負責雇主需求、轉介與來台進度。' : '菲律賓承辦負責人選推薦、文件與申辦進度。'}</p></div><button type="button" onClick={() => setSelectedId(null)}>收起詳情</button></div>
      <div className={styles.relationGrid}><div><h3>機構成員與責任</h3>{detail.members.length ? <ul>{detail.members.map(member => <li key={member.id}>{member.display_name} · {member.admin_scope === 'agency' ? '機構管理者' : selected.agency_type === 'taiwan' ? '業務' : '承辦'} · {member.active ? '啟用' : '停用'}</li>)}</ul> : <p>尚未指派機構成員，請到會員帳號確認歸屬。</p>}<button type="button" onClick={() => navigate('members')}>查看會員帳號</button></div>
      <div><h3>所屬雇主與工人</h3><p>{detail.employers.length} 位所屬雇主 · {detail.workers.length} 位所屬工人</p><ul>{[...detail.employers.map(row => ({ ...row, key: `e-${row.id}` })), ...detail.workers.map(row => ({ ...row, key: `w-${row.id}` }))].map(row => <li key={row.key}>{row.name}</li>)}</ul></div>
      <div><h3>相關需求與案件</h3>{detail.orders.length ? <ul>{detail.orders.map(order => <li key={order.id}>需求 #{order.id} · {order.job_type} · {({ open: '媒合中', filled: '已額滿', cancelled: '已取消' })[order.status] || order.status}</li>)}</ul> : <p>目前沒有相關需求。</p>}<p>{detail.cases.length} 件相關案件</p>{detail.unassigned > 0 && <p className={styles.notice}>請在媒合需求單指派負責業務。</p>}<button type="button" onClick={() => navigate('job-orders')}>查看媒合需求單</button></div></div>
    </section>}
  </section>;
}
