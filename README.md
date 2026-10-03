# hy-wu.com — 个人网站（NUC 自托管）

线上地址：https://www.hy-wu.com
链路：浏览器 → Cloudflare 边缘 → 出站隧道（cloudflared）→ nginx（127.0.0.1:8080）→ /var/www/demo

三个板块：**博客**（`/blog/`）· **调研**（`/research/`，文献调研/技术调研/知识库）· **项目**（`/projects/`）。
主页暂缺：`/` 跳转 `/blog/`。

## 技术栈

- **Vite + React + TypeScript**，静态多页（MPA）：每个页面独立 `index.html`，URL 即路径，无客户端路由
- **预渲染**：`scripts/build-content.ts` 把 content/ 生成完整 HTML 页面壳（无 JS 可读），React 只接管交互（明暗主题切换、列表即时过滤）
- **主题**：纯黑底 dark / 纯浅灰底 light，跟随系统 + 手动切换（localStorage 记忆）
- **Rust 预留**：`crates/site-core/` 纯函数工具箱（`cargo test`），未来编译 wasm32 由前端调用，目前未接入构建

## 本机应用托管（apps 子系统）

项目原型直接挂在本站子路径下，不做内容转换（nginx 按路径分发，仍只有一条隧道 ingress）：

- 在线托管：`/tn-lm/`、`/metro-dreams/`、`/orderlevelredro/`、`/hpc_stat/`、`/space_explorer/` —— 清单 `apps/apps.json`（仓库地址在 `privacy.local.json` 的 `githubRepos`，不入库）
- **仅本机**（绝不公网暴露，见 `systemd/user/README.md`）：sciLC（judge 无沙箱执行提交代码）、corkpit（聚合本机 agent 会话）——只绑 127.0.0.1，自己用 SSH 隧道访问

流程：

```bash
node scripts/app-deploy.ts --all   # 克隆/更新到 /home/w/apps/，构建，产物暂存 .apps-build/
./deploy.sh                        # 主站 + 应用 + nginx 片段一并 rsync，nginx -t 后 reload
```

新增应用 = `apps/apps.json` 加一条 + `node scripts/gen-apps.ts` 重新生成 nginx 片段。

## 目录结构

```
content/                      内容唯一源（改这里）
  posts/*.md                  博客文章（frontmatter: title/date/tags/author）
  projects/*.md               项目条目（frontmatter: name/blurb/stack/year/order/local）
  projects/docs/<slug>.md     项目 README 文档（fetch-app-docs.ts 抓取，已脱敏）
  research/<专题>/             调研子版块（block.md + report.md + bibliography.csv + figs/）
  authors.json                作者字段（npm run authors 生成，人工可审后提交）
apps/apps.json                本机托管应用清单（子路径、构建命令、产物目录）
scripts/
  build-content.ts            内容 → 预渲染 MPA 页面壳
  app-deploy.ts               托管应用：克隆/构建/暂存（--all）
  gen-apps.ts                 apps.json → nginx/apps-locations.conf
  fetch-app-docs.ts           抓取项目 README + 截图（脱敏后入库）
  import-tnlm.ts              从公开仓库导入 tn-lm 调研（npm run import:tnlm）
  gen-authors.ts              git 日志提取工具名作者（npm run authors，双重过滤）
  check-privacy.ts            隐私红线检查（build 末步，命中即失败）
src/                          React 组件、页面交互、全局样式
crates/site-core/             Rust 预留位
nginx/demo.conf               源站配置（仅监听 127.0.0.1:8080 + apps 子路径 include）
systemd/user/                 仅本机服务单元（corkpit/sciLC）+ 说明
cloudflared/config.yml.example  隧道路由模板（<TUNNEL-UUID> 占位，protocol: http2）
systemd/cloudflared-tunnel.service  隧道服务单元（完整沙箱）
setup-server.sh               从零重建服务器（幂等）
deploy.sh                     构建 + 部署（主站 + 托管应用 + nginx 片段）
index.html                    根路径跳转页（手写，指向 /blog/）
```

不在仓库里的东西（各自有家）：

- `tunnel-uuid.txt`（仓库根，gitignored）—— setup-server.sh 读取的隧道 UUID
- 笔记与踩坑记录 —— `~/Documents/cloudflared-学习笔记.md`
- 隧道凭据 —— 服务器 `/etc/cloudflared/`（600，专用用户）；管理证书 `~/.cloudflared/cert.pem`

## 日常流程

写文章：`content/posts/` 新建 `YYYY-MM-DD-slug.md` → `git commit` → `./deploy.sh`

本地预览：`npm run dev`（会先重新生成页面壳）

## 改服务器配置后如何生效

```bash
# nginx
sudo cp nginx/demo.conf /etc/nginx/sites-available/demo && sudo nginx -t && sudo systemctl reload nginx

# 隧道路由（改 config.yml.example 后，替换占位符放到服务器）
sudo cp cloudflared/config.yml.example /etc/cloudflared/config.yml  # 手动替换 <TUNNEL-UUID>
sudo systemctl restart cloudflared-tunnel

# systemd 单元（改过加固参数时）
sudo cp systemd/cloudflared-tunnel.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl restart cloudflared-tunnel
```

## 从零重建

```bash
echo "<你的隧道UUID>" > tunnel-uuid.txt
sudo bash setup-server.sh   # 需要 node ≥20
```

## 安全红线

- 凭据（`*.pem`、隧道凭据 json）**永不提交**——private 仓库也不放，防账号被盗时外泄
- 真实 UUID 只存在于服务器和本地 `tunnel-uuid.txt`；仓库里一律 `<TUNNEL-UUID>` 占位
- **作者署名只用 AI 模型/工具名**；`scripts/gen-authors.ts` 从 git 日志提取时双重过滤（真名黑名单 + 工具名白名单），黑名单在 `scripts/privacy.local.json`（gitignored，真名绝不入仓），识别不出就留空
- `scripts/check-privacy.ts` 在每次构建末尾扫描产物（真名/邮箱/UUID/机器名），命中即构建失败
- 笔记（含架构细节）不入库；按"仓库随时可能变公开"的标准维护
