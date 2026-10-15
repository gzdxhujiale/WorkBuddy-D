# AGENTS.md

## Project (项目概述与技术基线)

WorkBuddy-D 是一款以 Tauri 2、React 19 与 Supabase 构建的个人规划和专注桌面应用。主窗口与快捷编辑、专注助手及通知 Webview 共享同一前端代码；Supabase 托管认证、PostgreSQL、PostgREST、RPC 与 Realtime 服务。

- 前端：TypeScript、React 19、Vite、Tailwind CSS 4、Arco Design、TanStack Query、TanStack Router、Zustand、Tiptap。
- 桌面端：Tauri 2 与 Rust；窗口、托盘、通知和自启动能力由 `src-tauri/` 管理。
- 数据端：Supabase Auth、PostgreSQL、RLS、RPC 与私有 Realtime Broadcast；仓库没有独立应用服务器。
- 依赖事实以 `package.json`、`pnpm-lock.yaml` 与 `src-tauri/Cargo.toml` 为准。
- [ARCHITECTURE.md](ARCHITECTURE.md) 说明系统边界；[docs/FRONTEND.md](docs/FRONTEND.md) 说明 React 工程组织；[docs/BACKEND.md](docs/BACKEND.md) 说明 Supabase 与持久化边界。
- [docs/DESIGN.md](docs/DESIGN.md)、[docs/SECURITY.md](docs/SECURITY.md) 和 [docs/RELIABILITY.md](docs/RELIABILITY.md) 分别记录设计、安全和可靠性约定；`openspec/specs/` 是已批准行为规约的权威来源。

## Operating Invariants (工程不变量与操作准则)

- **差分作用域验证**：从 `git diff` 识别本次文件与直接依赖，按改动风险执行聚焦验证；更广范围的检查仅在当前变更需要时扩展。
- **最小因果改动**：围绕用户目标修改最小文件集合，保留既有的无关工作区改动与历史问题。
- **事实锚定**：路径、命令、依赖、API 和架构陈述以当前代码、配置、迁移及锁文件为证据；不确定项写明待核验状态。
- **数据所有权**：TanStack Query 管理远端异步状态，Zustand 管理客户端 UI 状态，PostgreSQL/RLS/RPC 决定持久数据与授权。
- **分层访问**：页面和组件通过 Hook、Service 访问 Supabase；Realtime Broadcast 仅触发 Query 失效，再通过 RLS 读取权威数据。
- **迁移演进**：数据库变更追加到 `supabase/migrations/`，保留已应用迁移内容。
- **原生权限**：新增 Tauri 权限时，依据窗口的实际能力需求更新对应 capability。
- **规格纯粹与正向表达**：`openspec/specs/` 仅规范业务能力契约与系统行为（WHAT）；技术选型、前端缓存、后端驱动与 UI/UX 视觉分别归属 `docs/FRONTEND.md`、`docs/BACKEND.md` 与 `docs/DESIGN.md`。规格编写全程贯彻正向行动化表述，定义明确的不变量与期望状态，杜绝“粉色大象”式负向禁令与历史修补疤痕。

## Task Routing (任务路由与事实来源)

- **React、路由、状态与数据加载**：先读 [docs/FRONTEND.md](docs/FRONTEND.md)，以 `src/` 和 `package.json` 为事实源；按需参考 `.agents/skills/frontend-design/`、`.agents/skills/arco-design/`。
- **系统拓扑、多 Webview、模块边界**：先读 [ARCHITECTURE.md](ARCHITECTURE.md)，以 `src-tauri/`、Vite 入口和前端源码为事实源。
- **数据库、认证、安全与实时同步**：先读 [docs/BACKEND.md](docs/BACKEND.md) 与 [docs/SECURITY.md](docs/SECURITY.md)，以 `supabase/migrations/` 和服务层源码为事实源；按需参考 `.agents/skills/supabase/` 与 `.agents/skills/supabase-postgres-best-practices/`。
- **视觉系统与交互规范**：先读 [docs/DESIGN.md](docs/DESIGN.md) 和 `src/index.css`。
- **Tauri 原生能力**：先读 [ARCHITECTURE.md](ARCHITECTURE.md)、`src-tauri/tauri.conf.json` 和对应 capability；按需参考 `.agents/skills/tauri/`。
- **用户可见行为或数据契约变化**：先查看 `openspec/specs/`，按仓库现存 OpenSpec 流程在 `openspec/changes/` 建立和验证变更。
- **文档维护**：使用全局 `ai-harness` 命令；受管文档为 `AGENTS.md`、`ARCHITECTURE.md`、`docs/FRONTEND.md`、`docs/BACKEND.md`。
- **来源冲突**：已批准规格决定产品行为；运行时代码/config 决定当前实现事实；迁移历史决定数据库演进事实。两项权威来源存在无法消解的冲突时，先列清矛盾和可选解释，再请求人工判断。

## Commands (高频指令集)

- 安装项目依赖：`pnpm install`
- 启动 Vite：`pnpm dev`
- 类型检查与前端生产构建：`pnpm build`
- 启动 Tauri 桌面开发环境：`pnpm tauri`
- 桌面安装包构建：`pnpm run "tauri build"`
- Rust 检查：在 `src-tauri/` 执行 `cargo check`
- 检查受管文档状态：`ai-harness status`
- 更新项目事实扫描：`ai-harness inspect`
- 校验全部适用受管文档：`ai-harness validate`
- 单文档校验：`ai-harness validate docs/FRONTEND.md --json`
- 检查 OpenSpec CLI：`openspec --version`

## Completion Criteria (任务准出与交付标准)

- 代码修改按影响范围运行对应构建或检查；前端代码改动以 `pnpm build` 通过为准，Rust 改动增加 `cargo check`。
- 受管文档修改后运行 `ai-harness validate <file> --json`；全量文档变更再运行 `ai-harness validate` 和 `ai-harness status`。
- 文档事实与仓库实现一致；所有受管章节完整，且不残留 Harness 占位符。
- 最终检查 `git diff`，确认差异属于本次目标，并在交付说明中列出验证命令及结果。

## Ask for Human Judgment When (人工介入条件)

- 需求存在会改变数据语义、用户流程或安全边界的多种合理解释，且当前 OpenSpec 与代码无法确定唯一方向。
- 工作将清除或改写未备份的用户数据、已发布历史、密钥或大范围用户内容。
- RLS、凭证、隐私、计费或 Tauri 原生权限缺少必要产品/安全决定。
- 两份权威规格冲突，或需求要求改变系统信任边界、部署形态和支持平台。

提问时按以下结构提供足够上下文：

1. **阻碍与证据**：指出具体文件、配置、规格或操作的影响。
2. **可选路径**：列出可行方案及其主要利弊和影响范围。
3. **建议与求证**：给出有证据支撑的推荐方案，并请求用户决定需要裁决的部分。
