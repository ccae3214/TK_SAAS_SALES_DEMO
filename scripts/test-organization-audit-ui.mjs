// Isolated component browser test. Mocked HTTP responses, NOT authenticated app/DB E2E.
// Run in the Playwright image with locked node_modules; TMPDIR must be an external writable scratch directory.
import { createRequire } from 'node:module';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!process.env.TMPDIR) throw new Error('Set TMPDIR to an external scratch directory');
const dir = await mkdtemp(path.join(process.env.TMPDIR, 'organization-audit-ui-'));
const webpack = require('next/dist/compiled/webpack/webpack'); webpack.init();
const babelPath = require.resolve('next/dist/compiled/babel/core');
const presetPath = require.resolve('next/babel');
await writeFile(path.join(dir, 'loader.cjs'), `module.exports=function(source){return require(${JSON.stringify(babelPath)}).transformSync(source,{filename:this.resourcePath,babelrc:false,configFile:false,presets:[[${JSON.stringify(presetPath)},{'preset-react':{runtime:'automatic'}}]]}).code;};`);
await writeFile(path.join(dir, 'language.js'), 'export const useLanguage=()=>({lang:window.testLanguage || "zh"});');
await writeFile(path.join(dir, 'css.cjs'), 'module.exports=function(){return "export default {}";};');
await writeFile(path.join(dir, 'entry.jsx'), `import React from 'react';import {createRoot} from 'react-dom/client';import Component from ${JSON.stringify(path.join(root, 'src/components/HrOrganizationAuditLog.jsx'))};createRoot(document.getElementById('root')).render(<Component/>);`);
await new Promise((resolve, reject) => webpack.webpack({
  mode: 'development', entry: path.join(dir, 'entry.jsx'), output: { path: dir, filename: 'bundle.js' },
  resolve: { modules: [path.join(root, 'node_modules'), 'node_modules'], alias: { '@/context/LanguageContext$': path.join(dir, 'language.js'), '@': path.join(root, 'src'), '@babel/runtime': path.join(root, 'node_modules/next/dist/compiled/@babel/runtime') }, extensions: ['.js', '.jsx'] },
  module: { rules: [{ test: /\.jsx$/, use: path.join(dir, 'loader.cjs') }, { test: /\.css$/, use: path.join(dir, 'css.cjs') }] },
}, (error, stats) => error || stats.hasErrors() ? reject(error || new Error(stats.toString({ all: false, errors: true }))) : resolve()));
const bundle = await readFile(path.join(dir, 'bundle.js'), 'utf8');
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
let passed = 0;
try {
  for (const width of [1280, 390]) for (const language of ['zh', 'en']) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    let fail = false;
    const requests = [];
    await page.route('http://audit.test/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' });
      requests.push(url);
      if (fail) return route.fulfill({ status: 500, json: { error: 'test failure' } });
      const training = url.searchParams.get('kind') === 'training';
      const before = url.searchParams.get('before');
      const q = url.searchParams.get('q');
      return route.fulfill({ json: { rows: q === 'empty' ? [] : [{ id: before ? '99' : '100', organization_name: training ? 'DEMO center' : 'DEMO agency', actor_name: 'DEMO actor', actor_kind: 'training_center', action: 'create', target_type: 'course', target_name: 'DEMO course', summary: training ? '新增課程' : '新增工作者', summary_en: 'Added worker', created_at: '2026-01-01T00:00:00Z' }], nextBefore: before || q ? null : '100' } });
    });
    await page.goto('http://audit.test/');
    await page.evaluate(lang => { window.testLanguage = lang; }, language);
    await page.addScriptTag({ content: bundle });
    await expect(page.getByRole('cell', { name: 'DEMO agency', exact: true })).toBeVisible();
    await page.getByRole('button', { name: language === 'zh' ? '載入更早的紀錄' : 'Load earlier entries' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(2);
    if (!requests.some(url => url.searchParams.get('before') === '100')) throw new Error('missing cursor request');
    passed++;
    await page.getByRole('combobox').selectOption('training');
    await expect(page.getByRole('cell', { name: 'DEMO center', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'DEMO agency', exact: true })).toHaveCount(0);
    if (language === 'en') await expect(page.getByRole('cell', { name: /added course/ })).toBeVisible();
    passed++;
    await page.getByRole('textbox').fill('empty');
    await page.getByRole('button', { name: language === 'zh' ? '搜尋／重新整理' : 'Search / refresh' }).click();
    await expect(page.getByText(language === 'zh' ? '沒有符合條件的操作紀錄。' : 'No matching activity.', { exact: true })).toBeVisible();
    passed++;
    fail = true;
    await page.getByRole('button', { name: language === 'zh' ? '搜尋／重新整理' : 'Search / refresh' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    passed++;
    fail = false;
    await page.getByRole('textbox').fill('');
    await page.getByRole('button', { name: language === 'zh' ? '搜尋／重新整理' : 'Search / refresh' }).click();
    await expect(page.getByRole('cell', { name: 'DEMO center', exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    if (errors.length) throw new Error(errors.join('\n'));
    passed++;
    await page.close();
    console.log(`PASS ${width}px ${language}: pagination, source switch, empty, failure, recovery; pageerror=0`);
  }
  console.log(`${passed} passed, 0 failed; mocked component browser checks, not database E2E`);
} finally { await browser.close(); }
