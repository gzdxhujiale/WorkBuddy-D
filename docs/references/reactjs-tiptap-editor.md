# reactjs-tiptap-editor 使用指南

> 项目依赖版本：`reactjs-tiptap-editor@1.0.32`
>
> **项目结论：WorkBuddy-D 使用 `reactjs-tiptap-editor` 作为业务富文本编辑器，不直接以 Tiptap 组装业务编辑器。** `@tiptap/*` 是该封装及共享组件的底层依赖，仅在维护 `src/components/ui/reactjs-tiptap-editor.tsx` 时使用。
>
> 官方文档：[Getting Started](https://reactjs-tiptap-editor.vercel.app/guide/getting-started.html) · [Toolbar](https://reactjs-tiptap-editor.vercel.app/guide/toolbar.html) · [Bubble Menu](https://reactjs-tiptap-editor.vercel.app/guide/bubble-menu.html) · [i18n](https://reactjs-tiptap-editor.vercel.app/guide/internationalization.html) · [Custom Theme](https://reactjs-tiptap-editor.vercel.app/guide/custom-theme.html) · [Migration Guide](https://reactjs-tiptap-editor.vercel.app/guide/how-to-migrate.html) · [GitHub](https://github.com/hunghg255/reactjs-tiptap-editor)

## 1. 定位

`reactjs-tiptap-editor` 是基于 Tiptap 3 和 shadcn 风格组件的 React 富文本编辑器。当前版本采用组合式架构：编辑器实例由 Tiptap 的 `useEditor` 创建，官方包提供 `RichTextProvider`、各个扩展、工具栏按钮、气泡菜单和国际化/主题能力。

它不是一个必须直接使用的单体 `<RichTextEditor />` 组件。项目将它封装在 `src/components/ui/reactjs-tiptap-editor.tsx`，业务界面必须复用该封装，不要各自创建 `useEditor` 实例或直接改动 `node_modules`。

## 2. WorkBuddy-D 接入规范

共享组件 `ReactjsTiptapEditor` 是唯一的富文本接入点。它负责扩展组合、中文 locale、样式、输入去重和外部内容同步；业务层只传入序列化内容与保存回调。

| 场景 | 调用位置 | 工具栏 | 持久化约定 |
| --- | --- | --- | --- |
| 知识笔记 | `src/components/knowledge/KnowledgePanel.tsx` | 显示 | `notes.content` 保存 Tiptap JSON 字符串。 |
| 每日复盘 | `src/components/daily-review/DailyReviewPanel.tsx` | 显示 | 编辑器内容为 JSON 字符串；服务层将其包装为 `daily_reviews.content` 的 `{ text }` JSONB 载荷。 |
| 任务描述 | `src/components/time-management/TaskQuickEdit.tsx` | 隐藏 | `time_management_tasks.description` 保持 `text`，保存 Tiptap JSON 字符串。 |

共享组件的公开参数：

```tsx
<ReactjsTiptapEditor
  content={content}
  onChange={setContent}
  placeholder="输入内容…"
  showToolbar={false}
/>
```

`showToolbar` 默认为 `true`。任务快捷编辑窗必须传 `false`，以保持紧凑；气泡菜单和 `/` 命令仍可用。该封装将 `/` 菜单挂到 `document.body`；任务窗口的点击外部关闭逻辑必须将其识别为内部交互，且 `src/index.css` 负责使它高于 Tauri 浮层。任务摘要视图必须调用 `getTaskDescriptionText`，不得直接渲染 JSON 字符串。历史纯文本任务描述由共享组件读取兼容。

## 3. 安装

```bash
pnpm add reactjs-tiptap-editor@latest
```

官方文档示例基于 Tiptap 3 的独立基础扩展。所有 `@tiptap/*` 包应使用同一个版本号；本项目当前使用 `3.29.2`。

## 4. 最小可运行示例

```tsx
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { RichTextProvider } from 'reactjs-tiptap-editor'
import { Placeholder } from '@tiptap/extension-placeholder'
import { RichTextBold } from 'reactjs-tiptap-editor/bold'
import 'reactjs-tiptap-editor/style.css'

const extensions = [
  StarterKit,
  Placeholder.configure({
    placeholder: "输入 '/' 使用命令",
  }),
]

export function Editor() {
  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: '<p>Hello world</p>',
  })

  if (!editor) return null

  return (
    <RichTextProvider editor={editor}>
      <div className="toolbar">
        <RichTextBold />
      </div>
      <EditorContent editor={editor} />
    </RichTextProvider>
  )
}
```

官方 Getting Started 示例使用独立的 `Document`、`Text`、`Paragraph`、`ListItem`、`TextStyle`、`Dropcursor`、`Gapcursor`、`HardBreak`、`TrailingNode` 和 `Placeholder` 组成 Base Kit。本项目已有 `StarterKit@3.29.2`，它已经包含常用基础节点和标记，因此新增模块优先复用 `StarterKit`，只额外添加确实需要的官方扩展。

## 5. 数据读写

Tiptap 编辑器支持 HTML、纯文本和 JSONContent。应用内长期保存建议使用 JSON：

```tsx
const editor = useEditor({
  immediatelyRender: false,
  extensions,
  content: savedJson,
  onUpdate: ({ editor }) => {
    onChange(JSON.stringify(editor.getJSON()))
  },
})
```

读取历史内容时应兼容三种情况：JSON 文档直接传给 `content`；HTML 直接传给 `content`；旧版纯文本或 Markdown 转换为文档节点，避免整段内容变成不可编辑值。

切换文档或日期时，给编辑器组件设置稳定的 `key`，或者在外部内容变化时调用 `editor.commands.setContent(value, { emitUpdate: false })`。不要在每次 React 渲染时无条件 `setContent`，否则会重置光标和滚动位置。

## 6. 官方扩展与工具栏

### 扩展与样式修改优先级

在编辑器功能可以由多种方案实现时，统一遵循以下优先级：

1. `reactjs-tiptap-editor` 官方扩展
2. Tiptap 官方扩展
3. 项目自定义实现

如果需要修改的样式或功能位于 `node_modules` 内，优先在项目代码中通过覆盖、配置、组合或封装的方式实现，避免直接修改依赖包源码。这样可以避免重新安装依赖或升级版本后修改丢失。

官方扩展通常成对导出：扩展本身负责编辑器 schema，`RichTextXxx` 负责工具栏按钮。

```tsx
import { RichTextHeading } from 'reactjs-tiptap-editor/heading'
import { Highlight, RichTextHighlight } from 'reactjs-tiptap-editor/highlight'
import { TaskList, RichTextTaskList } from 'reactjs-tiptap-editor/tasklist'
import { TextAlign, RichTextAlign } from 'reactjs-tiptap-editor/textalign'
import { RichTextUndo, RichTextRedo } from 'reactjs-tiptap-editor/history'

const extensions = [
  StarterKit,
  Highlight.configure({ multicolor: true }),
  TaskList,
  TextAlign.configure({ types: ['heading', 'paragraph', 'list_item'] }),
]
```

`StarterKit` 已经包含的扩展不能与同名扩展同时启用，否则可能出现重复扩展警告或 schema 冲突。当前共享组件显式关闭了会被 `reactjs-tiptap-editor` 版本替换的 StarterKit 扩展，再注册对应的库扩展与 `RichTextXxx` 控件；新增能力必须沿用这个模式，而不是重复注册。

常用导入路径：

| 能力 | 扩展 | 工具栏组件 |
| --- | --- | --- |
| 粗体/斜体/删除线/下划线 | `bold` / `italic` / `strike` / `textunderline` | `RichTextBold` / `RichTextItalic` / `RichTextStrike` / `RichTextUnderline` |
| 标题 | `heading` | `RichTextHeading` |
| 列表 | `bulletlist` / `orderedlist` / `tasklist` | 对应 `RichText...` |
| 链接 | `link` | `RichTextLink` |
| 颜色/高亮 | `color` / `highlight` | `RichTextColor` / `RichTextHighlight` |
| 对齐 | `textalign` | `RichTextAlign` |
| 代码 | `code` / `codeblock` | `RichTextCode` / `RichTextCodeBlock` |
| 撤销/重做 | `history` | `RichTextUndo` / `RichTextRedo` |
| 查找替换 | `searchandreplace` | `RichTextSearchAndReplace` |
| 清除格式 | `clear` | `RichTextClear` |
| 表格 | `table` | `RichTextTable` |
| Drawer | `drawer` | `RichTextDrawer` |
| 分割线 | `horizontalrule` | `RichTextHorizontalRule` |

## 7. 气泡菜单和斜杠命令

```tsx
import {
  RichTextBubbleText,
  RichTextBubbleLink,
  RichTextBubbleCodeBlock,
} from 'reactjs-tiptap-editor/bubble'
import { SlashCommand, SlashCommandList } from 'reactjs-tiptap-editor/slashcommand'

const extensions = [StarterKit, SlashCommand]

function BubbleMenus() {
  return (
    <>
      <RichTextBubbleText />
      <RichTextBubbleLink />
      <RichTextBubbleCodeBlock />
      <SlashCommandList />
    </>
  )
}
```

斜杠命令通过输入 `/` 触发。图片、附件、视频等上传扩展需要提供 `upload` 回调并返回可访问 URL；没有后端上传能力时不要启用这些扩展。

## 8. 国际化和主题

```tsx
import { localeActions } from 'reactjs-tiptap-editor/locale-bundle'
import { themeActions } from 'reactjs-tiptap-editor/theme'

localeActions.setLang('zh_CN')
themeActions.setTheme('light')
themeActions.setColor('blue')
themeActions.setBorderRadius('0.5rem')
```

官方目前提供 `en`、`vi`、`zh_CN`、`pt_BR`、`hu_HU`、`fi` 和 `ja`。如需自定义语言，使用 `localeActions.setMessage('fr', messages)`。编辑器样式必须引入 `reactjs-tiptap-editor/style.css`，业务 CSS 只覆盖外层尺寸、背景、边框和内边距。

## 9. React / SSR 注意事项

- Tiptap 3 的所有 `@tiptap/*` 包保持同版本。
- SSR 或可能预渲染的 React 应用使用 `immediatelyRender: false`，并在编辑器未创建时返回 loading 或 `null`。
- 工具栏和气泡菜单必须放在 `RichTextProvider` 内部。
- 输入事件只在 `onUpdate` 中序列化；外层持久化应使用 debounce，避免每次按键都写数据库。
- 外部内容同步使用 `emitUpdate: false`，避免产生保存回路。

## 10. 从旧单体组件迁移

| 旧概念 | 新写法 |
| --- | --- |
| 单体 `RichTextEditor` | `useEditor` + `RichTextProvider` + `EditorContent` |
| `onChangeContent` | `useEditor({ onUpdate })` |
| 全部内置工具栏 | 只渲染需要的 `RichTextXxx` |
| `dark` 属性 | `themeActions` / 项目 CSS 主题 |
| `BaseKit` | `StarterKit` 或逐个导入官方 Tiptap 基础扩展 |

官方迁移指南建议先确认 schema、工具栏和输出格式，再逐个迁移扩展，不要在迁移时同时改变持久化格式。

## 11. 排查清单

1. 编辑器为空：确认 `content` 是有效 HTML 或 `type: 'doc'` JSON。
2. 按钮不显示：确认对应扩展已经加入 editor 的 `extensions`，且按钮位于 `RichTextProvider` 内。
3. 按键后内容回滚：检查是否在每次 React 渲染中无条件调用 `setContent`。
4. 中文按钮未翻译：确认调用了 `localeActions.setLang('zh_CN')`。
5. SSR 报错：确认 `immediatelyRender: false`，并等待 `editor` 实例创建完成。
6. 内容保存频繁：在业务层对 `onUpdate` 结果做 debounce，不要把每次事务直接写数据库。
