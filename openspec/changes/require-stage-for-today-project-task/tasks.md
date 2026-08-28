## 1. Association selection behavior

- [ ] 1.1 Update TodayQuickAdd to render active projects with their active child stages and verify that a selected stage is displayed with its parent project in the compact control.
- [ ] 1.2 Make project/stage selection atomic: project changes clear the previous stage, stage selection writes the matching project/stage pair, and the independent option clears both; verify each state transition manually.
- [ ] 1.3 Mark projects without active stages unavailable for project-task creation and verify that the user receives an explanatory message while standalone creation remains available.

## 2. Creation validation and resilience

- [ ] 2.1 Require a concrete valid stage whenever a project is selected; verify Enter and the click submit action block partial associations while preserving the typed title and selected quadrant.
- [ ] 2.2 Submit both project and stage identifiers through the existing task action path; verify a successful project task appears under the same stage in Today Workbench and Project Center.
- [ ] 2.3 Add local pending, error, and retry/reselection feedback for persistence failures; verify a rejected or stale association creates no task and retains the draft for correction.

## 3. Regression and acceptance verification

- [ ] 3.1 Verify standalone quick creation still schedules a task for today with neither association field and retains current Enter/Escape keyboard behavior.
- [ ] 3.2 Verify the selector and validation feedback render and operate correctly in Modern Clean and Retro Pixel 8-Bit themes, including keyboard focus and accessible labels.
- [ ] 3.3 Run `pnpm build` and verify TypeScript type checking and production build complete without errors.
