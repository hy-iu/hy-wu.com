// 内容 → 静态页面构建：content/ 是唯一源，产出可直接被 vite 打包的 MPA 页面壳。
// 每页预渲染完整正文（无 JS 可读），React 只接管交互（主题切换、列表过滤）。
// 运行：node scripts/build-content.ts（npm run content）
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { marked } from 'marked'
import matter from 'gray-matter'
import katex from 'katex'
import { csvToObjects, entryPath, esc, pageShell, ROOT } from './lib.ts'

marked.setOptions({ gfm: true })

// ---------- 数学公式（构建期 KaTeX 渲染，页面保持无 JS 可读） ----------
// 流程：保护代码块 → 把公式抽成占位符 → marked 解析 → 占位符还原为 KaTeX HTML。
// 支持：行内 $...$ 与 \(...\)，块级 $$...$$ 与 \[...\]（可跨行）。
interface MathSpan {
  tex: string
  display: boolean
}

const MATH_MACROS: Record<string, string> = {
  '\\dd': '\\mathrm{d}',
  '\\ee': '\\mathrm{e}',
  '\\ii': '\\mathrm{i}',
  '\\R': '\\mathbb{R}',
  '\\E': '\\mathbb{E}',
  '\\lap': '\\nabla^2',
  '\\grad': '\\nabla',
  '\\div': '\\nabla\\cdot',
  '\\pd': '\\partial',
}

/** 把 fenced 代码块与行内代码换成占位符，避免公式语法误伤代码；返回原文与占位符对照 */
function protectCodeSegments(md: string): { text: string; codes: string[] } {
  const codes: string[] = []
  const stash = (raw: string) => {
    codes.push(raw)
    return `CODEPH${codes.length - 1}ENDPH`
  }
  const out: string[] = []
  let buf: string[] = []
  let inFence = false
  let fenceMark = ''
  for (const line of md.split('\n')) {
    const m = line.match(/^\s{0,3}(`{3,}|~{3,})/)
    if (!inFence && m) {
      inFence = true
      fenceMark = m[1][0]
      buf = [line]
      continue
    }
    if (inFence) {
      buf.push(line)
      if (m && m[1][0] === fenceMark) {
        out.push(stash(buf.join('\n')))
        inFence = false
        buf = []
      }
      continue
    }
    out.push(line)
  }
  if (inFence) out.push(...buf.splice(0)) // 未闭合围栏：原样放回
  let text = out.join('\n')
  text = text.replace(/(`+)[\s\S]*?\1/g, (raw) => stash(raw))
  return { text, codes }
}

/** 抽出公式为占位符；行内公式不跨行，纯数字内容（金额等）不当公式 */
function extractMath(text: string): { text: string; spans: MathSpan[] } {
  const spans: MathSpan[] = []
  const stash = (tex: string, display: boolean) => {
    spans.push({ tex: tex.trim(), display })
    return `KATEXPH${spans.length - 1}ENDPH`
  }
  text = text.replace(/(?<!\\)\$\$([\s\S]+?)\$\$/g, (_, tex) => stash(tex, true))
  text = text.replace(/\\\[([\s\S]+?)\\\]/g, (_, tex) => stash(tex, true))
  text = text.replace(/(?<!\\)\$(?!\s)((?:\\[^\n]|[^\n$])+?)(?<![\s\\])\$(?!\d)/g, (whole, tex) => {
    if (/^[\d.,\s%]+$/.test(tex.trim())) return whole
    return stash(tex, false)
  })
  text = text.replace(/\\\(([\s\S]+?)\\\)/g, (_, tex) => stash(tex, false))
  return { text, spans }
}

function katexHtml(spans: MathSpan[]): string[] {
  return spans.map(({ tex, display }) => {
    try {
      return katex.renderToString(tex, {
        displayMode: display,
        throwOnError: false,
        strict: false,
        macros: MATH_MACROS,
      })
    } catch {
      console.warn(`[katex] 渲染失败：${tex.slice(0, 60)}`)
      return `<code>${esc(tex)}</code>`
    }
  })
}

function renderMd(md: string): string {
  const { text: coded, codes } = protectCodeSegments(md)
  const { text: pulled, spans } = extractMath(coded)
  // 代码原样放回，交还给 marked 正常转义
  const restored = pulled.replace(/CODEPH(\d+)ENDPH/g, (_, i) => codes[+i])
  let html = marked.parse(restored, { async: false }) as string
  const rendered = katexHtml(spans)
  // 独占段落的块级公式替换整个 <p>，避免块级元素嵌进段落
  html = html.replace(/<p>KATEXPH(\d+)ENDPH<\/p>/g, (_, i) =>
    spans[+i].display ? `<div class="math-block">${rendered[+i]}</div>` : `<p>${rendered[+i]}</p>`,
  )
  html = html.replace(/KATEXPH(\d+)ENDPH/g, (_, i) => rendered[+i])
  return html
}

interface Post {
  slug: string
  title: string
  date: string
  tags: string[]
  author: string
  html: string
}
interface Project {
  slug: string
  name: string
  blurb: string
  stack: string[]
  year: string
  order: number
  authors: string[]
  local: boolean
  html: string
}
interface Block {
  slug: string
  name: string
  blurb: string
  order: number
  library: boolean
  figs: boolean
}

type Authors = Record<string, string[]>
function loadAuthors(): Authors {
  const p = join(ROOT, 'content', 'authors.json')
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {}
}

function readDirNames(dir: string): string[] {
  return existsSync(dir) ? readdirSync(dir).filter((f) => statSync(join(dir, f)).isDirectory()) : []
}

function frontmatterOf(file: string): { data: Record<string, unknown>; content: string } {
  const { data, content } = matter(readFileSync(file, 'utf8'))
  return { data, content }
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

/** 写入 MPA 页面壳，自动创建父目录（URL 目录 → index.html） */
function writePage(urlDir: string, html: string): void {
  const path = entryPath(urlDir)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, html)
}
function list(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)) : []
}

// ---------- 页内目录（wiki 式 h2/h3 编号） ----------
function withToc(html: string): { html: string; toc: { level: number; text: string; id: string }[] } {
  const toc: { level: number; text: string; id: string }[] = []
  let i = 0
  const out = html.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_, lvl: string, inner: string) => {
    const id = `s${i++}`
    // 标题内文本已被 marked 实体化，先解码再统一转义，避免 &amp;quot; 双重转义
    const text = decodeEntities(inner.replace(/<[^>]+>/g, '').trim())
    toc.push({ level: Number(lvl), text, id })
    return `<h${lvl} id="${id}">${inner}</h${lvl}>`
  })
  return { html: out, toc }
}

function decodeEntities(s: string): string {
  return s
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
}

function tocHtml(toc: { level: number; text: string; id: string }[]): string {
  if (toc.length === 0) return ''
  let out = '<div class="toc"><strong>目录</strong><ul>'
  let depth = 2
  for (const item of toc) {
    if (item.level > depth) out += '<ul>'
    if (item.level < depth) out += '</ul>'
    depth = item.level
    out += `<li><a href="#${item.id}">${esc(item.text)}</a></li>`
  }
  out += '</ul>'.repeat(depth - 1) + '</div>'
  return out
}

// ---------- 博客 ----------
function buildBlog(): void {
  const dir = join(ROOT, 'content', 'posts')
  const posts: Post[] = []
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
      const { data, content } = frontmatterOf(join(dir, f))
      const slug = f.replace(/\.md$/, '')
      posts.push({
        slug,
        title: str(data.title, f),
        date: str(data.date),
        tags: list(data.tags),
        author: str(data.author),
        // 文章配图约定：](img/xxx) → /blog/img/<slug>/xxx（文件由 copy-static.ts 搬运）
        html: renderMd(content.replaceAll('](img/', `](/blog/img/${slug}/`)),
      })
    }
  }
  posts.sort((a, b) => b.date.localeCompare(a.date))

  // 目录页
  const rows = posts
    .map(
      (p) =>
        `<tr><td>${esc(p.date)}</td><td><a href="/blog/${esc(p.slug)}/">${esc(p.title)}</a></td><td>${esc(
          p.author,
        )}</td><td>${esc(p.tags.join(' · '))}</td></tr>`,
    )
    .join('\n')
  const listMain = `<h1>博客</h1>
<p class="page-desc">${posts.length} 篇</p>
<div data-mount="filter" data-kind="rows" data-target="#post-rows"></div>
<table class="dir-table"><thead><tr><th>日期</th><th>标题</th><th>作者</th><th>标签</th></tr></thead>
<tbody id="post-rows">
${rows}
</tbody></table>`
  writePage('blog', pageShell({ title: '博客 — hy-wu.com', data: { total: posts.length } }, listMain))

  // 文章页
  for (const p of posts) {
    const meta = [p.date, p.tags.length ? `标签：${p.tags.join(' · ')}` : '', p.author ? `作者：${esc(p.author)}` : '']
      .filter(Boolean)
      .map(esc)
      .join(' · ')
    const main = `<h1>${esc(p.title)}</h1>
<p class="meta-line">${meta}</p>
<div class="post-body">
${p.html}
</div>
<p class="fineprint"><a href="/blog/">← 返回博客目录</a></p>`
    writePage(
      `blog/${p.slug}`,
      pageShell({ title: `${p.title} — hy-wu.com`, desc: p.tags.join(',') }, main),
    )
  }
  console.log(`blog: ${posts.length} 篇文章 + 目录页`)
}

// ---------- 应用托管清单（apps/apps.json：本机托管的子路径应用） ----------
function loadApps(): Record<string, { kind: string; src: string }> {
  const p = join(ROOT, 'apps', 'apps.json')
  if (!existsSync(p)) return {}
  const raw = JSON.parse(readFileSync(p, 'utf8')) as Record<string, { kind: string; src: string }>
  delete (raw as Record<string, unknown>)['$comment']
  return raw
}

/** 项目页文档折叠区：渲染 docs/<slug>.md，图片重写到 /projects/img/<slug>/ */
function renderProjectDocs(slug: string): string {
  const docsFile = join(ROOT, 'content', 'projects', 'docs', `${slug}.md`)
  if (!existsSync(docsFile)) return ''
  const md = readFileSync(docsFile, 'utf8').replaceAll('](img/', `](/projects/img/${slug}/`)
  const html = renderMd(md).trim()
  if (!html) return ''
  return `<details class="docs"><summary>文档 · README</summary>${html}</details>`
}

// ---------- 项目 ----------
function buildProjects(authors: Authors): void {
  const dir = join(ROOT, 'content', 'projects')
  const apps = loadApps()
  const projects: Project[] = []
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
      const { data, content } = frontmatterOf(join(dir, f))
      const name = str(data.name, f.replace(/\.md$/, ''))
      projects.push({
        slug: f.replace(/\.md$/, ''),
        name,
        blurb: str(data.blurb),
        stack: list(data.stack),
        year: str(data.year),
        order: typeof data.order === 'number' ? data.order : 99,
        authors: authors[name] ?? [],
        local: data.local === true,
        html: renderMd(content),
      })
    }
  }
  projects.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))

  const blocks = projects
    .map((p) => {
      const authorLine =
        p.authors.length > 0
          ? `<p class="meta-line">作者：${p.authors.map(esc).join(' · ')}</p>`
          : ''
      const stack = p.stack.map((s) => `<span class="tag">${esc(s)}</span>`).join('')
      const year = p.year ? `<span class="tag">${esc(p.year)}</span>` : ''
      const localTag = p.local ? `<span class="tag">仅本机</span>` : ''
      const online = apps[p.name] ? `<a class="online" href="/${esc(p.name)}/">在线 ↗</a>` : ''
      const body = p.html.trim() ? `<div class="proj-body">${p.html}</div>` : ''
      const docs = renderProjectDocs(p.slug)
      return `<section class="proj">
<h3>${esc(p.name)}${online}</h3>
<p>${esc(p.blurb)}</p>
<div>${stack}${year}${localTag}</div>
${authorLine}
${body}
${docs}
</section>`
    })
    .join('\n')

  const main = `<h1>项目</h1>
<p class="page-desc">${projects.length} 个</p>
${blocks}`
  writePage('projects', pageShell({ title: '项目 — hy-wu.com' }, main))
  console.log(`projects: ${projects.length} 个`)
}

// ---------- 调研 ----------
function buildResearch(authors: Authors): void {
  const contentRoot = join(ROOT, 'content', 'research')
  const apps = loadApps()
  const blocks: Block[] = []
  for (const slug of readDirNames(contentRoot)) {
    const metaFile = join(contentRoot, slug, 'block.md')
    if (!existsSync(metaFile)) continue
    const { data } = frontmatterOf(metaFile)
    blocks.push({
      slug,
      name: str(data.name, slug),
      blurb: str(data.blurb),
      order: typeof data.order === 'number' ? data.order : 99,
      library: data.library === true,
      figs: data.figs === true,
    })
  }
  blocks.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug))

  // 总览页
  const rows = blocks
    .map((b) => {
      const stats: string[] = []
      const bib = join(contentRoot, b.slug, 'bibliography.csv')
      if (b.library && existsSync(bib)) stats.push(`${csvToObjects(readFileSync(bib, 'utf8')).length} 条文献`)
      const figsDir = join(contentRoot, b.slug, 'figs')
      if (b.figs && existsSync(figsDir)) stats.push(`${readdirSync(figsDir).length} 张图`)
      if (existsSync(join(contentRoot, b.slug, 'report.md'))) stats.push('报告 1 篇')
      const blockAuthors = authors[b.slug] ?? []
      const authorLine = blockAuthors.length ? `（作者：${blockAuthors.map(esc).join(' · ')}）` : ''
      // 双入口：若该调研同时是本机托管应用（apps.json），原站为主入口
      const original = apps[b.slug] ? `<a href="/${esc(b.slug)}/">原站 ↗</a> · ` : ''
      const links = [
        original,
        existsSync(join(contentRoot, b.slug, 'report.md')) ? `<a href="/research/${esc(b.slug)}/">报告</a>` : '',
        b.library ? `<a href="/research/${esc(b.slug)}/library/">文献库</a>` : '',
        b.figs ? `<a href="/research/${esc(b.slug)}/figs/">图集</a>` : '',
      ]
        .filter(Boolean)
        .join(' · ')
      return `<tr><td>${esc(b.name)}</td><td>${esc(b.blurb)}${authorLine}</td><td>${stats.join(' · ')}</td><td>${links}</td></tr>`
    })
    .join('\n')
  const overview = `<h1>调研</h1>
<p class="page-desc">文献调研 · 技术调研 · 知识库</p>
<table class="dir-table"><thead><tr><th>专题</th><th>简介</th><th>规模</th><th>入口</th></tr></thead>
<tbody>
${rows}
</tbody></table>`
  writePage(
    'research',
    pageShell({ title: '调研 — hy-wu.com', desc: '文献调研 · 技术调研 · 知识库' }, overview),
  )

  // 各子版块
  for (const b of blocks) {
    buildTnlmBlock(b)
  }
  console.log(`research: ${blocks.length} 个子版块（${blocks.map((b) => b.slug).join(', ')}）`)
}

function buildTnlmBlock(b: Block): void {
  const base = join(ROOT, 'content', 'research', b.slug)
  const urlBase = `/research/${b.slug}`

  // 报告页（图片路径 figs/ → 站点绝对路径；附 wiki 式目录）
  let reportMain = ''
  if (existsSync(join(base, 'report.md'))) {
    const raw = readFileSync(join(base, 'report.md'), 'utf8')
    const fixed = raw.replaceAll('](figs/', `](${urlBase}/figs/`)
    const rendered = renderMd(fixed)
    const { html, toc } = withToc(rendered)
    const entries = [
      b.library ? `<a href="${urlBase}/library/">文献库</a>` : '',
      b.figs ? `<a href="${urlBase}/figs/">图集</a>` : '',
    ]
      .filter(Boolean)
      .join(' · ')
    reportMain = `<h1>${esc(b.name)}</h1>
<p class="meta-line">${esc(b.blurb)}${entries ? ` · ${entries}` : ''}</p>
${tocHtml(toc)}
<div class="post-body">
${html}
</div>
<p class="fineprint"><a href="/research/">← 返回调研目录</a></p>`
    writePage(`research/${b.slug}`, pageShell({ title: `${b.name} — hy-wu.com` }, reportMain))
  }

  // 文献库页：预渲染全量表格 + 客户端过滤（文本 + 主题）
  if (b.library && existsSync(join(base, 'bibliography.csv'))) {
    const papers = csvToObjects(readFileSync(join(base, 'bibliography.csv'), 'utf8'))
    const clusters = [...new Set(papers.map((p) => p.cluster || '未分类'))].sort()
    const rows = papers
      .map((p) => {
        const year = Math.round(Number(p.year)) || ''
        const cluster = p.cluster || '未分类'
        const title = p.title || '(无标题)'
        const link = p.url && p.url !== 'unknown' ? `<a href="${esc(p.url)}">${esc(title)}</a>` : esc(title)
        return `<tr data-topic="${esc(cluster)}"><td>${link}</td><td>${esc(p.authors || '')}</td><td>${year}</td><td>${esc(p.citations || '')}</td><td>${esc(cluster)}</td></tr>`
      })
      .join('\n')
    const libMain = `<h1>${esc(b.name)} · 文献库</h1>
<p class="page-desc">${papers.length} 条 · <a href="${urlBase}/">报告</a>${b.figs ? ` · <a href="${urlBase}/figs/">图集</a>` : ''}</p>
<div data-mount="filter" data-kind="library" data-target="#lit-rows"></div>
<table class="dir-table lit-table"><thead><tr><th>标题</th><th>作者</th><th>年</th><th>引用</th><th>主题</th></tr></thead>
<tbody id="lit-rows">
${rows}
</tbody></table>
<p class="fineprint"><a href="/research/">← 返回调研目录</a></p>`
    writePage(
      `research/${b.slug}/library`,
      pageShell(
        {
          title: `${b.name} · 文献库 — hy-wu.com`,
          data: { clusters, total: papers.length },
        },
        libMain,
      ),
    )
  }

  // 图集页
  if (b.figs) {
    const figsDir = join(base, 'figs')
    const figures = existsSync(figsDir)
      ? readdirSync(figsDir)
          .filter((f) => /\.(png|jpe?g|svg)$/i.test(f))
          .sort()
      : []
    const items = figures
      .map((f) => {
        const caption = f.replace(/\.[a-z]+$/i, '').replaceAll('_', ' ')
        return `<figure><img loading="lazy" src="${urlBase}/figs/${encodeURIComponent(f)}" alt="${esc(caption)}"><figcaption>${esc(caption)}</figcaption></figure>`
      })
      .join('\n')
    const figsMain = `<h1>${esc(b.name)} · 图集</h1>
<p class="page-desc">${figures.length} 张 · <a href="${urlBase}/">报告</a>${b.library ? ` · <a href="${urlBase}/library/">文献库</a>` : ''}</p>
${items}
<p class="fineprint"><a href="/research/">← 返回调研目录</a></p>`
    writePage(`research/${b.slug}/figs`, pageShell({ title: `${b.name} · 图集 — hy-wu.com` }, figsMain))
  }
}

// ---------- 404 ----------
function build404(): void {
  const main = `<h1>404 · 目录里没有这一页</h1>
<p>您访问的路径不存在，或尚未收录。</p>
<p>分类入口：<a href="/blog/">博客</a> · <a href="/research/">调研</a> · <a href="/projects/">项目</a></p>`
  writeFileSync(join(ROOT, '404.html'), pageShell({ title: '404 — hy-wu.com' }, main))
  console.log('404: ok')
}

// ---------- 主流程 ----------
rmSync(join(ROOT, 'blog'), { recursive: true, force: true })
rmSync(join(ROOT, 'research'), { recursive: true, force: true })
rmSync(join(ROOT, 'projects'), { recursive: true, force: true })
for (const d of ['blog', 'research', 'projects']) mkdirSync(d, { recursive: true })

const authors = loadAuthors()
buildBlog()
buildProjects(authors)
buildResearch(authors)
build404()
