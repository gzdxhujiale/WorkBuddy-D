## Purpose

Provides a fast, unified, multi-layer task quick edit popover and sub-window across the entire application, enabling seamless editing of title, rich descriptions, dates, reminders, priority quadrants, and project/stage associations.

## ADDED Requirements

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
