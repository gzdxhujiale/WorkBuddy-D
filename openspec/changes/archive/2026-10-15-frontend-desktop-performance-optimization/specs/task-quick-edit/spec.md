# Spec Delta

## ADDED Requirements

### Requirement: On-demand rich text editor loading in quick edit
The TaskQuickEdit component SHALL asynchronously lazy-load the rich-text editing engine on demand rather than statically bundling it into the initial task render tree.

#### Scenario: Opening quick edit popover
- **WHEN** user opens TaskQuickEdit
- **THEN** basic fields mount instantly, and the full rich-text editor bundle is loaded on-demand without blocking initial display
