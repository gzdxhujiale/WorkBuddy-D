# Tasks

## 1. Selection Slice Serialization & Utilities

- [x] 1.1 Implement `serializeSelectionToMarkdown` and clipboard helpers in `src/components/editor/utils/selectionClipboard.ts` and verify unit tests cover inline formatting (bold, italic, inline code, underline, strike, highlight, links) without redundant paragraph breaks
- [x] 1.2 Extend slice serialization for multi-block structures (headings, bullet lists, ordered lists, task lists, code blocks, blockquotes, callouts, and tables) and verify unit tests produce syntactically valid Markdown outputs

## 2. Editor Context Menu Component

- [x] 2.1 Implement `EditorContextMenu` in `src/components/editor/menus/EditorContextMenu.tsx` using Radix `DropdownMenu` and `DropdownMenuSub` with cascading options ("复制" -> "纯文本", "Markdown") and basic actions, and verify both default modern theme and Retro Pixel styling
- [x] 2.2 Wire copy actions to `navigator.clipboard.writeText` and trigger confirmation toast notifications (`toast.success`) upon completion

## 3. RichTextEditor Integration

- [x] 3.1 Bind `contextmenu` event handling in `src/components/editor/RichTextEditor.tsx` to position the context menu at mouse coordinates when an active selection exists
- [x] 3.2 Coordinate state to conceal `EditorBubbleMenu` while `EditorContextMenu` is open and verify that closing the context menu cleanly restores regular interaction

## 4. Verification & Validation

- [x] 4.1 Run unit tests covering slice-to-markdown serialization and verify all test assertions pass
- [x] 4.2 Run `pnpm build` and `pnpm lint:boundaries` to verify TypeScript compilation and architecture boundary conformance
