# Proposal: Editor Context Menu for Plain Text and Markdown Copying

## Why
When editing notes and documents in WorkBuddy-D, users frequently need to export or paste formatted snippets into external platforms (such as GitHub, Obsidian, chat tools, or AI prompts) in clean Markdown syntax. Currently, the editor only copies standard HTML and plain text to the clipboard on native copy actions, lacking a dedicated contextual menu to copy selections directly as Markdown or formatted plain text.

## What Changes
- Introduce a contextual right-click menu for the rich-text editor, triggered when users right-click over an active text or block selection.
- Provide a cascading menu structure:
  - First-level item: "复制" (Copy) with a submenu trigger chevron.
  - Second-level submenu: "纯文本" (Plain Text) and "Markdown".
  - Basic context actions: "剪切" (Cut) and "粘贴" (Paste) when applicable to the selection.
- Implement AST-aware slice-to-markdown serialization that converts partial inline selections (marks like bold, italic, code, underline, highlight, links) into inline Markdown syntax without redundant line breaks, and serializes multi-block selections (headings, lists, tasks, callouts, tables, code blocks) into valid Markdown blocks.
- Provide user feedback on successful copy via lightweight toast notifications ("已复制为 Markdown" / "已复制纯文本").
- Preserve clean visual separation: dismiss or conceal the floating selection bubble menu while the right-click context menu is active.
- Non-goals (明确排除项):
  - Do not introduce additional dedicated keyboard shortcuts (such as `Ctrl+Shift+C`) for markdown copying in this change.
  - Do not add a markdown copy icon button to the floating `EditorBubbleMenu`.
  - Do not alter external drag-and-drop or clipboard paste behavior.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `rich-text-editor`: Expand editor contextual interaction capabilities to include a selection context menu with cascading copy options ("纯文本" and "Markdown") and AST-based slice serialization.

## Impact
- Frontend Components:
  - `src/components/editor/RichTextEditor.tsx`: Bind contextmenu event listener and manage context menu anchor position and open state.
  - New component `src/components/editor/menus/EditorContextMenu.tsx`: Cascading context menu using `@radix-ui/react-dropdown-menu` wrappers.
  - `src/components/editor/markdown/markdownService.ts` or helper: Export AST slice-to-markdown serializer function `convertSelectionSliceToMarkdown`.
- Performance & Compatibility:
  - Zero new external npm dependencies (reuses `@radix-ui/react-dropdown-menu` and existing editor AST utilities).
  - Conforms to both default modern theme and Retro Pixel theme.
