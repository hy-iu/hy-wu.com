// 读 apps/apps.json，生成 nginx 子路径分发配置（每个应用一个 location alias）。
// 产物 nginx/apps-locations.conf 入库，deploy.sh 复制到 /etc/nginx/snippets/hy-wu-apps.conf。
// 运行：node scripts/gen-apps.ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './lib.ts'

interface AppSpec {
  kind: 'project' | 'research'
  src: string
}

const APPS: Record<string, AppSpec> = JSON.parse(
  readFileSync(join(ROOT, 'apps', 'apps.json'), 'utf8'),
)

const blocks = Object.keys(APPS)
  .filter((name) => !name.startsWith('$'))
  .sort()
  .map((name) => {
    const appDir = `/var/www/apps/${name}`
    return `# ${name}（${APPS[name].kind}）
location /${name}/ {
    alias ${appDir}/;
    try_files $uri $uri/ $uri/index.html =404;
}`
  })
  .join('\n\n')

const conf = `# 由 scripts/gen-apps.ts 从 apps/apps.json 生成 —— 不要手改，改清单后重新生成。
# deploy.sh 会把本文件复制到 /etc/nginx/snippets/hy-wu-apps.conf（demo.conf include 它）。

${blocks}
`

mkdirSync(join(ROOT, 'nginx'), { recursive: true })
writeFileSync(join(ROOT, 'nginx', 'apps-locations.conf'), conf)
console.log(`nginx/apps-locations.conf：${Object.keys(APPS).length} 个应用`)
