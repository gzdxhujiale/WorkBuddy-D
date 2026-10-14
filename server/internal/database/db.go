package database

import (
	"context"
	_ "embed"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed schema.sql
var schemaSQL string

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

	log.Printf("[Database] Connected successfully to %s/%s with pgxpool", cfg.ConnConfig.Host, cfg.ConnConfig.Database)

	// Ensure schema tables exist automatically
	if _, err := pool.Exec(ctx, schemaSQL); err != nil {
		log.Printf("[Database] Warning: auto schema migration returned: %v", err)
	} else {
		log.Println("[Database] Schema verified and up to date")
	}

	return &DB{Pool: pool}, nil
}

func (db *DB) Close() {
	if db.Pool != nil {
		db.Pool.Close()
	}
}
