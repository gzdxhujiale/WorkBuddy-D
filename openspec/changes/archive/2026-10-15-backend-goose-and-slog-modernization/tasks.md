# Tasks: Go Backend Goose Migration and slog Modernization

## 1. Goose Migration Setup

- [x] 1.1 Add `github.com/pressly/goose/v3` and `github.com/jackc/pgx/v5/stdlib` to `server/go.mod` and run `go mod tidy`, verifying clean dependency resolution.
- [x] 1.2 Add Goose `-- +goose Up` and `-- +goose Down` annotations to `db/migrations/000001_init_schema.sql` and `db/migrations/000002_upgrade_sync_kb_review.sql`, verifying SQL syntax remains intact.
- [x] 1.3 Update `server/internal/database/db.go` to embed migration files via `//go:embed` and execute `goose.Up` through `stdlib.OpenDBFromPool`, replacing the raw `pool.Exec(ctx, schemaSQL)`.

## 2. Structured Logging with `log/slog`

- [x] 2.1 Refactor `server/cmd/server/main.go` and `server/internal/database/db.go` to use Go 1.21+ `log/slog` for server lifecycle, database connection, and shutdown logging.
- [x] 2.2 Refactor `server/internal/buffer/note_buffer.go` and `server/internal/ws/hub.go` to use `slog` with structured key-value attributes.

## 3. Verification & Build

- [x] 3.1 Run `go -C server build ./cmd/server` to verify that the server binary compiles cleanly without warnings or errors.
- [x] 3.2 Verify that frontend production build (`pnpm build`) continues to pass cleanly alongside the backend.
