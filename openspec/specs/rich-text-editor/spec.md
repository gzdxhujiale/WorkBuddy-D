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
The editor SHALL accept image data pasted from the system clipboard or dragged directly into the editing area, creating embedded image blocks with responsive sizing and layout containment.

#### Scenario: Pasting an image from system clipboard
- **WHEN** a user copies an image or takes a screenshot and triggers paste (`Mod-V`) inside the active editor
- **THEN** the editor creates an inline image node at the current selection without interrupting document focus or throwing serialization errors

#### Scenario: Dragging an image file into the editor
- **WHEN** a user drops a valid image file from the desktop filesystem into the editor viewport
- **THEN** the editor inserts the image at the drop target position and reflects its rendered preview immediately

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
The editor SHALL provide contextual inline bubble menus on text selection and an interactive slash command palette (`/`) bounded strictly within the host editor container, presenting relevant formatting actions without viewport clipping.

#### Scenario: Activating text selection bubble menu
- **WHEN** a user selects a range of text characters in the editor
- **THEN** a floating bubble menu appears aligned above or below the selection offering relevant inline formatting controls

#### Scenario: Invoking slash command palette
- **WHEN** a user inputs `/` at the beginning of an empty line or after whitespace
- **THEN** a searchable command list appears locally bounded to the editor, supporting keyboard navigation (`Up`, `Down`, `Enter`, `Escape`) to insert structured blocks

### Requirement: Dual-Theme Presentation Conformance
The editor SHALL dynamically conform all typographic elements, code blocks, tables, callouts, selections, and contextual menus to both the default modern theme and the Retro Pixel theme.

#### Scenario: Displaying editor in Retro Pixel mode
- **WHEN** the active application theme transitions to Retro Pixel mode
- **THEN** the editor content, toolbar buttons, floating bubble menus, and command palettes adopt pixel-bordered outlines, monospace headings, parchment background accents, and tactile press states
