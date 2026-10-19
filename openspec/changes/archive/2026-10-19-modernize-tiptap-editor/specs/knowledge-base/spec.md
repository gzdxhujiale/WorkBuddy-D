# Spec Delta

## MODIFIED Requirements

### Requirement: Fidelity Markdown Document Import
The system SHALL parse imported Markdown documents into structured rich-text document AST nodes (including headings level 1 to 6, bullet lists, ordered lists, task lists, code blocks with language identifiers, blockquotes, callouts, details disclosure blocks, image references, and inline formatting). The system SHALL automatically extract the note title strictly from the selected file name (with file extension removed) and retain all original document content and headings in the note body.

#### Scenario: Single Markdown file imported into active note
- **WHEN** user selects a valid Markdown file via the note import action
- **THEN** system populates the rich-text editor with corresponding structured nodes preserving headings, lists, code blocks, images, callouts, details disclosures, and marks
- **AND** system sets the note title to the clean file name without file extension

#### Scenario: File dialog cancelled during single import
- **WHEN** user cancels or closes the file selection dialog without choosing a file
- **THEN** system terminates the import interaction safely without mutating editor content, title, or displaying error notices

## ADDED Requirements

### Requirement: Note-to-Note Navigation via Embedded Wikilinks
The knowledge base SHALL support embedded note links within document content, allowing users to jump directly between related notes in the active workspace or open targets in dedicated windows.

#### Scenario: Clicking an embedded note wikilink
- **WHEN** a user activates an embedded note wikilink referencing another note in the knowledge base
- **THEN** the system resolves the target note and updates the active presentation view to render the target note document
