#!/usr/bin/env bash
# 日常部署：构建（内容预渲染 → vite → 隐私红线检查）+ rsync 到源站目录。
# /var/www/{demo,apps} 属主是 w，无需 sudo。
# nginx 配置变更用 scripts/apply-nginx.sh（低频，需 sudo）。
# 应用托管产物需先 node scripts/app-deploy.ts --all 暂存到 .apps-build/
# 用法：./deploy.sh
set -euo pipefail
cd "$(dirname "$0")"
npm run build
rsync -a --delete dist/ /var/www/demo/
if [ -d .apps-build ]; then
  mkdir -p /var/www/apps
  rsync -a --delete .apps-build/ /var/www/apps/
fi
echo "已部署。本机自测：curl -s http://127.0.0.1:8080/blog/ | head"
echo "线上验证：https://www.hy-wu.com"
