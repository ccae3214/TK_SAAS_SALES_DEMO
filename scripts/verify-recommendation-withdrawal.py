"""Local-only recommendation withdrawal verification; writes isolated fictional fixtures.
Run with a Python containing Playwright + Chromium. Never accepts a remote base URL.
"""
import concurrent.futures
import json
import pathlib
import subprocess
import threading
import time
import urllib.request
import urllib.error
from playwright.sync_api import sync_playwright, expect

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = 'http://localhost:8088'
ENV = dict(line.split('=', 1) for line in (ROOT / '.env.review.local').read_text().splitlines() if line and not line.startswith('#'))
assert subprocess.check_output(['docker', 'inspect', 'tk-saas-review-app', '--format', '{{ index .Config.Labels "com.docker.compose.project" }}'], text=True).strip() == 'tk-saas-local-review'
PSQL = ['docker', 'exec', '-i', 'tk-saas-review-postgres', 'psql', '-U', 'review', '-d', 'tk_saas_review', '-At', '-v', 'ON_ERROR_STOP=1']
def sql(text):
    return subprocess.check_output(PSQL + ['-c', text], text=True).strip()
assert sql('SELECT current_database()') == 'tk_saas_review'
checks = []
def passed(name):
    checks.append(name)
    print('PASS:', name)
TOKEN = str(time.time_ns())

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    contexts, pages, errors = {}, {}, []
    for role, email in [('ph', 'test.agency.ph@example.com'), ('employer', 'test.employer01@example.com'), ('tw', 'test.agency.tw@example.com'), ('worker', 'test.worker01@example.com'), ('admin', 'review.admin@example.invalid')]:
        ctx = browser.new_context(viewport={'width': 1440, 'height': 1000})
        ctx.add_init_script("localStorage.setItem('hr-language:philippines-agency','zh');localStorage.setItem('language','zh');")
        page = ctx.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(BASE + '/hr/login')
        page.get_by_label('Email', exact=True).fill(email)
        page.get_by_label('密碼', exact=True).fill(ENV['REVIEW_LOGIN_PASSWORD'])
        page.get_by_role('button', name='登入人力管理系統', exact=True).click()
        page.wait_for_url('**/hr')
        contexts[role], pages[role] = ctx, page
    def get(role):
        response = contexts[role].request.get(BASE + '/api/hr')
        assert response.status == 200
        return response.json()
    def post(role, body):
        return contexts[role].request.post(BASE + '/api/hr', headers={'Origin': BASE}, data=body)
    def patch(role, body, origin=BASE):
        return contexts[role].request.patch(BASE + '/api/hr', headers={'Origin': origin}, data=body)
    ph_id = get('ph')['agencyId']
    tw_id = get('employer')['employers'][0]['agency_id']
    def worker(suffix):
        response = post('ph', {'type': 'worker', 'name': 'DEMO-撤回驗收-' + suffix + TOKEN, 'nationality': '菲律賓', 'jobPreference': '家庭幫傭', 'resumeProfile': {'gender': 'female'}})
        assert response.status == 201
        return response.json()
    def order(suffix):
        response = post('employer', {'type': 'job-order', 'jobType': '家庭幫傭', 'headcount': 1, 'description': 'DEMO-撤回驗收-' + suffix + TOKEN, 'taiwanAgencyAssignments': [{'agencyId': tw_id}]})
        assert response.status == 201
        row = response.json()
        dispatch = next(a for a in get('admin')['orderAgencies'] if str(a['job_order_id']) == str(row['id']))
        response = post('admin', {'type': 'job-order-admin-philippines-assignment', 'orderAgencyId': dispatch['id'], 'philippinesAgencyIds': [ph_id]})
        assert response.status == 201
        route = next(a for a in get('ph')['orderRoutes'] if str(a['job_order_id']) == str(row['id']))
        return row, route
    def recommend(w, route):
        response = post('ph', {'type': 'job-order-candidate', 'routeId': route['id'], 'workerId': w['id'], 'notes': 'DEMO-原推薦說明'})
        assert response.status == 201
        return response.json()
    def candidate(id):
        return next(c for c in get('ph')['orderCandidates'] if str(c['id']) == str(id))
    def withdraw(role, id):
        return patch(role, {'type': 'job-order-candidate-withdraw', 'candidateId': id})
    def interview(id, status):
        return patch('employer', {'type': 'job-order-candidate-interview', 'candidateId': id, 'status': status})

    wrong = worker('錯選')
    test_order, route = order('畫面')
    ph = pages['ph']
    ph.reload()
    ph.get_by_role('button', name='需求與配對', exact=True).click()
    article = ph.locator('article').filter(has_text=test_order['description'])
    article.get_by_label('推薦所屬工作者', exact=False).select_option(str(wrong['id']))
    article.get_by_label('推薦說明', exact=True).fill('DEMO-原推薦說明')
    article.get_by_role('button', name='推薦給雇主面試', exact=True).click()
    expect(article.get_by_text('等待雇主安排面試或確認人選。', exact=True)).to_be_visible()
    rec = next(c for c in get('ph')['orderCandidates'] if str(c['worker_id']) == str(wrong['id']) and str(c['route_id']) == str(route['id']))
    record = article.get_by_role('group', name=f"推薦紀錄 {rec['id']}", exact=True)
    expect(record.get_by_role('button', name='撤回推薦', exact=True)).to_be_visible()
    assert rec['agency_recommendation'] is True
    passed('Philippines recommends via UI and sees withdrawal only for eligible agency candidate')
    ph.once('dialog', lambda dialog: dialog.dismiss())
    record.get_by_role('button', name='撤回推薦', exact=True).click()
    assert candidate(rec['id'])['status'] == 'proposed'
    passed('cancel confirmation preserves recommendation')
    for role in ['employer', 'tw', 'worker', 'admin']:
        assert withdraw(role, rec['id']).status == 403
    anonymous = browser.new_context()
    assert anonymous.request.patch(BASE + '/api/hr', headers={'Origin': BASE}, data={'type': 'job-order-candidate-withdraw', 'candidateId': rec['id']}).status == 401
    anonymous.close()
    assert patch('ph', {'type': 'job-order-candidate-withdraw', 'candidateId': rec['id']}, 'https://wrong-origin.invalid').status == 403
    assert withdraw('ph', 'bad-id').status == 400
    assert withdraw('ph', 922337203685477580).status == 404
    passed('wrong roles, anonymous, foreign Origin, malformed and missing IDs are rejected')
    before_worker = sql(f"SELECT row_to_json(w)::text FROM hr_workers w WHERE id={int(wrong['id'])}")
    before_documents = sql(f"SELECT coalesce(json_agg(d ORDER BY id)::text,'[]') FROM hr_worker_documents d WHERE worker_id={int(wrong['id'])}")
    ph.once('dialog', lambda dialog: dialog.accept())
    record.get_by_role('button', name='撤回推薦', exact=True).click()
    expect(record.get_by_text('已撤回推薦', exact=True)).to_be_visible()
    expect(record.get_by_role('button', name='撤回推薦', exact=True)).to_have_count(0)
    withdrawn = candidate(rec['id'])
    assert withdrawn['status'] == 'rejected' and withdrawn['case_id'] is None
    assert withdrawn['notes'].startswith('DEMO-原推薦說明') and '\n[agency-withdrawal] ' in withdrawn['notes']
    assert before_worker == sql(f"SELECT row_to_json(w)::text FROM hr_workers w WHERE id={int(wrong['id'])}")
    assert before_documents == sql(f"SELECT coalesce(json_agg(d ORDER BY id)::text,'[]') FROM hr_worker_documents d WHERE worker_id={int(wrong['id'])}")
    assert sql(f"SELECT count(*) FROM hr_cases WHERE worker_id={int(wrong['id'])}") == '0'
    passed('withdrawal via UI preserves original recommendation, actor/time history, worker and document rows')
    notes = withdrawn['notes']
    retry = withdraw('ph', rec['id'])
    assert retry.status == 200 and retry.json()['alreadyWithdrawn'] is True
    assert candidate(rec['id'])['notes'] == notes
    passed('repeated withdrawal is idempotent without duplicate history')
    assert post('ph', {'type': 'job-order-candidate', 'routeId': route['id'], 'workerId': wrong['id'], 'notes': '覆寫測試'}).status in [403, 409]
    assert candidate(rec['id'])['notes'] == notes
    for status in ['scheduled', 'passed', 'rejected']:
        assert interview(rec['id'], status).status == 409
    passed('stale recommendation edits and employer actions cannot revive withdrawn candidate')
    employer = pages['employer']
    employer.reload()
    employer.get_by_role('button', name='需求與配對', exact=True).click()
    employer_record = employer.locator('article.job-order-card').filter(has_text=test_order['description']).locator('.candidate-card').filter(has_text=wrong['name'])
    expect(employer_record.get_by_text('已撤回推薦', exact=False)).to_be_visible()
    expect(employer_record.get_by_role('button', name='安排面試', exact=True)).to_have_count(0)
    passed('employer refresh shows withdrawal history without interview or hire actions')
    ph.reload()
    ph.get_by_role('button', name='需求與配對', exact=True).click()
    article = ph.locator('article').filter(has_text=test_order['description'])
    expect(article.get_by_text('已撤回推薦', exact=True)).to_be_visible()
    expect(article.get_by_label('推薦所屬工作者', exact=False).locator(f"option[value='{wrong['id']}']")).to_have_count(0)
    ph.set_viewport_size({'width': 390, 'height': 844})
    assert ph.evaluate('document.documentElement.scrollWidth <= innerWidth')
    # Taller capture viewport lets the entire card fit below the real sticky navigation.
    # Do not hide or restyle product controls just to make the evidence look cleaner.
    ph.set_viewport_size({'width': 390, 'height': 1200})
    article.evaluate('(el) => window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - 120)')
    article.screenshot(path=str(ROOT / 'docs/review/recommendation-withdrawal.png'))
    ph.set_viewport_size({'width': 1440, 'height': 1000})
    passed('withdrawal history survives reload and fits 390px')

    next_worker = worker('改推正確人選')
    next_candidate = recommend(next_worker, route)
    assert interview(next_candidate['id'], 'scheduled').status == 200
    scheduled = candidate(next_candidate['id'])
    assert withdraw('ph', next_candidate['id']).status == 409
    assert candidate(next_candidate['id']) == scheduled
    passed('different worker can be recommended; scheduled candidate cannot be withdrawn')
    assert interview(next_candidate['id'], 'passed').status == 200
    hired = candidate(next_candidate['id'])
    assert hired['case_id']
    assert withdraw('ph', hired['id']).status == 409
    assert candidate(hired['id'])['case_id'] == hired['case_id']
    passed('hired recommendation and its case cannot be withdrawn')
    ph.reload()
    ph.get_by_role('button', name='需求與配對', exact=True).click()
    closed = ph.locator('article').filter(has=ph.get_by_role('heading', name=f"需求 #{test_order['id']} · 家庭幫傭 · 已額滿", exact=True))
    expect(closed.get_by_text('已撤回推薦', exact=True)).to_be_visible()
    expect(closed.get_by_role('button', name='撤回推薦', exact=True)).to_have_count(0)
    passed('closed order retains withdrawal history without withdrawal controls')

    selected_worker = worker('雇主選工')
    selected_order, selected_route = order('雇主選工')
    response = post('employer', {'type': 'job-order-employer-candidate', 'orderId': selected_order['id'], 'workerId': selected_worker['id']})
    assert response.status == 201
    selected = next(c for c in get('ph')['orderCandidates'] if str(c['worker_id']) == str(selected_worker['id']))
    assert selected['agency_recommendation'] is False
    assert withdraw('ph', selected['id']).status == 409
    passed('Philippines cannot withdraw an employer-selected worker')

    # Unrelated agency fixture, no new login or rights: test isolation using the original Philippines session.
    cross = sql(f"""WITH a AS (INSERT INTO hr_agencies(name,agency_type,country) VALUES('DEMO-其他菲律賓機構{TOKEN}','philippines','菲律賓') RETURNING id),
      w AS (INSERT INTO hr_workers(name,agency_id,status) SELECT 'DEMO-其他機構工人{TOKEN}',id,'active' FROM a RETURNING id,agency_id),
      r AS (INSERT INTO hr_job_order_routes(order_agency_id,philippines_agency_id) SELECT {int(selected_route['order_agency_id'])},agency_id FROM w RETURNING id)
      INSERT INTO hr_job_order_candidates(route_id,worker_id) SELECT r.id,w.id FROM r,w RETURNING id""").splitlines()[0]
    assert withdraw('ph', int(cross)).status == 404
    assert sql(f'SELECT status FROM hr_job_order_candidates WHERE id={int(cross)}') == 'proposed'
    passed('cross-agency candidate is denied by real PostgreSQL ownership checks')

    race_worker = worker('競爭')
    race_order, race_route = order('競爭')
    race_rec = recommend(race_worker, race_route)
    barrier = threading.Barrier(2)
    cookies = {role: '; '.join(c['name'] + '=' + c['value'] for c in contexts[role].cookies(BASE)) for role in ['ph', 'employer']}
    def race_request(role, body):
        req = urllib.request.Request(BASE + '/api/hr', data=json.dumps(body).encode(), method='PATCH', headers={'Content-Type':'application/json','Origin':BASE,'Cookie':cookies[role]})
        barrier.wait(timeout=10)
        try:
            with urllib.request.urlopen(req, timeout=60) as response: return response.status
        except urllib.error.HTTPError as error: return error.code
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        withdrawal = pool.submit(race_request, 'ph', {'type':'job-order-candidate-withdraw','candidateId':race_rec['id']})
        schedule = pool.submit(race_request, 'employer', {'type':'job-order-candidate-interview','candidateId':race_rec['id'],'status':'scheduled'})
        statuses = [withdrawal.result(), schedule.result()]
    assert sorted(statuses) == [200, 409], statuses
    final = candidate(race_rec['id'])
    assert final['status'] in ['scheduled', 'rejected'] and final['case_id'] is None
    assert (final['status'] == 'rejected') == ('\n[agency-withdrawal] ' in final['notes'])
    passed('concurrent scheduling versus withdrawal has exactly one winner under PostgreSQL locks')
    assert not errors, errors
    passed('no browser pageerror')
    browser.close()
print(json.dumps({'passed':len(checks),'failed':0,'checks':checks}, ensure_ascii=False))
