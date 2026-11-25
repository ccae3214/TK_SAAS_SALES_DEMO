import test from 'node:test';
import assert from 'node:assert/strict';
import { TL_DICTIONARY } from '../src/data/tl-dictionary.js';
import { tlText, pick, copyFor, mapLeaves, nextLanguage, localeFor, isSupportedLanguage, LANGUAGES } from '../src/lib/language.js';
import { translations } from '../src/data/translations.js';

test('支援中文、英文與菲律賓語（tl），語言順序循環', () => {
  assert.deepEqual(LANGUAGES.map(item => item.code), ['zh', 'en', 'tl']);
  assert.ok(isSupportedLanguage('tl'));
  assert.ok(!isSupportedLanguage('fil'));
  assert.equal(nextLanguage('zh'), 'en');
  assert.equal(nextLanguage('en'), 'tl');
  assert.equal(nextLanguage('tl'), 'zh');
  assert.equal(localeFor('tl'), 'fil-PH');
});

test('菲律賓語字典：每一句都有內容、不含中文字、key 是英文', () => {
  const entries = Object.entries(TL_DICTIONARY);
  assert.ok(entries.length > 1500);
  for (const [en, tl] of entries) {
    assert.ok(tl.trim().length > 0, en);
    assert.ok(!/[㐀-鿿]/.test(tl), `${en} => ${tl}`);
    assert.ok(!/[㐀-鿿]/.test(en), en);
  }
});

test('tlText：查得到就翻譯、保留前後空白；查不到退回原英文', () => {
  assert.equal(tlText('Sign out'), TL_DICTIONARY['Sign out']);
  assert.equal(tlText('  Sign out '), `  ${TL_DICTIONARY['Sign out']} `);
  assert.equal(tlText('This sentence is not in the dictionary 12345'), 'This sentence is not in the dictionary 12345');
  assert.equal(tlText(42), 42);
});

test('pick / copyFor / mapLeaves：中文、英文、菲律賓語各取各的', () => {
  assert.equal(pick('zh', '中', 'Cancel'), '中');
  assert.equal(pick('en', '中', 'Cancel'), 'Cancel');
  assert.equal(pick('tl', '中', 'Cancel'), tlText('Cancel'));
  assert.equal(pick('tl', '中', 'Cancel', 'Custom'), 'Custom');
  const copy = { zh: { a: '中' }, en: { a: 'Cancel', list: ['Sign out'], fn: () => 1 } };
  assert.equal(copyFor(copy, 'zh'), copy.zh);
  assert.equal(copyFor(copy, 'en'), copy.en);
  const tl = copyFor(copy, 'tl');
  assert.equal(tl.a, tlText('Cancel'));
  assert.equal(tl.list[0], tlText('Sign out'));
  assert.equal(typeof tl.fn, 'function');
  assert.equal(copyFor(copy, 'tl'), tl, '結果有快取');
  assert.deepEqual(mapLeaves({ x: ['a', { y: 'b' }], n: 1 }, s => s.toUpperCase()), { x: ['A', { y: 'B' }], n: 1 });
});

test('網站主文案：英文版每個字串在菲律賓語版都有對應（缺的才會退回英文）', () => {
  const missing = [];
  let total = 0;
  (function walk(node, path) {
    if (typeof node === 'string') { if (/[A-Za-z]{3,}/.test(node)) { total += 1; if (!(node.trim() in TL_DICTIONARY)) missing.push(`${path}: ${node}`); } }
    else if (Array.isArray(node)) node.forEach((item, i) => walk(item, `${path}[${i}]`));
    else if (node && typeof node === 'object') Object.entries(node).forEach(([k, v]) => walk(v, `${path}.${k}`));
  })(translations.en, 'en');
  // 品牌名、人名、通用技術詞（Checkout、Wishlist…）刻意維持英文，不在字典裡；其餘缺漏請補進 tl-dictionary.js。
  assert.ok(missing.length / total < 0.25, `缺少 ${missing.length}/${total} 句：\n${missing.slice(0, 20).join('\n')}`);
});
