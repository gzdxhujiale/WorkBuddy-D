# AGENTS.md

## Project

WorkBuddy-D 是一款专为高效个人规划与专注打造的 Tauri 2 现代化桌面生产力工作空间应用。

- **核心架构**：前端采用 React 19、TypeScript、Vite、Tailwind CSS、TanStack Query、TanStack Router、Zustand、Arco Design 以及 Tiptap 富文本编辑器；后端由 Supabase 提供用户认证（Auth）、PostgreSQL 数据库、RPC 存储过程以及私有 Realtime Broadcast 实时广播通道。
- **视觉体系**：内置「现代极简风（Modern Clean）」与「复古像素 8-Bit 风（Retro Pixel 8-Bit，系统默认）」双套完整设计语言与全窗口联动机制。
- **核心文档导航**：
  - 系统架构、数据流与组件边界详见 [ARCHITECTURE.md](ARCHITECTURE.md)。
  - UI/UX 设计原则、双主题规范与视觉层级详见 [docs/DESIGN.md](docs/DESIGN.md)。
  - 前端工程模式、组件规范与状态管理详见 [docs/FRONTEND.md](docs/FRONTEND.md)。

## Repository Map

- `src/pages/` — 各功能模块路由页面（今日工作台、任务管理、项目中心、知识库、习惯打卡、每日复盘、设置等）。
- `src/components/` — 业务功能组件（如 `today/`, `time-management/`, `habit/`, `knowledge/`, `focus/`）与基础 UI 原子组件（`src/components/ui/`）。
- `src/hooks/` — 封装 TanStack Query 的服务端数据读取、乐观更新与防抖变更 Hook。
- `src/services/` — 各领域的 Supabase 数据访问层，负责 PostgREST 查询与 RPC 写入。
- `src/lib/` — 认证上下文、Supabase 客户端、Query Keys、Realtime 实时同步管理器、离线重放队列及通用运行时工具。
- `src/stores/` — Zustand 管理的客户端纯 UI 状态（选区高亮、折叠状态、双主题切换等）。
- `src/types/`, `src/utils/` — 共享 TypeScript 类型定义、通用工具与辅助函数。
- `src-tauri/` — Rust 桌面端入口、Tauri 窗口与打包配置、系统托盘、系统通知与安全 Capabilities 权限声明。
- `supabase/migrations/` — 权威且只增不改的数据库结构（DDL）、行级安全策略（RLS）、RPC 函数及触发器迁移历史。
- `docs/` — 长期工程文档、产品规格（`docs/product-specs/`）、设计决策与实时数据库架构快照（`docs/generated/db-schema.md`）。
- `.agents/skills/` — 面向 Coding Agent 的专用技能库与自动化工作流指南。
- `openspec/` — OpenSpec 规范体系（`openspec/specs/` 定义生效规约，`openspec/changes/` 管理行为变更提案）。

## Task Routing

针对不同类型的工程任务，请按以下路径首读对应文档、加载匹配技能并执行标准校验：

- **系统架构与依赖边界任务 (Architecture)**
  - 首读：`ARCHITECTURE.md`
  - 技能：`.agents/skills/tauri/`、`codebase-design`
  - 权威源：仓库代码 + `ARCHITECTURE.md`
  - 校验：`node ./node_modules/@hujiale2609/ai-harness/dist/cli.js validate ARCHITECTURE.md`

- **UI 界面与视觉设计任务 (Design & UI)**
  - 首读：`docs/DESIGN.md`
  - 技能：`frontend-design`、`tailwind-design-system`、`arco-design`
  - 权威源：`docs/DESIGN.md` + `src/index.css`
  - 校验：`node ./node_modules/@hujiale2609/ai-harness/dist/cli.js validate docs/DESIGN.md`


- **前端组件与 React 业务开发 (Frontend & React)**
  - 首读：`docs/FRONTEND.md`
  - 技能：`vercel-react-best-practices`、`tiptap`（涉及富文本编辑器时）
  - 权威源：`src/` 源码 + `docs/FRONTEND.md`
  - 校验：`pnpm build`

- **数据库、认证与安全策略任务 (Supabase & Security)**
  - 首读：`docs/SECURITY.md`、`docs/generated/db-schema.md`
  - 技能：`supabase`、`supabase-postgres-best-practices`
  - 权威源：`supabase/migrations/` + `docs/SECURITY.md`
  - 校验：审查 RLS、RPC 权限与 Broadcast 鉴权；运行 `pnpm build`

- **Tauri 原生、多窗口与桌面集成任务 (Tauri & Native)**
  - 首读：`ARCHITECTURE.md`、`src-tauri/tauri.conf.json`
  - 技能：`tauri`、`tauri-window`、`tauri-security`
  - 权威源：`src-tauri/` 目录源码与配置
  - 校验：`cd src-tauri && cargo check`；必要时执行 `pnpm run "tauri build"`

- **系统行为变更与功能演进任务 (OpenSpec Change Workflow)**
  - 首读：`openspec/specs/`
  - 技能：`openspec-explore`、`openspec-propose`、`openspec-apply-change`、`openspec-sync-specs`、`openspec-archive-change`
  - 权威源：`openspec/changes/<change-name>/`
  - 校验：`pnpm build` + 变更验证

## Change Workflow

所有涉及系统行为修改或重要功能演进的任务，必须遵循 OpenSpec 标准变更流转生命周期：

- **生效规约目录**：`openspec/specs/` — 记录当前系统已验证生效的标准行为规约。
- **活动变更目录**：`openspec/changes/<change-name>/` — 存放正在提议或进行中的变更工件：
  - `proposal.md` — 变更背景、动机、核心改动与影响范围评估。
  - `specs/` — 针对受影响领域的 Delta 规约（增加、修改或废弃的行为定义）。
  - `design.md` — 技术设计决策、状态流转与边界考量。
  - `tasks.md` — 可逐步执行、验证并勾选的任务清单。
- **归档目录**：`openspec/changes/archive/` — 变更全量落地并同步至主规约后的历史归档。

### 变更生命周期阶段：
1. **探索与需求明确 (Explore)**：使用 `openspec-explore` 澄清需求并分析架构影响。
2. **提案生成 (Propose)**：使用 `openspec-propose` 一键生成完整的 `proposal.md`、`specs/`、`design.md` 和 `tasks.md`。
3. **实施变更 (Apply Change)**：使用 `openspec-apply-change` 按任务分步编码并进行即时验证。
4. **规约同步与归档 (Sync & Archive)**：验证通过后，使用 `openspec-sync-specs` 将变更合入主规约，并通过 `openspec-archive-change` 归档。

## Engineering Invariants

在对本仓库进行任何代码或架构修改时，必须严格遵守以下工程不变式：

1. **UI 与数据访问严格解耦**：所有 UI 组件（`src/pages/`, `src/components/`）必须通过 `src/hooks/` 和 `src/services/` 获取与变更数据，严禁在页面或组件内部直接调用 Supabase 客户端。
2. **状态所有权分离**：TanStack Query 拥有且仅拥有服务端异步状态，Zustand 仅管理纯客户端本地 UI 状态（选区、浮层展开、双风格切换等），严禁在 Zustand 中伪造服务端持久化真值。
3. **数据库权威性与强安全隔离**：所有用户数据表均受 `user_id` 与 PostgreSQL 行级安全策略（RLS）保护；前端严禁引入 service-role 高权密钥；审计时间戳、软删除标记、完成时间及排序规则由数据库权威决定，前端禁止使用客户端时钟做决策。
4. **实时广播为无状态失效提示**：Supabase Realtime Broadcast (`user:<id>:sync`) 仅作为轻量级变更通知（Invalidation Hint）；前端收到广播后仅使对应 Query Key 失效并通过 RLS 重新拉取，严禁直接将广播载荷作为权威行数据覆盖本地缓存。
5. **知识库按需分级加载**：严格保持知识库的加载边界——优先加载侧边栏框架与目录树，笔记列表与 Markdown/富文本正文仅在选中激活时按需加载，避免全量预拉取。
6. **数据库迁移只增不改**：已应用的 SQL 迁移文件具有不可变性，所有表结构、函数或策略变更必须通过新建追加式迁移文件（`supabase/migrations/`）实施。
7. **原生桌面权限最小化**：Tauri capabilities 权限与 Native API 暴露必须严格按需分配给对应的 Webview 窗口，避免全局滥用高权能力。

## Completion Criteria

在向用户汇报或标记工作完成之前，必须通过以下对应类别的确定性门禁检查：

### 代码与功能修改：
- 运行 `pnpm build`：TypeScript 严格类型检查（`tsc`）零错误，Vite 构建成功打包。
- 若修改了 `src-tauri/` 下的 Rust 代码或配置：执行 `cd src-tauri && cargo check` 无报错。
- 未引入未使用的变量或参数（TypeScript 开启了 `noUnusedLocals` 和 `noUnusedParameters`）。
- 关键用户交互、多窗口联动及数据同步已经过实际验证。

### 规范文档维护：
- 文档内容完全基于已验证的真实仓库事实，杜绝虚构 API 或技术栈。
- 运行 `node ./node_modules/@hujiale2609/ai-harness/dist/cli.js validate [file]` 校验文档结构，必须 0 errors 通过。
- 移除了所有 Harness 初始化占位标记。

## Commands

以下为本仓库日常开发、构建与验证的核心稳定指令列表：

- `pnpm dev` — 启动前端 Vite 本地开发服务器（默认端口 1420）
- `pnpm build` — 执行 TypeScript 严格类型检查并打包生产前端产物
- `pnpm preview` — 本地预览前端构建产物
- `pnpm tauri` — 启动 Tauri 桌面端开发环境（联动前端与 Rust 宿主）
- `pnpm run "tauri build"` — 构建并打包桌面端生产安装包（.msi / .exe）
- `cd src-tauri && cargo check` — 快速校验 Tauri Rust 后端代码与依赖正确性
- `node ./node_modules/@hujiale2609/ai-harness/dist/cli.js validate` — 校验项目中所有受控规范文档的结构合规性
- `node ./node_modules/@hujiale2609/ai-harness/dist/cli.js inspect` — 扫描并生成仓库已验证的事实上下文
- `node ./node_modules/@hujiale2609/ai-harness/dist/cli.js status` — 查看当前 Harness 规约系统的状态与就绪情况

