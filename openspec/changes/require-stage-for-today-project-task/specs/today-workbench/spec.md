## MODIFIED Requirements

### Requirement: Inline quick task creation on Today Workbench
The system SHALL provide a persistent inline quick input bar on the Today Workbench, allowing users to enter a task title, choose an Eisenhower quadrant, optionally select a project and its concrete active stage, and press Enter to instantly create the task scheduled for today. A project-associated task MUST include both a `projectId` and a `projectStageId`; the selected stage MUST be active and belong to the selected active project. A standalone task MUST include neither value.

#### Scenario: Quick creating a standalone task for today
- **WHEN** the user types a task title into the Today inline input bar, leaves the association as “不关联项目 (独立待办)”, and presses Enter
- **THEN** the system creates a new task scheduled for today with the selected quadrant and no project or stage association, persists it to the database, and renders it immediately in the list

#### Scenario: Quick creating a project-associated task for today
- **WHEN** the user selects an existing active project, selects one concrete active stage displayed beneath that project, types a title, and presses Enter
- **THEN** the system creates the task with the selected `projectId`, matching `projectStageId`, and today's schedule date, reflecting it in both Today Workbench and the corresponding stage in Project Center

#### Scenario: Project selection requires a stage before submission
- **WHEN** the user has selected a project but has not selected a stage and attempts to submit
- **THEN** the system blocks creation, keeps the entered title and other selections intact, and shows a nearby actionable validation message requiring selection of a stage

#### Scenario: Changing or clearing a project association
- **WHEN** the user selects a different project
- **THEN** the system clears the prior stage selection and requires selection of a stage belonging to the newly selected project before a project-associated task can be submitted

#### Scenario: Clearing project association to create a standalone task
- **WHEN** the user chooses “不关联项目 (独立待办)” after having selected a project or stage
- **THEN** the system clears both project and stage selections and allows the task to be submitted as a standalone task

#### Scenario: Project has no active stage
- **WHEN** the user opens the project selector and a project has no active stages
- **THEN** the system makes clear that the project cannot be selected for a project-associated quick task until an active stage exists, without preventing standalone task creation

#### Scenario: Association is rejected during persistence
- **WHEN** the selected project or stage becomes unavailable or no longer belongs together before the task is persisted
- **THEN** the system does not create a partial task, preserves the user's title and selections, and displays a human-readable error with a recovery path to refresh or select a valid association
