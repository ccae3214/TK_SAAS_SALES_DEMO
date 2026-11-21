import test from 'node:test';
import assert from 'node:assert/strict';
import { backupFileName, backupsToPrune, detectCompose, isSafeDbName, parseEnvFile, resolveDbConfig } from '../scripts/db-backup-lib.mjs';

test('parseEnvFile reads KEY=VALUE, ignores comments/blank lines and strips quotes', () => {
  const env = parseEnvFile('# comment\r\nPOSTGRES_USER=app\r\n\r\nexport POSTGRES_DB="saas_prod"\nBAD LINE\nQUOTED=\'x y\'\n');
  assert.deepEqual(env, { POSTGRES_USER: 'app', POSTGRES_DB: 'saas_prod', QUOTED: 'x y' });
});

test('resolveDbConfig: environment beats .env beats the docker-compose defaults', () => {
  assert.deepEqual(resolveDbConfig({}, ''), { user: 'postgres', db: 'saas_demo' });
  assert.deepEqual(resolveDbConfig({}, 'POSTGRES_USER=fileuser\nPOSTGRES_DB=filedb'), { user: 'fileuser', db: 'filedb' });
  assert.deepEqual(resolveDbConfig({ POSTGRES_DB: 'envdb' }, 'POSTGRES_USER=fileuser\nPOSTGRES_DB=filedb'), { user: 'fileuser', db: 'envdb' });
});

test('isSafeDbName only accepts plain lowercase names', () => {
  for (const ok of ['restore_tmp', 'a', 'restore_0501']) assert.equal(isSafeDbName(ok), true, ok);
  for (const bad of ['', 'Restore', '1abc', 'a-b', 'a b', 'a;drop', 'x'.repeat(64), null, undefined]) assert.equal(isSafeDbName(bad), false, String(bad));
});

test('backupFileName uses zero-padded local time', () => {
  assert.equal(backupFileName('saas_demo', new Date(2026, 10, 6, 3, 4, 5)), 'saas_demo_20261106-030405.dump');
});

test('backupsToPrune keeps the newest N and never touches other files', () => {
  const names = [
    'saas_demo_20261101-030000.dump', 'saas_demo_20261103-030000.dump', 'saas_demo_20261102-030000.dump',
    'saas_demo_20261104-030000.dump', 'saas_demo_20261104-030000.dump.partial', 'other_db_20250101-000000.dump', 'notes.txt', 'backup.log',
  ];
  assert.deepEqual(backupsToPrune(names, 'saas_demo', 2), ['saas_demo_20261101-030000.dump', 'saas_demo_20261102-030000.dump']);
  assert.deepEqual(backupsToPrune(names, 'saas_demo', 10), []);
  // keep is never allowed to drop below one backup.
  assert.equal(backupsToPrune(names, 'saas_demo', 0).length, 3);
  assert.equal(backupsToPrune(names, 'saas_demo', 'abc').length, 3);
});

test('detectCompose prefers `docker compose`, falls back to docker-compose, honours an override', () => {
  assert.deepEqual(detectCompose(() => true), ['docker', 'compose']);
  assert.deepEqual(detectCompose(command => command[0] === 'docker-compose'), ['docker-compose']);
  assert.equal(detectCompose(() => false), null);
  assert.deepEqual(detectCompose(() => false, 'podman compose'), ['podman', 'compose']);
});
