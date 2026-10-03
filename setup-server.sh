#!/usr/bin/env bash
# hy-wu.com 服务器初始化：nginx 源站 + Cloudflare Tunnel 系统服务
# 用法：sudo bash setup-server.sh
# 隧道 UUID 从环境变量 TUNNEL_UUID 或仓库根目录 tunnel-uuid.txt 读取（两者都不入 git）
# 可重复执行（每步都是幂等的）
set -euo pipefail
REPO="$(cd "$(dirname "$0")" && pwd)"

TUNNEL_UUID="${TUNNEL_UUID:-$(cat "$REPO/tunnel-uuid.txt" 2>/dev/null || true)}"
if [ -z "$TUNNEL_UUID" ]; then
  echo "错误：缺少隧道 UUID。请 export TUNNEL_UUID=<uuid> 或把 UUID 写入 $REPO/tunnel-uuid.txt（已被 .gitignore 排除）" >&2
  exit 1
fi

echo "== 1/4 添加 Cloudflare 官方 apt 源（GPG 签名验证）=="
install -d -m 0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg -o /usr/share/keyrings/cloudflare-main.gpg
chmod 0644 /usr/share/keyrings/cloudflare-main.gpg
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" \
  > /etc/apt/sources.list.d/cloudflared.list
apt-get update -qq

echo "== 2/4 安装 nginx 和 cloudflared =="
DEBIAN_FRONTEND=noninteractive apt-get install -y nginx cloudflared

echo "== 3/4 配置 nginx：仅监听 127.0.0.1:8080（公网摸不到）=="
if ! command -v node >/dev/null 2>&1; then
  echo "错误：需要 Node.js（≥20）来构建站点，请先安装 node/npm" >&2
  exit 1
fi
npm ci --no-audit --no-fund
npm run build
mkdir -p /var/www/demo
rsync -a --delete "$REPO/dist/" /var/www/demo/
cat > /etc/nginx/sites-available/demo <<'NGINX'
# 主站：www（default_server —— 其他未声明 Host 也落到这里）
server {
    listen 127.0.0.1:8080 default_server;
    server_name www.hy-wu.com;
    root /var/www/demo;
    index index.html;

    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    # 静态站：只给 GET/HEAD，其它方法一律 405
    if ($request_method !~ ^(GET|HEAD)$) {
        return 405;
    }

    # 自定义 404（黄页风）；对外直接请求 /404.html 也按 404 处理
    error_page 404 /404.html;
    location = /404.html { internal; }

    # 本机托管的应用子路径（/tn-lm/、/metro-dreams/ …），清单见 apps/apps.json
    include /etc/nginx/snippets/hy-wu-apps.conf;
}

# 裸域：301 到 www（单一规范域名；边缘证书天然覆盖 hy-wu.com）
server {
    listen 127.0.0.1:8080;
    server_name hy-wu.com;
    return 301 https://www.hy-wu.com$request_uri;
}
NGINX
ln -sf /etc/nginx/sites-available/demo /etc/nginx/sites-enabled/demo
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx

echo "== 4/4 cloudflared 系统服务：专用用户 + 完整沙箱 =="
id cloudflared >/dev/null 2>&1 || useradd --system --home-dir /nonexistent --shell /usr/sbin/nologin cloudflared
mkdir -p /etc/cloudflared
# 真实配置由模板生成（占位符替换为真实 UUID），凭据文件留在服务器本地
sed "s/<TUNNEL-UUID>/${TUNNEL_UUID}/g" "$REPO/cloudflared/config.yml.example" > /etc/cloudflared/config.yml
cp -f "/home/w/.cloudflared/${TUNNEL_UUID}.json" /etc/cloudflared/
chown -R cloudflared:cloudflared /etc/cloudflared
chmod 600 /etc/cloudflared/config.yml /etc/cloudflared/*.json

cat > /etc/systemd/system/cloudflared-tunnel.service <<'UNIT'
[Unit]
Description=Cloudflare Tunnel (nuc -> www.hy-wu.com)
After=network-online.target
Wants=network-online.target

[Service]
User=cloudflared
Group=cloudflared
Type=simple
ExecStart=/usr/bin/cloudflared --config /etc/cloudflared/config.yml tunnel run
Restart=on-failure
RestartSec=5
# ---- 沙箱加固（系统管理器支持完整版）----
NoNewPrivileges=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectSystem=strict
ProtectHome=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
ProtectClock=yes
ProtectHostname=yes
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
RestrictSUIDSGID=yes
MemoryDenyWriteExecute=yes
LockPersonality=yes
CapabilityBoundingSet=
AmbientCapabilities=
SystemCallArchitectures=native
SystemCallFilter=@system-service
UMask=0077

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now cloudflared-tunnel.service

sleep 6
echo "== 结果 =="
echo -n "nginx:            "; systemctl is-active nginx
echo -n "cloudflared-tunnel: "; systemctl is-active cloudflared-tunnel.service
