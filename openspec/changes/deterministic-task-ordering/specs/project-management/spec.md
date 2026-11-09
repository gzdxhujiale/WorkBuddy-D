# Spec Delta

## MODIFIED Requirements

### Requirement: Stage-bound task visibility in stage board and timeline views
The project stage board and timeline views SHALL display tasks explicitly associated with valid stages of the active project, filtering out unassociated tasks. Across stage boards, timeline tracks, gantt tables, and task management modals, tasks belonging to the same stage SHALL be ordered using a deterministic multi-tier comparator (completion status, sort order or due timestamp, creation timestamp, and unique identifier), preserving stable 1:1 positional correspondence across all view modes.

#### Scenario: Stage board displays stage-bound tasks
- **WHEN** user views a project in the stage board or timeline view
- **THEN** only tasks assigned to valid stages of that project appear under their respective stage columns and tracks

#### Scenario: Positional consistency between stage board and task manager modal
- **WHEN** user opens the task manager modal for a stage and views the same stage on the board or gantt chart
- **THEN** the tasks appear in the identical sequential order across all representations
