# Spec Delta

## ADDED Requirements

### Requirement: External Rich-Text and Office Clipboard Sanitization
The rich-text editor SHALL sanitize incoming rich-text content pasted from external applications (including Microsoft Word, Excel, and office document tools), stripping redundant XML tags, proprietary styling metadata, and normalizing nested structures into semantic nodes.

#### Scenario: Pasting formatted text from Microsoft Word
- **WHEN** a user copies formatted content from Microsoft Word and pastes it into the active editor
- **THEN** proprietary office tags (such as `o:p` and `mso-*` styles) are purged while bold, italic, headings, lists, and table structures are normalized into clean native document nodes

#### Scenario: Pasting table data from spreadsheets
- **WHEN** a user copies a multi-cell range from a spreadsheet and pastes it into the editor
- **THEN** the editor converts the tabular data into standard table rows and cells preserving text alignment and column bounds without extraneous background styles
