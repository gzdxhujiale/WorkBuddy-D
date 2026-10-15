package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadDefaults(t *testing.T) {
	// Temporarily clear environment variables to test default fallbacks
	origPort := os.Getenv("PORT")
	origDSN := os.Getenv("DB_DSN")
	origJWT := os.Getenv("JWT_SECRET")
	origCORS := os.Getenv("CORS_ORIGIN")
	defer func() {
		os.Setenv("PORT", origPort)
		os.Setenv("DB_DSN", origDSN)
		os.Setenv("JWT_SECRET", origJWT)
		os.Setenv("CORS_ORIGIN", origCORS)
	}()

	os.Unsetenv("PORT")
	os.Unsetenv("DB_DSN")
	os.Unsetenv("JWT_SECRET")
	os.Unsetenv("CORS_ORIGIN")

	cfg := Load()
	if cfg.Port == "" {
		t.Errorf("expected non-empty Port, got %q", cfg.Port)
	}
	if cfg.DBDSN == "" {
		t.Errorf("expected non-empty DBDSN, got %q", cfg.DBDSN)
	}
	if cfg.JWTSecret == "" {
		t.Errorf("expected non-empty JWTSecret, got %q", cfg.JWTSecret)
	}
	if cfg.CORSOrigin == "" {
		t.Errorf("expected non-empty CORSOrigin, got %q", cfg.CORSOrigin)
	}
}

func TestLoadEnvFile(t *testing.T) {
	tmpDir := t.TempDir()
	envPath := filepath.Join(tmpDir, ".env")

	envContent := `
# Sample comment
TEST_CUSTOM_KEY="custom-value"
TEST_QUOTED_KEY='single-quoted'
TEST_PLAIN_KEY=plain-value
`
	if err := os.WriteFile(envPath, []byte(envContent), 0644); err != nil {
		t.Fatalf("failed to write temp env file: %v", err)
	}

	loadEnvFile(envPath)

	if val := os.Getenv("TEST_CUSTOM_KEY"); val != "custom-value" {
		t.Errorf("expected TEST_CUSTOM_KEY to be 'custom-value', got %q", val)
	}
	if val := os.Getenv("TEST_QUOTED_KEY"); val != "single-quoted" {
		t.Errorf("expected TEST_QUOTED_KEY to be 'single-quoted', got %q", val)
	}
	if val := os.Getenv("TEST_PLAIN_KEY"); val != "plain-value" {
		t.Errorf("expected TEST_PLAIN_KEY to be 'plain-value', got %q", val)
	}
}
