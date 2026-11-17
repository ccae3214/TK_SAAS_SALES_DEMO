// Shared person-name format: "姓氏 / 名字 / 中間名" (surname / given name / middle name).
// Plain module (no 'use client') so API routes, the LINE bot and the form component share one rule.

export function splitPersonName(value = '') {
  const text = String(value || '').trim();
  if (text.includes('/')) {
    const [surname = '', givenName = '', middleName = ''] = text.split('/').map(part => part.trim());
    return { surname, givenName, middleName };
  }
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 2) return { surname: '', givenName: words[0] || '', middleName: '' };
  return { surname: words.at(-1), givenName: words[0], middleName: words.slice(1, -1).join(' ') };
}

export function joinPersonName(parts) {
  return [parts.surname, parts.givenName, parts.middleName].map(part => String(part || '').trim()).filter(Boolean).join(' / ');
}

// Idempotent: "Maria Santos" -> "Santos / Maria", "Santos/Maria" -> "Santos / Maria",
// "Santos / Maria" stays as is. A single word (e.g. "王小明") has no surname/given split, so it stays unchanged.
export function normalizePersonName(value = '') {
  return joinPersonName(splitPersonName(value));
}
