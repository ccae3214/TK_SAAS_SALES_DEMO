import assert from 'node:assert/strict';
import test from 'node:test';
import * as m from '../src/lib/hr-employer-profile.js';

const homeOk = { gender:'female', age:'45', livesAlone:false, familyMembers:[{relation:'mother',age:'80',gender:'female',livesTogether:true}] };
test('contact required', () => {
  assert.equal(m.employerRecordError({employerType:'factory',phone:'',address:'x',profile:{companyRegNo:'1',responsiblePerson:'a'}}), m.MESSAGES.contact);
  assert.equal(m.employerRecordError({employerType:'factory',phone:'1',address:'  ',profile:{}}), m.MESSAGES.contact);
});
test('home employer requires gender, age, family', () => {
  const base = {employerType:'home_care',phone:'0912',address:'嘉義市'};
  assert.equal(m.employerRecordError({...base,profile:{}}), m.MESSAGES.gender);
  assert.equal(m.employerRecordError({...base,profile:{gender:'male'}}), m.MESSAGES.age);
  assert.equal(m.employerRecordError({...base,profile:{gender:'male',age:'17'}}), m.MESSAGES.age);
  assert.equal(m.employerRecordError({...base,profile:{gender:'male',age:'121'}}), m.MESSAGES.age);
  assert.equal(m.employerRecordError({...base,profile:{gender:'male',age:'40'}}), m.MESSAGES.family);
  assert.equal(m.employerRecordError({...base,profile:homeOk}), '');
  assert.equal(m.employerRecordError({...base,employerType:'domestic_helper',profile:homeOk}), '');
});
test('lives alone replaces family members and drops stale rows', () => {
  const p = m.cleanEmployerProfile({gender:'male',age:'70',livesAlone:true,familyMembers:[{relation:'child',age:'3',gender:'male'}]});
  assert.deepEqual(p.familyMembers, []);
  assert.equal(m.employerRecordError({employerType:'home_care',phone:'1',address:'a',profile:{gender:'male',age:'70',livesAlone:true}}), '');
});
test('partial family row is rejected, blank row ignored', () => {
  const base = {employerType:'home_care',phone:'1',address:'a'};
  assert.equal(m.employerRecordError({...base,profile:{...homeOk,familyMembers:[{relation:'child',age:'',gender:'male'}]}}), m.MESSAGES.familyRow);
  assert.equal(m.employerRecordError({...base,profile:{...homeOk,familyMembers:[{relation:'',age:'',gender:''}, ...homeOk.familyMembers]}}), '');
  assert.equal(m.cleanEmployerProfile({familyMembers:[{relation:'',age:'',gender:''}]}).familyMembers.length, 0);
});
test('factory requires company number and responsible person; gender/age optional', () => {
  const base = {employerType:'factory',phone:'1',address:'a'};
  assert.equal(m.employerRecordError({...base,profile:{}}), m.MESSAGES.company);
  assert.equal(m.employerRecordError({...base,profile:{companyRegNo:'12345678'}}), m.MESSAGES.company);
  assert.equal(m.employerRecordError({...base,profile:{companyRegNo:'12345678',responsiblePerson:'王大明'}}), '');
});
test('other type has no extra requirements', () => {
  assert.equal(m.employerRecordError({employerType:'other',phone:'1',address:'a',profile:{}}), '');
});
test('rejects unknown keys, junk values and non-object input', () => {
  const p = m.cleanEmployerProfile({gender:'<script>',age:'abc',familyMembers:'x',dormProvided:'maybe',evil:1});
  assert.deepEqual(p, {gender:'',age:'',livesAlone:false,familyMembers:[],companyRegNo:'',factoryRegNo:'',responsiblePerson:'',workAddress:'',dormProvided:'',dormAddress:''});
  assert.deepEqual(m.cleanEmployerProfile(null), m.cleanEmployerProfile(undefined));
  assert.deepEqual(m.cleanEmployerProfile([1,2]), m.cleanEmployerProfile({}));
  assert.equal('evil' in p, false);
});
test('clean is idempotent and caps family size and text length', () => {
  const many = Array.from({length:50},()=>({relation:'child',age:'5',gender:'male'}));
  const p = m.cleanEmployerProfile({...homeOk,familyMembers:many,companyRegNo:'9'.repeat(100)});
  assert.equal(p.familyMembers.length, m.MAX_FAMILY_MEMBERS);
  assert.equal(p.companyRegNo.length, 20);
  assert.deepEqual(m.cleanEmployerProfile(p), p);
});
test('dorm address only kept when dorm provided', () => {
  assert.equal(m.cleanEmployerProfile({dormProvided:'no',dormAddress:'x'}).dormAddress, '');
  assert.equal(m.cleanEmployerProfile({dormProvided:'yes',dormAddress:'x'}).dormAddress, 'x');
});
test('numeric ages accepted as numbers too', () => {
  assert.equal(m.cleanEmployerProfile({age:45}).age, '45');
  assert.equal(m.cleanEmployerProfile({age:0}).age, '');
  assert.equal(m.cleanEmployerProfile({familyMembers:[{relation:'child',age:0,gender:'male'}]}).familyMembers[0].age, '0');
});
test('reminder labels', () => {
  assert.deepEqual(m.employerMissingLabels({employer_type:'home_care',employer_profile:{}}), ['性別','年齡','家庭成員']);
  assert.deepEqual(m.employerMissingLabels({employer_type:'home_care',employer_profile:{gender:'male',age:'50',livesAlone:true}}), []);
  assert.deepEqual(m.employerMissingLabels({employer_type:'factory',employer_profile:{}}), ['統一編號','負責人姓名']);
  assert.deepEqual(m.employerMissingLabels({employer_type:'other'}), []);
  assert.deepEqual(m.employerMissingLabels(null), []);
});
test('care recipient', () => {
  assert.equal(m.careRecipientError({relation:'mother',age:'82',gender:'female',conditions:['bedridden','dementia']}), '');
  assert.equal(m.careRecipientError({relation:'mother',age:'82',gender:'female',conditions:['healthy']}), '');
  assert.equal(m.careRecipientError({relation:'mother',age:'0',gender:'female',conditions:['healthy']}), '');
  for (const bad of [{}, {relation:'self',age:'30',gender:'male'}, {relation:'self',age:'200',gender:'male',conditions:['healthy']}, {relation:'zzz',age:'30',gender:'male',conditions:['healthy']}, {relation:'self',age:'30',gender:'male',conditions:['nope']}, null]) {
    assert.equal(m.careRecipientError(bad), m.MESSAGES.care);
  }
  assert.deepEqual(m.cleanCareRecipient({relation:'self',age:'30',gender:'male',conditions:['healthy','dementia','dementia']}).conditions, ['dementia']);
  assert.equal(m.cleanCareRecipient({diagnosis:'x'.repeat(900)}).diagnosis.length, 500);
});
test('needsCareRecipient', () => {
  assert.equal(m.needsCareRecipient('家庭看護'), true);
  assert.equal(m.needsCareRecipient('家庭幫傭'), true);
  assert.equal(m.needsCareRecipient(' 家庭看護 '), true);
  for (const t of ['機構看護工','工廠技術工','農工','', undefined]) assert.equal(m.needsCareRecipient(t), false);
});
test('monthly salary', () => {
  assert.deepEqual(m.parseMonthlySalary(''), {ok:true,value:null});
  assert.deepEqual(m.parseMonthlySalary(undefined), {ok:true,value:null});
  assert.deepEqual(m.parseMonthlySalary('29500'), {ok:true,value:29500});
  assert.deepEqual(m.parseMonthlySalary(29500), {ok:true,value:29500});
  for (const bad of ['0','-1','1.5','abc','1000001','12345678','1e5']) assert.equal(m.parseMonthlySalary(bad).ok, false, bad);
});
test('jobOrderExtrasError', () => {
  const care = {relation:'mother',age:'80',gender:'female',conditions:['dementia']};
  assert.equal(m.jobOrderExtrasError({jobType:'家庭看護',monthlySalary:'',careRecipient:care}), '');
  assert.equal(m.jobOrderExtrasError({jobType:'家庭看護',monthlySalary:'',careRecipient:{}}), m.MESSAGES.care);
  assert.equal(m.jobOrderExtrasError({jobType:'家庭幫傭',monthlySalary:'20000',careRecipient:undefined}), m.MESSAGES.care);
  assert.equal(m.jobOrderExtrasError({jobType:'工廠技術工',monthlySalary:'29500',careRecipient:undefined}), '');
  assert.equal(m.jobOrderExtrasError({jobType:'工廠技術工',monthlySalary:'abc',careRecipient:undefined}), m.MESSAGES.salary);
});
