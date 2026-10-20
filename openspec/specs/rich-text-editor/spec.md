# rich-text-editor Specification

## Purpose
Provides a modular, high-performance rich-text editing capability across task memos, daily reviews, and knowledge base documents, featuring tiered execution presets, clipboard image pasting, syntax highlighting, bidirectional wikilinks, and dual-theme visual conformance.

## Requirements

### Requirement: Tiered Preset Execution Modes
The rich-text editor SHALL support three distinct execution presets (`minimal`, `compact`, and `full`) to adapt capabilities, UI toolbars, and performance overhead to specific host container contexts.

#### Scenario: Rendering minimal preset in task quick edit
- **WHEN** the editor is mounted within a task quick edit container with the `minimal` preset
- **THEN** the editor renders without top toolbars and suppresses complex table or details block triggers while retaining task checklist shortcuts

#### Scenario: Rendering compact preset in daily review
- **WHEN** the editor is mounted within the daily review panel with the `compact` preset
- **THEN** the editor displays an inline compact formatting bar and enables review template command insertions

#### Scenario: Rendering full preset in knowledge base full editor
- **WHEN** the editor is mounted within a full-screen note workspace or detached standalone window with the `full` preset
- **THEN** all rich-text features including advanced tables, code blocks, images, details disclosures, and full toolbars are active and accessible

### Requirement: Clipboard Image Pasting and Drag Insertion
The editor SHALL accept single or multiple image items pasted from clipboard or dragged into the editor viewport, performing client-side dimension and format optimization, initiating background upload, displaying interactive loading placeholders, and inserting responsive image blocks with adjustable sizing and alignment.

#### Scenario: Pasting an image from system clipboard
- **WHEN** a user copies an image or takes a screenshot and triggers paste (`Mod-V`) inside the active editor
- **THEN** the editor creates an inline image node at the current selection without interrupting document focus or throwing serialization errors

#### Scenario: Dragging an image file into the editor
- **WHEN** a user drops a valid image file from the desktop filesystem into the editor viewport
- **THEN** the editor inserts the image at the drop target position and reflects its rendered preview immediately

#### Scenario: Dragging multiple image files into the editor
- **WHEN** a user drops multiple image files simultaneously from the desktop filesystem into the editor viewport
- **THEN** the editor processes every dropped image sequentially, maintaining their relative drop order and inserting all images into the document

#### Scenario: Adjusting image dimensions and alignment
- **WHEN** a user selects an embedded image and chooses a dimension preset (25%, 50%, 75%, 100%) or alignment option (left, center, right)
- **THEN** the editor updates the image node attributes and immediately aligns and scales the rendered figure in the viewport

#### Scenario: Viewing image in fullscreen lightbox
- **WHEN** a user clicks an embedded image or activates the inspect action from its contextual toolbar
- **THEN** the system displays a fullscreen lightbox dialog presenting the full-resolution image with dismissal controls

### Requirement: Syntax-Highlighted Code Blocks
The editor SHALL format code blocks with language-specific syntax highlighting supporting major engineering languages including JavaScript, TypeScript, Go, SQL, Rust, Python, and Shell scripts.

#### Scenario: Formatting code blocks with specified language
- **WHEN** a user inputs a triple-backtick code block delimiter with an explicit language identifier
- **THEN** the editor renders the block with appropriate syntactic token highlights and monospace typographic styling

### Requirement: Bidirectional Internal Wikilink References
The editor SHALL provide bidirectional internal note referencing using `[[` delimiters. Entering the trigger opens an incremental search popover of existing notes; selecting a note inserts an interactive wikilink that navigates to the target note upon activation.

#### Scenario: Triggering wikilink search completion
- **WHEN** a user types `[[` in an active paragraph or list node
- **THEN** the editor opens a contextual suggestion popover listing matching notes from the current knowledge base

#### Scenario: Navigating through wikilink click
- **WHEN** a user activates an embedded note wikilink inside the editor
- **THEN** the system resolves the referenced note identifier and opens the target document in the designated presentation view

### Requirement: Contextual Command Palettes and Floating Bubble Menus
The editor SHALL provide contextual inline bubble menus on text selection and an interactive slash command palette (`/`) bounded strictly within the host editor container, presenting relevant formatting actions without viewport clipping or pointer event interception.

#### Scenario: Activating text selection bubble menu
- **WHEN** a user selects a range of text characters in the editor
- **THEN** a floating bubble menu appears aligned above or below the selection offering relevant inline formatting controls

#### Scenario: Executing format commands from floating bubble menu
- **WHEN** a user clicks any formatting button (such as Bold, Italic, Underline, or Highlight) on the active bubble menu
- **THEN** the editor applies the corresponding mark to the active selection without losing document focus or prematurely hiding the bubble menu

#### Scenario: Invoking slash command palette
- **WHEN** a user inputs `/` at the beginning of an empty line or after whitespace
- **THEN** a searchable command list appears locally bounded to the editor, supporting keyboard navigation (`Up`, `Down`, `Enter`, `Escape`) to insert structured blocks

### Requirement: Structured Lists and Hierarchical Indentation Management
The editor SHALL support multi-level structured lists (unordered, ordered, and task items) with unified keyboard indentation shortcuts, paragraph Tab defense, and differentiated typographic markers across hierarchical nesting depths.

#### Scenario: Sinking and lifting list items via keyboard shortcuts
- **WHEN** a user presses `Mod-]` (`Ctrl+]` or `Cmd+]`) or `Tab` within a valid list item
- **THEN** the editor sinks the current list item into a nested child list under the preceding sibling item

#### Scenario: Outdenting list items via keyboard shortcuts
- **WHEN** a user presses `Mod-[` (`Ctrl+[` or `Cmd+[`) or `Shift-Tab` within an indented list item
- **THEN** the editor lifts the current list item to its parent list level

#### Scenario: Preventing focus escape in standard text paragraphs
- **WHEN** a user presses `Tab` while editing a non-list standard text paragraph
- **THEN** the editor retains input focus and inserts a horizontal indent without navigating to adjacent DOM elements

#### Scenario: Presenting differentiated markers for nested lists
- **WHEN** an unordered or ordered list contains two or more nested levels
- **THEN** the editor renders distinct markers for each tier with normalized vertical margins and pure marker styling

### Requirement: Hierarchical Ordered List Backspace Guard
The rich-text editor SHALL guard ordered list deletion boundaries against accidental splitting. It SHALL outdent non-empty nested items at leading offset, safely remove intermediate empty items while returning focus to the preceding sibling, and unwrap isolated root empty items into regular paragraphs.

#### Scenario: Non-empty nested list item backspace at leading offset
- **WHEN** user presses Backspace at offset 0 of a non-empty nested ordered list item (e.g. `1.2xxxx`)
- **THEN** the editor lifts the item by a single level to become a sibling of the parent item (`2.xxxx`), preserving the continuous sequence numbering of surrounding items

#### Scenario: Intermediate empty list item backspace cleanup
- **WHEN** user presses Backspace inside an empty list item that has a preceding sibling item
- **THEN** the editor deletes the empty list item without splitting or lifting surrounding lists, and moves cursor focus directly to the end of the preceding sibling item

#### Scenario: Empty root list item backspace
- **WHEN** user presses Backspace inside an isolated empty root-level list item
- **THEN** the editor unwraps the item into a standard text paragraph without breaking remaining list siblings

#### Scenario: Empty list item step outdent and paragraph exit on enter
- **WHEN** user presses Enter inside an empty list item
- **THEN** the editor lifts the empty nested item by one hierarchy level if nested, or exits the list to a standard text paragraph if already at the root level

### Requirement: Consecutive List Auto-Join and Numbering Continuity
The rich-text editor SHALL automatically detect and fuse adjacent sibling ordered lists within document transactions. When an editing operation temporarily splits an ordered list or leaves contiguous sibling ordered lists, the editor SHALL join them into a single contiguous ordered list to preserve continuous sequence numbering.

#### Scenario: Automatic fusion of severed sibling ordered lists
- **WHEN** a list item deletion or extraction leaves two adjacent ordered list nodes as siblings in the document tree
- **THEN** the editor joins the two lists into a single continuous ordered list during transaction post-processing, retaining uninterrupted sequential numbering

#### Scenario: Parent numbering continuity after child item deletion
- **WHEN** a child list item (`1.2`) is completely deleted from a nested ordered list
- **THEN** the subsequent parent list item (`2.xxx`) remains strictly numbered as `2.xxx` without resetting to `1.xxx`

### Requirement: Multi-Level Outline Numbering Conformance
The rich-text editor SHALL render nested ordered lists with hierarchical outline numbering (`1.`, `1.1`, `1.2`, `1.2.1`) using dynamic stylesheet counters. When intermediate items are deleted or added, subsequent sibling counters SHALL recompute reactively to reflect the updated hierarchical sequence.

#### Scenario: Dynamic renumbering on intermediate item removal
- **WHEN** item `1.2` is removed from a sequence containing `1.1`, `1.2`, and `1.3`
- **THEN** former item `1.3` automatically displays as `1.2` without manual text modification

#### Scenario: Dual-theme outline visual alignment
- **WHEN** multi-level ordered lists are displayed in either the modern theme or the Retro Pixel theme
- **THEN** counters and clean hierarchical indentation render with correct token-based spacing, typography, and indentation offsets without vertical guide lines

### Requirement: Media Asset Storage and Upload Management
The system SHALL provide a dedicated media upload endpoint that receives image binary payloads, validates MIME types, deduplicates assets by content digest, and returns stable resource identifiers for document embedding.

#### Scenario: Uploading image asset through media endpoint
- **WHEN** an authenticated client posts a valid image payload to the media upload endpoint
- **THEN** the system computes the content SHA-256 digest, stores the binary asset on the designated disk storage, and responds with a successful status and accessible media URL

#### Scenario: Deduplicating identical image uploads
- **WHEN** a client uploads an image whose SHA-256 digest matches an existing stored asset
- **THEN** the system reuses the existing storage location and returns the established media URL without creating redundant file copies

### Requirement: Dual-Theme Presentation Conformance
The editor SHALL dynamically conform all typographic elements, code blocks, tables, callouts, selections, and contextual menus to both the default modern theme and the Retro Pixel theme.

#### Scenario: Displaying editor in Retro Pixel mode
- **WHEN** the active application theme transitions to Retro Pixel mode
- **THEN** the editor content, toolbar buttons, floating bubble menus, and command palettes adopt pixel-bordered outlines, monospace headings, parchment background accents, and tactile press states

### Requirement: External Rich-Text and Office Clipboard Sanitization
The rich-text editor SHALL sanitize incoming rich-text content pasted from external applications (including Microsoft Word, Excel, and office document tools), stripping redundant XML tags, proprietary styling metadata, and normalizing nested structures into semantic nodes.

#### Scenario: Pasting formatted text from Microsoft Word
- **WHEN** a user copies formatted content from Microsoft Word and pastes it into the active editor
- **THEN** proprietary office tags (such as `o:p` and `mso-*` styles) are purged while bold, italic, headings, lists, and table structures are normalized into clean native document nodes

#### Scenario: Pasting table data from spreadsheets
- **WHEN** a user copies a multi-cell range from a spreadsheet and pastes it into the editor
- **THEN** the editor converts the tabular data into standard table rows and cells preserving text alignment and column bounds without extraneous background styles

### Requirement: Editor Snapshot Commands and Milestone Keyboard Shortcuts
The rich-text editor SHALL provide programmable commands for saving named snapshots and opening history, and SHALL bind a global editor shortcut (`Mod-Shift-S`) to prompt for milestone naming and trigger instant snapshot persistence.

#### Scenario: Triggering milestone snapshot via keyboard shortcut
- **WHEN** a user presses `Mod-Shift-S` (`Ctrl+Shift+S` or `Cmd+Shift+S`) inside an active editor
- **THEN** the editor triggers a snapshot save dialog or prompt, allowing the user to provide a custom milestone name and persist the snapshot

#### Scenario: Invoking snapshot commands programmatically
- **WHEN** host containers execute `editor.commands.saveSnapshot(name)` or `editor.commands.openVersionHistory()`
- **THEN** the editor delegates to the registered snapshot handler without throwing errors
