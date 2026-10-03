// 一次性抓取各项目 README 与文档图片到 content/projects/docs/，展示在项目页折叠区。
// 脱敏：剥掉徽章行、把指向自己仓库的 URL 换成占位文本；check-privacy 会在构建时兜底扫描。
// 重新抓取：node scripts/fetch-app-docs.ts
import { execSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, loadPrivacyConfig } from './lib.ts'

const DOCS_DEST = join(ROOT, 'content', 'projects', 'docs')
const GITHUB_REPOS = loadPrivacyConfig().githubRepos

interface DocSource {
  /** 项目页 slug（与 content/projects/<slug>.md 对应） */
  slug: string
  /** github 仓库名（githubRepos 的 key）或本地路径 */
  source: string
  isLocal?: boolean
}

const SOURCES: DocSource[] = [
  { slug: 'corkpit', source: '/home/w/Documents/my_tools/corkpit', isLocal: true },
  { slug: 'scilc', source: 'sciLC' },
  { slug: 'metro-dreams', source: 'metro-dreams' },
  { slug: 'orderlevelredro', source: 'orderlevelredro' },
  { slug: 'visflow', source: 'visflow' },
  { slug: 'hpc_stat', source: 'hpc_stat' },
  { slug: 'space_explorer', source: 'space_explorer' },
]

function ghRaw(repo: string, path: string): Buffer {
  return execSync(`gh api "repos/${repo}/contents/${path}" -H "Accept: application/vnd.github.raw"`, {
    maxBuffer: 1 << 26,
  }) as unknown as Buffer
}

function fetchRawReadme(repo: string): string {
  return execSync(`gh api "repos/${repo}/readme" -H "Accept: application/vnd.github.raw"`, {
    encoding: 'utf8',
    maxBuffer: 1 << 26,
  })
}
/** 剥徽章行 + 抹掉指向自己仓库的 URL */
function sanitize(md: string, owner: string | null): string {
  let out = md
    .split('\n')
    .filter((line) => {
      if (!line.includes('![')) return true
      if (/shields\.io|badge|travis|circleci|actions\/workflows|app\.potproject|badgen/.test(line)) return false
      return true
    })
    .join('\n')
  if (owner) {
    out = out.replaceAll(new RegExp(`https://github\\.com/${owner}[^\\s)\\]"'>]*`, 'g'), '（仓库地址略）')
    out = out.replaceAll(new RegExp(`https://raw\\.githubusercontent\\.com/${owner}/[^\\s)\\]"'>]*`, 'g'), '（图片略）')
    out = out.replaceAll(new RegExp(`git@github\\.com:${owner}[^\\s)\\]"'>]*`, 'g'), '（仓库地址略）')
    // 自己的 GitHub Pages 站（域名含用户名）
    out = out.replaceAll(new RegExp(`https://${owner}\\.github\\.io[^\\s)\\]"'>]*`, 'g'), '（在线地址略）')
  }
  // Windows 绝对路径（含本地用户名/机器名）
  out = out.replaceAll(/[A-Za-z]:[\\/]+Users[\\/]+[^\s"'）)'，。]*/g, '（路径略）')
  // 折叠 HTML 包裹太深时去掉常见的外层 div（marked 能渲染，但密度风格不需要）
  out = out.replaceAll(/<div[^>]*>|<\/div>/g, '')
  return out
}

/** 抓取 README 引用的相对路径图片到 img/，返回路径重写后的 md */
function fetchImages(md: string, destImg: string, fetcher: (path: string) => Buffer): string {
  mkdirSync(destImg, { recursive: true })
  const seen = new Set<string>()
  const re = /!\[([^\]]*)\]\(([^)\s]+)\)/g
  const out = md.replace(re, (full, alt: string, path: string) => {
    if (/^https?:\/\//.test(path)) return full // 外链图保留
    if (path.startsWith('data:') || path.length > 150 || /[（()\s]/.test(path)) return full // data-URI/占位符跳过
    const base = path.split('/').pop() as string
    if (!/\.(png|jpe?g|gif|svg|webp)$/i.test(base)) return full
    const localPath = path.replace(/^\.\//, '')
    try {
      if (!seen.has(base)) {
        const data = fetcher(localPath)
        writeFileSync(join(destImg, base), data)
        seen.add(base)
      }
      return `![${alt}](img/${base})`
    } catch {
      return `${alt}（图片略）`
    }
  })
  return out
}

mkdirSync(DOCS_DEST, { recursive: true })
for (const { slug, source, isLocal } of SOURCES) {
  const imgDest = join(DOCS_DEST, slug, 'img')
  try {
    let md: string
    if (isLocal) {
      md = readFileSync(join(source, 'README.md'), 'utf8')
      const imgs = readdirSync(source).filter((f) => /\.(png|jpe?g|gif|webp)$/i.test(f))
      mkdirSync(imgDest, { recursive: true })
      for (const img of imgs) cpSync(join(source, img), join(imgDest, img))
      md = md.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (full, alt: string, path: string) => {
        const base = path.split('/').pop() as string
        return existsSync(join(imgDest, base)) ? `![${alt}](img/${base})` : `${alt}（图片略）`
      })
      md = sanitize(md, null)
    } else {
      const repo = GITHUB_REPOS[source]
      if (!repo) throw new Error(`githubRepos 缺少 "${source}"`)
      const owner = repo.split('/')[0]
      md = sanitize(fetchRawReadme(repo), owner)
      md = fetchImages(md, imgDest, (p) => ghRaw(repo, p))
    }
    writeFileSync(join(DOCS_DEST, `${slug}.md`), md.trim() + '\n')
    const imgCount = existsSync(imgDest) ? readdirSync(imgDest).length : 0
    console.log(`${slug.padEnd(18)} README ${String(md.length).padStart(6)} 字符 · ${imgCount} 图`)
  } catch (e) {
    console.error(`✗ ${slug}：${(e as Error).message}`)
  }
}
