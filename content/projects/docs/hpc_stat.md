# Unified GPU + LLM Table

基于 Astro + TypeScript 的参数工作台，包含硬件对比页、大模型统计页、AI Agent 工具页、模型 × 工具关联表和模型 × 硬件关联表：

- `/`（`index.html`）：GPU / FPGA / ASIC / CPU 参数、价格与能效对比。
- `/models.html`：LLM 价格、上下文、评测与核验状态宽表。
- `/agent-tools.html`：AI IDE、vibe coding CLI、云端 coding agent、IDE 插件的接入方式、能力、价格与核验状态宽表。
- `/model-tools.html`：模型在各 Agent 工具中的接入方式、价格消耗口径、能力适配与评价的稀疏关联表。
- `/model-hardware.html`：可自托管模型在各加速硬件上的部署方式、量化精度、显存需求与适配评分的稀疏关联表。

## 功能

- 多页面：硬件参数页、LLM 数据页、Agent 工具页、模型 × 工具与模型 × 硬件关联表共用一套静态发布方式。
- 任意字段排序：点击表头或使用排序字段下拉框。
- 全局搜索：型号、架构、显存、备注等字段都会参与搜索。
- 字段筛选：可添加多个条件，支持文本包含和数值比较。
- 列设置：显示或隐藏任意字段。
- 价格更新：支持粘贴 JSON，或读取 `data/prices.json`。
- 数据导入/导出：用 JSON 合并 GPU 数据，按 `id` 覆盖。
- 本地持久化：导入和价格更新会保存到浏览器 `localStorage`。数据带种子版本号（`src/islands/FlatTable.ts` 的 `GPU_SEED_VERSION`），修改 `data/gpus.json` 种子数据后递增该值，旧缓存会被丢弃并重新加载最新种子。

## 本地使用

需要 Node.js ≥ 22.12.0。

```bash
npm install
npm run dev
```

然后访问 `http://localhost:4321`。

### 本机密钥文件接入

`模型接入` 页支持通过本机桥接读取 `~/.secret/meet2ai.env`，而不把 API Key 交给浏览器。一个端点可配置多把 Key；桥接会逐把请求 `/models`，分别显示每把 Key 可访问的模型。该文件可使用以下键名：

```dotenv
MEET2AI_BASE_URL=https://api.example.com/v1
MEET2AI_API_KEY_personal=sk-...
MEET2AI_API_KEY_team=sk-...
```

也可保留单 Key 格式：`MEET2AI_API_KEY=sk-...`。多 Key 的另一种格式是 `MEET2AI_API_KEYS` JSON 数组，例如 `[{"id":"personal","name":"个人","key":"sk-..."}]`。变量名后缀或 JSON 的 `name` 只用作本地显示名，绝不会返回 Key。

分组标签优先从每把 Key 的模型接口响应中的 `group`、`groups`、`model_group` 或 `metadata.group` 字段读取。标准 OpenAI 兼容的 `/models` 响应通常不包含这些字段；这种情况下页面会明确显示“模型 API 未提供分组”，但仍会显示实际可访问的模型，避免把模型名或 Key 名误判为业务分组。

启动桥接时自行设置一个临时授权令牌；它只用于网页访问本机桥接服务，不是 API Key：

```bash
MODEL_ACCESS_BRIDGE_TOKEN='your-local-token' npm run model-bridge
```

默认接受 `http://127.0.0.1:4321` 和 `http://localhost:4321`。若页面运行在其他端口，可显式指定来源和文件路径：

```bash
MODEL_ACCESS_BRIDGE_TOKEN='your-local-token' \
MODEL_ACCESS_BRIDGE_ORIGIN='http://127.0.0.1:4325' \
MODEL_ACCESS_ENV_FILE="$HOME/.secret/meet2ai.env" \
npm run model-bridge
```

在“模型接入 -> 本机密钥文件”填入桥接地址和令牌后点击“授权”。桥接服务会顺序探测所有 Key；选择其中一个配置后可再次查询该 Key 的完整模型列表。每次查询都会重新读取 env 文件；它只监听 `127.0.0.1`，不会向网页返回 API Key，也不会写入该文件。

构建静态产物：

```bash
npm run build
```

产物输出在 `dist/` 目录，可直接部署到 GitHub Pages、Cloudflare Pages、Netlify 等静态托管平台。

类型检查：

```bash
npm run check
```

## LLM 数据核验

`models.html` 只把 `data/models.json` 中 `verification.verifiedFields` 标记过的字段加粗；没有来源或未核验的字段会以灰色显示。来源可以是官方页面、公开评测页，也可以是人工提供的截图/采购单等明确证据，但要在 `verification.sources` 中写清楚。人工证据类来源（截图、采购单等）的 `url` 允许为空字符串，此时 `label` 必须写清证据形式；空 URL 不代表可以省略来源说明。

数据快照约定：`verification.checkedAt` 表示该条记录最近一次成功核验的日期；页面与文档不得把旧快照数据当作实时值引用。当前模型数据主体快照为 2026-08-06（167 个模型，含 GPT-5.6 Sol/Terra/Luna、Claude Opus 5/Mythos 5、Gemini 3.5/3.6 Flash、Kimi K3、Qwen3.8-Max、GLM-5.2 等），Arena Elo 主体为 2026-08-01 arena.ai 文本榜快照（脚本可直接解析 SSR 表格），GPU 价格为 2026-04~05 人工报价快照，详见 `REFERENCE_SOURCES.md` 的「数据快照时间线」。

评测数据不要混用口径：旧的 `MMLU`、`HumanEval`、`GSM8K`、`MATH` 字段只填同名 benchmark；`MMLU-Pro`、`GPQA-Diamond`、`SWE-Bench Verified`、`Terminal-Bench` 等现代评测写入 `evals.*` 字段。

更新模型数据统一跑 Python 富化脚本。`data/model-overrides.json` 保存人工维护的精选模型、官方价格、评测和备注；脚本会用这些 curated overrides 作为基底，再从 OpenRouter 生成浏览器读取的 `data/models.json`。能结构化解析的来源绝不交给 LLM。

生成宽表数据时运行（macOS / Linux）：

```bash
python3 scripts/enrich_model_data.py --generate-openrouter --target-count 150 --min-model-count 150 --write --online --output .cache/model-enrich-report.json
```

仅做增量价格/参数更新（保留现有模型清单，不重新选型）时运行：

```bash
python3 scripts/enrich_model_data.py --write --online --min-model-count 150 --output .cache/model-enrich-report.json
```

只做离线一致性校验、不写回时运行：

```bash
python3 scripts/enrich_model_data.py --verify-only --min-model-count 150 --output .cache/model-verify-report.json
```

Windows 下把 `python3` 换成 `python`、路径分隔符换成 `\` 即可。依赖安装：`python3 -m venv .cache/venv && .cache/venv/bin/pip install -r requirements.txt`。

需要在线核验官方页面字符串时再加 `--online`。如果页面文本不够结构化，可显式增加 `--deepseek`；脚本只从 `.env` 读取 `DEEPSEEK_API_KEY`，不会把 key 写入源码或输出。旧的 Node 校验脚本已弃用。

`data/model-fields.json` 定义 LLM 表格字段、默认显示列和厂商链接，`src/islands/FlatTable.ts` 负责加载配置和渲染。

## Agent 工具数据核验

`agent-tools.html` 读取 `data/agent-tools.json` 和 `data/agent-tool-fields.json`。工具页沿用模型页的核验约定：只有写入 `verification.verifiedFields` 的字段会加粗显示；非结构化评价、体验备注和随计划变化的价格/配额应保持部分核验或未核验，不要当作客观 benchmark。

Agent 工具页当前约定：

- `categoryTags` / `deploymentTags` 都允许多值，用彩色标签显示，避免把「IDE + CLI + Cloud agent」错误压扁成单一类型。
- `pricing.freeTier` 与 `pricing.openSource` 分开维护；免费可用不等于开源。
- `pricing.plans` 保存各级套餐，优先写官方月费；无法静态确认时写 `Custom` / `Usage-based` / `See official pricing page`，不要猜。
- 对于 CLI/插件免费、但底层模型按 token 计费的工具，`startingUSD` 可以是 `0`，并在 `pricing.usageMeter` 中说明 provider 计费口径。

模型 × 工具关系的数据源仍使用稀疏记录：每条记录用 `toolId`、`modelId`、接入方式、消耗口径、能力评价和来源描述一个已观察到的组合。`model-tools.html` 会把这些记录 pivot 成真正的矩阵：模型是行、工具是列，空白 cell 表示暂无记录；评分字段是 1-5 的人工适配度（不是 benchmark），用于排序和筛选候选组合。

模型 × 硬件关系同样使用稀疏记录（`data/model-hardware.json`）：每条记录用 `modelId`、`gpuId`、部署方式（单卡/单设备/多卡/集群）、量化精度、卡数、最低显存、吞吐与成本说明和来源描述一个已观察到的部署组合。`model-hardware.html` 把它 pivot 成矩阵：模型是行、硬件是列；`memoryFit` / `bandwidthFit` / `computeFit` / `fitScore` 均为 1-5 的人工适配度（不是 benchmark），仅用于排序和筛选候选部署方案。`inputTps` / `outputTps` / `concurrency` / `perfSource` 记录 prefill 输入与 decode 输出速度（tok/s）、当时并发数与速度数据口径；速度数字允许摘自博客、论坛帖子、新闻等公开实测，不必全来自官方汇总，但要在 `perfSource` 中写清口径。页面把这三个指标画成单元格背景柱状图：输入/输出/并发三根竖条横向并排、填满格子，柱高按全表全局最大值归一（筛选时标尺不变），颜色越深数值越高；格内最后一行以左/中/右对齐显示对应数值。筛选后完全没有记录的硬件列会自动隐藏（列设置按钮会标注自动隐藏数量）。新抓取到的模型、硬件、工具条目一律并入对应数据表，不得以不在既有清单为由过滤。

## 价格更新格式

```json
[
  {
    "id": "nvidia-rtx-4090",
    "priceUSD": 1799,
    "merchant": "manual quote",
    "source": "local",
    "available": true
  }
]
```

也可以用 `model` 匹配：

```json
[
  {
    "model": "NVIDIA GeForce RTX 4090",
    "priceUSD": 1799
  }
]
```

## 部署

GitHub Pages 自动部署已配置在 `.github/workflows/deploy.yml`：推送 `main` 分支后，CI 会运行 Python 数据验证 → Node 类型检查 → Astro 构建，将 `dist/` 部署到 Pages。

## 后续可接的价格源

建议不要直接爬电商页面作为长期方案。更稳的是把价格更新做成一个独立后端任务：

- 定时调用供应商或采购系统 API。
- 输出统一格式的 `prices.json`。
- 前端点击“更新价格”读取这个 JSON。
