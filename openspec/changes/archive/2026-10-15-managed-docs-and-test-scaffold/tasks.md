# Tasks: Managed Architecture Docs Synchronization & Go Backend Automated Test Scaffolding

## 1. Go Backend Automated Test Scaffolding

- [x] 1.1 Create `server/internal/config/config_test.go` covering default values, environment overrides, and file parsing.
- [x] 1.2 Create `server/internal/buffer/note_buffer_test.go` covering buffering, dirty tracking, flush execution, and graceful shutdown.
- [x] 1.3 Run `go -C server test -v ./...` and verify all tests pass cleanly.

## 2. Managed Documents Synchronization

- [x] 2.1 Update `AGENTS.md` to reflect Go 1.23+ backend, Neon DB, Goose, slog, de-Arcoized frontend, and Tauri 2 plugins.
- [x] 2.2 Update `ARCHITECTURE.md` to document the 4-tier topology (Tauri 2 -> React 19 -> Go 1.23+ -> Neon PostgreSQL).
- [x] 2.3 Update `docs/BACKEND.md` to describe the Go backend services, pgxpool, Goose migrations, note buffer, and WebSocket hub.
- [x] 2.4 Update `docs/FRONTEND.md` to reflect pure Tailwind CSS 4 UI components and vendor chunking.

## 3. Verification & Validation Gate

- [x] 3.1 Run `ai-harness validate` to verify all 4 managed documents pass validation without errors.
- [x] 3.2 Run `pnpm build` to verify frontend compilation continues to pass.
- [x] 3.3 Run `cargo check` in `src-tauri/` to verify Rust code compiles cleanly.
