# 仅本机服务单元（systemd --user）

这两个服务含敏感能力，**绝不公网暴露**（无 ingress、无 nginx location）：

| 服务 | 端口 | 风险 |
|---|---|---|
| corkpit | 127.0.0.1:4177 | 聚合本机全部 AI agent 会话记录、token 花费、MCP/模型配置 |
| sciLC | 127.0.0.1:8000 | judge 以本机用户身份无沙箱执行提交的 Python；`/api/agent/config` 可改 agent 配置 |

## 启用

```bash
# 允许用户单元在未登录时运行（一次）
sudo loginctl enable-linger w

# corkpit（源码 /home/w/apps/my_tools/corkpit，由 app-deploy 克隆/构建）
mkdir -p ~/.config/systemd/user && cp systemd/user/corkpit.service ~/.config/systemd/user/
node scripts/app-deploy.ts my_tools   # 若清单里没有，见下方手动克隆
systemctl --user daemon-reload && systemctl --user enable --now corkpit

# sciLC（源码 /home/w/apps/sciLC）
cp systemd/user/scilc.service ~/.config/systemd/user/
systemctl --user daemon-reload && systemctl --user enable --now scilc
```

corkpit 的源码在 my_tools 仓库的子目录，手动准备：

```bash
gh repo clone <my_tools仓库> /home/w/apps/my_tools -- --depth 1
cd /home/w/apps/my_tools/corkpit && npm ci --no-audit --no-fund && npm run build
```

## 访问（仅自己）

```bash
# 从笔记本等设备经 SSH 隧道访问 NUC 上的服务：
ssh -L 4177:127.0.0.1:4177 -L 8000:127.0.0.1:8000 w@<nuc地址>
# 本机浏览器打开 http://localhost:4177（corkpit）/ http://localhost:8000（sciLC）
```
