#!/usr/bin/env bash
# 构建（内容预渲染 → vite → 隐私红线检查）并部署到 nginx 源站目录
# 应用托管产物需先 node scripts/app-deploy.ts --all 暂存到 .apps-build/
# 用法：./deploy.sh
set -euo pipefail
cd "$(dirname "$0")"
npm run build
sudo rsync -av --delete dist/ /var/www/demo/
if [ -d .apps-build ]; then
  sudo mkdir -p /var/www/apps
  sudo rsync -av --delete .apps-build/ /var/www/apps/
  sudo rsync -d nginx/apps-locations.conf /etc/nginx/snippets/hy-wu-apps.conf
  sudo nginx -t && sudo systemctl reload nginx
fi
echo "已部署。本机自测：curl -s http://127.0.0.1:8080/blog/ | head"
echo "线上验证：https://www.hy-wu.com"
