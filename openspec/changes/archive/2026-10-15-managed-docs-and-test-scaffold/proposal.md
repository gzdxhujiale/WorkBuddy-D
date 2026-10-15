# Proposal: Managed Architecture Docs Synchronization & Go Backend Automated Test Scaffolding

## Summary

Synchronize all 4 core managed documents (`AGENTS.md`, `ARCHITECTURE.md`, `docs/BACKEND.md`, `docs/FRONTEND.md`) to faithfully record the modern Go 1.23+ standalone server, Neon PostgreSQL, Goose migrations, `log/slog`, Tauri 2 native plugins, and de-Arcoized frontend architecture. Simultaneously, scaffold Go unit and integration tests for server configuration and buffering components, ensuring production-grade maintainability.

## Motivation & Benefits

- **Architecture Truth Alignment**: Recent upgrades migrated the system from Supabase BaaS to an independent Go 1.23+ backend with embedded Goose migrations, `log/slog` structured logging, WebSocket real-time sync, and eliminated `@arco-design/web-react`. The managed documents (`AGENTS.md`, `ARCHITECTURE.md`, `docs/BACKEND.md`, `docs/FRONTEND.md`) still reference Supabase BaaS and Arco Design, which misleads developers and AI coding agents.
- **Affirmative & Actionable Guidance**: In accordance with the `manage-docs` skill and affirmative action rules, the updated documents will strictly follow positive prescriptive patterns, clear dependency directions, and definitive verification gates.
- **Test Baseline**: Establishing unit tests for Go backend components (`config`, `note_buffer`) establishes automated CI/CD safety gates and prevents regressions.

## Scope

- In Scope:
  - Update `AGENTS.md` with accurate Go + Tauri 2 + React 19 technology baselines and developer commands.
  - Update `ARCHITECTURE.md` with system topology reflecting the standalone Go server, WebSocket hub, Goose migrations, and Tauri 2 shell.
  - Update `docs/BACKEND.md` to specify Go 1.23+, pgx connection pool, Goose migrations, note buffer, WebSocket hub, and Neon PostgreSQL persistence boundaries.
  - Update `docs/FRONTEND.md` to reflect pure Tailwind CSS 4 components, optimized bundle chunking, and WebSocket-driven TanStack Query invalidation.
  - Scaffold Go unit tests in `server/internal/config/config_test.go` and `server/internal/buffer/note_buffer_test.go`.
  - Validate documentation with `ai-harness validate` and tests with `go -C server test -v ./...`.
- Out of Scope:
  - Modifications to business domain rules in `openspec/specs/`.
