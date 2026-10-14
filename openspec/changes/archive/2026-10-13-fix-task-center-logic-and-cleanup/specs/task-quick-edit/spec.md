# Spec Delta: task-quick-edit

## ADDED Requirements

### Requirement: Date range mode reminder support
The system SHALL allow users to view, configure, and clear reminders when editing tasks in date range (`scheduleMode: range`) mode, matching the reminder capabilities of point-in-time mode.

#### Scenario: Setting reminder for a date range task
- **WHEN** the user switches task schedule mode to range mode and opens the reminder configuration
- **THEN** the reminder settings panel is accessible and allows selecting a reminder offset and time relative to the scheduled end date

### Requirement: Initial date prefill on quick task creation
The system SHALL prefill the task's schedule date when opened for creation from an explicit date slot or calendar view.

#### Scenario: Creating task from a calendar date slot
- **WHEN** the user triggers task creation from a specific date slot in week view or month view
- **THEN** TaskQuickEdit initializes with that specified date pre-selected rather than leaving it empty
