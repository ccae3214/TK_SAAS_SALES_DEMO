import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const baseURL='http://localhost:8092';
assert.equal(process.env.ACCEPTANCE_BASE_URL,baseURL);
const {members}=JSON.parse(await readFile('test-results/acceptance/fixtures.json'));
let count=0;
for(const engine of [chromium,webkit]){
 const browser=await engine.launch();
 try {
 for(const role of ['e','ph','w','tc']){
 const ctx=await browser.newContext({baseURL,isMobile:true,hasTouch:true,viewport:{width:390,height:844}});
 try {
 const csrf=await (await ctx.request.get('/api/auth/csrf')).json();
 await ctx.request.post('/api/auth/callback/credentials',{form:{email:members[role].email,password:process.env.ACCEPTANCE_LOGIN_PASSWORD,csrfToken:csrf.csrfToken,callbackUrl:'/'}});
 const roleCheck=await ctx.request.get('/api/hr');assert.equal(roleCheck.status(),200);
 assert.equal((await roleCheck.json()).role,{e:'employer',ph:'agency',w:'worker',tc:'training_center'}[role]);
 const p=await ctx.newPage();await p.goto('/',{waitUntil:'domcontentloaded'});

 const nav=p.locator('.hr-member-shell:not(.hr-embedded) nav.workspace-tabs');await expect(nav).toBeVisible();
 for(const [width,height,lang] of [[320,568,'zh-Hant'],[360,640,'en'],[390,844,'fil'],[430,932,'fil'],[667,375,'en']]){
 await p.setViewportSize({width,height});await p.locator('button[data-tour=language]').click();await p.locator(`[role=menuitemradio][lang=${lang}]`).click();await expect(p.locator('html')).toHaveAttribute('lang',lang);
 await expect.poll(()=>nav.evaluate(n=>{const r=n.getBoundingClientRect(),s=n.closest('.hr-member-shell');return Math.abs(r.bottom-innerHeight)<=1 && r.left>=-1 && r.right<=innerWidth+1 && document.documentElement.scrollWidth<=innerWidth+1 && parseFloat(getComputedStyle(s).paddingBottom)>=r.height && [...n.querySelectorAll('button')].every(b=>b.offsetHeight>=44&&b.scrollWidth<=b.clientWidth+1&&b.scrollHeight<=b.clientHeight+1);})).toBe(true);
 const last=nav.locator('button').last();await last.focus();await expect.poll(()=>last.evaluate(b=>{const r=b.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1;})).toBe(true);
 count++;console.log(engine.name(),role,width,height,lang,'PASS');
 }
 }finally{await ctx.close();}
 }
 }finally{await browser.close();}
}
console.log('Mobile layout scenarios passed:',count);
