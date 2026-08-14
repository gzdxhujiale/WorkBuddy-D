# Execution plans

## Purpose

This document defines how to plan complex, risky, or multi-step repository work. It is not a product roadmap. Concrete plans live in `docs/exec-plans/`; durable outcomes move into the architecture, product, design, reliability, security, or quality documents.

## When a plan is required

Create an execution plan before starting work that is likely to span multiple sessions or includes a database migration, security/native-permission change, cross-window synchronization change, significant feature, large refactor, or material uncertainty. Small, localized, reversible fixes do not need one.

Place active work in `docs/exec-plans/active/` and completed work in `docs/exec-plans/completed/`. Record cross-cutting deferred work in [tech-debt-tracker.md](exec-plans/tech-debt-tracker.md).

## Required plan sections

Every plan is a living, self-contained Markdown file and must include:

1. **Purpose and big picture** — the user-visible outcome and scope.
2. **Context and orientation** — relevant paths, current behavior, terminology, constraints, and dependencies.
3. **Progress** — a dated checklist reflecting completed, partial, and remaining work.
4. **Plan of work** — ordered prose describing the intended modifications and their dependency sequence.
5. **Concrete steps** — working directory, exact commands, files/modules, and expected observable results.
6. **Validation and acceptance** — behavior-focused scenarios (`Given` / `When` / `Observe`) plus the applicable repository commands.
7. **Idempotence and recovery** — safe reruns, rollback, cleanup, or stop conditions for risky operations.
8. **Surprises and discoveries** — unexpected repository, library, schema, or runtime findings with evidence.
9. **Decision log** — date, decision, and rationale for material trade-offs.
10. **Outcomes and retrospective** — what completed, what did not, follow-up debt, and documentation updates.

## Planning rules

- Ground each step in existing repository paths and real commands; do not invent infrastructure or validation.
- Name the relevant contract: product specification, design decision, migration, capability, or skill.
- Make migration/security/realtime steps explicit about ownership, grants, RLS, triggers, private topics, and verification.
- Keep the plan updated as facts change; do not leave completed work described as future work.
- A plan is not a substitute for the implementation’s final diff review and validation.

## Completion lifecycle

Before moving an active plan to `completed/`:

1. Record the final validation and unresolved work.
2. Move durable knowledge to the appropriate system document.
3. Add or update a quality/debt entry only when a verified gap remains.
4. Update the plan’s retrospective and then move it; do not delete the evidence trail.

For an active plan, start with [Architecture](/architecture) and the task-specific documents routed from `AGENTS.md`.
