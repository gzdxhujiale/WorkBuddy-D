# Spec Delta

## MODIFIED Requirements

### Requirement: Server-persisted task reordering and quadrant transitions
The system SHALL support reordering tasks within a quadrant and moving tasks across quadrants, persisting the updated sequential sort order and target quadrant while preserving existing scheduled timestamps. When tasks are rendered in quadrants or due collections, the system SHALL apply a deterministic multi-tier sort order (completion state, primary sortOrder or scheduled due timestamp, creation timestamp, and unique identifier tie-breaker), ensuring task positions remain mathematically stable across renders and cache refetches.

#### Scenario: Reordering task sequence within quadrant
- **WHEN** user changes the display order of tasks within a quadrant
- **THEN** the system persists the updated sort order indices to storage, maintaining the new sequence across subsequent sessions

#### Scenario: Moving task across quadrants preserves scheduled timestamps
- **WHEN** user moves a task from one quadrant to another
- **THEN** the system updates the quadrant identifier while preserving the task's original start and end timestamps

#### Scenario: Deterministic task ordering when sort order or due dates collide
- **WHEN** multiple tasks in the same quadrant have identical sort orders or scheduled deadlines
- **THEN** the system orders them deterministically using creation timestamp and unique identifier tie-breakers without positional drift
