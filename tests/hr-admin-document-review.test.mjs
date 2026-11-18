import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// 系統管理員的「文件收件與審核」要和仲介的「必要文件與審核」長得一樣：
// 同一個 HrDocumentReviewList（依工作者分小元件、點選展開、一次只開一位），文件卡片也用同一套樣式。
const admin = await readFile(new URL('../src/components/HrManagement.jsx', import.meta.url), 'utf8');
const portal = await readFile(new URL('../src/components/HrMemberPortal.jsx', import.meta.url), 'utf8');
const translations = await readFile(new URL('../src/lib/hr-translations.jsx', import.meta.url), 'utf8');
const documentList = admin.slice(admin.indexOf('function DocumentList('), admin.indexOf('function StepDone('));

test('admin document review uses the same worker-tile list as the agency view', () => {
  assert.match(admin, /import HrDocumentReviewList from '@\/components\/HrDocumentReviewList'/);
  assert.match(documentList, /<HrDocumentReviewList workers=\{reviewWorkers\} requirements=\{visible\} renderItem=\{renderItem\}\/>/);
  assert.doesNotMatch(documentList, /<table/);
});

test('admin review reuses the agency stylesheet inside an embedded wrapper', () => {
  assert.match(admin, /import \{ PortalStyles \} from '@\/components\/HrMemberPortal'/);
  assert.match(portal, /export function PortalStyles\(\)/);
  assert.match(documentList, /className="hr-member-shell hr-embedded"><div className="hr-member-card">/);
  assert.match(portal, /\.hr-member-shell\.hr-embedded\{min-height:0;padding:0;background:none\}/);
});

test('admin cards keep every admin action: preview, download, upload, approve, return', () => {
  for (const label of ['預覽 (', '下載', '新增版本', '上傳文件', '核准文件', '退回補件']) assert.ok(documentList.includes(label), label);
  assert.match(documentList, /decide\(row,'approved'\)/);
  assert.match(documentList, /decide\(row,'returned',event\.currentTarget\)/);
});

test('version rows are one string so they translate to "Version N · file" in English', () => {
  assert.match(translations, /const versionRow=trimmed\.match\(\/\^第\(\\d\+\)版 · \(\.\+\)\$\/\)/);
  assert.match(documentList, /`第\$\{sub\.version_number\}版 · \$\{sub\.original_filename\}`/);
  assert.match(portal, /`第\$\{sub\.version_number\}版 · \$\{sub\.original_filename\}`/);
});
