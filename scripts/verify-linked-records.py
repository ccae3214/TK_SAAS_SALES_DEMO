"""Authorized fictional local review only: actual UI/API/PostgreSQL integration.
No remote base override, destructive deletion, schema injection, or credential output.
Fault injection wraps only the exact store's query call; PostgreSQL rollback is real.
"""
import base64
import concurrent.futures
import json
import pathlib
import subprocess
import time
import urllib.request
import urllib.error
from playwright.sync_api import sync_playwright, expect

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = 'http://localhost:8088'
ENV = dict(line.split('=', 1) for line in (ROOT / '.env.review.local').read_text().splitlines() if line and not line.startswith('#'))
PASSWORD = ENV['REVIEW_LOGIN_PASSWORD']
TOKEN = str(time.time_ns())
PSQL = ['docker', 'exec', '-i', 'tk-saas-review-postgres', 'psql', '-U', 'review', '-d', 'tk_saas_review', '-At', '-v', 'ON_ERROR_STOP=1']
assert subprocess.check_output(['docker', 'inspect', 'tk-saas-review-app', '--format', '{{ index .Config.Labels "com.docker.compose.project" }}'], text=True).strip() == 'tk-saas-local-review'
def sql(statement):
    return subprocess.check_output(PSQL + ['-c', statement], text=True).strip()
assert sql('SELECT current_database()') == 'tk_saas_review'
checks, errors = [], []
def passed(name):
    checks.append(name)
    print('PASS:', name, flush=True)
def pair(kind, ident):
    table, column = ('hr_workers', 'worker_id') if kind == 'worker' else ('hr_employers', 'employer_id')
    return json.loads(sql(f"SELECT json_build_object('name',r.name,'email',r.email,'status',r.status,'member_name',m.display_name,'member_email',m.email,'member_active',m.active,'member_id',m.id) FROM {table} r LEFT JOIN hr_members m ON m.{column}=r.id WHERE r.id={int(ident)}"))

def worker_payload(row, **change):
    return {'type': 'worker', 'id': row['id'], 'name': row['name'], 'nationality': row.get('nationality', ''), 'phone': row.get('phone', ''), 'email': row.get('email', ''), 'jobPreference': row.get('job_preference', '家庭幫傭'), 'resumeProfile': row.get('resume_profile', {'gender': 'female'}), 'agencyId': row.get('agency_id'), **change}
def employer_payload(row, **change):
    return {'type': 'employer', 'id': row['id'], 'name': row['name'], 'employerType': row['employer_type'], 'email': row['email'], 'agencyId': row['agency_id'], **change}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    def login(email):
        ctx = browser.new_context(viewport={'width': 1440, 'height': 1000})
        ctx.add_init_script("localStorage.setItem('language','zh');")
        page = ctx.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(BASE + '/hr/login')
        page.get_by_label('Email', exact=True).fill(email)
        page.get_by_label('密碼', exact=True).fill(PASSWORD)
        page.get_by_role('button', name='登入人力管理系統', exact=True).click()
        page.wait_for_url('**/hr')
        return ctx, page
    def state(ctx):
        response = ctx.request.get(BASE + '/api/hr')
        assert response.status == 200, response.status
        return response.json()
    def post(ctx, body):
        return ctx.request.post(BASE + '/api/hr', headers={'Origin': BASE}, data=body)
    def patch(ctx, body):
        return ctx.request.patch(BASE + '/api/hr', headers={'Origin': BASE}, data=body)
    admin, admin_page = login('review.admin@example.invalid')
    ph, _ = login('test.agency.ph@example.com')
    tw, _ = login('test.agency.tw@example.com')
    data = state(admin)
    ph_id = state(ph)['agencyId']
    tw_id = state(tw)['agencyId']
    assert sql("SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname='hr_sync_member_active_status')") == 't'
    assert sql("SELECT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='hr_members_sync_active_status')") == 't'
    passed('approved main initializer installed function and trigger in isolated DB')

    def create(kind, suffix, agency_id=None):
        payload = {'type': kind, 'name': 'DEMO-一致性-' + suffix + TOKEN, 'email': 'linked.' + kind + '.' + suffix + TOKEN + '@example.invalid', 'password': PASSWORD, 'agencyId': agency_id or (ph_id if kind == 'worker' else tw_id)}
        if kind == 'worker':
            payload.update(nationality='菲律賓', jobPreference='家庭幫傭', resumeProfile={'gender': 'female'})
        else:
            payload['employerType'] = 'domestic_helper'
        response = post(admin, payload)
        assert response.status == 201, (response.status, response.text())
        row = response.json()
        current = pair(kind, row['id'])
        assert current['email'] == current['member_email'] == payload['email']
        assert current['name'] == current['member_name'] == payload['name']
        return row
    worker = create('worker', 'self')
    employer = create('employer', 'self')
    assert int(sql(f"SELECT count(*) FROM hr_worker_documents WHERE worker_id={int(worker['id'])}")) == 22
    wc, worker_page = login(worker['email'])
    ec, _ = login(employer['email'])
    assert state(wc)['role'] == 'worker' and state(ec)['role'] == 'employer'
    passed('admin creates linked worker/employer logins and 22 worker documents; both real logins work')

    for kind, row, ctx, payload in [('worker', worker, wc, worker_payload), ('employer', employer, ec, employer_payload)]:
        before = pair(kind, row['id'])
        for email in ['', 'not-an-email', 'review.admin@example.invalid']:
            response = patch(ctx, payload(row, email=email))
            assert response.status == (403 if email == 'review.admin@example.invalid' else 400), (response.status, response.text())
            assert pair(kind, row['id']) == before
        passed(kind + ' own blank/invalid/reserved emails rejected without partial writes')
        response = patch(ctx, payload(row, email='  ' + row['email'].upper() + '  '))
        assert response.status == 200
        assert pair(kind, row['id'])['email'] == pair(kind, row['id'])['member_email'] == row['email']
        passed(kind + ' same login email is normalized consistently and session remains usable')

    # Agency scopes are exercised through actual authenticated HTTP requests.
    before = pair('worker', worker['id'])
    assert patch(ph, worker_payload(worker, email='')).status == 400
    assert pair('worker', worker['id']) == before
    assert patch(ph, worker_payload(worker, email=worker['email'].upper())).status == 200
    before = pair('employer', employer['id'])
    assert patch(tw, employer_payload(employer, email='')).status == 400
    assert pair('employer', employer['id']) == before
    assert patch(tw, employer_payload(employer, email=employer['email'].upper())).status == 200
    passed('Philippines worker and Taiwan employer edit routes share validation and normalized sync')

    response = post(admin, {'type': 'agency', 'name': 'DEMO-隔離菲仲' + TOKEN, 'agencyType': 'philippines'})
    assert response.status == 201
    foreign_worker = create('worker', 'foreign', response.json()['id'])
    before = pair('worker', foreign_worker['id'])
    assert patch(ph, worker_payload(foreign_worker, email='review.admin@example.invalid')).status == 404
    assert pair('worker', foreign_worker['id']) == before
    assert patch(tw, worker_payload(worker)).status == 403
    assert patch(ph, employer_payload(employer)).status == 403
    passed('cross-agency target is non-enumerating 404 and wrong agency roles remain denied')

    for kind, row, payload in [('worker', worker, worker_payload), ('employer', employer, employer_payload)]:
        before = pair(kind, row['id'])
        assert patch(admin, payload(row, email='')).status == 400
        assert pair(kind, row['id']) == before
        assert patch(admin, payload(row, name='DEMO-管理修改-' + kind + TOKEN)).status == 200
        current = pair(kind, row['id'])
        assert current['name'] == current['member_name'] == 'DEMO-管理修改-' + kind + TOKEN
    before = pair('worker', worker['id'])
    assert patch(admin, worker_payload(worker, name='')).status == 400
    assert pair('worker', worker['id']) == before
    before = pair('employer', employer['id'])
    assert patch(admin, employer_payload(employer, employerType='invalid')).status == 400
    assert pair('employer', employer['id']) == before
    passed('admin worker/employer edit routes update both records atomically; invalid name/type remains 400 without writes')

    member_id = pair('worker', worker['id'])['member_id']
    new_email = 'linked.renamed.' + TOKEN + '@example.invalid'
    response = patch(admin, {'type': 'member-profile', 'id': member_id, 'displayName': 'DEMO-會員反向修改' + TOKEN, 'email': new_email})
    assert response.status == 200, (response.status, response.text())
    current = pair('worker', worker['id'])
    assert current['name'] == current['member_name'] == 'DEMO-會員反向修改' + TOKEN
    assert current['email'] == current['member_email'] == new_email
    renamed, _ = login(new_email)
    assert state(renamed)['role'] == 'worker'
    before = pair('worker', worker['id'])
    assert patch(admin, {'type': 'member-profile', 'id': member_id, 'displayName': 'DEMO-保護測試', 'email': 'review.admin@example.invalid'}).status in (403, 409)
    assert pair('worker', worker['id']) == before
    passed('reverse member edit synchronizes record and permits real login with new address')

    assert patch(admin, {'type': 'worker', 'id': worker['id'], 'status': 'inactive'}).status == 200
    current = pair('worker', worker['id'])
    assert current['status'] == 'inactive' and current['member_active'] is False
    assert patch(admin, {'type': 'worker', 'id': worker['id'], 'status': 'active'}).status == 200
    current = pair('worker', worker['id'])
    assert current['status'] == 'active' and current['member_active'] is True
    passed('record disable/enable and main member-active trigger remain synchronized')

    # Read-only nonce/CSP acceptance uses the actual HTTP response, not a guessed policy.
    response = admin.request.get(BASE + '/hr')
    policy = response.headers.get('content-security-policy', '')
    assert "'nonce-" in policy and "'strict-dynamic'" in policy and 'blob:' in policy
    passed('latest main nonce CSP is returned while real browser role flows hydrate without pageerror')

    # The store runs against real PostgreSQL; the sole injected behavior is an exception at a named write.
    store = base64.b64encode((ROOT / 'src/lib/hr-linked-record-store.js').read_bytes()).decode()
    fault_script = """
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { Pool }=createRequire('/app/package.json')('pg');
const { updateLinkedRecord,updateLinkedMemberProfile }=await import('data:text/javascript;base64,STORE');
const url=new URL(process.env.DATABASE_URL);assert.equal(process.env.LOCAL_REVIEW_ONLY,'1');assert.equal(url.hostname,'review-postgres');assert.equal(url.pathname,'/tk_saas_review');
const pool=new Pool({connectionString:url.toString(),ssl:false});const id=WORKER_ID;
const snapshot=async()=> (await pool.query('SELECT w.name,w.email,w.updated_at,m.display_name,m.email member_email,m.updated_at member_updated,m.id member_id FROM hr_workers w JOIN hr_members m ON m.worker_id=w.id WHERE w.id=$1',[id])).rows[0];
const before=await snapshot();
function faulty(prefix){return {connect:async()=>{const c=await pool.connect();return {query:(sql,args)=>sql.startsWith(prefix)?Promise.reject(new Error('injected-write-failure')):c.query(sql,args),release:()=>c.release()};}};}
try{
 await assert.rejects(updateLinkedRecord(faulty('UPDATE hr_members'),{kind:'worker',id,fields:{name:'DEMO-fault',email:'fault@example.invalid'},update:async(c,f)=>(await c.query('UPDATE hr_workers SET name=$2,email=$3,updated_at=NOW() WHERE id=$1 RETURNING *',[id,f.name,f.email])).rows[0]}),/injected-write-failure/);
 assert.deepEqual(await snapshot(),before);
 await assert.rejects(updateLinkedMemberProfile(faulty('UPDATE hr_workers'),{id:before.member_id,fields:{displayName:'DEMO-reverse-fault',email:'reverse-fault@example.invalid'},authorize(){},update:async(c,f)=>(await c.query('UPDATE hr_members SET display_name=$2,email=$3,updated_at=NOW() WHERE id=$1 RETURNING *',[before.member_id,f.displayName,f.email])).rows[0]}),/injected-write-failure/);
 assert.deepEqual(await snapshot(),before);
 const reserved='unoccupied-reserved@example.invalid';assert.equal((await pool.query('SELECT 1 FROM hr_members WHERE email=$1',[reserved])).rowCount,0);
 await assert.rejects(updateLinkedRecord(pool,{kind:'worker',id,fields:{email:reserved},reservedEmails:[reserved],update:async()=>{throw new Error('must-not-write');}}),e=>e.status===403);
 assert.deepEqual(await snapshot(),before);
 console.log(JSON.stringify({forwardRollback:true,reverseRollback:true,reservedUnoccupiedRejected:true,scope:'real PostgreSQL; fault injected at store query boundary; no schema injection'}));
}finally{await pool.end();}
""".replace('STORE', store).replace('WORKER_ID', str(int(worker['id'])))
    result = subprocess.check_output(['docker', 'exec', '-i', 'tk-saas-review-app', 'node', '--input-type=module'], input=fault_script, text=True)
    evidence = json.loads(result)
    assert evidence['forwardRollback'] and evidence['reverseRollback'] and evidence['reservedUnoccupiedRejected']
    passed('real PostgreSQL forward/reverse injected failures roll back names/emails/timestamps; unoccupied reserved email rejected')

    race_a, race_b = create('worker', 'race-a'), create('worker', 'race-b')
    before = {str(row['id']): pair('worker', row['id']) for row in [race_a, race_b]}
    cookies = '; '.join(c['name'] + '=' + c['value'] for c in admin.cookies(BASE))
    race_email = 'linked.race.' + TOKEN + '@example.invalid'
    def concurrent_edit(row):
        request = urllib.request.Request(BASE + '/api/hr', data=json.dumps(worker_payload(row, email=race_email)).encode(), method='PATCH', headers={'Cookie': cookies, 'Origin': BASE, 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return str(row['id']), response.status
        except urllib.error.HTTPError as error:
            return str(row['id']), error.code
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(concurrent_edit, [race_a, race_b]))
    assert sorted(code for _, code in results) == [200, 409], results
    for ident, code in results:
        after = pair('worker', ident)
        assert after['email'] == after['member_email']
        assert after['email'] == (race_email if code == 200 else before[ident]['email'])
    passed('two real concurrent HTTP updates to one email yield 200/409 with no partial record writes')

    legacy = post(ph, {'type': 'worker', 'name': 'DEMO-無登入舊流程' + TOKEN, 'jobPreference': '家庭幫傭', 'resumeProfile': {'gender': 'female'}})
    assert legacy.status == 201
    legacy_worker = legacy.json()
    assert pair('worker', legacy_worker['id'])['member_id'] is None
    assert patch(ph, worker_payload(legacy_worker, email='')).status == 200
    for kind in ['worker', 'employer']:
        before_count = int(sql('SELECT count(*) FROM ' + ('hr_workers' if kind == 'worker' else 'hr_employers')))
        body = {'type': kind, 'name': 'DEMO-保留Email拒絕', 'email': 'review.admin@example.invalid', 'password': PASSWORD, 'agencyId': ph_id if kind == 'worker' else tw_id, 'jobPreference': '家庭幫傭', 'resumeProfile': {'gender': 'female'}, 'employerType': 'domestic_helper'}
        assert post(admin, body).status == 403
        assert int(sql('SELECT count(*) FROM ' + ('hr_workers' if kind == 'worker' else 'hr_employers'))) == before_count
    assert post(ph, {'type': 'worker', 'name': 'DEMO-保留Email拒絕', 'email': 'review.admin@example.invalid', 'jobPreference': '家庭幫傭', 'resumeProfile': {'gender': 'female'}}).status == 403
    assert post(admin, {'type': 'member', 'name': 'DEMO-保留Email拒絕', 'email': 'review.admin@example.invalid', 'password': PASSWORD, 'role': 'worker', 'agencyId': ph_id, 'jobPreference': '家庭幫傭', 'gender': 'female'}).status == 403
    passed('legacy unlinked empty-contact path retained; reserved email blocked for admin/agency records and paired member creation')
    line_worker = create('worker', 'line-only')
    line_member_id = pair('worker', line_worker['id'])['member_id']
    assert patch(admin, {'type': 'member-profile', 'id': line_member_id, 'displayName': line_worker['name'], 'email': '', 'lineUserId': 'DEMO-line-only-' + TOKEN}).status == 200
    current = pair('worker', line_worker['id'])
    assert current['email'] == '' and current['member_email'] is None
    assert patch(ph, worker_payload(line_worker, email='')).status == 200
    current = pair('worker', line_worker['id'])
    assert current['email'] == '' and current['member_email'] is None
    passed('existing LINE-only identity semantics permit empty contact email without restoring stale login email')

    # A separate fresh worker demonstrates the actual blank-email form and retained values.
    ui_worker = create('worker', 'ui')
    ui_ctx, page = login(ui_worker['email'])
    page.get_by_role('button', name='基本資料', exact=True).click()
    page.get_by_role('button', name='編輯履歷', exact=True).click()
    dialog = page.get_by_role('dialog', name='編輯工作者', exact=True)
    # Fixture names are single-token labels; fill the existing required surname before testing email.
    dialog.get_by_role('textbox', name='姓氏', exact=True).first.fill('DEMO')
    before_ui = pair('worker', ui_worker['id'])
    dialog.get_by_label('Email', exact=True).fill('')
    with page.expect_response(lambda response: response.url.endswith('/api/hr') and response.request.method == 'PATCH') as attempted:
        dialog.get_by_role('button', name='儲存工作者', exact=True).click()
    assert attempted.value.status == 400
    expect(dialog.get_by_text('請填寫有效的登入 Email', exact=False).first).to_be_visible()
    assert pair('worker', ui_worker['id']) == before_ui
    dialog.get_by_label('Email', exact=True).fill(ui_worker['email'].upper())
    dialog.get_by_role('button', name='儲存工作者', exact=True).click()
    expect(dialog).to_have_count(0)
    page.reload()
    page.get_by_role('button', name='基本資料', exact=True).click()
    expect(page.get_by_role('button', name='編輯履歷', exact=True)).to_be_visible()
    assert pair('worker', ui_worker['id'])['email'] == ui_worker['email']
    passed('real worker UI rejects blank email, saves normalized correction and survives reload')
    # Preserve latest-main behavior: returning to an idle tab refreshes, but an actual open editor does not.
    page.bring_to_front()
    page.wait_for_timeout(10100)
    with page.expect_response(lambda response: response.url.endswith('/api/hr') and response.request.method == 'GET') as refreshed:
        page.evaluate("window.dispatchEvent(new Event('focus'))")
    assert refreshed.value.status == 200 and refreshed.value.json()['role'] == 'worker'
    passed('latest-main focus refresh still fetches current authorized data')
    page.get_by_role('button', name='編輯履歷', exact=True).click()
    expect(page.get_by_role('dialog', name='編輯工作者', exact=True)).to_be_visible()
    page.wait_for_timeout(10100)
    observed = []
    page.on('request', lambda request: observed.append(request.url) if request.url.endswith('/api/hr') and request.method == 'GET' else None)
    page.evaluate("window.dispatchEvent(new Event('focus'))")
    page.wait_for_timeout(1000)
    assert observed == [], observed
    page.get_by_role('button', name='關閉工作者表單', exact=True).click()
    passed('latest-main auto refresh skips an actual open worker editor')
    assert errors == [], errors
    passed('all tested real browser flows have zero uncaught pageerror')
    browser.close()
print(json.dumps({'checks': len(checks), 'failed': 0, 'pageerror': len(errors), 'scope': 'isolated fictional API/UI/real PostgreSQL, not production/third-party login/iPhone'}, ensure_ascii=False))
