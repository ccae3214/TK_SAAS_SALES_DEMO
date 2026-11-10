"""Explicitly local-only browser review. Writes fictional records to the authorized review DB.
Run with a Python environment containing playwright; no production URL override is accepted.
"""
import json
import pathlib
import time
import subprocess
import hashlib
import secrets
from playwright.sync_api import sync_playwright, expect

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = 'http://localhost:8088'
ENV = dict(line.split('=', 1) for line in (ROOT / '.env.review.local').read_text().splitlines() if line and not line.startswith('#'))
OUT = ROOT / 'docs/review'
OUT.mkdir(exist_ok=True)
checks = []
errors = []
project = subprocess.check_output(['docker', 'inspect', 'tk-saas-review-app', '--format', '{{ index .Config.Labels "com.docker.compose.project" }}'], text=True).strip()
assert project == 'tk-saas-local-review', 'Refusing to test an unidentified local container'
new_member_email = 'review.browser.' + str(time.time_ns()) + '@example.invalid'
salt = secrets.token_bytes(16)
key = hashlib.scrypt(ENV['REVIEW_LOGIN_PASSWORD'].encode(), salt=salt, n=16384, r=8, p=1, dklen=64)
encoded = 'scrypt$' + salt.hex() + '$' + key.hex()
# Fictional pending account fixture only; no role/permission is granted and no existing account is reset.
fixture_sql = f"INSERT INTO hr_members(email,display_name,password_hash,role,active) VALUES('{new_member_email}','B流程新會員','{encoded}',NULL,TRUE);"
subprocess.run(['docker', 'exec', '-i', 'tk-saas-review-postgres', 'psql', '-U', 'review', '-d', 'tk_saas_review', '-v', 'ON_ERROR_STOP=1', '-At'], input=fixture_sql, text=True, check=True, capture_output=True)

def passed(name):
    checks.append(name)
    print('PASS:', name)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    contexts, pages = {}, {}
    def login(role, email):
        context = browser.new_context(viewport={'width': 1440, 'height': 1000})
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(BASE + '/hr/login')
        expect(page.get_by_text('目前使用會員帳號登入', exact=False)).to_be_visible()
        expect(page.get_by_role('button', name='使用 LINE 登入', exact=True)).to_have_count(0)
        expect(page.get_by_role('button', name='使用 Google 登入', exact=True)).to_have_count(0)
        page.get_by_label('Email', exact=True).fill(email)
        page.get_by_label('密碼', exact=True).fill(ENV['REVIEW_LOGIN_PASSWORD'])
        page.get_by_role('button', name='登入人力管理系統', exact=True).click()
        page.wait_for_url('**/hr')
        response = context.request.get(BASE + '/api/hr')
        assert response.status == 200
        assert response.json()['role'] == {'admin':'admin','taiwan':'agency','philippines':'agency','employer':'employer','worker':'worker','new':'pending'}[role]
        contexts[role], pages[role] = context, page
        passed(role + ' login and authorized API')
        return response.json()
    for role, email in [('admin', 'review.admin@example.invalid'), ('taiwan', 'test.agency.tw@example.com'), ('philippines', 'test.agency.ph@example.com'), ('employer', 'test.employer01@example.com'), ('worker', 'test.worker01@example.com'), ('new', new_member_email)]:
        login(role, email)
    passed('unconfigured external login methods hidden')

    def state(role):
        response = contexts[role].request.get(BASE + '/api/hr')
        assert response.status == 200
        return response.json()
    def tab(role, name):
        page = pages[role]
        page.get_by_role('button', name=name, exact=True).click()
        return page
    def chinese(role):
        page = pages[role]
        expect(page.get_by_role('button', name='工作起點', exact=True).or_(page.get_by_role('button', name='Start here', exact=True))).to_be_visible()
        if role == 'philippines':
            # The role effect selects English after the initial API response.
            expect(page.get_by_role('button', name='Switch to Chinese', exact=True)).to_be_visible()
        if page.get_by_role('button', name='Switch to Chinese', exact=True).count():
            page.get_by_role('button', name='Switch to Chinese', exact=True).click()
        expect(page.get_by_role('button', name='工作起點', exact=True)).to_be_visible()
    for role in ['taiwan', 'philippines', 'employer', 'worker']:
        chinese(role)
        expect(pages[role].get_by_label('工作起點', exact=True)).to_be_visible()
    passed('four member roles land on guided starting point')

    admin = tab('admin', '仲介機構')
    admin.get_by_label('仲介類型', exact=False).select_option('taiwan')
    expect(admin.get_by_role('button', name='查看機構詳情', exact=True)).to_have_count(1)
    admin.get_by_label('搜尋仲介', exact=False).fill('找不到的虛構機構')
    expect(admin.get_by_text('找不到符合條件的機構，請調整名稱或類型。')).to_be_visible()
    admin.get_by_label('搜尋仲介', exact=False).fill('克雷迅')
    admin.get_by_role('button', name='查看機構詳情', exact=True).click()
    detail = admin.get_by_label('機構詳情', exact=True)
    expect(detail.get_by_role('heading', name='機構成員與責任')).to_be_visible()
    expect(detail.get_by_role('heading', name='相關需求與案件')).to_be_visible()
    admin.evaluate('window.scrollTo(0,0)')
    admin.screenshot(path=str(OUT / 'b-agency-directory.png'), full_page=True)
    passed('agency search, type filter and relationship details')

    for role in ['taiwan', 'philippines']:
        page = tab(role, '需求與配對')
        expect(page.get_by_role('heading', name='需求追蹤與歷史')).to_be_visible()
        # Existing filled order from the previous round must remain read-only.
        for article in page.locator('article').all():
            if '已額滿' in article.inner_text():
                expect(article.get_by_role('button', name='轉交選取仲介')).to_have_count(0)
                expect(article.get_by_role('button', name='推薦給雇主面試')).to_have_count(0)
        page.set_viewport_size({'width': 390, 'height': 844})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.evaluate('window.scrollTo(0,0)')
        page.screenshot(path=str(OUT / f'b-{role}-mobile.png'), full_page=True)
        page.set_viewport_size({'width': 1440, 'height': 1000})
    passed('filled requests are read-only and matching tabs fit 390px')

    # Prepare one fictional worker through the existing Philippines API; the matching loop below is UI-driven.
    token = str(time.time_ns())
    response = contexts['philippines'].request.post(BASE + '/api/hr', headers={'Origin': BASE}, data={'type': 'worker', 'name': 'B流程虛構工人' + token, 'nationality': '菲律賓', 'jobPreference': '家庭幫傭', 'resumeProfile': {'gender': 'female'}})
    assert response.status == 201, response.text()
    worker = response.json()
    assert any(str(row['id']) == str(worker['id']) for row in state('philippines')['workers'])
    passed('fictional worker fixture created and read back')

    employer = tab('employer', '需求與配對')
    employer.get_by_label('工作類型', exact=False).select_option('家庭幫傭')
    employer.get_by_label('需求人數', exact=True).fill('1')
    employer.get_by_label('工作內容／條件', exact=True).fill('B本機流程驗收 ' + token)
    employer.get_by_role('button', name='建立需求單並送交所屬仲介', exact=True).click()
    expect(employer.get_by_text('B本機流程驗收 ' + token, exact=True)).to_be_visible()
    order = next(row for row in state('employer')['jobOrders'] if row['description'] == 'B本機流程驗收 ' + token)
    passed('employer creates and dispatches request via UI, read back')

    # Latest main removed Taiwan manual forwarding. Exercise its administrator assignment UI instead.
    ph_id = next(row['id'] for row in state('employer')['agencies'] if row['agency_type'] == 'philippines')
    pages['admin'].reload()
    admin = tab('admin', '媒合需求單')
    card = admin.locator('tr').filter(has_text='B本機流程驗收 ' + token)
    card.get_by_role('checkbox', name='克雷迅菲律賓仲介測試帳號', exact=True).check()
    card.get_by_role('button', name='儲存菲律賓仲介指派', exact=True).click()
    assert any(str(row['job_order_id']) == str(order['id']) for row in state('taiwan')['orderRoutes'])
    passed('latest-main administrator assigns Philippines via UI, Taiwan route read back')

    ph = pages['philippines']
    ph.reload()
    ph = tab('philippines', '需求與配對')
    article = ph.locator('article').filter(has_text='B本機流程驗收 ' + token)
    article.get_by_label('推薦所屬工作者', exact=False).select_option(str(worker['id']))
    article.get_by_role('button', name='推薦給雇主面試', exact=True).click()
    expect(article.get_by_text('等待雇主安排面試或確認人選。', exact=True)).to_be_visible()
    candidate = next(row for row in state('employer')['orderCandidates'] if str(row['job_order_id']) == str(order['id']))
    passed('Philippines agency recommends via UI, read back')

    employer.reload()
    employer = tab('employer', '需求與配對')
    article = employer.locator('article.job-order-card').filter(has_text='B本機流程驗收 ' + token)
    employer.on('dialog', lambda dialog: dialog.accept())
    article.get_by_role('button', name='安排面試', exact=True).click()
    expect(article.get_by_text('雇主確認面試結果；錄用後會建立正式案件。', exact=True)).to_be_visible()
    assert next(row for row in state('employer')['orderCandidates'] if str(row['id']) == str(candidate['id']))['status'] == 'scheduled'
    passed('employer confirms interview via UI, read back')
    article.get_by_role('button', name='錄用', exact=True).click()
    expect(article.get_by_text('已額滿', exact=True)).to_be_visible()
    expect(article.get_by_role('button', name='錄用', exact=True)).to_have_count(0)
    final = state('employer')
    hired = next(row for row in final['orderCandidates'] if str(row['id']) == str(candidate['id']))
    assert hired['status'] == 'passed' and hired['case_id']
    assert any(str(row['id']) == str(hired['case_id']) for row in final['cases'])
    employer.evaluate('window.scrollTo(0,0)')
    employer.screenshot(path=str(OUT / 'b-employer-matching.png'), full_page=True)
    passed('employer hires via UI, case read back and terminal actions absent')
    for role in ['taiwan', 'philippines']:
        pages[role].reload()
        page = tab(role, '需求與配對')
        terminal = page.locator('article').filter(has=page.get_by_role('heading', name=f"需求 #{order['id']} · 家庭幫傭 · 已額滿", exact=True))
        expect(terminal).to_have_count(1)
        expect(terminal.get_by_role('button', name='轉交選取仲介', exact=True)).to_have_count(0)
        expect(terminal.get_by_role('button', name='推薦給雇主面試', exact=True)).to_have_count(0)
    passed('both agency UIs stop actions after hiring')

    # Preserve latest-main employer direct selection in addition to administrator -> Philippines recommendation.
    response = contexts['philippines'].request.post(BASE + '/api/hr', headers={'Origin': BASE}, data={'type': 'worker', 'name': 'B直接選工虛構工作者' + token, 'nationality': '菲律賓', 'jobPreference': '家庭幫傭', 'resumeProfile': {'gender': 'female'}})
    assert response.status == 201
    direct_worker = response.json()
    assert any(str(row['id']) == str(direct_worker['id']) for row in state('philippines')['workers'])
    employer.reload()
    employer = tab('employer', '需求與配對')
    employer.get_by_label('工作類型', exact=False).select_option('家庭幫傭')
    employer.get_by_label('需求人數', exact=True).fill('1')
    employer.get_by_label('工作內容／條件', exact=True).fill('B直接選工驗收 ' + token)
    employer.get_by_role('button', name='建立需求單並送交所屬仲介', exact=True).click()
    expect(employer.get_by_text('B直接選工驗收 ' + token, exact=True)).to_be_visible()
    direct_order = next(row for row in state('employer')['jobOrders'] if row['description'] == 'B直接選工驗收 ' + token)
    direct_article = employer.locator('article.job-order-card').filter(has_text='B直接選工驗收 ' + token)
    direct_article.locator('.candidate-card').filter(has_text='B直接選工虛構工作者' + token).get_by_role('button', name='挑選工作者', exact=True).click()
    expect(direct_article.get_by_text('等待雇主安排面試或確認人選。', exact=True)).to_be_visible()
    direct_candidate = next(row for row in state('employer')['orderCandidates'] if str(row['job_order_id']) == str(direct_order['id']))
    assert str(direct_candidate['worker_id']) == str(direct_worker['id'])
    assert any(str(row['job_order_id']) == str(direct_order['id']) for row in state('taiwan')['orderRoutes'])
    assert any(str(row['job_order_id']) == str(direct_order['id']) for row in state('philippines')['orderRoutes'])
    passed('latest-main employer direct worker selection via UI, both agency routes read back')
    direct_article.get_by_role('button', name='安排面試', exact=True).click()
    expect(direct_article.get_by_text('雇主確認面試結果；錄用後會建立正式案件。', exact=True)).to_be_visible()
    assert next(row for row in state('employer')['orderCandidates'] if str(row['id']) == str(direct_candidate['id']))['status'] == 'scheduled'
    direct_article.get_by_role('button', name='錄用', exact=True).click()
    expect(direct_article.get_by_text('已額滿', exact=True)).to_be_visible()
    direct_hired = next(row for row in state('employer')['orderCandidates'] if str(row['id']) == str(direct_candidate['id']))
    assert direct_hired['status'] == 'passed' and direct_hired['case_id']
    assert any(str(row['id']) == str(direct_hired['case_id']) for row in state('employer')['cases'])
    expect(direct_article.get_by_role('button', name='挑選工作者', exact=True)).to_have_count(0)
    passed('latest-main direct selection interview and hiring via UI, case and filled state read back')

    pages['admin'].reload()
    admin = tab('admin', '媒合需求單')
    closed = admin.locator('tr').filter(has_text='B直接選工驗收 ' + token)
    expect(closed.get_by_role('button', name='儲存菲律賓仲介指派', exact=True)).to_have_count(0)
    passed('filled requests disable administrator desktop matching controls')
    worker_state = state('worker')
    assert worker_state['requirements'] and all(row.get('worker_id') for row in worker_state['requirements'])
    worker_page = tab('worker', '必要文件')
    worker_page.get_by_role('button', name='B 備齊個人文件', exact=False).click()
    expect(worker_page.get_by_text('新護照', exact=True)).to_be_visible()
    passed('latest-main worker-owned document data and worker document UI preserved')

    new = pages['new']
    d = state('new')
    if not d.get('requestedRole'):
        expect(new.get_by_role('heading', name='開始設定你的會員帳號')).to_be_visible()
        new.set_viewport_size({'width': 390, 'height': 844})
        assert new.evaluate('document.documentElement.scrollWidth <= innerWidth')
        new.evaluate('window.scrollTo(0,0)')
        new.screenshot(path=str(OUT / 'b-new-member-choose.png'), full_page=True)
        new.get_by_label('申請類型', exact=False).select_option('employer')
        new.get_by_label('所屬台灣仲介', exact=False).select_option(str(state('employer')['employers'][0]['agency_id']))
        new.get_by_role('button', name='送出審核申請', exact=True).click()
        expect(new.get_by_role('heading', name='申請已送出，等待管理者審核')).to_be_visible()
        assert state('new')['requestedRole'] == 'employer'
        passed('new member selects role and submits via UI, read back')
    else:
        passed('existing membership request preserved (fresh submission not repeated)')
    new.reload()
    expect(new.get_by_role('heading', name='申請已送出，等待管理者審核')).to_be_visible()
    new.get_by_role('button', name='重新確認審核狀態', exact=True).click()
    expect(new.get_by_role('button', name='送出審核申請', exact=True)).to_have_count(0)
    new.evaluate('window.scrollTo(0,0)')
    new.screenshot(path=str(OUT / 'b-new-member-waiting.png'), full_page=True)
    passed('pending membership survives reload and status refresh')
    # Leave a reusable unconsumed fixture and an assigned open request for human review.
    manual_name = 'DEMO-手動推薦測試工人-A'
    ph_data = state('philippines')
    manual = next((w for w in ph_data['workers'] if w['name'] == manual_name and w['status'] == 'active' and not any(str(c['worker_id']) == str(w['id']) for c in ph_data['cases'])), None)
    if manual is None:
        response = contexts['philippines'].request.post(BASE + '/api/hr', headers={'Origin': BASE}, data={'type': 'worker', 'name': manual_name, 'nationality': '菲律賓', 'jobPreference': '家庭幫傭', 'resumeProfile': {'gender': 'female'}})
        assert response.status == 201
        manual = response.json()
    employer_data = state('employer')
    manual_order = next((o for o in employer_data['jobOrders'] if o['description'] == 'DEMO-手動推薦驗收' and o['status'] == 'open'), None)
    if manual_order is None:
        response = contexts['employer'].request.post(BASE + '/api/hr', headers={'Origin': BASE}, data={'type': 'job-order', 'jobType': '家庭幫傭', 'headcount': 1, 'description': 'DEMO-手動推薦驗收', 'taiwanAgencyAssignments': [{'agencyId': employer_data['employers'][0]['agency_id']}]})
        assert response.status == 201
        manual_order = response.json()
    employer_data = state('employer')
    manual_dispatch = next(a for a in employer_data['orderAgencies'] if str(a['job_order_id']) == str(manual_order['id']))
    existing_routes = [r['philippines_agency_id'] for r in employer_data['orderRoutes'] if str(r['order_agency_id']) == str(manual_dispatch['id'])]
    response = contexts['admin'].request.post(BASE + '/api/hr', headers={'Origin': BASE}, data={'type': 'job-order-admin-philippines-assignment', 'orderAgencyId': manual_dispatch['id'], 'philippinesAgencyIds': list({str(x) for x in existing_routes + [ph_data['agencyId']]})})
    assert response.status == 201
    ph = pages['philippines']
    ph.reload()
    ph = tab('philippines', '需求與配對')
    manual_article = ph.locator('article').filter(has_text='DEMO-手動推薦驗收')
    manual_select = manual_article.get_by_label('推薦所屬工作者', exact=False)
    expect(manual_select.locator(f"option[value='{manual['id']}']")).to_have_count(1)
    manual_select.select_option(str(manual['id']))
    expect(manual_article.get_by_role('button', name='推薦給雇主面試', exact=True)).to_be_enabled()
    assert not any(str(c['worker_id']) == str(manual['id']) for c in state('philippines')['cases'])
    print(json.dumps({'manual_worker_id': manual['id'], 'manual_order_id': manual_order['id'], 'manual_candidate_submitted': False}, ensure_ascii=False))
    passed('manual recommendation worker and assigned request left usable, not submitted or hired')
    assert not errors, errors
    passed('no browser pageerror across tested contexts')
    browser.close()
print(json.dumps({'passed': len(checks), 'failed': 0, 'checks': checks}, ensure_ascii=False))
