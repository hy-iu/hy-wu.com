// 把 content/ 下的静态资源（各调研子版块的 figs/）拷进 dist/。
// vite 只打包 HTML 入口引用的资源；文献图集和报告内嵌图是纯静态文件，需要单独搬运。
// 运行：node scripts/copy-static.ts（npm run build 中段）
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './lib.ts'

const researchDir = join(ROOT, 'content', 'research')
let copied = 0
if (existsSync(researchDir)) {
  for (const block of readdirSync(researchDir)) {
    const figs = join(researchDir, block, 'figs')
    if (!existsSync(figs) || !statSync(figs).isDirectory()) continue
    const dest = join(ROOT, 'dist', 'research', block, 'figs')
    mkdirSync(dest, { recursive: true })
    cpSync(figs, dest, { recursive: true })
    copied += readdirSync(dest).length
  }
}
console.log(`static: ${copied} 个文件已拷入 dist/（调研图集）`)
