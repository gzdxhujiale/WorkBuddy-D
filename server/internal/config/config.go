package config

import (
	"bufio"
	"os"
	"strings"
)

type Config struct {
	Port       string
	DBDSN      string
	JWTSecret  string
	CORSOrigin string
}

func loadEnvFile(path string) {
	file, err := os.Open(path)
	if err != nil {
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			key := strings.TrimSpace(parts[0])
			val := strings.TrimSpace(parts[1])
			if len(val) >= 2 && ((val[0] == '"' && val[len(val)-1] == '"') || (val[0] == '\'' && val[len(val)-1] == '\'')) {
				val = val[1 : len(val)-1]
			}
			if _, exists := os.LookupEnv(key); !exists {
				os.Setenv(key, val)
			}
		}
	}
}

func Load() *Config {
	loadEnvFile(".env")
	loadEnvFile("../.env")

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dsn := os.Getenv("DB_DSN")
	if dsn == "" {
		dsn = "postgres://postgres:postgres@localhost:5432/workbuddy?sslmode=disable"
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "workbuddy-default-jwt-secret-key-2026"
	}

	corsOrigin := os.Getenv("CORS_ORIGIN")
	if corsOrigin == "" {
		corsOrigin = "*"
	}

	return &Config{
		Port:       port,
		DBDSN:      dsn,
		JWTSecret:  jwtSecret,
		CORSOrigin: corsOrigin,
	}
}

