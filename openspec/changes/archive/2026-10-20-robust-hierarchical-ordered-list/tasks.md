# Tasks

## 1. 展现层：CSS 级联计数器与双主题适配

- [x] 1.1 在 `src/index.css` 中通过原生 `::marker { content: counters(tiptap-ol, ".") ". "; }` 替代脱离文档流的 `::before`，并彻底拔除 `RichTextEditor.tsx` 中的 Tailwind 覆盖类名
- [x] 1.2 在 `src/index.css` 中移除多级列表的竖向引导虚线，保留双主题（现代默认与 Retro Pixel）纯净自然缩进与层级对齐

## 2. 事务层：连续列表自动缝合扩展（ConsecutiveListJoinPlugin）

- [x] 2.1 创建 `src/components/editor/extensions/ConsecutiveListJoinPlugin.ts`，利用 `appendTransaction` 自动检测并缝合同级紧邻的 `<ol>`/`<ul>` 节点，保持列表连续性与 `start` 序号不中断
- [x] 2.2 在 `src/components/editor/presets/full.ts`、`src/components/editor/presets/compact.ts` 与 `src/components/editor/index.ts` 中完成扩展注册与导出

## 3. 交互层：智能退格与删除守卫（Smart Backspace & Lift Guard）

- [x] 3.1 在 `src/components/editor/extensions/CustomKeymapExtensions.ts` 中实现阶梯式退格守卫（嵌套子项行首优先单步 Outdent 提升，根级空项解散变段落，杜绝粗暴粘连上一行）
- [x] 3.2 编写针对列表退格守卫与缝合机制的自动化单元测试 `src/components/editor/extensions/listGuard.test.ts`，并通过 `pnpm test` 验证

## 4. 体系验证与构建检查

- [x] 4.1 运行 `pnpm build`、单元测试与 `pnpm lint:boundaries`，确保前端类型检查、生产构建与架构边界零错误
