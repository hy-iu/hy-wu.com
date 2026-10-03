// 隐私红线检查：扫描构建产物，任何一条命中即构建失败。
// 注意：域名 hy-wu.com 本身是站点名，不在黑名单；这里拦截的是"人"的标识。
// 黑名单在 scripts/privacy.local.json（gitignored）——真名绝不能写进被跟踪的文件。
// 运行：node scripts/check-privacy.ts（npm run build 末步）
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, loadPrivacyConfig } from './lib.ts'

const FORBIDDEN: [string, RegExp][] = [
  // 不含身份信息的通用规则（永远生效）
  ['邮箱地址', /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/],
]

// 本地黑名单（真名、拼音 ID、机器名等——只存在于 privacy.local.json）
for (const item of loadPrivacyConfig().deny) {
  // 逐字符转义为字面量（避免在类型剥离模式下写复杂正则字符类）
  const literal = item.replace(/[^\w\s]/g, '\\$&')
  FORBIDDEN.push(['黑名单', new RegExp(literal, 'i')])
}

// 站点自己的域名不是泄露：扫描前先掩掉，避免黑名单里的 "hy-wu" 误伤 "hy-wu.com"
const SITE_DOMAIN = /(?:www\.)?hy-wu\.com/g

// 隧道 UUID（若本地缓存文件存在）
const uuidFile = join(ROOT, 'tunnel-uuid.txt')
try {
  const uuid = readFileSync(uuidFile, 'utf8').trim()
  if (uuid) FORBIDDEN.push(['隧道 UUID', new RegExp(uuid.replace(/-/g, '\\-'))])
} catch {
  /* 无缓存文件，跳过 */
}

function* listFiles(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) yield* listFiles(p)
    else yield p
  }
}

const dist = join(ROOT, 'dist')
let hits = 0
for (const file of listFiles(dist)) {
  if (!/\.(html|js|css|json|svg)$/.test(file)) continue
  const text = readFileSync(file, 'utf8').replaceAll(SITE_DOMAIN, '§site§')
  for (const [label, re] of FORBIDDEN) {
    const m = text.match(re)
    if (m) {
      hits++
      const idx = m.index ?? 0
      console.error(`[泄露] ${label} 命中 ${re} 于 ${file.replace(ROOT + '/', '')} …${text.slice(Math.max(0, idx - 40), idx + 60).replaceAll('\n', ' ')}…`)
    }
  }
}
if (hits > 0) {
  console.error(`\n隐私检查失败：${hits} 处命中。构建产物不得发布。`)
  process.exit(1)
}
console.log('隐私检查通过：dist/ 无敏感标识。')
