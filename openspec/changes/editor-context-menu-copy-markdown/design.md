# Design: Editor Context Menu for Plain Text and Markdown Copying

## Context
See `proposal.md` for motivation and background. WorkBuddy-D's editor uses Tiptap 3 / ProseMirror with tiered presets (`minimal`, `compact`, `full`). While document-level markdown export and conversion exist in `src/components/editor/markdown/markdownService.ts`, there is currently no mechanism to extract and copy arbitrary selection slices as Markdown. Additionally, right-clicking currently falls back to default WebView2 behavior without editor-specific contextual commands.

## Goals / Non-Goals

**Goals:**
- Provide a responsive, theme-consistent right-click context menu when selecting text or blocks in `RichTextEditor`.
- Offer a cascading "复制" (Copy) menu with "纯文本" (Plain Text) and "Markdown" sub-options.
- Accurately serialize selection slices to Markdown (both single-paragraph inline fragments and multi-block structures such as lists, tables, callouts, and code blocks).
- Gracefully coordinate with `EditorBubbleMenu` to avoid visual clutter and overlapping toolbars.
- Zero extra npm dependencies, leveraging existing Radix DropdownMenu wrappers and theme configurations.

**Non-Goals:**
- No custom keyboard shortcuts (such as `Ctrl+Shift+C`) for Markdown copying in this iteration.
- No Markdown copy icon added to the floating `EditorBubbleMenu`.
- No modification to external paste sanitization or system clipboard drag-drop mechanics.

## Decisions

### Decision 1: Reuse Encapsulated Radix DropdownMenu with Virtual Anchor
- **Choice**: Implement `EditorContextMenu` using the project's existing `DropdownMenu`, `DropdownMenuSub`, `DropdownMenuSubTrigger`, and `DropdownMenuSubContent` components in `src/components/ui/dropdown-menu.tsx`. Anchor positioning is driven by a lightweight virtual reference element placed at `(clientX, clientY)`.
- **Rationale**:
  - `src/components/ui/dropdown-menu.tsx` is already styled, theme-tested, and supports both the modern sleek theme and Retro Pixel theme (`isPixelTheme`).
  - Radix DropdownMenu handles viewport collision boundaries, sub-menu hover delays, and portal mounting automatically.
  - Avoids adding `@radix-ui/react-context-menu` or mixing different component library styling paradigms (e.g. Semi UI Dropdown).
- **Alternatives considered**:
  - *Add `@radix-ui/react-context-menu`*: Increases bundle size and package lock surface for functionally identical submenu capabilities.
  - *Semi UI Dropdown (`trigger="contextMenu"`) `: Inconsistent with the Radix design token system and Retro Pixel styling applied in `src/components/ui/dropdown-menu.tsx`.

### Decision 2: AST-Based Slice-to-Markdown Serializer
- **Choice**: Implement a dedicated selection slice serializer (`serializeSelectionToMarkdown(editor)`) extending `src/components/editor/markdown/markdownService.ts`.
  - Extract the active selection's `Slice` via `editor.state.selection.content()`.
  - Convert `slice.toJSON()` to inspect node structures:
    - If the slice represents an inline fragment within a single paragraph (`slice.openStart > 0 && slice.content.length === 1`), serialize inline child nodes with their active marks (`**bold**`, `*italic*`, `` `code` ``, `==highlight==`, `<u>underline</u>`, `~~strike~~`, `[link](url)`) without wrapping them in block paragraph newlines.
    - If the slice spans multiple blocks or root-level elements, map each block through the AST renderer (`renderBlockToMarkdown`), preserving Callouts, TaskLists, Tables, Headings, and CodeBlocks.
- **Rationale**: Guarantees 100% syntactic parity with WorkBuddy's custom document structures and handles partial inline selections cleanly.
- **Alternatives considered**:
  - *ProseMirror DOMSerializer -> Turndown (HTML to Markdown)*: Extra overhead, and loss of custom AST attributes (like Callout types or details summaries).
  - *Raw `@tiptap/markdown` serializer*: Lacks built-in knowledge of WorkBuddy's custom AST nodes (`CustomCallout`, `CustomDetails`, `WikilinkExtension`).

### Decision 3: Event Coordination and BubbleMenu Suppression
- **Choice**:
  - Intercept the `contextmenu` event on the editor content scroll container.
  - If a non-empty selection exists (`!editor.state.selection.empty`), call `e.preventDefault()`, store the cursor viewport coordinates in React state, and open the context menu.
  - While the context menu is open, pass an active flag to suppress `EditorBubbleMenu`.
  - When the context menu closes (via click, escape, or action execution), restore normal bubble menu visibility.
- **Rationale**: Prevents awkward double-overlay UI where both the floating bubble toolbar and cascading context menu fight for visual prominence.

## Risks / Trade-offs

- **[Risk: Right-click near window boundaries causing submenu clipping]**
  → *Mitigation*: Radix DropdownMenu sub-contents automatically flip sides and respect viewport `collisionPadding={8}`.
- **[Risk: Browser clipboard permissions in desktop / webview]**
  → *Mitigation*: Standard `navigator.clipboard.writeText()` is invoked directly synchronously inside user click handlers, which is fully supported across Chromium / WebView2.
- **[Risk: Selection loss on context menu focus]**
  → *Mitigation*: Trigger menu items without clearing editor selection, preventing destructive blur.
