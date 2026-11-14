import assert from 'node:assert/strict';
import test from 'node:test';
import { readJson } from '../src/lib/hr-read-json.js';

const reply = (body, status = 200) => new Response(body, { status });

test('valid JSON is parsed, empty body becomes {}', async () => {
  assert.deepEqual(await readJson(reply('{"rooms":[1]}')), { rooms: [1] });
  assert.deepEqual(await readJson(reply('')), {});
});

test('an HTML error page becomes a readable zh/en error instead of "Unexpected token <"', async () => {
  for (const status of [404, 502, 504]) {
    const error = await readJson(reply('<!DOCTYPE html><html><body>Bad Gateway</body></html>', status)).then(() => null, e => e);
    assert.ok(error, `status ${status} should throw`);
    assert.equal(error.status, status);
    assert.match(error.message, new RegExp(`HTTP ${status}`));
    assert.match(error.en, new RegExp(`HTTP ${status}`));
    assert.doesNotMatch(error.message + error.en, /Unexpected token|DOCTYPE/);
  }
});
