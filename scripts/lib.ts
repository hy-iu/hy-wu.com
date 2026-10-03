// 共享工具：无第三方依赖（vite.config.ts 也引用本文件）。
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

export const ROOT = process.cwd()

// ---------- 隐私本地配置 ----------
// 真名黑名单、GitHub 仓库归属等私密常量放在 scripts/privacy.local.json（gitignored，
// 示例见 privacy.local.example.json）。本仓库必须保持"随时可公开"：任何真名/身份
// 标识都不允许写进被跟踪的文件。
export interface PrivacyConfig {
  /** 子串黑名单（大小写不敏感），命中即过滤/构建失败 */
  deny: string[]
  /** 项目名 → "owner/repo"（作者提取的数据源） */
  githubRepos: Record<string, string>
  /** 子版块名 → 克隆地址（调研内容导入） */
  import: Record<string, string>
}

export function loadPrivacyConfig(): PrivacyConfig {
  try {
    const raw = readFileSync(join(ROOT, 'scripts', 'privacy.local.json'), 'utf8')
    const cfg = JSON.parse(raw) as Partial<PrivacyConfig>
    return {
      deny: Array.isArray(cfg.deny) ? cfg.deny : [],
      githubRepos: cfg.githubRepos ?? {},
      import: cfg.import ?? {},
    }
  } catch {
    // 无本地配置：仅保留不含任何身份信息的通用规则
    return {
      deny: ['@gmail.com', '@qq.com', '@163.com', '@outlook.com', 'edu.cn'],
      githubRepos: {},
      import: {},
    }
  }
}

// ---------- MPA 入口枚举 ----------
// 规则：根 index.html、404.html，以及 blog/ research/ projects/ 下所有 index.html。
// 页面壳由 build-content.ts 生成；content/ 是唯一内容源。
export function collectEntries(): string[] {
  const entries = ['index.html']
  if (existsSync(join(ROOT, '404.html'))) entries.push('404.html')
  for (const base of ['blog', 'research', 'projects']) {
    const abs = join(ROOT, base)
    if (!existsSync(abs)) continue
    walk(abs, (rel) => {
      if (rel.endsWith('index.html')) entries.push(rel)
    }, base)
  }
  return entries.sort()
}

function walk(dir: string, fn: (rel: string) => void, prefix = ''): void {
  for (const name of readdirSync(dir).sort()) {
    const abs = join(dir, name)
    const rel = prefix ? `${prefix}/${name}` : name
    if (statSync(abs).isDirectory()) walk(abs, fn, rel)
    else fn(rel)
  }
}

// ---------- CSV（RFC 4180 子集：双引号转义） ----------
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (c !== '\r') field += c
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

export function csvToObjects(text: string): Record<string, string>[] {
  const rows = parseCsv(text)
  if (rows.length < 1) return []
  const header = rows[0]
  return rows.slice(1).filter((r) => r.some((v) => v.trim() !== '')).map((r) => {
    const obj: Record<string, string> = {}
    header.forEach((h, i) => (obj[h.trim()] = (r[i] ?? '').trim()))
    return obj
  })
}

// ---------- HTML ----------
export function esc(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export const CREDITS =
  'Qwen3.8Max Qoder · GLM5.3Flash ZCode · GPT6.1Sol Codex · Opus5.5 ClaudeCode · DeepSeek v4Flash dsh'

// 首帧前确定主题，避免闪烁（与 src/lib/theme.ts 的切换逻辑保持一致）
const THEME_INIT = `(function(){try{var t=localStorage.getItem('theme');if(t!=='dark'&&t!=='light')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='light'}})()`

export interface PageMeta {
  title: string
  desc?: string
  /** 供 React 交互组件使用的数据（过滤、统计等） */
  data?: unknown
}

export function pageShell(meta: PageMeta, mainHtml: string): string {
  const dataJson = meta.data === undefined ? '{}' : JSON.stringify(meta.data)
    .replaceAll('<', '\\u003c')
  const descTag = meta.desc ? `\n<meta name="description" content="${esc(meta.desc)}">` : ''
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">${descTag}
<title>${esc(meta.title)}</title>
<script>${THEME_INIT}</script>
</head>
<body>
<header class="site-header">
  <div class="wrap header-row">
    <a class="site-title" href="/">hy-wu.com</a>
    <nav class="site-nav"><a href="/blog/">博客</a><a href="/research/">调研</a><a href="/projects/">项目</a></nav>
    <span data-mount="theme-toggle"></span>
  </div>
</header>
<main class="wrap">
${mainHtml}
</main>
<footer class="site-footer">
  <div class="wrap">
    <p class="credits">${CREDITS}</p>
    <p class="fineprint">hy-wu.com · 文献调研 / 技术调研 / 知识库</p>
  </div>
</footer>
<script type="application/json" id="page-data">${dataJson}</script>
<script type="module" src="/src/main.tsx"></script>
</body>
</html>
`
}

/** 写入 MPA 页面壳：路径即 URL（/blog/x/ → blog/x/index.html） */
export function entryPath(urlDir: string): string {
  return join(ROOT, urlDir, 'index.html')
}
