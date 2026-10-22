package handler

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"workbuddy-server/internal/middleware"
	"workbuddy-server/internal/storage"
)

const (
	MaxMediaFileSize = 10 * 1024 * 1024 // 10MB
)

type MediaHandler struct {
	driver    storage.StorageDriver
	uploadDir string
}

func NewMediaHandler(uploadDir string, drivers ...storage.StorageDriver) *MediaHandler {
	if uploadDir == "" {
		uploadDir = "./data/media"
	}
	var d storage.StorageDriver
	if len(drivers) > 0 && drivers[0] != nil {
		d = drivers[0]
	} else {
		d, _ = storage.NewLocalStorageDriver(uploadDir)
	}
	return &MediaHandler{
		driver:    d,
		uploadDir: uploadDir,
	}
}

// UploadMedia handles uploading media assets with SHA-256 deduplication and MIME validation.
func (h *MediaHandler) UploadMedia(c *gin.Context) {
	_, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing file in form field 'file'"})
		return
	}

	if fileHeader.Size > MaxMediaFileSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file size exceeds maximum limit of 10MB"})
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to open uploaded file: %v", err)})
		return
	}
	defer file.Close()

	content, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to read uploaded file: %v", err)})
		return
	}

	if len(content) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "uploaded file is empty"})
		return
	}

	// Detect and validate MIME type
	mimeType, ext, ok := detectAllowedImageType(content, fileHeader.Filename)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("unsupported media type: %s. Allowed types: JPEG, PNG, WebP, GIF, SVG", mimeType),
		})
		return
	}

	// Compute SHA-256 digest
	hashBytes := sha256.Sum256(content)
	hashHex := hex.EncodeToString(hashBytes[:])
	filename := fmt.Sprintf("%s%s", hashHex, ext)

	// Persist via storage driver (handles deduplication, cloud R2 upload, or local fallback)
	mediaURL, err := h.driver.Put(c.Request.Context(), filename, content, mimeType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to persist media file: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"url":       mediaURL,
		"filename":  filename,
		"size":      len(content),
		"mime_type": mimeType,
		"hash":      hashHex,
	})
}

// ServeAsset serves an uploaded media asset with strong cache headers.
func (h *MediaHandler) ServeAsset(c *gin.Context) {
	filename := filepath.Base(c.Param("filename"))
	if filename == "" || filename == "." || filename == "/" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid filename"})
		return
	}

	targetPath := filepath.Join(h.uploadDir, filename)
	if _, err := os.Stat(targetPath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "media asset not found"})
		return
	}

	c.Header("Cache-Control", "public, max-age=31536000, immutable")
	c.File(targetPath)
}

func detectAllowedImageType(data []byte, originalFilename string) (mimeType string, ext string, ok bool) {
	detected := http.DetectContentType(data)

	// Check standard image mime types
	switch detected {
	case "image/jpeg":
		return "image/jpeg", ".jpg", true
	case "image/png":
		return "image/png", ".png", true
	case "image/webp":
		return "image/webp", ".webp", true
	case "image/gif":
		return "image/gif", ".gif", true
	}

	// SVG is often detected as text/xml or text/plain
	lowerName := strings.ToLower(originalFilename)
	if strings.HasSuffix(lowerName, ".svg") {
		sample := string(data)
		if len(sample) > 512 {
			sample = sample[:512]
		}
		if strings.Contains(sample, "<svg") || strings.Contains(sample, "<?xml") {
			return "image/svg+xml", ".svg", true
		}
	}

	return detected, "", false
}
