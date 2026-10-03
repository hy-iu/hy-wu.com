// 托管应用部署：克隆/更新到 /home/w/apps/<name>（持久目录，服务类应用直接从这里跑），
// 构建后把产物暂存到 .apps-build/<name>/（deploy.sh 统一 rsync 到 /var/www/apps/）。
// 仓库地址从 scripts/privacy.local.json 的 githubRepos 解析，不入库。
// 用法：node scripts/app-deploy.ts <name>... | --all
import { execSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, loadPrivacyConfig } from './lib.ts'

interface AppSpec {
  kind: 'project' | 'research'
  src: string
  build?: string
  /** 仓库内子目录（如 my_tools 里的 corkpit），克隆目录 = /home/w/apps/<name>/<subdir?> */
  subdir?: string
}

const APPS: Record<string, AppSpec> = JSON.parse(
  readFileSync(join(ROOT, 'apps', 'apps.json'), 'utf8'),
)
delete (APPS as Record<string, unknown>)['$comment']
const PERSISTENT = '/home/w/apps'
const STAGING = join(ROOT, '.apps-build')
const GITHUB_REPOS = loadPrivacyConfig().githubRepos

function sh(cmd: string, cwd?: string): void {
  execSync(cmd, { cwd, stdio: 'inherit' })
}

function syncRepo(name: string): string {
  const repo = GITHUB_REPOS[name]
  if (!repo) throw new Error(`privacy.local.json 的 githubRepos 缺少 "${name}"`)
  const dir = join(PERSISTENT, name)
  if (existsSync(join(dir, '.git'))) {
    sh(`git pull --ff-only`, dir)
  } else {
    mkdirSync(PERSISTENT, { recursive: true })
    rmSync(dir, { recursive: true, force: true })
    // "owner/repo" 简写交给 gh（带认证），无 gh 时退回 https
    sh(`gh repo clone ${repo} ${dir} -- --depth 1 || git clone --depth 1 https://github.com/${repo}.git ${dir}`)
  }
  return dir
}

function deployOne(name: string, spec: AppSpec): void {
  console.log(`\n=== ${name} ===`)
  const repoDir = syncRepo(name)
  const workDir = spec.subdir ? join(repoDir, spec.subdir) : repoDir
  if (spec.build) sh(spec.build, workDir)
  const src = join(workDir, spec.src)
  if (!existsSync(src)) throw new Error(`${name}: 产物目录不存在 ${src}（构建是否成功？）`)
  const dest = join(STAGING, name)
  rmSync(dest, { recursive: true, force: true })
  mkdirSync(dest, { recursive: true })
  cpSync(src, dest, { recursive: true })
  console.log(`${name}: 产物已暂存 → ${dest}`)
}

const targets = process.argv[2] === '--all' ? Object.keys(APPS) : process.argv.slice(2)
if (targets.length === 0) {
  console.error('用法：node scripts/app-deploy.ts <name>... | --all')
  console.error(`可用：${Object.keys(APPS).join(', ')}`)
  process.exit(1)
}
let failed = 0
for (const name of targets) {
  const spec = APPS[name]
  if (!spec) {
    console.error(`未知应用 "${name}"（见 apps/apps.json）`)
    failed++
    continue
  }
  try {
    deployOne(name, spec)
  } catch (e) {
    failed++
    console.error(`✗ ${name} 失败：${(e as Error).message}`)
  }
}
if (failed > 0) {
  console.error(`\n${failed} 个应用失败`)
  process.exit(1)
}
console.log('\n全部完成。运行 ./deploy.sh 同步到 /var/www/apps/（需 sudo）。')
