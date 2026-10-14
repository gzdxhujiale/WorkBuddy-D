# project-management-center Specification

## Purpose

Provides a cohesive project management center managing project hierarchies, lifecycle stages, template instantiation with pre-configured tasks, stage-bound board and timeline visualization, deterministic stage ordering, and cascading deletion integrity.

## Requirements

### Requirement: Cascading soft deletion of project and stage hierarchies
The system SHALL ensure that when a project is soft-deleted, all associated stages and project tasks are cascade soft-deleted within the same operation. When a stage is soft-deleted, all tasks bound to that stage SHALL also be soft-deleted. The stage query API SHALL NOT return stages belonging to soft-deleted projects.

#### Scenario: Soft delete project cascades to stages and tasks
- **WHEN** user deletes a project
- **THEN** the project, all its stages, and all tasks assigned to that project have their `deleted_at` timestamp set, and subsequent list queries return none of these items

#### Scenario: Soft delete stage cascades to assigned tasks
- **WHEN** user deletes a stage within an active project
- **THEN** the stage and all tasks associated with that stage have their `deleted_at` timestamp set, and are removed from active queries

### Requirement: Deterministic stage sort order allocation on creation
The system SHALL allocate a deterministic, sequential sort order value when creating a new project stage, avoiding duplicate zero sort order collisions across stages.

#### Scenario: New stages receive sequential sort orders
- **WHEN** user adds multiple stages to a project in sequence
- **THEN** each stage is persisted with an increasing `sort_order` index reflecting its creation order, and the stage board renders them in consistent order across page reloads

### Requirement: Full project template instantiation with stages and tasks
The system SHALL instantiate all stages and all template tasks defined in a project template when creating a project from that template, automatically mapping each task's `stageKey` to the newly created stage's generated ID.

#### Scenario: Project created from template contains both stages and tasks
- **WHEN** user creates a new project selecting a template containing 4 stages and 4 tasks
- **THEN** the created project contains all 4 stages and all 4 tasks properly associated with their corresponding stages and default quadrants

### Requirement: Optimistic cache synchronization and lock version persistence
The system SHALL ensure that after a project or template is saved, the client cache updates its in-memory `lock_version` and `updated_at` timestamps using the server response without being blocked by stale optimistic timestamps.

#### Scenario: Project save updates lock version in client cache
- **WHEN** user updates a project's name or metadata
- **THEN** the local cache reflects the server's incremented `lock_version`, and subsequent updates use the latest version number

### Requirement: Task and project association cache consistency
The system SHALL ensure that when a task's project association is cleared in the task management center or quick edit window, the task is immediately removed from the project center's cached task collection.

#### Scenario: Disassociating project removes task from project center cache
- **WHEN** user edits a task and clears its project binding
- **THEN** the task is immediately evicted from the project center's cached task list

### Requirement: Stage-bound task visibility in stage board and timeline views
The project stage board and project gantt timeline views SHALL only render tasks that are explicitly bound to a valid stage of the active project. Unassigned independent tasks from the task center without project and stage bindings SHALL NOT appear in the stage board or gantt views.

#### Scenario: Stage board displays only stage-bound tasks
- **WHEN** user views a project in the stage board or gantt view
- **THEN** only tasks assigned to valid stages of that project are displayed under their respective stage columns and tracks

### Requirement: Automatic fallback selection when active project becomes unavailable
The system SHALL automatically select the first available project when the currently selected project is deleted or is filtered out by the active status filter.

#### Scenario: Fallback to first available project on deletion
- **WHEN** the currently selected project is deleted
- **THEN** the project center automatically selects the first remaining project in the filtered sidebar list instead of remaining on an empty view
