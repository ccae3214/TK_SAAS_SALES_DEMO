import { test, expect, request } from '@playwright/test';
import { reviewPool, fixtures } from '../support/review-fixtures.mjs';
import { ensureNotificationSchema } from '../../src/lib/hr-notifications.js';

const baseURL = 'http://localhost:8088';
const pool = reviewPool();
let fixture, admin, lineAdmin, agencyAdmin, ph, errors = [];
const contexts = [];
const notificationButton = page => page.getByRole('button', { name: /^會員申請通知，待審/ });
const panel = page => page.getByRole('region', { name: '會員申請通知', exact: true });
async function apiLogin(context, email) {
  const csrf = await (await context.get('/api/auth/csrf')).json();
  const result = await context.post('/api/auth/callback/credentials', {
    form: { email, password: process.env.REVIEW_LOGIN_PASSWORD, csrfToken: csrf.csrfToken, callbackUrl: '/hr' },
    headers: { 'X-Auth-Return-Redirect': '1' },
  });
  expect(result.ok()).toBeTruthy();
}
async function login(page, member) {
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/hr/login');
  await page.getByLabel('Email', { exact: true }).fill(member.email);
  await page.getByLabel('密碼', { exact: true }).fill(fixture.password);
  await page.getByRole('button', { name: '登入人力管理系統', exact: true }).click();
  await expect(page).toHaveURL(/\/hr$/);
  await expect(page.getByRole('heading', { name: '克雷迅人力仲介', exact: true })).toHaveCount(0);
}
async function applicantPage(browser, page, kind = 'applicant') {
  const member = await fixture.member(kind);
  const context = await browser.newContext({ baseURL, viewport: page.viewportSize() });
  contexts.push(context);
  const other = await context.newPage();
  await login(other, member);
  await expect(other.getByRole('heading', { name: '開始設定你的會員帳號' })).toBeVisible();
  return { member, page: other, context };
}
async function submitViaApi(context, role = 'worker') {
  return context.post('/api/hr/member-request', {
    headers: { Origin: baseURL }, data: { requestedRole: role, requestedAgencyId: role === 'training_center' ? null : ph.id },
  });
}
async function openRequest(page, member) {
  await page.bringToFront();
  await notificationButton(page).click();
  const button = panel(page).getByRole('button', { name: new RegExp(member.display_name) });
  await expect(button).toBeVisible();
  await button.click();
  const dialog = page.getByRole('dialog', { name: '編輯會員類型', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(member.display_name);
  return dialog;
}

test.beforeAll(async () => {
  const setup = await request.newContext({ baseURL });
  try {
    await apiLogin(setup, 'review.admin@example.invalid');
    const initialized = await setup.get('/api/hr');
    expect(initialized.status()).toBe(200);
    expect((await initialized.json()).role).toBe('admin');
  } finally { await setup.dispose(); }
  await ensureNotificationSchema(pool);
  fixture = await fixtures(pool);
  ph = (await pool.query("SELECT id FROM hr_agencies WHERE agency_type='philippines' AND active=TRUE ORDER BY id LIMIT 1")).rows[0];
  expect(ph).toBeTruthy();
  admin = await fixture.member('e2e-admin', { role: 'system_admin', adminScope: 'system' });
  lineAdmin = await fixture.member('e2e-line-admin', { role: 'system_admin', adminScope: 'system', line: `review-only-line-${fixture.suffix}` });
  agencyAdmin = await fixture.member('e2e-agency-admin', { role: 'agency', adminScope: 'agency', agencyId: ph.id });
});
test.afterAll(async () => { if (fixture) await fixture.close(); await pool.end(); });
test.beforeEach(() => { errors = []; });
test.afterEach(async () => {
  for (const context of contexts.splice(0)) await context.close();
  expect(errors, 'browser pageerror').toEqual([]);
});

test('會員 UI 送審→通知→取消不變更→核准→申請人重新確認', async ({ page, browser }, testInfo) => {
  await login(page, admin);
  await expect(notificationButton(page)).toBeVisible();
  const initial = await (await page.request.get('/api/hr/notifications')).json();
  const applicant = await applicantPage(browser, page);
  await applicant.page.getByRole('combobox', { name: /^申請類型/ }).selectOption('worker');
  await applicant.page.getByRole('combobox', { name: /^所屬菲律賓仲介/ }).selectOption(String(ph.id));
  const started = Date.now();
  const response = applicant.page.waitForResponse(r => r.url().endsWith('/api/hr/member-request') && r.request().method() === 'POST');
  await applicant.page.getByRole('button', { name: '送出審核申請' }).click();
  expect((await response).status()).toBe(201);
  await expect(applicant.page.getByRole('heading', { name: '申請已送出，等待管理者審核' })).toBeVisible();
  await page.bringToFront();
  await expect(notificationButton(page)).toHaveAccessibleName(`會員申請通知，待審 ${initial.total + 1} 筆`, { timeout: 10000 });
  const elapsedMs = Date.now() - started;
  expect(elapsedMs).toBeLessThan(10000);
  await testInfo.attach('notification-latency', { body: JSON.stringify({ elapsedMs, channel: 'foreground-site-notification', physicalLineReceiptVerified: false }), contentType: 'application/json' });
  let dialog = await openRequest(page, applicant.member);
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  let saved = (await pool.query('SELECT role,requested_role FROM hr_members WHERE id=$1', [applicant.member.id])).rows[0];
  expect(saved).toMatchObject({ role: null, requested_role: 'worker' });
  dialog = await openRequest(page, applicant.member);
  await dialog.getByRole('combobox', { name: /^會員類型/ }).selectOption('worker');
  await dialog.getByRole('combobox', { name: /^所屬菲律賓仲介/ }).selectOption(String(ph.id));
  const approval = page.waitForResponse(r => r.url().endsWith('/api/hr') && r.request().method() === 'PATCH');
  await dialog.getByRole('button', { name: '儲存', exact: true }).click();
  const approvedResponse = await approval;
  expect(approvedResponse.status()).toBe(200);
  expect(Number(approvedResponse.request().postDataJSON().id)).toBe(Number(applicant.member.id));
  await expect(dialog).toHaveCount(0);
  saved = (await pool.query('SELECT role,worker_id,requested_role FROM hr_members WHERE id=$1', [applicant.member.id])).rows[0];
  expect(saved.role).toBe('worker'); expect(saved.worker_id).toBeTruthy(); expect(saved.requested_role).toBeNull();
  await applicant.page.bringToFront();
  await applicant.page.getByRole('button', { name: '重新確認審核狀態', exact: true }).click();
  await expect(applicant.page.getByRole('heading', { name: '申請已送出，等待管理者審核' })).toHaveCount(0);
  const view = await (await applicant.page.request.get('/api/hr')).json();
  expect(view.role).toBe('worker'); expect(Number(view.workers[0].id)).toBe(Number(saved.worker_id));
  expect((await applicant.page.request.get('/api/hr/notifications')).status()).toBe(403);
  await page.bringToFront();
  await expect(notificationButton(page)).toHaveAccessibleName(`會員申請通知，待審 ${initial.total} 筆`);
});

test('同會員並行重送不重複建立 LINE 提醒', async ({ page, browser }) => {
  const applicant = await applicantPage(browser, page, 'duplicate');
  const responses = await Promise.all([submitViaApi(applicant.context.request), submitViaApi(applicant.context.request)]);
  expect(responses.map(r => r.status())).toEqual([201, 201]);
  const result = await pool.query('SELECT COUNT(*)::integer AS total FROM hr_notification_outbox WHERE subject_member_id=$1 AND recipient_member_id=$2', [applicant.member.id, lineAdmin.id]);
  expect(result.rows[0].total).toBe(1);
});

test('匿名、仲介管理者與待審會員不得讀系統通知', async ({ page, browser }) => {
  expect((await page.request.get('/api/hr/notifications')).status()).toBe(401);
  await login(page, agencyAdmin);
  expect((await page.request.get('/api/hr/notifications')).status()).toBe(403);
  await expect(page.getByTestId('member-request-notifications')).toHaveCount(0);
  const applicant = await applicantPage(browser, page, 'access');
  expect((await applicant.context.request.get('/api/hr/notifications')).status()).toBe(403);
});

test('新通知更新不覆蓋正在編輯的審核選擇', async ({ page, browser }) => {
  await login(page, admin);
  const applicant = await applicantPage(browser, page, 'draft');
  expect((await submitViaApi(applicant.context.request)).status()).toBe(201);
  await page.bringToFront();
  await expect(async () => {
    const body = await (await page.request.get('/api/hr/notifications')).json();
    expect(body.items.some(item => String(item.id) === String(applicant.member.id))).toBeTruthy();
  }).toPass();
  // Bring-to-front refresh, then wait for the actual summary request, not a fixed sleep.
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  let dialog = await openRequest(page, applicant.member);
  await dialog.getByRole('combobox', { name: /^會員類型/ }).selectOption('training_center');
  const next = await applicantPage(browser, page, 'draft-next');
  expect((await submitViaApi(next.context.request)).status()).toBe(201);
  await page.bringToFront();
  await page.waitForResponse(r => r.url().endsWith('/api/hr/notifications') && r.status() === 200);
  await expect(dialog.getByRole('combobox', { name: /^會員類型/ })).toHaveValue('training_center');
  await expect(dialog).toContainText(applicant.member.display_name);
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  expect((await pool.query('SELECT requested_role FROM hr_members WHERE id=$1', [applicant.member.id])).rows[0].requested_role).toBe('worker');
});

test('聊天室與通知網路故障不把舊提醒歸零，恢復後可更新', async ({ page }) => {
  await login(page, admin);
  const current = await (await page.request.get('/api/hr/notifications')).json();
  await expect(notificationButton(page)).toHaveAccessibleName(`會員申請通知，待審 ${current.total} 筆`);
  await page.route('**/api/hr/chat', route => route.abort());
  await page.route('**/api/hr/notifications', route => route.abort());
  await notificationButton(page).click();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(panel(page)).toContainText('更新失敗，保留上次結果。');
  await expect(notificationButton(page)).toHaveAccessibleName(`會員申請通知，待審 ${current.total} 筆`);
  await page.unroute('**/api/hr/notifications');
  await panel(page).getByRole('button', { name: '重新整理通知' }).click();
  await expect(panel(page).getByRole('button', { name: '重新整理通知' })).toHaveCount(0);
});

test('LINE 深連結定位正確申請；已處理連結不重開審核', async ({ page, browser }) => {
  const applicant = await applicantPage(browser, page, 'deep-link');
  expect((await submitViaApi(applicant.context.request, 'training_center')).status()).toBe(201);
  await login(page, admin);
  await page.goto(`/hr?memberRequest=${applicant.member.id}`);
  const dialog = page.getByRole('dialog', { name: '編輯會員類型', exact: true });
  await expect(dialog).toContainText(applicant.member.display_name);
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  const approval = await page.request.patch('/api/hr', { headers: { Origin: baseURL }, data: { type: 'member', id: Number(applicant.member.id), role: 'training_center', agencyId: null } });
  expect(approval.status()).toBe(200);
  await page.reload();
  await expect(page.getByText('此申請已處理或狀態已變更，請查看最新會員資料。')).toBeVisible();
  await expect(dialog).toHaveCount(0);
});

test('非法類型、跨來源與缺機構拒絕且不產生通知', async ({ page, browser }) => {
  const applicant = await applicantPage(browser, page, 'invalid');
  const api = applicant.context.request;
  expect((await api.post('/api/hr/member-request', { headers: { Origin: baseURL }, data: { requestedRole: 'system_admin' } })).status()).toBe(400);
  expect((await api.post('/api/hr/member-request', { headers: { Origin: 'https://example.invalid' }, data: { requestedRole: 'training_center' } })).status()).toBe(403);
  expect((await api.post('/api/hr/member-request', { headers: { Origin: baseURL }, data: { requestedRole: 'worker' } })).status()).toBe(400);
  expect((await pool.query('SELECT id FROM hr_notification_outbox WHERE subject_member_id=$1', [applicant.member.id])).rowCount).toBe(0);
  expect((await pool.query('SELECT requested_role FROM hr_members WHERE id=$1', [applicant.member.id])).rows[0].requested_role).toBeNull();
});

test('通知入口與面板在目前視窗內，保留可讀畫面證據', async ({ page }, testInfo) => {
  await login(page, admin);
  await expect(notificationButton(page)).toBeVisible();
  const language = page.getByRole('button', { name: '切換為英文', exact: true });
  if (await page.getByRole('button', { name: '開啟導覽', exact: true }).isVisible()) {
    await page.getByRole('button', { name: '開啟導覽', exact: true }).click();
    await expect(language).toBeInViewport({ ratio: 1 });
    await page.getByRole('button', { name: '關閉導覽', exact: true }).click({ position: { x: page.viewportSize().width - 5, y: 70 } });
  } else await expect(language).toBeInViewport({ ratio: 1 });
  await expect(async () => {
    const unobstructed = await notificationButton(page).evaluate(element => {
      const r = element.getBoundingClientRect();
      return [r.left + r.width / 2, r.right - 4].every(x => {
        const hit = document.elementFromPoint(x, r.top + r.height / 2);
        return hit === element || element.contains(hit);
      });
    });
    expect(unobstructed).toBeTruthy();
  }).toPass();
  await notificationButton(page).click();
  await expect(panel(page)).toBeVisible();
  for (const locator of [notificationButton(page), panel(page)]) {
    const box = await locator.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
  }
  await page.screenshot({ path: testInfo.outputPath('member-notifications.png'), fullPage: false });
});
