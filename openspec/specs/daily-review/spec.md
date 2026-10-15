# daily-review Specification

## Purpose
Provides a complete daily review capability covering structured document persistence, optimistic concurrency control, input continuity, decoupled summary queries, on-demand detail hydration, streak calculations, and yearly activity heatmaps.

## Requirements

### Requirement: Structured Daily Review Persistence
The system SHALL retrieve and persist daily review records based on user identity and review date, returning authoritative persistent entity records.

#### Scenario: List user daily reviews successfully
- **WHEN** client requests the daily review history for the active user
- **THEN** the system queries reviews by user identity and returns records ordered chronologically by review date

### Requirement: Optimistic Concurrency Control and Version Synchronization
The system SHALL maintain monotonically advancing lock versions during daily review updates, returning authoritative identifiers, timestamps, and lock versions upon persistence.

#### Scenario: Upsert review updates lock version and returns authoritative entity
- **WHEN** client submits a review update for a specific date
- **THEN** the system advances the lock version, commits the content atomically, and returns the entity with latest version metadata

### Requirement: Structured Content Integrity Protection
The system SHALL preserve multi-node structured rich text documents during review updates and workbench interactions, preventing document layout truncation.

#### Scenario: Interacting with review from workbench preserves document structure
- **WHEN** user interacts with an existing multi-paragraph structured review from the daily workbench
- **THEN** the system maintains the complete structured document tree and formatting

### Requirement: Stable Editor Lifecycle and Input Continuity
The system SHALL maintain active editor component instances and cursor focus across auto-save lifecycle events, reconciling returned persistence identifiers smoothly.

#### Scenario: Auto-save maintains continuous typing session
- **WHEN** user types in a newly initiated daily review triggering an auto-save that assigns an entity identifier
- **THEN** the editor instance remains mounted, preserving text cursor position, focus, and input composition

### Requirement: Substantive Streak and Text Heatmap Statistics
The system SHALL compute consecutive review streaks and text volume heatmaps by evaluating substantive user text, excluding whitespace-only empty blocks and formatting markup.

#### Scenario: Empty blocks excluded from streak calculation
- **WHEN** a review entry contains only empty paragraphs or whitespace nodes
- **THEN** the system classifies the review as empty, excluding it from streak counts and total review metrics

#### Scenario: Heatmap reflects substantive text volume
- **WHEN** computing activity heatmap levels for a specific date
- **THEN** the system calculates word counts from substantive text content, presenting accurate activity intensity

### Requirement: Decoupled metadata summaries and on-demand hydration
The daily review service SHALL provide lightweight summary listings returning dates, identifiers, and preview snippets without transferring heavy document payload trees, hydrating full document bodies on demand.

#### Scenario: Listing lightweight review summaries
- **WHEN** client requests review history summaries
- **THEN** the system returns metadata entries containing date, update time, and brief preview text without nested rich-text document structures

#### Scenario: Fetching detailed review content on demand
- **WHEN** client requests the complete review document for a specific date
- **THEN** the system returns the full review record including complete document content

### Requirement: Yearly review activity heatmap and compound metrics
The system SHALL provide compact mappings of calendar dates to review activity levels and compute compound growth metrics directly from stored review history.

#### Scenario: Requesting yearly heatmap and compound statistics
- **WHEN** client requests yearly review activity statistics
- **THEN** the system computes consecutive review days up to the current date and returns streak counts, total reviews, compound metrics, and date-to-activity level mappings
