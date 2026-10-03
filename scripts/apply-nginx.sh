#!/usr/bin/env bash
# 低频：nginx 配置变更后应用（demo.conf、apps-locations.conf）。
# 日常内容部署用 ./deploy.sh，不需要本脚本。
# 触发时机：改了 nginx/demo.conf 或 apps/apps.json（生成新片段）之后。
# 用法：bash scripts/apply-nginx.sh
set -euo pipefail
cd "$(dirname "$0")/.."
sudo cp nginx/demo.conf /etc/nginx/sites-available/demo
sudo mkdir -p /etc/nginx/snippets
sudo cp nginx/apps-locations.conf /etc/nginx/snippets/hy-wu-apps.conf
sudo nginx -t && sudo systemctl reload nginx
echo "nginx 配置已应用并 reload。"
