# daily-review Specification

## Purpose
Provides a complete daily review capability covering structured document persistence, optimistic concurrency control, input continuity, decoupled summary queries, on-demand detail hydration, streak calculations, and yearly activity heatmaps.

## Requirements

### Requirement: Structured Daily Review Persistence
The system SHALL retrieve and persist daily review records based on user identity and review date, returning authoritative persistent entity records. Daily review document content SHALL conform to a canonical structured Tiptap JSON document schema, rejecting legacy multi-format decoding fallbacks.

#### Scenario: List user daily reviews successfully
- **WHEN** client requests the daily review history for the active user
- **THEN** the system queries reviews by user identity and returns records ordered chronologically by review date

#### Scenario: Persisting review with canonical document structure
- **WHEN** client persists a daily review document
- **THEN** the system stores the content as a canonical structured JSON document, returning the validated entity record

### Requirement: Optimistic Concurrency Control and Version Synchronization
The system SHALL maintain monotonically advancing lock versions during daily review updates, returning authoritative identifiers, timestamps, and lock versions upon persistence.

#### Scenario: Upsert review updates lock version and returns authoritative entity
- **WHEN** client submits a review update for a specific date
- **THEN** the system advances the lock version, commits the content atomically, and returns the entity with latest version metadata

### Requirement: Structured Content Integrity Protection
The system SHALL preserve multi-node structured rich text documents during review updates and workbench interactions, preventing document layout truncation or format degradation.

#### Scenario: Interacting with review from workbench preserves document structure
- **WHEN** user interacts with an existing multi-paragraph structured review from the daily workbench
- **THEN** the system maintains the complete structured document tree and formatting

#### Scenario: Review content parsing rejects corrupt payloads
- **WHEN** a client or background job encounters an invalid review document structure
- **THEN** the system falls back to an empty canonical document structure without crashing or executing recursive ad-hoc decoding

### Requirement: Stable Editor Lifecycle and Input Continuity
The system SHALL maintain active editor component instances and cursor focus across auto-save and date-switching lifecycle events, reconciling returned persistence identifiers and asynchronously hydrated document payloads smoothly without destructive editor re-instantiation.

#### Scenario: Auto-save maintains continuous typing session
- **WHEN** user types in a newly initiated daily review triggering an auto-save that assigns an entity identifier
- **THEN** the editor instance remains mounted, preserving text cursor position, focus, and input composition

#### Scenario: Switching dates preserves editor instance and reconciles asynchronous content
- **WHEN** user navigates from one review date to another previously uncached review date
- **THEN** the system reuses the active editor instance, flushes any pending edits from the previous date, and smoothly updates the document content once the target date detail is hydrated without blanking out or overwriting remote content

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

### Requirement: Decoupled Calendar Month Navigation and Selected Date
The review calendar view SHALL maintain its active viewing month independently from the currently selected review date, allowing users to inspect historical monthly check-in entries without altering or navigating away from their active editing date.

#### Scenario: Browsing calendar months maintains active review date
- **WHEN** user navigates to previous or subsequent months using the calendar navigation controls
- **THEN** the calendar updates the displayed month and check-in indicators while the selected editing date and active review editor remain unchanged

#### Scenario: Selecting a calendar day navigates to that date
- **WHEN** user clicks an enabled calendar day in any displayed month
- **THEN** the system sets the selected editing date to the clicked date and loads the corresponding daily review
