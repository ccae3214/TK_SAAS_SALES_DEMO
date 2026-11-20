// 人員與會員：仲介新增工作者、管理者新增仲介／會員／雇主／工作者。
// 每個 handler 自己宣告 allow（哪些角色能用）；沒有任何 handler 符合時由 index.js 回 403／400。
import pool, { query } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getAdminEmails, isHrRootAdminSession, HR_MEMBER_ROLES } from '@/lib/hr-access';
import { hashPassword } from '@/lib/passwords';
import { insertWorkerDocuments } from '@/lib/hr-requirements';
import { syncLineRichMenu } from '@/lib/hr-line-bot';
import { normalizeRecordEmail } from '@/lib/hr-linked-record-store';
import { normalizePersonName } from '@/lib/person-name';
import { EMPLOYER_TYPES, clean, WORKER_JOB_PREFERENCES, cleanWorkerResumeProfile, workerGenderCode, workerProfileWithReference, validId, employerProfileFromBody } from '../_shared';

const MEMBER_EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

export const createAgencyWorker = {
  types: ["worker"],
  allow: principal => principal.role === 'agency' && principal.agency_type === 'philippines',
  async run({ principal, session, body, actor }) {
    const name = normalizePersonName(clean(body.name,160));
    if (!name) return NextResponse.json({ error: '請填寫工作者姓名。' }, { status: 400 });
    const email = normalizeRecordEmail(clean(body.email,254), { reservedEmails: getAdminEmails() });
    const workerProfile=cleanWorkerResumeProfile(body.resumeProfile),jobPreference=clean(body.jobPreference,120);
    if(!WORKER_JOB_PREFERENCES.has(jobPreference)||!workerGenderCode(workerProfile.gender))return NextResponse.json({error:'請選擇工作意向與性別，才能建立工作者編號。'},{status:400});
    const created = await query(`INSERT INTO hr_workers(name,nationality,phone,email,job_preference,notes,resume_profile,agency_id)
      VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8) RETURNING *`, [name,clean(body.nationality,80),clean(body.phone,50),email,jobPreference,clean(body.notes,2000),JSON.stringify(workerProfile),principal.agency_id]);
    const profile=workerProfileWithReference(workerProfile,jobPreference,created[0].id);
    const saved=await query('UPDATE hr_workers SET resume_profile=$2::jsonb WHERE id=$1 RETURNING *',[created[0].id,JSON.stringify(profile)]);
    await insertWorkerDocuments(pool,created[0].id,profile);
    return NextResponse.json(saved[0], { status: 201 });
  },
};

export const createAgency = {
  types: ["agency"],
  allow: principal => principal.role === 'admin',
  async run({ principal, session, body, actor }) {
    const name = clean(body.name, 160), agencyType = clean(body.agencyType, 30);
    if (!name || !['taiwan','philippines'].includes(agencyType)) return NextResponse.json({ error: '請填寫仲介名稱並選擇台灣或菲律賓仲介。' }, { status: 400 });
    const country = clean(body.country,80) || (agencyType === 'taiwan' ? '台灣' : '菲律賓');
    const result = await query('INSERT INTO hr_agencies(name,agency_type,country) VALUES($1,$2,$3) RETURNING *', [name,agencyType,country]);
    return NextResponse.json(result[0], { status: 201 });
  },
};

export const createMember = {
  types: ["member"],
  allow: principal => principal.role === 'admin',
  async run({ principal, session, body, actor }) {
    const email = clean(body.email,254).toLowerCase(), role = clean(body.role,20);
    const name = role === 'worker' ? normalizePersonName(clean(body.name,160)) : clean(body.name,160);
    const lineUserId = clean(body.lineUserId,100) || null;
    const password = typeof body.password === 'string' ? body.password : '';
    const agencyId = Number(body.agencyId);
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || !HR_MEMBER_ROLES.has(role)) return NextResponse.json({ error: '會員姓名、Email 與類型皆須正確填寫。' }, { status: 400 });
    if (role === 'system_admin' && !isHrRootAdminSession(session)) return NextResponse.json({ error: '只有 ENV 綁定的 LINE 最高管理者可以新增系統管理者。' }, { status: 403 });
    if (password.length < 10) return NextResponse.json({ error: '測試登入密碼至少需要 10 個字元。' }, { status: 400 });
    if (role === 'worker' || role === 'employer') {
      normalizeRecordEmail(email, { reservedEmails: getAdminEmails(), allowEmpty: false });
      const agencyType = role === 'worker' ? 'philippines' : 'taiwan';
      if (!validId(agencyId)) return NextResponse.json({ error: role === 'worker' ? '請選擇所屬菲律賓仲介。' : '請選擇所屬台灣仲介。' }, { status: 400 });
      const agency = await query('SELECT id FROM hr_agencies WHERE id=$1 AND active=TRUE AND agency_type=$2', [agencyId,agencyType]);
      if (!agency.length) return NextResponse.json({ error: '所屬仲介不存在、類型不符或已停用。' }, { status: 400 });
    }
    if (role === 'agency' && !validId(body.targetId)) return NextResponse.json({ error: '請選擇所屬仲介機構。' }, { status: 400 });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let workerId = null, employerId = null, memberAgencyId = null;
      if (role === 'worker') {
        const jobPreference = clean(body.jobPreference,120), gender = clean(body.gender,20);
        if (!WORKER_JOB_PREFERENCES.has(jobPreference) || !workerGenderCode(gender)) {
          await client.query('ROLLBACK');
          return NextResponse.json({ error: '請選擇工作意向與性別。' }, { status: 400 });
        }
        const profile = cleanWorkerResumeProfile({ gender });
        const created = await client.query(`INSERT INTO hr_workers(name,nationality,email,job_preference,resume_profile,agency_id)
          VALUES($1,$2,$3,$4,$5::jsonb,$6) RETURNING id`,
        [name,clean(body.nationality,80)||'菲律賓',email,jobPreference,JSON.stringify(profile),agencyId]);
        workerId = created.rows[0].id;
        const resumeProfile = workerProfileWithReference(profile,jobPreference,workerId);
        await client.query('UPDATE hr_workers SET resume_profile=$2::jsonb WHERE id=$1', [workerId,JSON.stringify(resumeProfile)]);
        await insertWorkerDocuments(client,workerId,resumeProfile);
      } else if (role === 'employer') {
        const employerType = ['home_care','factory','domestic_helper','nursing_home','other'].includes(body.employerType) ? body.employerType : '';
        if (!employerType) {
          await client.query('ROLLBACK');
          return NextResponse.json({ error: '請選擇雇主類型。' }, { status: 400 });
        }
        const created = await client.query(`INSERT INTO hr_employers(name,contact_name,email,employer_type,agency_id)
          VALUES($1,$1,$2,$3,$4) RETURNING id`, [name,email,employerType,agencyId]);
        employerId = created.rows[0].id;
      } else if (role === 'agency') {
        const agency = await client.query('SELECT id FROM hr_agencies WHERE id=$1 AND active=TRUE', [Number(body.targetId)]);
        if (!agency.rowCount) {
          await client.query('ROLLBACK');
          return NextResponse.json({ error: '所屬仲介不存在或已停用。' }, { status: 400 });
        }
        memberAgencyId = Number(body.targetId);
      }
      const createdMember = await client.query(`INSERT INTO hr_members(email,line_user_id,display_name,password_hash,role,worker_id,employer_id,agency_id,admin_scope)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,email,display_name,role,worker_id,employer_id,agency_id,admin_scope,active,created_at`,
      [email,lineUserId,name,await hashPassword(password),role,workerId,employerId,memberAgencyId,role === 'system_admin' ? 'system' : 'none']);
      await client.query('COMMIT');
      if (role === 'system_admin' && lineUserId) {
        syncLineRichMenu(lineUserId, { role: 'admin' })
          .catch(error => console.error('hr_member_rich_menu_sync_failed', String(error?.message || error).slice(0, 120)));
      }
      return NextResponse.json(createdMember.rows[0], { status: 201 });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
};

export const createEmployerOrWorker = {
  types: ["employer", "worker"],
  allow: principal => principal.role === 'admin',
  async run({ principal, session, body, actor }) {
    const isEmployer = body.type === 'employer';
    const name = isEmployer ? clean(body.name, 160) : normalizePersonName(clean(body.name, 160));
    if (!name) return NextResponse.json({ error: isEmployer ? '請填寫雇主或客戶名稱。' : '請填寫工作者姓名。' }, { status: 400 });
    const email = normalizeRecordEmail(clean(body.email, 254), { reservedEmails: getAdminEmails(), allowEmpty: false });
    const password = typeof body.password === 'string' ? body.password : '';
    if (!MEMBER_EMAIL_PATTERN.test(email)) return NextResponse.json({ error: '請填寫有效的登入 Email，系統會同時建立會員帳號。' }, { status: 400 });
    if (password.length < 10) return NextResponse.json({ error: '初始密碼至少需要 10 個字元。' }, { status: 400 });
    const agencyId = body.agencyId && validId(body.agencyId) ? Number(body.agencyId) : null;
    if (isEmployer && !EMPLOYER_TYPES.has(body.employerType)) return NextResponse.json({ error: '請選擇有效的雇主類型。' }, { status: 400 });
    let employerExtra = { profile: null };
    if (isEmployer) {
      employerExtra = employerProfileFromBody(body);
      if (employerExtra.error) return NextResponse.json({ error: employerExtra.error }, { status: 400 });
    }
    let workerProfile = null, jobPreference = '';
    if (!isEmployer) {
      workerProfile = cleanWorkerResumeProfile(body.resumeProfile);
      jobPreference = clean(body.jobPreference, 120);
      if (!WORKER_JOB_PREFERENCES.has(jobPreference) || !workerGenderCode(workerProfile.gender)) return NextResponse.json({ error: '請選擇工作意向與性別，才能建立工作者編號。' }, { status: 400 });
    }
    if ((await query('SELECT id FROM hr_members WHERE lower(email)=lower($1) LIMIT 1', [email])).length) {
      return NextResponse.json({ error: '這個 Email 已屬於另一個會員，請改用不同的 Email。' }, { status: 409 });
    }
    const passwordHash = await hashPassword(password);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let record;
      if (isEmployer) {
        record = (await client.query(`INSERT INTO hr_employers(name,contact_name,phone,email,address,notes,employer_type,agency_id,employer_profile)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9::jsonb,'{}'::jsonb)) RETURNING *`, [name, clean(body.contactName,120), clean(body.phone,50), email, clean(body.address,300), clean(body.notes,2000), body.employerType, agencyId, employerExtra.profile])).rows[0];
      } else {
        const created = (await client.query(`INSERT INTO hr_workers(name,nationality,phone,email,job_preference,notes,resume_profile,agency_id)
          VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8) RETURNING *`, [name, clean(body.nationality,80), clean(body.phone,50), email, jobPreference, clean(body.notes,2000), JSON.stringify(workerProfile), agencyId])).rows[0];
        const profile = workerProfileWithReference(workerProfile, jobPreference, created.id);
        record = (await client.query('UPDATE hr_workers SET resume_profile=$2::jsonb WHERE id=$1 RETURNING *', [created.id, JSON.stringify(profile)])).rows[0];
        await insertWorkerDocuments(client, created.id, profile);
      }
      await client.query(`INSERT INTO hr_members(email,display_name,password_hash,role,worker_id,employer_id,admin_scope)
        VALUES($1,$2,$3,$4,$5,$6,'none')`, [email, name, passwordHash, isEmployer ? 'employer' : 'worker', isEmployer ? null : record.id, isEmployer ? record.id : null]);
      await client.query('COMMIT');
      return NextResponse.json(record, { status: 201 });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  },
};
