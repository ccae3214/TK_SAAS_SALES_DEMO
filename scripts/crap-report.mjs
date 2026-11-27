#!/usr/bin/env node
// CRAP 報告：CRAP(m) = comp(m)^2 * (1 - cov(m))^3 + comp(m)
//   comp：ESLint complexity 規則的循環複雜度
//   cov ：函式自身行（扣掉內層函式）的行覆蓋率，來自 node --test 的 lcov
//
// 用法：
//   node scripts/crap-report.mjs            # 跑測試產生覆蓋率，再算 CRAP
//   node scripts/crap-report.mjs --no-test  # 沿用 coverage/lcov.info
//   node scripts/crap-report.mjs --max 20   # 門檻（預設 20），有超過就 exit 1
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Linter } from 'eslint'
import { builtinRules } from 'eslint/use-at-your-own-risk'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const maxIdx = args.indexOf('--max')
const MAX = maxIdx >= 0 ? Number(args[maxIdx + 1]) : 20
const outDir = path.join(root, 'coverage')
const lcovPath = path.join(outDir, 'lcov.info')

function testFiles() {
  const tests = readdirSync(path.join(root, 'tests'))
    .filter((f) => f.endsWith('.test.mjs'))
    .map((f) => path.join('tests', f))
  return [...tests, path.join('scripts', 'test-hr-requirements.mjs')]
}

function runCoverage() {
  mkdirSync(outDir, { recursive: true })
  const r = spawnSync(process.execPath, [
    // 讓 import '@/…' 的模組也能在測試中載入（見 tests/support/alias-hooks.mjs）
    '--import', pathToFileURL(path.join(root, 'tests', 'support', 'register-alias.mjs')).href,
    '--test',
    '--experimental-test-coverage',
    '--test-coverage-include=src/**',
    '--test-reporter=dot', '--test-reporter-destination=stdout',
    '--test-reporter=lcov', `--test-reporter-destination=${lcovPath}`,
    ...testFiles(),
  ], { cwd: root, stdio: 'inherit' })
  if (r.status !== 0) console.warn(`\n[crap] 測試有失敗（exit ${r.status}），仍以現有覆蓋率計算。\n`)
}

function parseLcov(text) {
  const files = new Map()
  let cur = null
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('SF:')) {
      cur = new Map()
      files.set(path.resolve(root, line.slice(3)), cur)
    } else if (line.startsWith('DA:') && cur) {
      const [ln, hits] = line.slice(3).split(',').map(Number)
      cur.set(ln, (cur.get(ln) || 0) + hits)
    }
  }
  return files
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(m?js|jsx)$/.test(name)) out.push(p)
  }
  return out
}

// 包一層 ESLint 內建 complexity 規則：它回報的位置只有函式「開頭」，
// 這裡攔截 report，改記錄整個函式節點的起訖行，覆蓋率才會算整個函式本體。
const complexityRule = builtinRules.get('complexity')
let collected = []
const crapPlugin = {
  rules: {
    complexity: {
      meta: complexityRule.meta,
      create(context) {
        const proxy = Object.create(context, {
          report: {
            value(descriptor) {
              const { node, data } = descriptor
              collected.push({
                name: data?.name?.match(/'([^']+)'/)?.[1] || '(anonymous)',
                comp: Number(data?.complexity),
                start: node.loc.start.line,
                end: node.loc.end.line,
              })
            },
          },
        })
        return complexityRule.create(proxy)
      },
    },
  },
}

const linter = new Linter({ configType: 'flat' })
const lintConfig = [{
  files: ['**/*.{js,jsx,mjs}'],
  plugins: { crap: crapPlugin },
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  rules: { 'crap/complexity': ['error', { max: 0 }] },
}]

function functionsOf(file) {
  collected = []
  const code = readFileSync(file, 'utf8')
  for (const m of linter.verify(code, lintConfig, { filename: file })) {
    if (m.fatal) console.warn(`[crap] 無法解析 ${path.relative(root, file)}: ${m.message}`)
  }
  return collected
}

if (!args.includes('--no-test')) runCoverage()
if (!existsSync(lcovPath)) {
  console.error(`[crap] 找不到 ${lcovPath}`)
  process.exit(2)
}
const coverage = parseLcov(readFileSync(lcovPath, 'utf8'))

const rows = []
for (const file of walk(path.join(root, 'src'))) {
  const fns = functionsOf(file)
  const da = coverage.get(file)
  for (const fn of fns) {
    // 扣掉內層函式的行，避免外層函式吃到內層覆蓋率
    const inner = fns.filter((o) => o !== fn && o.start >= fn.start && o.end <= fn.end
      && !(o.start === fn.start && o.end === fn.end))
    let total = 0
    let hit = 0
    for (let ln = fn.start; ln <= fn.end; ln++) {
      if (inner.some((o) => ln > o.start && ln <= o.end)) continue
      if (!da || !da.has(ln)) continue
      total++
      if (da.get(ln) > 0) hit++
    }
    const cov = da ? (total ? hit / total : 1) : 0
    const crap = fn.comp ** 2 * (1 - cov) ** 3 + fn.comp
    rows.push({ file: path.relative(root, file).replaceAll('\\', '/'), ...fn, cov, crap, loaded: Boolean(da) })
  }
}

rows.sort((a, b) => b.crap - a.crap)
const bad = rows.filter((r) => r.crap >= MAX)
const fmt = (n) => n.toFixed(1)

const byFile = new Map()
for (const r of bad) {
  const e = byFile.get(r.file) || { file: r.file, count: 0, worst: 0, sum: 0, loaded: r.loaded }
  e.count++; e.worst = Math.max(e.worst, r.crap); e.sum += r.crap
  byFile.set(r.file, e)
}
const files = [...byFile.values()].sort((a, b) => b.count - a.count || b.worst - a.worst)

const comp10 = rows.filter((r) => r.comp >= MAX).length
const md = [
  `# CRAP 報告（門檻 < ${MAX}）`,
  '',
  `- 函式總數：${rows.length}`,
  `- CRAP ≥ ${MAX}：**${bad.length}**（${fmt(bad.length / rows.length * 100)}%）`,
  `- 其中複雜度本身 ≥ ${MAX}（必須拆函式）：${comp10}`,
  `- 沒有任何測試載入的檔案：${new Set(rows.filter((r) => !r.loaded).map((r) => r.file)).size}`,
  '',
  '## 依檔案',
  '',
  '| 檔案 | 超標函式數 | 最高 CRAP | 有測試載入 |',
  '|---|---:|---:|:---:|',
  ...files.map((f) => `| ${f.file} | ${f.count} | ${fmt(f.worst)} | ${f.loaded ? '✓' : '✗'} |`),
  '',
  '## 全部超標函式',
  '',
  '| CRAP | 複雜度 | 覆蓋率 | 函式 | 位置 |',
  '|---:|---:|---:|---|---|',
  ...bad.map((r) => `| ${fmt(r.crap)} | ${r.comp} | ${fmt(r.cov * 100)}% | ${r.name} | ${r.file}:${r.start} |`),
  '',
].join('\n')

mkdirSync(outDir, { recursive: true })
writeFileSync(path.join(outDir, 'crap-report.md'), md)
writeFileSync(path.join(outDir, 'crap-report.json'), JSON.stringify(rows, null, 2))

console.log(`\n[crap] 函式 ${rows.length} 個，CRAP ≥ ${MAX}：${bad.length} 個（複雜度 ≥ ${MAX}：${comp10}）`)
console.log('[crap] 前 15 名：')
for (const r of bad.slice(0, 15)) {
  console.log(`  ${fmt(r.crap).padStart(8)}  comp=${String(r.comp).padStart(3)}  cov=${fmt(r.cov * 100).padStart(5)}%  ${r.name}  ${r.file}:${r.start}`)
}
console.log(`[crap] 完整報告：coverage/crap-report.md`)
process.exit(bad.length ? 1 : 0)
