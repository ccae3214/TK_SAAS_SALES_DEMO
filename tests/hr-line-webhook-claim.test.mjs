import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/app/api/line/webhook/route.js', import.meta.url), 'utf8');
const claimSql = source.match(/async function claimEvent[\s\S]*?RETURNING event_id/)?.[0] || '';

test('LINE webhook claim lets failed events retry', () => {
  assert.match(claimSql, /status='failed'/);
});

test('LINE webhook claim lets stale processing events retry after a crash', () => {
  assert.match(claimSql, /status='processing'\s+AND hr_line_webhook_events\.updated_at < NOW\(\) - make_interval\(mins => \$3::int\)/);
  assert.match(source, /const STALE_PROCESSING_MINUTES = 2;/);
});

test('LINE webhook reclaim refreshes updated_at so a concurrent retry cannot also claim it', () => {
  assert.match(claimSql, /last_error=NULL,updated_at=NOW\(\)/);
});
