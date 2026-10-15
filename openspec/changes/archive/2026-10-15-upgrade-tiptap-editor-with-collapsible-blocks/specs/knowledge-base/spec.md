# Spec Delta: knowledge-base

## ADDED Requirements

### Requirement: Collapsible Details Content Blocks in Note Documents
The system SHALL support collapsible details content blocks within rich-text note documents, allowing users to nest summary titles and collapsible body blocks, toggle visual disclosure, and persist disclosure state through auto-save buffers.

#### Scenario: User inserts and toggles collapsible block in note
- **WHEN** user inserts a collapsible block into the active note editor and enters a summary title and body content
- **THEN** the editor renders a structured collapsible container with disclosure toggle controls and editable summary and content regions

#### Scenario: Collapsible block content persists across note reload
- **WHEN** user saves a note containing collapsible blocks and re-opens the note
- **THEN** the system re-renders the collapsible structure with summary headings, body elements, and disclosure states preserved without content truncation
