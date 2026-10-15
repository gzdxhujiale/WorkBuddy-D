package database

import (
	"context"
	"embed"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

//go:embed migrations/*.sql
var embedMigrations embed.FS

type DB struct {
	Pool *pgxpool.Pool
}

func Connect(ctx context.Context, dsn string) (*DB, error) {
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("parse dsn: %w", err)
	}

	// Bounded connection limits to prevent exhaustion
	cfg.MaxConns = 25
	cfg.MinConns = 3
	cfg.MaxConnLifetime = 1 * time.Hour
	cfg.MaxConnIdleTime = 30 * time.Minute
	cfg.HealthCheckPeriod = 1 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("create connection pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("ping database: %w", err)
	}

	slog.Info("connected to database",
		slog.String("host", cfg.ConnConfig.Host),
		slog.String("database", cfg.ConnConfig.Database),
	)

	// Run versioned migrations via Goose
	if err := runMigrations(pool); err != nil {
		slog.Error("database migration failed", slog.Any("error", err))
		return nil, fmt.Errorf("run goose migrations: %w", err)
	}

	return &DB{Pool: pool}, nil
}

func runMigrations(pool *pgxpool.Pool) error {
	db := stdlib.OpenDBFromPool(pool)
	defer db.Close()

	goose.SetBaseFS(embedMigrations)
	if err := goose.SetDialect("postgres"); err != nil {
		return fmt.Errorf("set dialect: %w", err)
	}

	goose.SetLogger(goose.NopLogger())

	slog.Info("running database migrations via goose...")
	if err := goose.Up(db, "migrations"); err != nil {
		return fmt.Errorf("goose up: %w", err)
	}

	version, err := goose.GetDBVersion(db)
	if err != nil {
		slog.Warn("could not retrieve goose db version", slog.Any("error", err))
	} else {
		slog.Info("database schema up to date", slog.Int64("version", version))
	}

	return nil
}

func (db *DB) Close() {
	if db.Pool != nil {
		db.Pool.Close()
	}
}
