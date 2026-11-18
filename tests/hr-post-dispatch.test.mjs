import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

// 不連資料庫、不載入 Next：直接讀 _post/*.js 裡每個 handler 宣告的 allow，驗證「哪個角色能打哪個 type」。
const dir = new URL('../src/app/api/hr/_post/', import.meta.url);
const source = async name => readFile(new URL(name, dir), 'utf8');

const roles = {
  admin: { role: 'admin' },
  taiwanAgency: { role: 'agency', agency_type: 'taiwan' },
  philippinesAgency: { role: 'agency', agency_type: 'philippines' },
  employer: { role: 'employer' },
};

async function loadHandlers() {
  const files = ['job-orders.js', 'people.js', 'cases.js'];
  const handlers = [];
  for (const file of files) {
    const text = await source(file);
    for (const match of text.matchAll(/export const (\w+) = \{\s*types: (\[[^\]]*\]),\s*allow: principal => ([^\n]+),\n/g)) {
      handlers.push({ name: match[1], file, types: JSON.parse(match[2]), allowExpr: match[3].replace(/,$/, '') });
    }
  }
  return handlers.map(item => ({ ...item, allow: new Function('principal', `return ${item.allowExpr};`) }));
}

const expected = {
  'job-order': { employer: ['createJobOrder'] },
  'job-order-admin-assignment': { admin: ['assignTaiwanAgency'] },
  'job-order-admin-philippines-assignment': { admin: ['assignPhilippinesAgencies'] },
  'job-order-candidate': { philippinesAgency: ['recommendCandidate'] },
  'job-order-employer-candidate': { employer: ['employerPickCandidate'] },
  worker: { philippinesAgency: ['createAgencyWorker'], admin: ['createEmployerOrWorker'] },
  employer: { admin: ['createEmployerOrWorker'] },
  agency: { admin: ['createAgency'] },
  member: { admin: ['createMember'] },
  case: { admin: ['createCase'] },
  requirement: { admin: ['addRequirement'] },
  task: { admin: ['addTask'] },
};

test('每種 POST type 只有指定角色的 handler 會接手，其餘角色不會誤入別人的邏輯', async () => {
  const handlers = await loadHandlers();
  assert.equal(handlers.length, 12);
  for (const [type, perRole] of Object.entries(expected)) {
    for (const [roleName, principal] of Object.entries(roles)) {
      const matched = handlers.filter(item => item.types.includes(type) && item.allow(principal)).map(item => item.name);
      assert.deepEqual(matched, perRole[roleName] || [], `${type} / ${roleName}`);
    }
  }
});

test('推薦人選與雇主挑選只開放給各自角色，管理者不會落入這兩個 handler', async () => {
  const handlers = await loadHandlers();
  for (const name of ['recommendCandidate', 'employerPickCandidate', 'createJobOrder']) {
    assert.equal(handlers.find(item => item.name === name).allow(roles.admin), false, name);
  }
  for (const name of ['createMember', 'createAgency', 'createCase', 'createEmployerOrWorker']) {
    const handler = handlers.find(item => item.name === name);
    for (const role of ['taiwanAgency', 'philippinesAgency', 'employer']) assert.equal(handler.allow(roles[role]), false, `${name}/${role}`);
  }
});

test('index.js 登錄了每一個 handler，且沒有任何 handler 缺少 allow', async () => {
  const handlers = await loadHandlers();
  const index = await source('index.js');
  for (const { name } of handlers) assert.match(index, new RegExp(`\\b${name}\\b`), name);
  const total = (await Promise.all(['job-orders.js', 'people.js', 'cases.js'].map(async f => ((await source(f)).match(/export const \w+ = \{/g) || []).length))).reduce((a, b) => a + b, 0);
  assert.equal(total, handlers.length);
});

test('route.js 的 handlePost 只做驗證登入與分派，不再自帶 body.type 分支與共用的管理者結尾', async () => {
  const route = await readFile(new URL('../src/app/api/hr/route.js', import.meta.url), 'utf8');
  const start = route.indexOf('async function handlePost');
  const end = route.indexOf('async function handlePatch');
  const post = route.slice(start, end);
  assert.doesNotMatch(post, /body\.type\s*===/);
  assert.doesNotMatch(post, /principal\.role\s*!==\s*'admin'/);
  assert.match(post, /dispatchPost\(/);
});

test('_post 目錄下每個檔案都在 index.js 的分派範圍內（沒有被遺忘的檔案）', async () => {
  const files = (await readdir(dir)).filter(name => name.endsWith('.js') && name !== 'index.js').sort();
  assert.deepEqual(files, ['cases.js', 'job-orders.js', 'people.js']);
});
