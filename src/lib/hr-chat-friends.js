// 聊天室好友列表。
// 1) 在群組裡「單獨聊天過」（私訊聊天室裡至少有一則訊息）的人，自動成為好友。
// 2) 系統管理員彼此都找得到：管理員不屬於任何仲介／案件，不會出現在任何群組會員清單，
//    所以另外提供「系統管理員名錄」，讓管理員可以直接私訊、撥打給其他管理員。

// 與 /api/hr/chat 的 getReaderKey 相同的規則：用環境變數登記的管理員（沒有會員編號）用 admin:<email 或 LINE ID>，
// 其他人用 member:<會員編號>。這樣不論從群組清單或名錄找到同一個人，私訊與來電都會送到他實際登入時用的識別碼。
export function memberChatKey(member, adminEmails = [], adminLineIds = []) {
  const email = String(member?.email || '').trim().toLowerCase();
  const lineUserId = String(member?.line_user_id || '');
  const envAdmin = (!!email && adminEmails.includes(email)) || (!!lineUserId && adminLineIds.includes(lineUserId));
  return envAdmin ? `admin:${email || lineUserId}` : `member:${member.id}`;
}

export function isAdminFriend(row) {
  return String(row?.key || '').startsWith('admin:') || row?.admin_scope === 'system' || row?.role === 'system_admin';
}

// 環境變數管理員沒有 hr_members 資料列，登入聊天室時把名字記下來，其他管理員才找得到他。
export async function rememberAdminIdentity(run, key, name) {
  const displayName = String(name || '').trim() || '管理者';
  await run(`INSERT INTO hr_chat_directory(participant_key,display_name) VALUES($1,$2)
    ON CONFLICT(participant_key) DO UPDATE SET display_name=EXCLUDED.display_name,updated_at=NOW()
    WHERE hr_chat_directory.display_name IS DISTINCT FROM EXCLUDED.display_name`, [key, displayName]);
}

// 回傳 [{key,name,role,agencyName,memberId,roomId,chatted}]；roomId 是已存在的私訊聊天室（沒有則為 null）。
export async function listFriends(run, { principal, selfKey, adminEmails = [], adminLineIds = [] }) {
  const chatted = await run(`SELECT p.participant_key AS key,COALESCE(m.display_name,p.display_name) AS name,p.member_id,r.id AS room_id,
      m.role,m.admin_scope,a.name AS agency_name
    FROM hr_chat_participants me
    JOIN hr_chat_rooms r ON r.id=me.room_id AND r.room_type='direct'
    JOIN hr_chat_participants p ON p.room_id=r.id AND p.participant_key<>me.participant_key
    LEFT JOIN hr_members m ON m.id=p.member_id
    LEFT JOIN hr_agencies a ON a.id=m.agency_id
    WHERE me.participant_key=$1 AND (m.id IS NULL OR m.active=TRUE)
      AND EXISTS(SELECT 1 FROM hr_chat_messages x WHERE x.room_id=r.id)`, [selfKey]);
  const friends = new Map();
  for (const row of chatted) {
    friends.set(row.key, {
      key: row.key, name: row.name, role: isAdminFriend(row) ? 'admin' : (row.role || ''), agencyName: row.agency_name || '',
      memberId: row.member_id ? Number(row.member_id) : null, roomId: Number(row.room_id), chatted: true,
    });
  }
  if (principal?.role === 'admin') {
    const admins = await run(`SELECT m.id,m.email,m.line_user_id,m.display_name FROM hr_members m
      WHERE m.active=TRUE AND (m.admin_scope='system' OR m.role='system_admin')`);
    const directory = await run('SELECT participant_key,display_name FROM hr_chat_directory');
    const candidates = [
      ...admins.map(row => ({ key: memberChatKey(row, adminEmails, adminLineIds), name: row.display_name, memberId: Number(row.id) })),
      ...directory.map(row => ({ key: row.participant_key, name: row.display_name, memberId: null })),
    ];
    for (const item of candidates) {
      if (item.key === selfKey) continue;
      const existing = friends.get(item.key);
      if (existing) { existing.role = 'admin'; continue; }
      friends.set(item.key, { key: item.key, name: item.name, role: 'admin', agencyName: '', memberId: item.memberId, roomId: null, chatted: false });
    }
  }
  return [...friends.values()].filter(item => item.key !== selfKey).sort((a, b) => String(a.name).localeCompare(String(b.name)));
}
