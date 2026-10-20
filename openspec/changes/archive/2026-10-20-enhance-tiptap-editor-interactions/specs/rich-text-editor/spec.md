# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
- **THEN** the editor renders distinct markers for each tier (disc, circle, square for unordered lists; decimal, lower-alpha, lower-roman for ordered lists) with normalized vertical margins and guide lines

### Requirement: Media Asset Storage and Upload Management
The system SHALL provide a dedicated media upload endpoint that receives image binary payloads, validates MIME types, deduplicates assets by content digest, and returns stable resource identifiers for document embedding.

#### Scenario: Uploading image asset through media endpoint
- **WHEN** an authenticated client posts a valid image payload to the media upload endpoint
- **THEN** the system computes the content SHA-256 digest, stores the binary asset on the designated disk storage, and responds with a successful status and accessible media URL

#### Scenario: Deduplicating identical image uploads
- **WHEN** a client uploads an image whose SHA-256 digest matches an existing stored asset
- **THEN** the system reuses the existing storage location and returns the established media URL without creating redundant file copies
