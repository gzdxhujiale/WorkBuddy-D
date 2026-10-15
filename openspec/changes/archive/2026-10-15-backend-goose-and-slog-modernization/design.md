# Design: Go Backend Goose Migration and slog Modernization

## Context

The Go backend connects to PostgreSQL via `github.com/jackc/pgx/v5/pgxpool`. Migration files reside in `db/migrations/` (referenced by `sqlc.yaml`), but previously `server/internal/database/db.go` duplicated the schema in an embedded `schema.sql` and ran `pool.Exec(ctx, schemaSQL)`. Logging across the server used unstructured standard `log.Printf` statements.

## Goals / Non-Goals

**Goals:**
- Replace raw schema execution in `db.go` with versioned migrations driven by `pressly/goose/v3`.
- Embed `db/migrations/*.sql` directly into the Go binary using `//go:embed` so the backend runs migrations automatically on startup without requiring an external CLI.
- Adapt `000001_init_schema.sql` and `000002_upgrade_sync_kb_review.sql` with `-- +goose Up` and `-- +goose Down` directives while maintaining `sqlc` compatibility.
- Adopt standard library `log/slog` for structured logging, providing unified logging across HTTP server, database connection, NoteBufferManager, and WebSocket Hub.

**Non-Goals:**
- Altering existing table columns or data models.
- Changing SQLC queries or API endpoint signatures.

## Decisions

### 1. Embedded Goose Runner via `pgx/v5/stdlib`
- **Choice**: Use `github.com/jackc/pgx/v5/stdlib` to expose a `*sql.DB` from the existing `*pgxpool.Pool` for Goose.
- **Implementation**:
  ```go
  //go:embed migrations/*.sql
  var embedMigrations embed.FS
  ```
  Set Goose base filesystem via `goose.SetBaseFS(embedMigrations)` and execute `goose.Up(db, "migrations")`.
- **Alternative considered**: Requiring `goose` CLI installed on host. (Rejected: breaks single-binary zero-dependency deployment).

### 2. Migration Directives in SQL
- Add `-- +goose Up` and `-- +goose Down` blocks in `000001_init_schema.sql` and `000002_upgrade_sync_kb_review.sql`.
- Keep `IF NOT EXISTS` guards so migrations safely apply to existing databases without failing on existing objects.

### 3. Structured Logging with `log/slog`
- Initialize `slog.Default()` with `slog.NewTextHandler` (colored or readable in dev, structured JSON handler configurable via env).
- Replace `log.Printf` with `slog.Info`, `slog.Warn`, and `slog.Error` using key-value attributes (e.g. `slog.Info("connected to database", "host", host, "db", dbName)`).

## Risks / Trade-offs

- **[Risk] Existing DB already has tables but no `goose_db_version` table** → **Mitigation**: All statements in migrations use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`. Goose will create `goose_db_version` and cleanly execute without conflict, bringing the DB version history into sync.
