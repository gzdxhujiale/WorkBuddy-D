package storage

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3types "github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/aws/smithy-go"
)

// StorageDriver defines the contract for persisting media assets.
type StorageDriver interface {
	// Put persists media bytes under the given key and returns its accessible URL.
	Put(ctx context.Context, key string, data []byte, contentType string) (string, error)
	// Exists checks whether an asset key already exists in the storage provider.
	Exists(ctx context.Context, key string) (bool, error)
	// GetURL returns the canonical access URL for the given key.
	GetURL(key string) string
}

// ==========================================
// Local Storage Driver
// ==========================================

type LocalStorageDriver struct {
	baseDir string
}

// NewLocalStorageDriver creates a local disk storage driver.
func NewLocalStorageDriver(baseDir string) (*LocalStorageDriver, error) {
	if baseDir == "" {
		baseDir = "./data/media"
	}
	if err := os.MkdirAll(baseDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create local media directory: %w", err)
	}
	return &LocalStorageDriver{baseDir: baseDir}, nil
}

func (l *LocalStorageDriver) Put(ctx context.Context, key string, data []byte, contentType string) (string, error) {
	targetPath := filepath.Join(l.baseDir, key)
	if _, err := os.Stat(targetPath); os.IsNotExist(err) {
		if err := os.WriteFile(targetPath, data, 0644); err != nil {
			return "", fmt.Errorf("failed to write local media file: %w", err)
		}
	}
	return l.GetURL(key), nil
}

func (l *LocalStorageDriver) Exists(ctx context.Context, key string) (bool, error) {
	targetPath := filepath.Join(l.baseDir, key)
	_, err := os.Stat(targetPath)
	if err == nil {
		return true, nil
	}
	if os.IsNotExist(err) {
		return false, nil
	}
	return false, err
}

func (l *LocalStorageDriver) GetURL(key string) string {
	return fmt.Sprintf("/api/v1/media/assets/%s", key)
}

// ==========================================
// Cloudflare R2 / S3 Storage Driver
// ==========================================

type R2Config struct {
	AccountID       string
	AccessKeyID     string
	SecretAccessKey string
	BucketName      string
	PublicDomain    string
}

type R2StorageDriver struct {
	client       *s3.Client
	bucketName   string
	publicDomain string
}

// NewR2StorageDriver creates an S3-compatible driver targeting Cloudflare R2.
func NewR2StorageDriver(cfg R2Config) (*R2StorageDriver, error) {
	if cfg.AccountID == "" || cfg.AccessKeyID == "" || cfg.SecretAccessKey == "" || cfg.BucketName == "" {
		return nil, errors.New("incomplete R2 credentials: AccountID, AccessKeyID, SecretAccessKey and BucketName are required")
	}

	endpoint := fmt.Sprintf("https://%s.r2.cloudflarestorage.com", cfg.AccountID)

	s3Client := s3.New(s3.Options{
		BaseEndpoint: aws.String(endpoint),
		Region:       "auto",
		Credentials:  credentials.NewStaticCredentialsProvider(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
	})

	publicDomain := strings.TrimRight(cfg.PublicDomain, "/")
	if publicDomain == "" {
		publicDomain = fmt.Sprintf("https://%s.r2.cloudflarestorage.com/%s", cfg.AccountID, cfg.BucketName)
	}

	return &R2StorageDriver{
		client:       s3Client,
		bucketName:   cfg.BucketName,
		publicDomain: publicDomain,
	}, nil
}

func (r *R2StorageDriver) Put(ctx context.Context, key string, data []byte, contentType string) (string, error) {
	// Object key in R2 bucket under media/ prefix
	s3Key := fmt.Sprintf("media/%s", key)

	cacheControl := "public, max-age=31536000, immutable"
	input := &s3.PutObjectInput{
		Bucket:       aws.String(r.bucketName),
		Key:          aws.String(s3Key),
		Body:         bytes.NewReader(data),
		ContentType:  aws.String(contentType),
		CacheControl: aws.String(cacheControl),
	}

	_, err := r.client.PutObject(ctx, input)
	if err != nil {
		return "", fmt.Errorf("failed to upload object to Cloudflare R2: %w", err)
	}

	return r.GetURL(key), nil
}

func (r *R2StorageDriver) Exists(ctx context.Context, key string) (bool, error) {
	s3Key := fmt.Sprintf("media/%s", key)
	_, err := r.client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(r.bucketName),
		Key:    aws.String(s3Key),
	})
	if err == nil {
		return true, nil
	}

	var apiErr smithy.APIError
	if errors.As(err, &apiErr) {
		var notFound *s3types.NotFound
		if errors.As(err, &notFound) || apiErr.ErrorCode() == "NotFound" || apiErr.ErrorCode() == "404" {
			return false, nil
		}
	}

	return false, err
}

func (r *R2StorageDriver) GetURL(key string) string {
	return fmt.Sprintf("%s/media/%s", r.publicDomain, key)
}
