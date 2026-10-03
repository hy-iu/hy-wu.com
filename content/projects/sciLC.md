---
name: sciLC
blurb: 物理文献 LeetCode 化 —— 约 100 道文献题卡 + 自动评测 judge（FastAPI WebUI + CLI）
stack: [Python, FastAPI]
year: "2026"
order: 7
---
把"读物理文献/教材"变成 LeetCode 式的刷题体验：

- **题卡**：约 100 道、每道五部分，来自文献与教材，答案在 `solution.py` 里现场写
- **评测**：不靠测试用例，靠物理校验 —— 极限行为、量纲、已知精确值（如 Onsager 温度）、数值/符号/维度检查
- **工作台**：FastAPI/uvicorn WebUI + CLI，提交、进度追踪、费曼式提问
- **出题流水线**：AI 工作流把 arXiv 论文转成可判题的题卡；种子题包括阶梯算符、2D Ising Metropolis、Kitaev 链 BdG
