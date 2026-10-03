#!/usr/bin/env bash
# 把 site/ 部署到 nginx 运行目录（目标归 root，需要 sudo）
# 用法：./deploy.sh
set -euo pipefail
cd "$(dirname "$0")"
sudo rsync -av --delete site/ /var/www/demo/
echo "已部署。本机自测：curl -s http://127.0.0.1:8080/ | head"
echo "线上验证：https://www.hy-wu.com"
