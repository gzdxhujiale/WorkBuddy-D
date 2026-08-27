# today-workbench Specification

## Purpose

Provides the day-level command center on the Today Workbench, including automatic ingestion and visible warning for uncompleted overdue tasks, one-click rescheduling to today, and seamless inline quick task planning with quadrant and project assignment.

## Requirements

### Requirement: Overdue uncompleted tasks MUST be included in the Today task stream
The system SHALL include all uncompleted tasks whose scheduled deadline or date is prior to the current day alongside tasks scheduled for today, ensuring past due tasks are never silently hidden from the user.

#### Scenario: Displaying overdue uncompleted tasks in Today view
- **WHEN** the user opens the Today Workbench and has uncompleted tasks with deadline earlier than today
- **THEN** the system displays these tasks in the Today task stream with an explicit overdue indicator and badge

#### Scenario: Excluding completed past tasks
- **WHEN** a task with deadline earlier than today is already completed
- **THEN** the system does not include it in the active pending overdue task list for today

### Requirement: One-click reschedule overdue tasks to today
The system SHALL provide a single-click action on each overdue task to reschedule its due date to the end of the current day.

#### Scenario: User clicks reschedule to today on an overdue task
- **WHEN** the user clicks the "顺延至今日" (Reschedule to Today) button on an overdue task item
- **THEN** the system updates the task's `scheduledEndAt` timestamp to today at 23:59:59 and updates the item's overdue badge immediately

### Requirement: Inline quick task creation on Today Workbench
The system SHALL provide a persistent inline quick input bar on the Today Workbench, allowing users to enter a task title, choose an Eisenhower quadrant, optionally select a project, and press Enter to instantly create the task scheduled for today.

#### Scenario: Quick creating a standalone task for today
- **WHEN** the user types a task title into the Today inline input bar and presses Enter
- **THEN** the system creates a new task scheduled for today with the selected quadrant, persists it to the database, and renders it immediately in the list

#### Scenario: Quick creating a project-associated task for today
- **WHEN** the user selects an existing project from the inline project picker, types a title, and presses Enter
- **THEN** the system creates the task with `projectId` and today's schedule date, reflecting it in both Today Workbench and Project Center
