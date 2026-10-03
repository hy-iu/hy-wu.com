// 从 git 提交日志提取"作者"字段——仅限 AI 模型/工具署名。
// 双重过滤，防真名泄露：
//   1) DENY：真名/真名拼音/真实邮箱/机器名，一票否决
//   2) TOOL：仅当作者名可识别为模型/工具时才展示，否则留空（待人工填写）
// 产物 content/authors.json 提交入库（人工可审）。重新生成：npm run authors
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, loadPrivacyConfig } from './lib.ts'

// ---------- 过滤规则 ----------
// 黑名单来自 privacy.local.json（gitignored，不把任何真名写进仓库）。
// 主防线是 TOOL 白名单：只有可识别为模型/工具名的作者才会被展示。
const { deny: DENY_LIST, githubRepos: GITHUB_REPOS } = loadPrivacyConfig()
// 通用兜底：工具署名都是 ASCII，含 CJK 的作者名一律不展示
const HAS_CJK = /[\u4e00-\u9fff\u3400-\u4dbf]/

function isDenied(name: string, email: string): boolean {
  const haystack = `${name} ${email}`.toLowerCase()
  return DENY_LIST.some((d) => haystack.includes(d.toLowerCase())) || HAS_CJK.test(name)
}

const TOOL_SUBSTR = [
  'qwen', 'glm', 'gpt', 'claude', 'deepseek', 'kimi', 'zcode',
  'qoder', 'codex', 'gemini', 'copilot', 'cursor', 'aider',
]

function isToolAuthor(name: string): boolean {
  const norm = name.toLowerCase()
  if (norm.includes('[bot]')) return true
  // 去掉数字/点再分词，使 "GLM5.3Flash" → glm + flash、"GPT6.1Sol" → gpt + sol 可被识别
  const words = norm.replace(/[0-9.]+/g, ' ').split(/[^a-z]+/).filter(Boolean)
  if (words.some((w) => TOOL_SUBSTR.some((s) => w.includes(s)))) return true
  // 仅精确匹配的短标识（避免 Bradshaw 一类人名误伤）
  if (words.some((w) => w === 'dsh' || w === 'bot')) return true
  return false
}

function pick(entries: { name: string; email: string }[]): string[] {
  const out = new Set<string>()
  for (const { name, email } of entries) {
    if (isDenied(name, email)) continue
    if (!isToolAuthor(name)) continue
    out.add(name.trim())
  }
  return [...out]
}

// ---------- 数据源 ----------
type RepoSpec =
  | { kind: 'local'; key: string; path: string }
  | { kind: 'github'; key: string; repo: string }

const REPOS: RepoSpec[] = [
  { kind: 'local', key: 'hy-wu.com', path: ROOT },
  { kind: 'local', key: 'my_tools', path: '/home/w/Documents/my_tools' },
  ...Object.entries(GITHUB_REPOS).map(([key, repo]) => ({ kind: 'github' as const, key, repo })),
]

function localAuthors(path: string): { name: string; email: string }[] {
  const out = execSync('git log --format=%an%x09%ae', { cwd: path, encoding: 'utf8', maxBuffer: 1 << 24 })
  return out.split('\n').filter(Boolean).map((l) => {
    const [name, email] = l.split('\t')
    return { name: name ?? '', email: email ?? '' }
  })
}

function ghAvailable(): boolean {
  try {
    execSync('gh auth status', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

async function githubAuthors(repo: string): Promise<{ name: string; email: string }[]> {
  // 优先走 gh CLI（带认证，匿名 fetch 会被 403 限流）
  if (ghAvailable()) {
    const out: { name: string; email: string }[] = []
    for (let page = 1; page <= 10; page++) {
      const raw = execSync(`gh api "repos/${repo}/commits?per_page=100&page=${page}"`, {
        encoding: 'utf8',
        maxBuffer: 1 << 26,
      })
      const commits = JSON.parse(raw) as { commit: { author: { name: string; email: string } } }[]
      for (const c of commits) out.push(c.commit.author)
      if (commits.length < 100) break
    }
    return out
  }
  const out: { name: string; email: string }[] = []
  for (let page = 1; page <= 10; page++) {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/commits?per_page=100&page=${page}`,
      { headers: { 'User-Agent': 'hy-wu.com-authors', Accept: 'application/vnd.github+json' } },
    )
    if (!res.ok) throw new Error(`GitHub API ${res.status} for ${repo}`)
    const commits = (await res.json()) as {
      commit: { author: { name: string; email: string } }
    }[]
    for (const c of commits) out.push(c.commit.author)
    if (commits.length < 100) break
  }
  return out
}

// ---------- 主流程 ----------
const result: Record<string, string[]> = {}
for (const spec of REPOS) {
  const entries =
    spec.kind === 'local' ? localAuthors(spec.path) : await githubAuthors(spec.repo)
  const authors = pick(entries)
  result[spec.key] = authors
  console.log(`${spec.key.padEnd(16)} 提交者 ${entries.length} 条 → 展示: [${authors.join(', ')}]`)
}

writeFileSync(join(ROOT, 'content', 'authors.json'), JSON.stringify(result, null, 2) + '\n')
console.log('已写入 content/authors.json')
