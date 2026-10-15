# focus-companion Specification

## Purpose
Provides a desktop focus companion capability covering wall-clock accurate timers, global desktop notification action processing, categorized focus session statistics, visual theme adaptability, and persistent desktop summoning.

## Requirements

### Requirement: Wall-Clock Timer Accuracy
The system SHALL compute remaining focus and rest durations based on absolute wall-clock timestamps, immediately calibrating countdown displays after system sleep or background throttling and completing expired sessions.

#### Scenario: System sleep or background throttling
- **WHEN** system wakes from sleep or background throttling during an active focus timer
- **THEN** the system immediately recalculates the elapsed wall-clock duration, updating the countdown display or completing the session if the target time has elapsed

### Requirement: Global Task Notification Actions
The system SHALL process notification card actions globally across window boundaries regardless of the currently active route in the main window.

#### Scenario: User completes task from notification card
- **WHEN** user marks a task complete from an external desktop notification card
- **THEN** the system receives the completion command globally, persists the task status, and refreshes associated view caches

### Requirement: Categorized Focus Statistics
The system SHALL aggregate focus duration exclusively from completed focus sessions, isolating rest and break sessions from productive focus statistics.

#### Scenario: User queries focus statistics
- **WHEN** user views daily and weekly focus summary metrics
- **THEN** the system calculates total duration from focus sessions while partitioning break sessions into auxiliary rest logs

### Requirement: Visual Theme Adaptability
The system SHALL adapt companion surfaces to match the application's active visual theme style, maintaining cohesive presentation across all window surfaces.

#### Scenario: User switches theme style
- **WHEN** user changes the active application theme style
- **THEN** the floating companion window dynamically applies the corresponding visual theme tokens and typography

### Requirement: Persistent Summoning and Visibility Control
The system SHALL provide a persistent summoning toggle in the application navigation rail, allowing users to toggle visibility of the floating desktop companion.

#### Scenario: User toggles companion visibility
- **WHEN** user clicks the focus companion toggle action
- **THEN** the system alternates between displaying and hiding the desktop companion window
