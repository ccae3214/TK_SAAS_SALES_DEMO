import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { resolveAlias, resolve } from './support/alias-hooks.mjs';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const fileOf = url => path.normalize(fileURLToPath(url));

test('@/ 別名對應到 src/，可省略副檔名', () => {
  assert.equal(fileOf(resolveAlias('@/lib/db')), path.join(src, 'lib', 'db.js'));
  assert.equal(fileOf(resolveAlias('@/lib/db.js')), path.join(src, 'lib', 'db.js'));
  assert.equal(resolveAlias('@/lib/no-such-module'), null);
  assert.equal(resolveAlias('react'), null);
});

test('解析失敗時，相對路徑與 next 子路徑會補 .js 或 /index.js；其他錯誤照原樣丟出', async () => {
  const notFound = Object.assign(new Error('not found'), { code: 'ERR_MODULE_NOT_FOUND' });
  const tried = [];
  const nextResolve = async specifier => {
    tried.push(specifier);
    if (specifier === './_post/index.js' || specifier === 'next/server.js') return { url: `resolved:${specifier}` };
    throw notFound;
  };
  assert.deepEqual(await resolve('./_post', {}, nextResolve), { url: 'resolved:./_post/index.js' });
  assert.deepEqual(tried, ['./_post', './_post.js', './_post/index.js']);
  assert.deepEqual(await resolve('next/server', {}, nextResolve), { url: 'resolved:next/server.js' });
  await assert.rejects(resolve('some-package', {}, nextResolve), notFound, '一般套件不猜副檔名');
  await assert.rejects(resolve('./already.js', {}, nextResolve), notFound, '已經有副檔名的不再補');
  const other = Object.assign(new Error('syntax'), { code: 'ERR_INVALID_URL' });
  await assert.rejects(resolve('./x', {}, async () => { throw other; }), other);
});

test('npm run test:hr 會帶上別名設定：import @/ 的模組可以直接載入', async () => {
  const access = await import('../src/lib/hr-access.js');
  assert.equal(typeof access, 'object');
  const route = await import('../src/app/api/hr/route.js');
  assert.equal(typeof route.GET, 'function');
});
