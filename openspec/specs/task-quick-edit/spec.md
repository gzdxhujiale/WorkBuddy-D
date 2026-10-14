# task-quick-edit Specification

## Purpose

Provides a fast, unified, multi-layer task quick edit popover and sub-window across the entire application, enabling seamless editing of title, rich descriptions, dates, reminders, priority quadrants, and project/stage associations.

## Requirements

### Requirement: Project and stage selection in global TaskQuickEdit
The system SHALL provide a dedicated project and stage selector button in the TaskQuickEdit top bar positioned directly to the left of the priority quadrant selector, allowing users to view, select, change, or clear project and stage bindings for the current task. Whenever a project is associated, a specific stage under that project MUST be selected.

#### Scenario: Selecting project and stage during task editing
- **WHEN** the user clicks the project selector button in TaskQuickEdit and chooses a project
- **THEN** the system requires selecting a concrete stage belonging to that project, setting both `projectId` and `projectStageId` on the task and persisting the association upon commit

#### Scenario: Clearing project association to make task standalone
- **WHEN** the user chooses "不关联项目 (独立待办)" in the project selector dropdown
- **THEN** the system clears both `projectId` and `projectStageId` fields on the task

### Requirement: IPC and state synchronization for quick edit window
The system SHALL synchronize available projects and stages metadata from the main window to the TaskQuickEdit sub-window during initialization, ensuring offline-safe, zero-delay rendering of the project dropdown without secondary network calls.

#### Scenario: Initializing quick edit window with project and stage metadata
- **WHEN** the main window triggers `openQuickEditWindow` for a task
- **THEN** the initialization payload `tqe:init` contains the latest active projects and stages list, and commits include the updated `projectId` and `projectStageId`

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
