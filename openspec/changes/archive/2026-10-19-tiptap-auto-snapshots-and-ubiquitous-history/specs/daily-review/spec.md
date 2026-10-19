# Spec Delta

## ADDED Requirements

### Requirement: Daily Review Version History Snapshots and Visual Diffing
The daily review module SHALL maintain version snapshots for daily reflection records, automatically capturing snapshots during extended editing sessions, and providing a visual history comparison drawer to inspect additions, deletions, and perform one-click restoration.

#### Scenario: Background auto-snapshot during review writing
- **WHEN** a user edits a daily review and pauses typing for an inactivity debounce period
- **THEN** the system persists a snapshot record associated with the review date in `daily_review_snapshots`

#### Scenario: Inspecting daily review version diffs
- **WHEN** a user opens the version history panel for a specific review date
- **THEN** the system displays historical snapshot points and renders an inline visual diff highlighting newly added text in green and deleted text in red strikethrough

#### Scenario: Restoring a historical daily review snapshot
- **WHEN** a user confirms restoration of a historical daily review snapshot
- **THEN** the active review editor updates to the content captured in that snapshot and persists the change
