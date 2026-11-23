// 全站管理員唯讀入口；不改變仲介／訓練中心自己的存取規則。
export const ORGANIZATION_AUDIT_PAGE_SIZE = 100;
const SOURCES = {
  agency: { table: 'hr_agency_audit_log', name: 'agency_name', summary: 'summary_zh', extra: 'summary_en' },
  training: { table: 'hr_tc_audit_log', name: 'center_name', summary: 'summary', extra: 'actor_kind,detail' },
};

export function createOrganizationAuditHandler({ auth, getPrincipal, query, ensure, onError = () => {} }) {
  return async request => {
    const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
    try {
      const session = await auth();
      if (!session?.user) return json({ error: 'Authentication required' }, 401);
      const principal = await getPrincipal(session);
      if (principal?.role !== 'admin') return json({ error: '僅系統管理者可查看操作紀錄。' }, 403);
      const params = new URL(request.url).searchParams;
      const kind = params.get('kind') || 'agency';
      if (!Object.hasOwn(SOURCES, kind)) return json({ error: '紀錄類型不正確。' }, 400);
      const before = params.get('before');
      if (before !== null && !/^[1-9]\d{0,17}$/.test(before)) return json({ error: '資料編號不正確。' }, 400);
      const q = (params.get('q') || '').trim();
      if (q.length > 80) return json({ error: '搜尋文字過長。' }, 400);
      const source = SOURCES[kind];
      await ensure(kind);
      const keyword = q ? `%${q.replace(/[\\%_]/g, '\\$&')}%` : null;
      const rows = await query(`SELECT id,${source.name} AS organization_name,actor_name,action,target_type,target_name,
        ${source.summary} AS summary,${source.extra},created_at
        FROM ${source.table}
        WHERE ($1::bigint IS NULL OR id < $1::bigint)
          AND ($2::text IS NULL OR ${source.name} ILIKE $2 OR actor_name ILIKE $2 OR target_name ILIKE $2 OR ${source.summary} ILIKE $2)
        ORDER BY id DESC LIMIT $3`, [before, keyword, ORGANIZATION_AUDIT_PAGE_SIZE + 1]);
      const page = rows.slice(0, ORGANIZATION_AUDIT_PAGE_SIZE);
      return json({ rows: page, nextBefore: rows.length > ORGANIZATION_AUDIT_PAGE_SIZE ? String(page[page.length - 1].id) : null });
    } catch (error) {
      onError(error);
      return json({ error: '讀取操作紀錄失敗，請稍後再試。' }, 500);
    }
  };
}
