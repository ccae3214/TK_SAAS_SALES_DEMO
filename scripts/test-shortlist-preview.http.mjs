// Actual HTTP/browser smoke of the local preview server. Preview data is fictional; this is NOT HR database E2E.
import { chromium, expect } from '@playwright/test';
import { mkdtemp } from 'node:fs/promises';
import path from 'node:path';
const base=process.env.SHORTLIST_PREVIEW_URL||'http://127.0.0.1:8091';
const url=new URL(base);
if(!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('Only a local UI preview may be tested');
if(!process.env.TMPDIR)throw new Error('Set TMPDIR to external scratch');
const dir=await mkdtemp(path.join(process.env.TMPDIR,'shortlist-preview-http-'));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
let checks=0;
try{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});const page=await context.newPage();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const writes=[];page.on('request',request=>{if(request.method()==='POST')writes.push(request.postDataJSON());});
 const response=await page.goto(base);if(response.status()!==200)throw new Error('preview unavailable');
 await expect(page.getByText(/UI 測試站：只有虛構資料/)).toBeVisible();
 const region=page.getByRole('region',{name:'為這張需求挑選人選',exact:true});
 const selected=region.getByRole('region',{name:'待確認人選',exact:true});
 const current=()=>region.locator('article[tabindex="0"]');
 await expect(current()).toHaveAccessibleName('DEMO Worker 1');checks++;
 await current().focus();await page.keyboard.press('ArrowRight');await expect(selected.getByText('DEMO Worker 1',{exact:true})).toBeVisible();if(writes.length)throw new Error('initial choice submitted');checks++;
 await page.getByLabel('模擬確認失敗（保留待確認人選）').check();
 let result=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/hr');
 await selected.getByRole('button',{name:'確認挑選',exact:true}).click();if((await result).status()!==409)throw new Error('failure not simulated');
 await expect(region.getByRole('alert')).toBeVisible();await expect(selected.getByText('DEMO Worker 1',{exact:true})).toBeVisible();checks++;
 await page.getByLabel('模擬確認失敗（保留待確認人選）').uncheck();
 result=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/hr');
 await selected.getByRole('button',{name:'確認挑選',exact:true}).dblclick();
 const success=await result;if(success.status()!==200||(await success.json()).previewOnly!==true)throw new Error('success not marked preview-only');
 await expect(selected.locator('strong')).toHaveCount(0);if(writes.length!==2)throw new Error('duplicate HTTP write');checks++;
 await page.reload();await expect(current()).toHaveAccessibleName('DEMO Worker 1');await expect(selected.locator('strong')).toHaveCount(0);checks++;
 await current().focus();await page.keyboard.press('ArrowRight');await page.locator('#switch-order').click();await expect(selected.locator('strong')).toHaveCount(0);await expect(current()).toHaveAccessibleName('DEMO Worker 1');checks++;
 let dialogText='';page.once('dialog',async dialog=>{dialogText=dialog.message();await dialog.dismiss();});await region.getByRole('button',{name:'查看完整履歷',exact:true}).click();await expect.poll(()=>dialogText).toContain('UI 測試');checks++;
 dialogText='';page.once('dialog',async dialog=>{dialogText=dialog.message();await dialog.dismiss();});await region.getByRole('button',{name:'下載履歷 PDF',exact:true}).click();await expect.poll(()=>dialogText).toContain('不產生真實履歷 PDF');checks++;
 await page.getByRole('link',{name:'English / Reset',exact:true}).click();
 await expect(page.getByRole('region',{name:'Choose candidates for this request',exact:true})).toBeVisible();checks++;
 if(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth))throw new Error('horizontal overflow');
 await page.screenshot({path:path.join(dir,'preview-mobile-en.png'),fullPage:true});checks++;
 const request=page.request;
 for(const route of ['/.env','/api/auth/session','/api/line/webhook']){const r=await request.get(base+route);if(r.status()!==404)throw new Error('unexpected route '+route);}
 if(response.headers()['cache-control']!=='no-store')throw new Error('preview caching enabled');checks++;
 const invalid=await request.post(base+'/api/hr',{data:{type:'worker-delete',workerId:1}});if(invalid.status()!==400)throw new Error('unexpected mutation accepted');checks++;
 const large=await request.post(base+'/api/hr',{data:'x'.repeat(5000)});if(large.status()!==413)throw new Error('oversized fixture request accepted');checks++;
 if(errors.length)throw new Error(errors.join('\n'));
 console.log(`${checks} passed, 0 failed; actual local preview HTTP/browser; no HR auth or database claims`);
 console.log('screenshots='+dir);await context.close();
}finally{await browser.close();}
