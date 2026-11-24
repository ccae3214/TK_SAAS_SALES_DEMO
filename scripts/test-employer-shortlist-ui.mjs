// Real React component + its real CSS and current portal CSS. Network/auth/DB are controlled fixtures, not full app E2E.
import { createRequire } from 'node:module';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'node:http';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!process.env.TMPDIR) throw new Error('Set TMPDIR to external writable scratch');
const dir = await mkdtemp(path.join(process.env.TMPDIR, 'employer-shortlist-ui-'));
const webpack = require('next/dist/compiled/webpack/webpack'); webpack.init();
const babel = require.resolve('next/dist/compiled/babel/core'), preset = require.resolve('next/babel');
await writeFile(path.join(dir,'jsx.cjs'), `module.exports=function(source){return require(${JSON.stringify(babel)}).transformSync(source,{filename:this.resourcePath,babelrc:false,configFile:false,presets:[[${JSON.stringify(preset)},{'preset-react':{runtime:'automatic'}}]]}).code;};`);
// Deterministic class renaming while preserving every rule; no CSS stub.
await writeFile(path.join(dir,'css.cjs'), `module.exports=function(source){const names={};const css=source.replace(/\\.([a-zA-Z_][\\w-]*)/g,(_,name)=>{names[name]='sw_'+name;return '.sw_'+name;});return 'const style=document.createElement("style");style.textContent='+JSON.stringify(css)+';document.head.append(style);export default '+JSON.stringify(names);};`);
await writeFile(path.join(dir,'language.js'), 'export const useLanguage=()=>({lang:window.testLanguage || "zh"});');
await writeFile(path.join(dir,'entry.jsx'), `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import Shortlist from ${JSON.stringify(path.join(root,'src/components/HrEmployerShortlist.jsx'))};
const initial=[1,2,3].map(id=>({id,name:'DEMO Worker '+id,agency_id:7,nationality:'Philippines',job_preference:'家庭看護',resume_profile:{languageOptions:'English、Tagalog',employmentExperiences:[{workplace:'DEMO Care Center',period:'2022–2025',title:'Caregiver',content:'Assisted with meals and daily care.'}]}}));
function App(){const [workers,setWorkers]=useState(initial);const [orderId,setOrderId]=useState(10);window.removeWorker=id=>setWorkers(rows=>rows.filter(w=>w.id!==id));window.restoreWorkers=()=>setWorkers(initial);return <><button id="switch-order" onClick={()=>setOrderId(id=>id===10?20:10)}>Switch request</button><main className="hr-member-shell"><article className="job-order-card"><Shortlist key={orderId} order={{id:orderId,job_type:'家庭看護'}} workers={workers} agencies={[{id:7,name:'DEMO Agency'}]} onProfile={worker=>{window.profileId=worker.id;if(window.previewMode)window.alert('UI 測試：履歷按鈕已觸發。完整履歷視窗需在有授權的登入測試站驗證。');}} onDownload={worker=>{window.pdfId=worker.id;if(window.previewMode)window.alert('UI 測試：PDF 按鈕已觸發。此頁不產生真實履歷 PDF。');}} onConfirm={async worker=>{const response=await fetch('/api/hr'+(window.previewFail?'?fail=1':''),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'job-order-employer-candidate',orderId,workerId:worker.id})});const payload=await response.json();if(!response.ok)return null;setWorkers(rows=>rows.filter(w=>w.id!==worker.id));return payload;}}/></article></main></>;}
createRoot(document.getElementById('root')).render(<App/>);`);
await new Promise((resolve,reject)=>webpack.webpack({mode:'development',entry:path.join(dir,'entry.jsx'),output:{path:dir,filename:'bundle.js'},resolve:{modules:[path.join(root,'node_modules'),'node_modules'],alias:{'@/context/LanguageContext$':path.join(dir,'language.js'),'@':path.join(root,'src'),'@babel/runtime':path.join(root,'node_modules/next/dist/compiled/@babel/runtime')},extensions:['.js','.jsx']},module:{rules:[{test:/\.jsx$/,use:path.join(dir,'jsx.cjs')},{test:/\.css$/,use:path.join(dir,'css.cjs')}]}},(error,stats)=>error||stats.hasErrors()?reject(error||new Error(stats.toString({all:false,errors:true}))):resolve()));
const bundle=await readFile(path.join(dir,'bundle.js'),'utf8');
const portal=await readFile(path.join(root,'src/components/HrMemberPortal.jsx'),'utf8');
const portalCss=portal.match(/export function PortalStyles\(\)\s*\{\s*return <style jsx global>\{`([\s\S]*?)`\}<\/style>/)?.[1];
if(!portalCss || portalCss.includes('${')) throw new Error('Portal CSS extraction changed; review harness instead of silently omitting styles');
if (process.argv.includes('--preview')) {
 const port=Number(process.env.SHORTLIST_PREVIEW_PORT || 8091);
 const bind=process.env.SHORTLIST_PREVIEW_BIND || '127.0.0.1';
 if(!Number.isInteger(port)||port<1024||port>65535||!['127.0.0.1','0.0.0.0'].includes(bind)) throw new Error('Invalid local preview address');
 const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  if(req.method==='GET'&&url.pathname==='/'){
   const language=url.searchParams.get('lang')==='en'?'en':'zh';
   res.setHeader('Content-Type','text/html; charset=utf-8');
   res.end('<!doctype html><html lang="'+(language==='en'?'en':'zh-Hant')+'"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>雇主選工 UI 測試｜虛構資料</title><style>body{margin:0;font-family:Arial,"Noto Sans TC",sans-serif}main{max-width:1000px;margin:auto}.preview-toolbar{padding:16px;background:#fff8dd;color:#342a0c;border-bottom:2px solid #8a6c19;font-size:16px;line-height:1.7}.preview-toolbar a,.preview-toolbar label{display:inline-flex;align-items:center;min-height:44px;margin-right:16px}.preview-toolbar input{width:20px;height:20px;margin-right:8px}'+portalCss+'</style></head><body><aside class="preview-toolbar" aria-label="測試站說明"><strong>UI 測試站：只有虛構資料，不連資料庫或 LINE，不會真的推薦、安排面試或錄用。</strong><br>這裡可測試滑動、復原、初選、送出提示及錯誤恢復；履歷／PDF 僅驗證按鈕入口。重整可還原人選。<br><a href="/?lang=zh">繁體中文／重設</a><a href="/?lang=en">English / Reset</a><label><input id="simulate-failure" type="checkbox">模擬確認失敗（保留待確認人選）</label></aside><div id="root"></div><script>window.testLanguage='+JSON.stringify(language)+';window.previewMode=true;document.getElementById("simulate-failure").addEventListener("change",event=>{window.previewFail=event.target.checked;});</script><script src="/bundle.js"></script></body></html>');return;
  }
  if(req.method==='GET'&&url.pathname==='/bundle.js'){res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(bundle);return;}
  if(req.method==='GET'&&/^\/api\/hr\/workers\/[123]\/resume-photo$/.test(url.pathname)){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({photoDataUrl:''}));return;}
  if(req.method==='POST'&&url.pathname==='/api/hr'){
   try{
    let text='';for await(const chunk of req){text+=chunk;if(text.length>4096){res.writeHead(413);res.end();return;}}
    const body=JSON.parse(text);
    if(body.type!=='job-order-employer-candidate'||![10,20].includes(body.orderId)||![1,2,3].includes(body.workerId)){res.writeHead(400);res.end();return;}
    await new Promise(resolve=>setTimeout(resolve,250));
    const failed=url.searchParams.get('fail')==='1';res.writeHead(failed?409:200,{'Content-Type':'application/json'});res.end(JSON.stringify(failed?{error:'Controlled preview failure'}:{ok:true,previewOnly:true}));return;
   }catch{res.writeHead(400);res.end();return;}
  }
  res.writeHead(404);res.end('Not found');
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,bind,resolve);});
 console.log(`UI preview listening on ${bind}:${port}; FICTIONAL DATA ONLY; no database or provider access`);
 await new Promise(resolve=>{process.once('SIGTERM',()=>server.close(resolve));process.once('SIGINT',()=>server.close(resolve));});
} else {
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
let checks=0;
try {
for(const [width,height,language,reduced] of [[375,812,'zh',false],[390,844,'en',false],[844,390,'zh',true],[1280,900,'en',false]]) {
 const context=await browser.newContext({viewport:{width,height},hasTouch:true,reducedMotion:reduced?'reduce':'no-preference'});
 const page=await context.newPage(); const errors=[];page.on('pageerror',error=>errors.push(error.message));
 let fail=false,delay=false;const sent=[];
 await page.route('http://shortlist.test/**',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;font-family:Arial,"Noto Sans TC",sans-serif}main{max-width:1000px;margin:auto}'+portalCss+'</style><div id="root"></div>'});
   if(request.method()==='POST'){sent.push(request.postDataJSON());if(delay)await new Promise(resolve=>setTimeout(resolve,250));return route.fulfill({status:fail?409:200,json:fail?{error:'fixture stale'}:{ok:true}});}
   return route.fulfill({json:{photoDataUrl:''}});
 });
 await page.goto('http://shortlist.test/');await page.evaluate(lang=>{window.testLanguage=lang;},language);await page.addScriptTag({content:bundle});
 const en=language==='en',label=en?'Choose candidates for this request':'為這張需求挑選人選';
 const region=page.getByRole('region',{name:label,exact:true});
 const selected=region.getByRole('region',{name:en?'Shortlist to confirm':'待確認人選',exact:true});
 const current=()=>region.locator('article[tabindex="0"]');
 await expect(current()).toHaveAccessibleName('DEMO Worker 1');
 await expect(region.getByText('DEMO Care Center / 2022–2025 / Caregiver / Assisted with meals and daily care.',{exact:true})).toBeVisible();
 await region.getByRole('button',{name:en?'View full resume':'查看完整履歷',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.profileId)).toBe(1);
 await region.getByRole('button',{name:en?'Download resume PDF':'下載履歷 PDF',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.pdfId)).toBe(1);checks++;
 // True pointer drag to the right; no write until explicit confirmation.
 await current().locator('h6').scrollIntoViewIfNeeded();
 let box=await current().boundingBox(), dragY=Math.max(30,Math.min(height-80,box.y+60));await page.mouse.move(box.x+box.width/2,dragY);await page.mouse.down();await page.mouse.move(box.x+box.width/2+100,dragY,{steps:8});await page.mouse.up();
 await expect(selected.getByText('DEMO Worker 1',{exact:true})).toBeVisible();if(sent.length)throw new Error('swipe wrote business data');checks++;
 await region.getByRole('button',{name:en?'Undo last choice':'復原上一筆',exact:true}).click();await expect(current()).toHaveAccessibleName('DEMO Worker 1');await expect(selected.locator('strong')).toHaveCount(0);checks++;
 // Vertical movement must not select or skip.
 box=await current().boundingBox();await page.mouse.move(box.x+box.width/2,box.y+50);await page.mouse.down();await page.mouse.move(box.x+box.width/2+10,box.y+150,{steps:8});await page.mouse.up();await expect(current()).toHaveAccessibleName('DEMO Worker 1');checks++;
 // Keyboard alternative to swipe.
 await current().focus();await page.keyboard.press('ArrowLeft');await expect(current()).toHaveAccessibleName('DEMO Worker 2');
 await current().focus();await page.keyboard.press('ArrowRight');await expect(selected.getByText('DEMO Worker 2',{exact:true})).toBeVisible();if(sent.length)throw new Error('keyboard initial selection wrote business data');checks++;
 // List/card switch retains local selection.
 await region.getByRole('button',{name:en?'List view':'清單瀏覽',exact:true}).click();await expect(selected.getByText('DEMO Worker 2',{exact:true})).toBeVisible();
 await region.getByRole('button',{name:en?'Card view':'卡片瀏覽',exact:true}).click();await expect(current()).toHaveAccessibleName('DEMO Worker 3');checks++;
 fail=true;await selected.getByRole('button',{name:en?'Confirm selection':'確認挑選',exact:true}).click();await expect(region.getByRole('alert')).toBeVisible();await expect(selected.getByText('DEMO Worker 2',{exact:true})).toBeVisible();
 if(sent.length!==1||sent[0].workerId!==2||sent[0].orderId!==10||sent[0].type!=='job-order-employer-candidate')throw new Error('wrong existing API contract');checks++;
 fail=false;delay=true;await selected.getByRole('button',{name:en?'Confirm selection':'確認挑選',exact:true}).dblclick();await expect(selected.locator('strong')).toHaveCount(0);await expect(region.getByRole('alert')).toHaveCount(0);if(sent.length!==2)throw new Error('duplicate submission');checks++;
 // Stale availability prunes selected workers; drafts never move to another request.
 await current().focus();await page.keyboard.press('ArrowRight');await expect(selected.getByText('DEMO Worker 3',{exact:true})).toBeVisible();
 await page.evaluate(()=>window.removeWorker(3));await expect(selected.locator('strong')).toHaveCount(0);checks++;
 await page.evaluate(()=>window.restoreWorkers());await expect(current()).toBeVisible();await current().focus();await page.keyboard.press('ArrowRight');await expect(selected.locator('strong')).toHaveCount(1);
 await page.locator('#switch-order').click();await expect(selected.locator('strong')).toHaveCount(0);await expect(current()).toHaveAccessibleName('DEMO Worker 1');checks++;
 // Chromium touch events exercise the actual pan-y gesture path, not only mouse pointer emulation.
 await current().locator('h6').scrollIntoViewIfNeeded();box=await current().boundingBox();
 const touchY=Math.max(30,Math.min(height-80,box.y+60)),touchX=box.x+box.width/2;
 const cdp=await context.newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:touchX,y:touchY}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touchX-100,y:touchY}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect(current()).toHaveAccessibleName('DEMO Worker 2');await expect(selected.locator('strong')).toHaveCount(0);checks++;
 await region.getByRole('button',{name:en?'Undo last choice':'復原上一筆',exact:true}).click();
 await current().locator('h6').scrollIntoViewIfNeeded();box=await current().boundingBox();
 const rightY=Math.max(30,Math.min(height-80,box.y+60));
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:rightY}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+box.width/2+100,y:rightY}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect(selected.getByText('DEMO Worker 1',{exact:true})).toBeVisible();if(sent.length!==2)throw new Error('touch initial selection wrote data');checks++;
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);if(overflow)throw new Error(`horizontal overflow ${width}`);
 const controls=await region.getByRole('button').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().height>0).map(n=>({label:n.textContent,height:n.getBoundingClientRect().height,width:n.getBoundingClientRect().width})));if(controls.some(n=>n.height<44||n.width<44))throw new Error('undersized target '+JSON.stringify(controls));
 if(errors.length)throw new Error(errors.join('\n'));checks++;
 await region.screenshot({path:path.join(dir,`${width}-${language}.png`)});
 console.log(`PASS ${width}x${height} ${language} reduced=${reduced}: 13 checks; pageerror=0`);await context.close();
}
console.log(`${checks} passed, 0 failed; actual component/CSS + controlled API, NOT authenticated database E2E`);console.log('screenshots='+dir);
}finally{await browser.close();}
}
