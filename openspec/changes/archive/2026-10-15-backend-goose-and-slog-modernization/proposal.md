# Proposal: Go Backend Goose Migration and slog Modernization

## Why

The WorkBuddy-D Go backend currently executes a raw embedded `schema.sql` on startup without database migration versioning, locking, or rollback control, even though migration scripts exist separately in `db/migrations/`. Furthermore, server diagnostics rely on unstructured standard `log.Printf` statements without log levels or contextual attributes. Introducing `pressly/goose/v3` with embedded migrations and adopting Go 1.21+ `log/slog` brings production-grade database version management and observable structured logging.

## What Changes

- **Integrate Goose v3**: Embed `db/migrations/*.sql` using `//go:embed` and execute pending migrations through `goose.Up` on server start, recording migration versions in `goose_db_version`.
- **Annotate Migration SQL**: Update `db/migrations/000001_init_schema.sql` and `000002_upgrade_sync_kb_review.sql` with standard `-- +goose Up` and `-- +goose Down` comments, fully compatible with `sqlc`.
- **Adopt `log/slog`**: Replace standard library `log.Printf`/`log.Println` across `server/cmd/server/main.go`, `server/internal/database/db.go`, `server/internal/buffer/note_buffer.go`, and WebSocket Hub with Go 1.21+ `slog`, featuring contextual attributes (`user_id`, `path`, `status`, `duration_ms`, `err`).
- **Clean Database Boot**: Remove the raw startup `pool.Exec(ctx, schemaSQL)` in favor of the type-safe, versioned Goose runner.

## Capabilities

### New Capabilities
None. (This is an internal backend infrastructure and observability modernization.)

### Modified Capabilities
None.

## Impact

- **Dependencies**: Adds `github.com/pressly/goose/v3` to `server/go.mod`.
- **Affected Files**:
  - `server/go.mod` / `server/go.sum`
  - `db/migrations/000001_init_schema.sql`
  - `db/migrations/000002_upgrade_sync_kb_review.sql`
  - `server/internal/database/db.go`
  - `server/cmd/server/main.go`
  - `server/internal/ws/hub.go`
  - `server/internal/buffer/note_buffer.go`
- **Zero Breaking Changes**: Database schema, API routes, and frontend contracts remain 100% backwards-compatible.
