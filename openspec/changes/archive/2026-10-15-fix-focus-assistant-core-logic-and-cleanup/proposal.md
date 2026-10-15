# Proposal: 修复专注助手核心逻辑漏洞、清理历史包袱与优化常驻入口

## Why

专注助手（Focus Assistant）是 WorkBuddy-D 的高频桌面伴侣，融合了番茄钟心流、桌面宠物、任务聚焦以及跨多屏通知 HUD。经过深度代码排查，发现当前实现存在严重的时间冻结、事件丢失、统计失真与样式割裂等问题：
1. **定时器依赖脆弱的 `setInterval` 递减，缺少绝对时间校准**：电脑睡眠、休眠、合盖或 Webview 节流时，倒计时被严重冻结，无法准确按真实物理时间流逝；
2. **通知卡片交互事件监听生命周期层级错误（静默丢操作）**：屏幕中央 HUD 卡片与多屏 Toast 上的“完成任务”与“查看任务”监听被写在四象限组件内，离开该页面时全系统无人响应，导致用户的点击直接丢失；
3. **今日/本周专注统计将“休息时长”盲目累加**：后端返回的休息（Rest）时长未过滤，导致用户的专注成就数据虚高失真；
4. **`getThemeClasses` 遗漏像素小狗主题**：漏掉 `pixel-dog` 和 `pixel-dog-pure`，导致像素小狗在现代白底方块中渲染，视觉崩坏；
5. **修改时间弹窗“保存并重置”假重置**：保存时不调用 `resetTimer()`，运行中的番茄钟继续跑旧时间；
6. **失效幽灵任务残留**：主窗口完成或删除的任务未被悬浮窗检测与清理；
7. **历史包袱与冗余代码**：残留 `tqe-window` 复制粘贴类名、混乱的跨模块引用、点击“开始专注”无差别弹多屏卡片轰炸用户；
8. **交互与入口缺失**：主界面侧边栏缺乏全局常驻呼出入口；气泡宽度有裁切风险。

本变更旨在全面修复上述 6 项逻辑漏洞、清理 3 项兼容包袱与 2 项冗余代码，并优化 3 项交互体验缺陷（含侧边栏刷新按钮上方常驻入口）。

## What Changes

1. **核心逻辑漏洞修复**：
   - 引入真实物理时间戳（`targetEndTime`）差值锚点校准机制，彻底修复电脑睡眠休眠与系统节流导致的倒计时停滞；
   - 将 `complete-task-action` 与 `navigate-to-task` 事件提升至主应用全局监听，保证在任何页面下点击通知卡片的操作均 100% 生效；
   - 在 `focusAssistantService.ts` 统计时严格过滤 `type === "focus"`，剔除休息与异常数据；
   - 补齐 `pixel-dog` 与 `pixel-dog-pure` 主题类名映射；
   - 调整时间弹窗保存逻辑，确保实时更新运行态时间；
   - 增加对已失效幽灵任务的感知与回退兜底。
2. **清理兼容代码与历史包袱**：
   - 移除 `focus-assistant-window.tsx` 中的复制粘贴类名 `tqe-window`；
   - 规范化从 `@/lib/preferences` 导入 `isTauriEnv`，切断对快捷编辑窗口管理器的不当依赖；
   - 精简与抽取宠物动画通用逻辑。
3. **清理冗余代码与死代码**：
   - 移除用户主动在悬浮助手上点击“开始专注”时的冗余全局多屏通知弹窗；
   - 清理接口未使用的死参数。
4. **交互体验与入口优化**：
   - 在主界面侧边栏底部的“刷新数据”按钮正上方，新增常驻的“专注助手”唤起/收起快捷按钮；
   - 优化对话气泡自适应宽度，防止在紧凑悬浮窗边缘被截断；
   - 优化跨屏拖拽逻辑。

## Capabilities

### New Capabilities
- `focus-companion`: 具备绝对时间校准韧性、全局事件闭环、纯净专注统计与侧边栏一键召唤能力的桌面专注伴侣。

### Modified Capabilities
<!-- 无需修改其他已批准 spec -->

## Impact

- **前端核心**：`src/features/focus/hooks/useFocusTimer.ts`、`src/features/focus/components/FocusAssistant.tsx`、`src/features/focus/components/assistant/types.ts`、`src/features/focus/components/pets/SpeechBubble.tsx`、`src/features/focus/api/focusAssistantService.ts`、`src/app/windows/focusAssistantWindowManager.ts`、`src/components/layout/AppLayout.tsx`、`src/focus-assistant-window.tsx`。
- **构建验证**：保证 `pnpm build` 与 `cargo check` 100% 通过。
