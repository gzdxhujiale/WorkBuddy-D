# task-management-center Specification

## Purpose

Provides a robust, four-quadrant task center with reliable drag-and-drop sort order persistence, date-range views (week and month), accurate deadline expiration grouping, and complete backend reminder persistence.

## Requirements

### Requirement: Four-quadrant task classification and group sorting
The system SHALL accurately categorize tasks into Eisenhower quadrants (Q1, Q2, Q3, Q4) and group them by due time offsets ("已过期", "一天内", "三天内", "一周内", "一周外", "无日期"). Completed tasks with past deadlines SHALL NOT be grouped into active upcoming groups such as "一天内".

#### Scenario: Completed past task is not classified into within 1 day group
- **WHEN** a task has a scheduled deadline in the past and is marked as completed
- **THEN** the system groups it into completed tasks or preserves its historical completion status without placing it into the "一天内" (within 24 hours) active reminder group

### Requirement: Server-persisted task reordering and quadrant movement
The system SHALL support reordering tasks within a quadrant and moving tasks across quadrants, persisting the updated `sort_order` and `quadrant` reliably to the backend without validation errors.

#### Scenario: Reordering task sequence within quadrant
- **WHEN** the user drags a task above or below another task in the quadrant view
- **THEN** the system updates `sort_order` and sends the update payload to the backend without requiring a title change, persisting the new sequence permanently

#### Scenario: Preserving individual timestamps on task reorder
- **WHEN** the user reorders a task relative to another task within the same quadrant
- **THEN** the dragged task retains its original scheduled start and end timestamps rather than overwriting them with the target task's exact time

### Requirement: Persistent reminder metadata across API lifecycle
The system SHALL accept, persist, and return task reminder configurations (`offsetDays`, `time`, `repeat`) across task creation and updates.

#### Scenario: Saving and updating reminder configuration
- **WHEN** the user configures a reminder for a task and commits changes
- **THEN** the backend persists the reminder JSON data and includes it in all subsequent task query responses

### Requirement: Focused view layout without redundant day view
The system SHALL display only the Eisenhower Quadrants (default), Week View, and Month View in the task center, omitting any redundant standalone Day View. The period overview sidebar SHALL only be visible in Week and Month views.

#### Scenario: Task center navigation view selection
- **WHEN** the user navigates to the Task Center (/four-quadrants)
- **THEN** the view switcher provides options for Four Quadrants, Week View, and Month View, and the Four Quadrants view renders in full width without the period sidebar
