package storage

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestLocalStorageDriver(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "local_storage_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	driver, err := NewLocalStorageDriver(tempDir)
	if err != nil {
		t.Fatalf("failed to initialize LocalStorageDriver: %v", err)
	}

	ctx := context.Background()
	testKey := "test-image.webp"
	testData := []byte("fake-image-binary-data")
	contentType := "image/webp"

	// 1. Initial exists check should be false
	exists, err := driver.Exists(ctx, testKey)
	if err != nil {
		t.Fatalf("Exists returned error: %v", err)
	}
	if exists {
		t.Fatalf("expected key not to exist initially")
	}

	// 2. Put file
	url, err := driver.Put(ctx, testKey, testData, contentType)
	if err != nil {
		t.Fatalf("Put failed: %v", err)
	}
	expectedURL := "/api/v1/media/assets/test-image.webp"
	if url != expectedURL {
		t.Errorf("expected URL %q, got %q", expectedURL, url)
	}

	// 3. Verify file on disk
	content, err := os.ReadFile(filepath.Join(tempDir, testKey))
	if err != nil {
		t.Fatalf("failed to read persisted file: %v", err)
	}
	if string(content) != string(testData) {
		t.Errorf("persisted content mismatch")
	}

	// 4. Exists check should be true
	exists, err = driver.Exists(ctx, testKey)
	if err != nil {
		t.Fatalf("Exists returned error: %v", err)
	}
	if !exists {
		t.Fatalf("expected key to exist after Put")
	}
}

func TestNewR2StorageDriver_Validation(t *testing.T) {
	// Incomplete configuration should return error
	_, err := NewR2StorageDriver(R2Config{
		AccountID: "my-account",
		// missing other fields
	})
	if err == nil {
		t.Fatalf("expected error on incomplete R2 config, got nil")
	}

	// Valid config should instantiate driver without error
	driver, err := NewR2StorageDriver(R2Config{
		AccountID:       "test-account-id",
		AccessKeyID:     "test-access-key",
		SecretAccessKey: "test-secret-key",
		BucketName:      "test-bucket",
		PublicDomain:    "https://assets.workbuddy.hujiale.works",
	})
	if err != nil {
		t.Fatalf("unexpected error creating R2 driver: %v", err)
	}

	expectedURL := "https://assets.workbuddy.hujiale.works/media/sample.webp"
	if driver.GetURL("sample.webp") != expectedURL {
		t.Errorf("expected URL %q, got %q", expectedURL, driver.GetURL("sample.webp"))
	}
}
