# hy-wu.com — 个人网站（NUC 自托管）

线上地址：https://www.hy-wu.com
链路：浏览器 → Cloudflare 边缘 → 出站隧道（cloudflared）→ nginx（127.0.0.1:8080）→ site/

本仓库只含**可公开的代码与配置模板**，不含任何凭据、UUID 和基础设施笔记。

## 目录结构

```
site/                               网页内容（源文件，改这里）
nginx/demo.conf                     nginx 源站配置（仅监听 127.0.0.1:8080）
cloudflared/config.yml.example      隧道路由模板（<TUNNEL-UUID> 占位）
systemd/cloudflared-tunnel.service  隧道 systemd 单元（完整沙箱）
setup-server.sh                     从零重建服务器的幂等脚本
deploy.sh                           部署 site/ 到 /var/www/demo/
```

不在仓库里的东西（各自有家）：

- `tunnel-uuid.txt`（仓库根，gitignored）—— setup-server.sh 读取的隧道 UUID
- 笔记与踩坑记录 —— `~/Documents/cloudflared-学习笔记.md`
- 隧道凭据 —— 服务器 `/etc/cloudflared/`（600，专用用户）；管理证书 `~/.cloudflared/cert.pem`

## 日常流程

改版面：编辑 `site/` → `git commit` → `./deploy.sh`

## 改服务器配置后如何生效

```bash
# nginx
sudo cp nginx/demo.conf /etc/nginx/sites-available/demo && nginx -t && sudo systemctl reload nginx

# 隧道路由（改 config.yml.example 后，替换占位符放到服务器）
sudo cp cloudflared/config.yml.example /etc/cloudflared/config.yml  # 手动替换 <TUNNEL-UUID>
sudo systemctl restart cloudflared-tunnel

# systemd 单元（改过加固参数时）
sudo cp systemd/cloudflared-tunnel.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl restart cloudflared-tunnel
```

## 从零重建

```bash
echo "<你的隧道UUID>" > tunnel-uuid.txt
sudo bash setup-server.sh
```

## 安全红线

- 凭据（`*.pem`、隧道凭据 json）**永不提交**——private 仓库也不放，防账号被盗时外泄
- 真实 UUID 只存在于服务器和本地 `tunnel-uuid.txt`；仓库里一律 `<TUNNEL-UUID>` 占位
- 笔记（含架构细节）不入库；按"仓库随时可能变公开"的标准维护
