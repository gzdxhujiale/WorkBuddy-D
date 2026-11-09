# Spec Delta

## ADDED Requirements

### Requirement: Stage task pipeline progression and historical snapshot
The system SHALL advance active stage tasks to the immediate next stage upon stage checkbox completion, while retaining a completed historical snapshot of the task in the prior stage. When advancing, the active task SHALL reset its completed state to pending, automatically assign the target stage's default assignee, and align its scheduled date range with the target stage.

#### Scenario: Advancing task from initial stage to next stage
- **WHEN** user marks an uncompleted task as checked within a non-terminal stage
- **THEN** the system records an immutable completed snapshot in the current stage, moves the active task to the next stage in an uncompleted state, and updates the task's assignee and scheduled range to match the next stage

#### Scenario: Terminal stage completion marks task globally completed
- **WHEN** user marks an uncompleted task as checked within the final stage of a project
- **THEN** the system marks the task as globally completed, recalculates the project overall completion rate, and syncs the completed status to historical task streams

### Requirement: Task stage rollback from active pipeline
The system SHALL support rolling back an active stage task to its immediate previous stage via the task card action menu.

#### Scenario: Rolling back active task to previous stage
- **WHEN** user triggers the rollback action on a task in a non-initial stage
- **THEN** the system moves the active task back to the preceding stage, removes or supersedes the prior stage snapshot, and presents the task as pending in that preceding stage

### Requirement: Direct completion bypassing intermediate stages
The system SHALL provide a direct completion action via the task context menu, allowing users to immediately complete a task regardless of its current stage position.

#### Scenario: Direct completion via context menu
- **WHEN** user selects direct completion from a task context menu in any stage
- **THEN** the system transitions the task directly to globally completed status and updates project progress indicators without requiring incremental stage-by-stage progression
