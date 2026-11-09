# Spec Delta

## ADDED Requirements

### Requirement: Modal Tiptap task list management for project stages
The system SHALL provide a modal dialog embedding a Tiptap task list editor on each project stage, rendering existing stage tasks as interactive task list items. Users can batch add, edit titles, delete, and toggle completion of items within the editor with bidirectional persistence upon confirmation.

#### Scenario: Opening stage task manager modal populates current stage tasks
- **WHEN** user clicks the task manager button on a stage card
- **THEN** the system displays a modal containing a Tiptap task list prefilled with all active tasks belonging to that stage

#### Scenario: Batch adding tasks via Enter key in Tiptap editor
- **WHEN** user creates new task list items by typing titles and pressing Enter in the modal editor and saves
- **THEN** the system creates corresponding task entities bound to the active project and stage

#### Scenario: Removing task items deletes stage tasks
- **WHEN** user removes task list items from the editor and saves
- **THEN** the system removes the corresponding tasks from the stage and updates active task collections

#### Scenario: Checking task item in modal triggers stage progression
- **WHEN** user checks an uncompleted task item within the stage modal and saves
- **THEN** the system applies stage progression to that task, moving it to the next stage and retaining a snapshot in the current stage

### Requirement: Task context menu direct completion and stage navigation
The system SHALL surface a context menu on project task cards offering direct stage actions including completing immediately, rolling back to the previous stage, and removing the task.

#### Scenario: Invoking task card context menu
- **WHEN** user right-clicks on a project task card
- **THEN** the system displays a context menu containing direct complete, rollback to previous stage when available, and delete options
