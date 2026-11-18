import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizePersonName, splitPersonName, joinPersonName } from '../src/lib/person-name.js';

const cases = [
  ['Maria Santos', 'Santos / Maria'],
  ['Maria Cruz Santos', 'Santos / Maria / Cruz'],
  ['Maria Dela Cruz Santos', 'Santos / Maria / Dela Cruz'],
  ['  Maria   Santos  ', 'Santos / Maria'],
  ['Santos/Maria', 'Santos / Maria'],
  ['Santos / Maria / Cruz', 'Santos / Maria / Cruz'],
  ['Santos /Maria/ Cruz ', 'Santos / Maria / Cruz'],
  ['Maria', 'Maria'],
  ['王小明', '王小明'],
  ['會員工作者', '會員工作者'],
  ['', ''],
  [undefined, ''],
  [null, ''],
];
for (const [input, expected] of cases) {
  test(`normalizePersonName(${JSON.stringify(input)})`, () => assert.equal(normalizePersonName(input), expected));
}

test('normalizing twice changes nothing', () => {
  for (const [input] of cases) assert.equal(normalizePersonName(normalizePersonName(input)), normalizePersonName(input));
});

test('split and join agree with the form component format', () => {
  assert.deepEqual(splitPersonName('Santos / Maria / Cruz'), { surname: 'Santos', givenName: 'Maria', middleName: 'Cruz' });
  assert.equal(joinPersonName({ surname: 'Santos', givenName: 'Maria', middleName: '' }), 'Santos / Maria');
});

// Every place that writes a worker's name must go through the shared rule.
test('worker name write paths use normalizePersonName', async () => {
  const route = await readFile(new URL('../src/app/api/hr/route.js', import.meta.url), 'utf8');
  const bot = await readFile(new URL('../src/lib/hr-line-bot.js', import.meta.url), 'utf8');
  const store = await readFile(new URL('../src/lib/hr-linked-record-store.js', import.meta.url), 'utf8');
  const people = await readFile(new URL('../src/app/api/hr/_post/people.js', import.meta.url), 'utf8');
  assert.match(route, /import \{ normalizePersonName \} from '@\/lib\/person-name'/);
  assert.match(people, /import \{ normalizePersonName \} from '@\/lib\/person-name'/);
  assert.equal((route.match(/normalizePersonName\(/g) || []).length + (people.match(/normalizePersonName\(/g) || []).length >= 7, true);
  assert.match(bot, /normalizePersonName\(values\.name\)/);
  assert.match(store, /kind === 'worker'\) normalized\.displayName = normalizePersonName/);
});
