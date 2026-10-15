# Spec Delta

## Purpose

Decouples daily review metadata summaries from heavy document contents, and provides server-side streak calculations, compound metrics, and yearly heatmap matrices.

## ADDED Requirements

### Requirement: Decoupled daily review metadata summaries
The daily review service SHALL provide a summary listing endpoint that returns dates, IDs, versioning info, and preview snippets without returning full rich-text document trees.

#### Scenario: Listing review summaries
- **WHEN** the client requests daily review summaries
- **THEN** the system returns review metadata entries containing date, update time, and brief preview text without nested rich-text document structures

### Requirement: On-demand daily review detail fetching
The daily review service SHALL retrieve the full document payload of a daily review only when requested for a specific date or identifier.

#### Scenario: Fetching detailed review content
- **WHEN** the client requests the review document for a specific date
- **THEN** the system returns the complete review record including its full document content

### Requirement: Server-side streak and compound statistics
The service SHALL compute and return streak counts, total review counts, and compound growth metrics directly on the server.

#### Scenario: Querying compound review statistics
- **WHEN** the client requests daily review statistics
- **THEN** the server computes consecutive review days up to the current date and returns current streak, longest streak, total reviews, and compound value

### Requirement: Yearly review activity heatmap
The system SHALL provide a compact mapping of dates to review activity levels for a given calendar year to render activity heatmaps without downloading full review logs.

#### Scenario: Requesting yearly heatmap
- **WHEN** the client requests the heatmap for a specific calendar year
- **THEN** the system returns a key-value mapping of dates to activity levels and word counts for that year
