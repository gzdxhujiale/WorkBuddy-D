# Spec Delta: daily-review

## MODIFIED Requirements

### Requirement: Structured Daily Review Persistence
The system SHALL retrieve and persist daily review records based on user identity and review date, returning authoritative persistent entity records. Daily review document content SHALL conform to a canonical structured Tiptap JSON document schema, rejecting legacy multi-format decoding fallbacks.

#### Scenario: List user daily reviews successfully
- **WHEN** client requests the daily review history for the active user
- **THEN** the system queries reviews by user identity and returns records ordered chronologically by review date

#### Scenario: Persisting review with canonical document structure
- **WHEN** client persists a daily review document
- **THEN** the system stores the content as a canonical structured JSON document, returning the validated entity record

### Requirement: Structured Content Integrity Protection
The system SHALL preserve multi-node structured rich text documents during review updates and workbench interactions, preventing document layout truncation or format degradation.

#### Scenario: Interacting with review from workbench preserves document structure
- **WHEN** user interacts with an existing multi-paragraph structured review from the daily workbench
- **THEN** the system maintains the complete structured document tree and formatting

#### Scenario: Review content parsing rejects corrupt payloads
- **WHEN** a client or background job encounters an invalid review document structure
- **THEN** the system falls back to an empty canonical document structure without crashing or executing recursive ad-hoc decoding
