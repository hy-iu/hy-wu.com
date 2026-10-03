# sciLC — Scientific LeetCode · Physics

把"读文献、补知识"改造成刷 LeetCode 式的主动通关：**题目来自论文与教材，Accepted 来自机器判题**。物理题没有现成的 test case？有——极限检验、精确已知值（Onsager 温度）、对称性残差（粒子–空穴对称 < 1e-9）都可以变成自动判据。

## 为什么能找回刷题的沉浸感

| LeetCode | sciLC |
|---|---|
| 题目描述 | 五段式题卡：statement / input / output / algorithm(≤5步) / sanity check |
| 提交代码 | 改 `problems/<题>/solution.py` |
| Submit → Accepted | `python -m scilc.judge problems/<题>` → 逐用例 PASS/FAIL，全绿 = Accepted |
| 难度/标签/通过率 | 题卡元数据 + [dashboard.html](dashboard.html) 自动统计 |
| 每日一题 | 闯关 quizzes（费曼式，一次一题、立即判分） |

## 快速开始

### WebUI（推荐）

```bash
pip install -e .          # 安装 scilc（含 fastapi/uvicorn）
python -m scilc.web       # http://localhost:8000
# 首次需构建前端：cd web && npm install && npm run build
```

浏览器打开 `http://localhost:8000` 即可：筛选 100 题 → 读五段式题卡 → 编辑 `solution.py` → Submit 判题 → 看逐用例 `PASS/FAIL + detail` → AC 后可见 `reference.py`；进度/闯关/学习路线同页可用。与 CLI 完全互通（`progress.json` / `problem.json` 单调状态一致）。

### CLI（无浏览器 / 自动化）

```bash
# 1. 挑一道题，读题卡（2 分钟扫完骨架）
cat problems/P001-ladder-operators/problem.json

# 2. 只改 solution.py，实现题卡 output 要求的函数
#    卡住了让 AI 按 problem.json 的 hints 逐条解锁（先弱后强）

# 3. 提交判题
python -m scilc.judge problems/P001-ladder-operators

# 4. 看进度面板（legacy，自包含 HTML）
python -m scilc.dashboard   # 生成 dashboard.html（WebUI 已内置进度页，此为备用）
```

## 目录结构

```
scilc/                  核心包
  judge.py              判题机（Accepted/WA/RE，写回状态与历史）
  harness.py            判题脚手架：t() 记用例；numeric_close / symbolic_equal / pint 量纲
  new_problem.py        新题脚手架
  dashboard.py          进度面板渲染
problems/               题库（每题一个目录）
  P00X-slug/
    problem.json        题卡（五段式 + hints + source）
    solution.py         你唯一要改的文件
    check.py            验收用例（判题合同：run_tests() -> list）
    reference.py        参考解（AC 后再看！）
    notes.md            逻辑流笔记 + 提示解锁记录
quizzes/                费曼闯关卡（JSON，一次一题）
demos/                  公式最小 demo（热身区，不计分）
progress.json           活动历史（判题机自动追加）
dashboard.html          进度面板（python -m scilc.dashboard 重新生成）
.agents/skills/         三个 AI 工作流 skill（本仓库内生效）
  scilc-paper           论文 → 可判题的题目（arXiv 全自动拆解）
  scilc-quiz            费曼闯关（一次一题、即时判分、错题点评）
  scilc-demo            公式 → 30 秒可运行 demo + 极限自检
```

## 三条 AI 工作流（本仓库内对 AI 说即可触发）

1. **论文题化**："把 arXiv:cond-mat/0010440 拆成一道题" → AI 取论文、出题卡、写判题用例、自检后入库。
2. **费曼闯关**："考考我统计物理" → 一次一题、✅/❌ 即时判分、错题点评，成绩进进度系统。
3. **公式 Demo**："这个公式帮我跑一下" → ≤60 行带物理注释的脚本 + 极限自检 + 图。

## 种子题库

| 题号 | 题目 | 类型 | 难度 | 验收核心 |
|---|---|---|---|---|
| P001 | 谐振子阶梯算符 | derivation | Easy | 对易子结构 + 能谱 ½,3/2,5/2,7/2 |
| P002 | 2D Ising Metropolis | simulation | Medium | 比热峰位 ≈ Onsager T_c = 2.269 |
| P003 | Kitaev 链 BdG | paper | Hard | Majorana 零模 + μ=±2t 能隙关闭 + PHS |

P003 grounding：[Kitaev, "Unpaired Majorana fermions in quantum wires" (arXiv:cond-mat/0010440)](https://arxiv.org/abs/cond-mat/0010440)。

## 给 AI 的约定（维护者/agent 必读）

见 [AGENTS.md](AGENTS.md)：判题合同、新题入库自检流程、状态字段语义。

## 背景

设计动机与方法论来自工作区 `chat-history.gemini.md`（被动吸收 → 主动通关的四条策略），工具生态调研见 `research-tooling-report.zcode.md`（arxiv / paper-search MCP、sympy 等已装入 ZCode）。
