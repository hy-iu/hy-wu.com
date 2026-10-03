---
name: corkpit
blurb: 多智能体控制面 —— 会话观测、token 成本 Sankey、模型路由（本机服务）
stack: [TypeScript, Node]
year: "2026"
order: 8
local: true
---
聚合本机全部 AI 编码 agent 的会话记录：多会话观测、token 花费 Sankey 图、MCP/模型配置一览与路由。Node 常驻服务，只绑 127.0.0.1:4177，不暴露公网；VS Code 扩展（cockpit-vscode）通过 iframe 内嵌它。
