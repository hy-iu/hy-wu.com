// 一次性导入调研仓库（地址见 privacy.local.json）的内容到 content/research/tn-lm/。
// 导入产物入库，之后构建/部署不再依赖网络。重新导入：npm run import:tnlm
import { execSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, loadPrivacyConfig } from './lib.ts'

const CACHE = join(ROOT, '.tnlm-cache', 'tn-lm')
const DEST = join(ROOT, 'content', 'research', 'tn-lm')
// 克隆地址在 privacy.local.json（gitignored，避免仓库地址暴露站点与账号的关联）
const REPO = loadPrivacyConfig().import['tn-lm']
if (!REPO) {
  console.error('错误：privacy.local.json 缺少 import["tn-lm"]（参考 privacy.local.example.json）')
  process.exit(1)
}

// 1. shallow clone
if (existsSync(CACHE)) rmSync(CACHE, { recursive: true, force: true })
execSync(`git clone --depth 1 ${REPO} "${CACHE}"`, { stdio: 'inherit' })

// 2. 定位仓库内文件（不假设唯一拼写）
const rootFiles = readdirSync(CACHE)
const reportFile = rootFiles.find((f) => f.endsWith('.md') && statSync(join(CACHE, f)).size > 10_000)
if (!reportFile) throw new Error('未找到调研报告 md（仓库根 >10KB 的 .md）')
const bibFile = join(CACHE, 'lit', 'bibliography.csv')
if (!existsSync(bibFile)) throw new Error('未找到 lit/bibliography.csv')

// 3. 复制内容
mkdirSync(join(DEST, 'topics'), { recursive: true })
mkdirSync(join(DEST, 'figs'), { recursive: true })
writeFileSync(join(DEST, 'report.md'), readFileSync(join(CACHE, reportFile)))
writeFileSync(join(DEST, 'bibliography.csv'), readFileSync(bibFile))

const csvDir = join(CACHE, 'lit', 'csv')
for (const f of readdirSync(csvDir)) {
  if (f.endsWith('.csv')) writeFileSync(join(DEST, 'topics', f), readFileSync(join(csvDir, f)))
}
for (const figDir of [join(CACHE, 'app', 'figs'), join(CACHE, 'lit'), join(CACHE, 'figs')]) {
  if (!existsSync(figDir)) continue
  for (const f of readdirSync(figDir)) {
    if (/\.(png|jpe?g|svg)$/i.test(f)) cpSync(join(figDir, f), join(DEST, 'figs', f))
  }
}

// 4. 子版块元数据（已存在则不覆盖，允许手工维护）
const blockMd = join(DEST, 'block.md')
if (!existsSync(blockMd)) {
  writeFileSync(blockMd, `---
name: TN × LM
blurb: 张量网络（MPS/PEPS/MERA/TTN）用于深度学习与大模型研究的课题文献调研
order: 1
library: true
figs: true
---
`)
}

// 5. 摘要输出
const bibHead = readFileSync(bibFile, 'utf8').split('\n')[0]
const bibRows = readFileSync(bibFile, 'utf8').split('\n').length - 1
const topics = readdirSync(join(DEST, 'topics'))
const figs = readdirSync(join(DEST, 'figs'))
console.log(`报告: ${reportFile}`)
console.log(`bibliography: ${bibRows} 行，表头: ${bibHead}`)
console.log(`topics: ${topics.length} 个 CSV → ${topics.slice(0, 4).join(', ')} ...`)
console.log(`figs: ${figs.length} 张图`)
