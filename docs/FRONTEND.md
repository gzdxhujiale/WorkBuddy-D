# 前端工程规范 (Frontend Engineering)

## Frontend Overview

WorkBuddy-D 前端基于 React 19、TypeScript、Vite 7、Tailwind CSS 与 Arco Design 构建。系统采用多 Webview 架构，主窗口与辅助弹窗（任务极速编辑 `quick-edit.html`、专注助手 `focus-assistant.html`、通知浮层 `notification-toast.html`）共享状态与主题规范。前端以 TanStack Router 承载路由，TanStack Query 驱动服务端异步状态，Zustand 掌控纯客户端 UI 状态。

## Source Structure

前端源码统一组织在 `src/` 目录下：
- `src/main.tsx`：主窗口入口，初始化认证上下文、QueryClient、路由与主题注入。
- `src/pages/`：路由级页面组件（`TodayPage`、`FourQuadrantsPage`、`ProjectsPage`、`HabitPage`、`KnowledgePage`、`DailyReviewPage`）。
- `src/components/`：业务功能组件目录（`today/`、`time-management/`、`habit/`、`knowledge/`、`focus/`）及基础原子组件库（`src/components/ui/`）。
- `src/hooks/`：领域数据 Hook，封装 TanStack Query 的加载、乐观更新与突变操作。
- `src/services/`：Supabase 数据访问层，隔离 PostgREST 查询与 RPC 写入。
- `src/stores/`：Zustand 客户端 UI 状态（选区、抽屉展开、双主题切换等）。
- `src/lib/`：认证上下文、Query Keys、实时同步引擎、离线重放队列与日期/排期算法。
- `src/types/`：TypeScript 领域与数据模型类型定义。

## Component Design

组件划分严格遵循单一职责与高内聚原则：
- **容器与页面组件 (`src/pages/`)**：负责路由参数解析、页面骨架编排与领域 Hook 绑定。
- **业务领域组件 (`src/components/`)**：封装特定领域的交互逻辑与组合呈现，通过 Props 接收数据或消费领域 Hook。
- **基础原子组件 (`src/components/ui/`)**：无业务侵入的通用 UI 基座（如 Button、Dialog、Modal、Drawer、Input 等），集成 `useAppThemeStyle` 支持双主题样式穿透。

## Design System Usage

项目内置「现代极简（Modern Clean）」与「复古像素 8-Bit（Retro Pixel 8-Bit）」双套完整设计系统：
- 基础组件优先采用 `src/components/ui/` 中的封装组件。
- 业务涉及复杂弹层、下拉菜单与表格时，使用 `@arco-design/web-react` 配合 `getChildrenPopupContainer={() => document.body}` 防止弹层溢出截断。
- 像素风组件采用 `src/components/pixel/` 中的专用像素图标与像素容器，保持整体 8-Bit 艺术一致性。

## Styling

- 样式系统采用 Tailwind CSS 配合 CSS 变量（`src/index.css`）驱动。
- 色彩与层级定义遵循 [docs/DESIGN.md](DESIGN.md) 的语义化 Token 体系（`bg-background`、`bg-card`、`text-foreground`、`text-muted-foreground`、`border-border` 等）。
- 严禁在业务组件中硬编码十六进制色值，所有主题色必须映射至 Tailwind 语义类或设计系统 Token。

## State Management

前端严格贯彻状态所有权清晰分离原则：
- **服务端异步持久化状态**：由 TanStack Query 独占管理，包括任务、项目、习惯、笔记、复盘等。
- **客户端全局 UI 状态**：由 Zustand (`src/stores/uiStore.ts`) 管理，包括选区高亮、折叠状态、双主题切换及时间轴联动悬停 ID。
- **本地瞬时交互状态**：由组件内部 `useState` / `useReducer` 管理（如输入框 Draft、悬停浮层、局部展开等）。

## Data Fetching

- 所有服务端数据查询均通过 `src/hooks/` 封装的 TanStack Query Hook 获取。
- Query Key 统一由 `src/lib/syncEngine.ts` 中的 `queryKeys` 工厂方法生成（严格带有 `userId` 作用域）。
- 页面与组件严禁直接调用 Supabase 客户端执行数据读取。

## Routing and Navigation

- 路由由 TanStack Router 驱动，在 `src/router.tsx` 中定义路由表。
- 页面路由采用动态懒加载导入，确保主应用包体积精简与首屏秒开。
- 导航跳转统一使用 TanStack Router 的 `useNavigate` 或 `<Link />` 组件，保证类型安全。

## Forms and Validation

- 轻量表单与就地录入（如 `TodayQuickAdd`）采用受控输入配合键盘事件监听（Enter 提交、Escape 取消）。
- 复杂表单使用受控状态结合即时类型校验，提交前进行有效性检查并提供明确的错误反馈。

## Loading

- **加载态 (Loading)**：数据获取中展示骨架屏或呼吸动画指示器，避免布局大幅抖动。
- **空态 (Empty)**：当列表为空时，展示图文结合的引导性空状态面板（如今日无待办时提供快捷录入引导）。
- **错误态 (Error)**：捕获 PostgREST 异常并通过全局 Toast 或边界 Fallback 给予用户可恢复的操作提示。

## Effects and Side Effects

- 副作用严格限制在 `useEffect` 或事件处理函数中，严禁在渲染流程中直接触发状态更新。
- 定时器、广播订阅与窗口事件监听器必须在 Effect 清理函数中完整注销，防止内存泄漏。

## Hooks and Reusable Logic

- 通用交互逻辑与外部系统抽象（如主题感知 `useAppThemeStyle`、防抖突变 `useDebouncedMutation`、乐观同步 `useOptimisticSync`）沉淀于 `src/hooks/`。
- 自定义 Hook 严格遵循以 `use` 开头的命名规范并保持高内聚性。

## TypeScript

- 全局开启 TypeScript 严格模式（`strict: true`、`noUnusedLocals: true`、`noUnusedParameters: true`）。
- 领域实体类型统一定义在 `src/types/` 中，严禁使用 `any` 绕过类型检查。

## Performance

- 对高频重计算的过滤、排序与象限分组使用 `useMemo` 进行记忆化。
- 跨多组件传递的回调函数使用 `useCallback` 稳定引用。
- 富文本编辑器采用按需加载策略，避免在非激活状态下全量初始化重型编辑器引擎。

## Accessibility Implementation

- 交互按钮与复选框均提供标准语义标签（`role="checkbox"`、`aria-checked`）与 `title` 属性。
- 关键表单支持全键盘操作（Tab 切换焦点、Enter 提交、Escape 退出）。

## Testing

- 构建与类型门禁以 `pnpm build`（`tsc && vite build`）为基准执行严格校验。
- 关键排期与逾期计算逻辑（如 `taskBelongsToToday`、`isTaskOverdue`）具备确定性的输入输出边界。

## Frontend Invariants

1. **UI 与数据访问严格解耦**：组件严禁直接调用 Supabase 客户端，必须通过 Hook 与 Service 层操作。
2. **状态所有权分离**：TanStack Query 拥有服务端状态，Zustand 仅掌控客户端 UI 状态，严禁在 Zustand 中伪造服务端真值。
3. **实时广播为无状态失效提示**：接收到 Broadcast 广播后仅失效对应 Query Key 重新拉取，禁止直接覆盖本地缓存。
4. **主题样式统一穿透**：所有新增组件必须同时适配现代极简风与复古像素 8-Bit 风。

## Frontend Review Criteria

- [ ] 是否通过 `pnpm build` 且无任何 TypeScript 报错与未使用的变量？
- [ ] 数据流向是否符合 Hook -> Service -> Supabase 的单向分层？
- [ ] 新增交互是否同时支持键盘快捷操作与双主题视觉呈现？
- [ ] 是否正确处理了加载态、空状态与异常回滚？
