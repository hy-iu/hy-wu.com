---
name: space_explorer
blurb: Graph Workspace —— 本地图优先的图工作台，把标签页、文件、笔记、代码、AI 检索结果统一为图节点
stack: [React, TypeScript, Zustand, "react-force-graph-3d", Dexie, Monaco]
year: "2026"
order: 6
---
以图为中心的桌面工作台：所有资源（浏览器标签页、本地文件、笔记、代码、AI 检索结果）都是同一个共享图里的节点，靠 references、imports 之类的关系连边。本地优先 —— MVP 直接索引文件夹成图节点，条目以卡片打开，可视化代码结构并持久化布局；计划以 Tauri 做桌面壳。

![space_explorer 运行截图](/projects/img/space_explorer/screenshot.png)
