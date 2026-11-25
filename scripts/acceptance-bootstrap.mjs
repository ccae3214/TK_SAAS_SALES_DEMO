// Explicitly authorized, fresh acceptance database only. Refuses populated databases.
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../src/lib/passwords.js';
import { mkdir, writeFile } from 'node:fs/promises';
const u = new URL(process.env.DATABASE_URL || 'http://invalid');
if(process.env.LOCAL_REVIEW_ONLY !== '1' || u.hostname !== 'review-postgres' || u.pathname !== '/tk_saas_acceptance') throw new Error('Acceptance DB only');
const pool = new pg.Pool({connectionString:process.env.DATABASE_URL});
const count = await pool.query('SELECT count(*)::int n FROM hr_members');
const newCohort=process.argv.includes('--new-cohort');
if(count.rows[0].n&&!newCohort) throw new Error('Refusing populated member table (use --new-cohort to append new fixtures only)');
const suffix=count.rows[0].n?randomUUID().slice(0,8):'';
const hash = await hashPassword(process.env.ACCEPTANCE_LOGIN_PASSWORD);
const f = { agencies:{}, members:{}, employers:{}, workers:{} };
const client = await pool.connect();
try {
 await client.query('BEGIN');
 for(const [key,type] of [['tw','taiwan'],['twOther','taiwan'],['ph','philippines'],['phOther','philippines'],['empty','taiwan']]) {
  f.agencies[key]=(await client.query('INSERT INTO hr_agencies(name,agency_type) VALUES($1,$2) RETURNING id',[`ACCEPTANCE ${key} ${suffix}`,type])).rows[0].id;
 }
 for(const [key,agency] of [['e','tw'],['eOther','twOther']]) f.employers[key]=(await client.query("INSERT INTO hr_employers(name,email,agency_id,employer_type) VALUES($1,$2,$3,'factory') RETURNING id",[`ACCEPTANCE ${key}`,`acceptance.${key.toLowerCase()}${suffix}@example.invalid`,f.agencies[agency]])).rows[0].id;
 for(const key of ['w','w2','w3','w4','w5','wOther']) f.workers[key]=(await client.query("INSERT INTO hr_workers(name,email,agency_id,job_preference,nationality,resume_profile) VALUES($1,$2,$3,'工廠技術工','菲律賓',$4::jsonb) RETURNING id",[`ACCEPTANCE ${key}`,`acceptance.${key.toLowerCase()}${suffix}@example.invalid`,f.agencies[key==='wOther'?'phOther':'ph'],JSON.stringify({gender:'female',maritalStatus:'單身',numberOfChildren:'0',referenceNo:`ACCEPTANCE-${key}`})])).rows[0].id;
 const types={admin:[null,null,null,null],tw:['agency',null,null,'tw'],twOther:['agency',null,null,'twOther'],ph:['agency',null,null,'ph'],phOther:['agency',null,null,'phOther'],e:['employer',null,'e',null],eOther:['employer',null,'eOther',null],w:['worker','w',null,null],wOther:['worker','wOther',null,null],pending:[null,null,null,null],waiting:[null,null,null,null],empty:['agency',null,null,'empty'],tc:['training_center',null,null,null]};
 for(const [key,[role,w,e,a]] of Object.entries(types)) {
  if(key==='admin'&&count.rows[0].n){const m=(await client.query("SELECT id,email,role FROM hr_members WHERE email='acceptance.admin@example.invalid'")).rows[0];if(!m)throw new Error('Missing acceptance admin');f.members.admin=m;continue;}
  const email=`acceptance.${key.toLowerCase()}${suffix}@example.invalid`;
  const member=(await client.query('INSERT INTO hr_members(email,display_name,password_hash,role,worker_id,employer_id,agency_id,requested_role,requested_agency_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',[email,`ACCEPTANCE ${key} ${suffix}`,hash,role,w?f.workers[w]:null,e?f.employers[e]:null,a?f.agencies[a]:null,key==='waiting'?'worker':null,key==='waiting'?f.agencies.ph:null])).rows[0];
  f.members[key]={id:member.id,email,role};
 }
 for(const [tw,ph] of [['tw','ph'],['twOther','phOther']]) await client.query("INSERT INTO hr_agency_certifications(taiwan_agency_id,philippines_agency_id,status,taiwan_confirmed_at,philippines_confirmed_at,source) VALUES($1,$2,'certified',NOW(),NOW(),'admin')",[f.agencies[tw],f.agencies[ph]]);
 for(const wid of Object.values(f.workers)) { const { insertWorkerDocuments } = await import('../src/lib/hr-requirements.js'); await insertWorkerDocuments(client,wid,{gender:'female',maritalStatus:'單身',numberOfChildren:'0'},'工廠技術工'); }
 await client.query('COMMIT');
 await mkdir('test-results/acceptance',{recursive:true});
 await writeFile('test-results/acceptance/fixtures.json',JSON.stringify(f,null,2));
 console.log('Fresh fictional fixtures created: '+Object.keys(f.members).length+' members; no LINE identities');
} catch(e) {await client.query('ROLLBACK');throw e;} finally {client.release();await pool.end();}
