# project-management Specification

## Purpose
Provides a cohesive project management capability managing project hierarchies, lifecycle stages, template instantiation with pre-configured tasks, stage-bound board and timeline visualization, deterministic stage ordering, and cascading deletion integrity.

## Requirements

### Requirement: Cascading soft deletion of project and stage hierarchies
The system SHALL atomically cascade soft-deletion across project, stage, and task hierarchies. Active query endpoints retrieve only non-deleted entities belonging to active projects.

#### Scenario: Soft delete project cascades to stages and tasks
- **WHEN** user deletes an active project
- **THEN** the system marks the project, all its stages, and associated tasks as deleted, excluding them from active query responses

#### Scenario: Soft delete stage cascades to assigned tasks
- **WHEN** user deletes a stage within an active project
- **THEN** the system marks the stage and all tasks assigned to that stage as deleted, removing them from active view listings

### Requirement: Deterministic stage sort order allocation on creation
The system SHALL assign monotonically increasing sequential sort order indices upon creating project stages, preserving consistent chronological ordering across view reloads.

#### Scenario: New stages receive sequential sort orders
- **WHEN** user adds multiple stages to a project in sequence
- **THEN** each stage is persisted with an increasing sort order index reflecting its creation order, rendering consistently across sessions

### Requirement: Full project template instantiation with stages and tasks
The system SHALL instantiate all stages and pre-configured template tasks defined in a project template when creating a project from that template, automatically mapping each task's stage key to the newly created stage's generated identifier.

#### Scenario: Project created from template contains both stages and tasks
- **WHEN** user creates a new project from a multi-stage template with tasks
- **THEN** the created project contains all template stages and tasks bound to their respective newly generated stage identifiers

### Requirement: Authoritative lock version synchronization
The system SHALL advance entity lock versions and update timestamps atomically upon persistence, synchronizing authoritative version metadata to the client.

#### Scenario: Project update increments lock version
- **WHEN** user updates a project's name or metadata
- **THEN** the system persists the change with an incremented lock version, enabling subsequent updates to submit matching version tokens

### Requirement: Task and project association view consistency
The system SHALL maintain synchronized task collections across project and independent views, presenting disassociated tasks exclusively in independent task listings.

#### Scenario: Disassociating project updates project view
- **WHEN** user edits a task and clears its project binding
- **THEN** the task is removed from the active project collection and reflected in standalone task listings

### Requirement: Stage-bound task visibility in stage board and timeline views
The project stage board and timeline views SHALL display tasks explicitly associated with valid stages of the active project, filtering out unassociated tasks.

#### Scenario: Stage board displays stage-bound tasks
- **WHEN** user views a project in the stage board or timeline view
- **THEN** only tasks assigned to valid stages of that project appear under their respective stage columns and tracks

### Requirement: Automatic fallback selection when active project becomes unavailable
The system SHALL automatically select the first available project when the currently selected project is deleted or excluded by the active filter.

#### Scenario: Fallback to first available project on deletion
- **WHEN** the currently selected project is deleted
- **THEN** the system automatically selects the first remaining project in the filtered list, presenting its workspace view
