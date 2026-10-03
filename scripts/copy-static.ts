// 把 content/ 下的静态资源（各调研子版块的 figs/）拷进 dist/。
// vite 只打包 HTML 入口引用的资源；文献图集和报告内嵌图是纯静态文件，需要单独搬运。
// 运行：node scripts/copy-static.ts（npm run build 中段）
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './lib.ts'

const researchDir = join(ROOT, 'content', 'research')
const projectsDocsDir = join(ROOT, 'content', 'projects', 'docs')
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
// 项目页文档区截图：content/projects/docs/<slug>/img → dist/projects/img/<slug>
if (existsSync(projectsDocsDir)) {
  for (const slug of readdirSync(projectsDocsDir)) {
    const img = join(projectsDocsDir, slug, 'img')
    if (!existsSync(img) || !statSync(img).isDirectory()) continue
    const dest = join(ROOT, 'dist', 'projects', 'img', slug)
    mkdirSync(dest, { recursive: true })
    cpSync(img, dest, { recursive: true })
    copied += readdirSync(dest).length
  }
}
// 博客文章配图：content/posts/img/<slug>/ → dist/blog/img/<slug>
const postsImgDir = join(ROOT, 'content', 'posts', 'img')
if (existsSync(postsImgDir)) {
  for (const slug of readdirSync(postsImgDir)) {
    const dir = join(postsImgDir, slug)
    if (!statSync(dir).isDirectory()) continue
    const dest = join(ROOT, 'dist', 'blog', 'img', slug)
    mkdirSync(dest, { recursive: true })
    cpSync(dir, dest, { recursive: true })
    copied += readdirSync(dest).length
  }
}
// KaTeX 的 CSS 与字体（build-content.ts 构建期渲染公式后的静态依赖）
const katexDist = join(ROOT, 'node_modules', 'katex', 'dist')
if (existsSync(katexDist)) {
  const dest = join(ROOT, 'dist', 'katex')
  mkdirSync(dest, { recursive: true })
  cpSync(join(katexDist, 'katex.min.css'), join(dest, 'katex.min.css'))
  cpSync(join(katexDist, 'fonts'), join(dest, 'fonts'), { recursive: true })
  copied += 1 + readdirSync(join(dest, 'fonts')).length
}
console.log(`static: ${copied} 个文件已拷入 dist/（调研图集 + 项目文档图 + 博客配图 + KaTeX）`)
