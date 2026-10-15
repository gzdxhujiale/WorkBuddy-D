# task-management Specification

## Purpose
Provides a unified task management capability covering Eisenhower four-quadrant classification, overdue task ingestion with one-click rescheduling to today, inline rapid planning, multi-attribute quick editing, reminder configurations, and project/stage bindings.

## Requirements

### Requirement: Four-quadrant classification and deadline grouping
The system SHALL categorize tasks into four Eisenhower quadrants and group them by deadline intervals (Overdue, Within 1 Day, Within 3 Days, Within 1 Week, Beyond 1 Week, No Date). Overdue and active upcoming intervals aggregate uncompleted tasks, while completed tasks are partitioned into historical completed collections.

#### Scenario: Categorizing active tasks by deadline
- **WHEN** tasks with varying scheduled deadlines are queried in the task center
- **THEN** the system groups uncompleted tasks into their respective chronological offset intervals with matching quadrant tags

#### Scenario: Isolating completed past tasks from active upcoming groups
- **WHEN** a task with a past deadline is marked as completed
- **THEN** the system archives it into completed task history rather than placing it in active pending groups

### Requirement: Server-persisted task reordering and quadrant transitions
The system SHALL support reordering tasks within a quadrant and moving tasks across quadrants, persisting the updated sequential sort order and target quadrant while preserving existing scheduled timestamps.

#### Scenario: Reordering task sequence within quadrant
- **WHEN** user changes the display order of tasks within a quadrant
- **THEN** the system persists the updated sort order indices to storage, maintaining the new sequence across subsequent sessions

#### Scenario: Moving task across quadrants preserves scheduled timestamps
- **WHEN** user moves a task from one quadrant to another
- **THEN** the system updates the quadrant identifier while preserving the task's original start and end timestamps

### Requirement: Persistent reminder metadata across task lifecycle
The system SHALL accept, persist, and return task reminder configurations (relative offset days, trigger time, repeat frequency) across task creation, editing, and date range adjustments.

#### Scenario: Saving and updating reminder configuration
- **WHEN** user sets or modifies a reminder on a task
- **THEN** the system persists the reminder payload and returns the configuration in task query payloads

#### Scenario: Configuring reminder for date range task
- **WHEN** user switches task schedule mode to range mode and configures a reminder
- **THEN** the system computes and anchors the reminder relative to the scheduled end date

### Requirement: Overdue task ingestion and single-action rescheduling
The system SHALL include all uncompleted tasks with deadlines prior to the current day in the Today task stream with visible overdue indicators, and provide a single-action command to reschedule their due date to today.

#### Scenario: Displaying overdue uncompleted tasks in Today stream
- **WHEN** user views the Today task stream with uncompleted tasks scheduled before today
- **THEN** the system displays these tasks in the active stream marked with an explicit overdue status

#### Scenario: Rescheduling overdue task to today
- **WHEN** user triggers the reschedule command on an overdue task
- **THEN** the system updates the task's scheduled deadline to the end of the current day and refreshes its status immediately

### Requirement: Inline quick task creation on Today Workbench
The system SHALL provide a persistent inline quick input bar on the Today Workbench, allowing users to enter a task title, choose an Eisenhower quadrant, optionally select a project, and press Enter to instantly create the task scheduled for today.

#### Scenario: Quick creating a standalone task for today
- **WHEN** user submits a new task title and quadrant in the quick add bar
- **THEN** the system creates and persists a new task scheduled for today with the specified quadrant

#### Scenario: Quick creating a project-associated task for today
- **WHEN** user selects a project association during quick add and submits
- **THEN** the system creates the task bound to the selected project and schedules it for today

### Requirement: Multi-attribute quick task editing and project association
The system SHALL provide a unified quick edit capability allowing simultaneous editing of title, rich descriptions, dates, reminders, priority quadrants, and project/stage associations. When associated with a project, a concrete project stage MUST be selected.

#### Scenario: Selecting project and stage during task editing
- **WHEN** user associates a project during task quick edit
- **THEN** the system binds the task to both the project and a valid stage within that project, persisting the association upon commit

#### Scenario: Clearing project association to make task standalone
- **WHEN** user clears the project binding during task edit
- **THEN** the system disassociates the project and stage identifiers, converting the task into an independent standalone item

#### Scenario: Initializing task creation with preselected date from calendar slot
- **WHEN** user initiates quick task creation from a specific calendar date cell
- **THEN** the quick edit surface opens initialized with that specified date preselected
