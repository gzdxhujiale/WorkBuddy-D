# Spec Delta

## MODIFIED Requirements

### Requirement: Stable Editor Lifecycle and Input Continuity
The system SHALL maintain active editor component instances and cursor focus across auto-save and date-switching lifecycle events, reconciling returned persistence identifiers and asynchronously hydrated document payloads smoothly without destructive editor re-instantiation.

#### Scenario: Auto-save maintains continuous typing session
- **WHEN** user types in a newly initiated daily review triggering an auto-save that assigns an entity identifier
- **THEN** the editor instance remains mounted, preserving text cursor position, focus, and input composition

#### Scenario: Switching dates preserves editor instance and reconciles asynchronous content
- **WHEN** user navigates from one review date to another previously uncached review date
- **THEN** the system reuses the active editor instance, flushes any pending edits from the previous date, and smoothly updates the document content once the target date detail is hydrated without blanking out or overwriting remote content

## ADDED Requirements

### Requirement: Decoupled Calendar Month Navigation and Selected Date
The review calendar view SHALL maintain its active viewing month independently from the currently selected review date, allowing users to inspect historical monthly check-in entries without altering or navigating away from their active editing date.

#### Scenario: Browsing calendar months maintains active review date
- **WHEN** user navigates to previous or subsequent months using the calendar navigation controls
- **THEN** the calendar updates the displayed month and check-in indicators while the selected editing date and active review editor remain unchanged

#### Scenario: Selecting a calendar day navigates to that date
- **WHEN** user clicks an enabled calendar day in any displayed month
- **THEN** the system sets the selected editing date to the clicked date and loads the corresponding daily review
