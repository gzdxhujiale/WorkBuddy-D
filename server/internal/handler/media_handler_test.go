package handler

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func createTestPNG() []byte {
	// Minimal valid PNG header and chunks (1x1 pixel transparent PNG)
	return []byte{
		0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
		0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk length & type
		0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // width: 1, height: 1
		0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, // bit depth: 8, color type: RGBA
		0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, // IDAT chunk
		0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
		0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
		0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, // IEND chunk
		0x42, 0x60, 0x82,
	}
}

func TestDetectAllowedImageType(t *testing.T) {
	pngData := createTestPNG()
	mime, ext, ok := detectAllowedImageType(pngData, "test.png")
	if !ok || mime != "image/png" || ext != ".png" {
		t.Errorf("expected png, got mime=%s, ext=%s, ok=%v", mime, ext, ok)
	}

	svgData := []byte("<svg xmlns=\"http://www.w3.org/2000/svg\"><circle r=\"10\"/></svg>")
	mime, ext, ok = detectAllowedImageType(svgData, "icon.svg")
	if !ok || mime != "image/svg+xml" || ext != ".svg" {
		t.Errorf("expected svg, got mime=%s, ext=%s, ok=%v", mime, ext, ok)
	}

	invalidData := []byte("plain text content which is not an image")
	mime, _, ok = detectAllowedImageType(invalidData, "test.txt")
	if ok {
		t.Errorf("expected invalid type, got mime=%s, ok=%v", mime, ok)
	}
}

func TestMediaHandler_UploadMedia_Unauthorized(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "media_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	h := NewMediaHandler(tempDir)

	r := gin.New()
	r.POST("/upload", h.UploadMedia)

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	_ = writer.Close()

	req, _ := http.NewRequest("POST", "/upload", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected status 401, got %d", w.Code)
	}
}

func TestMediaHandler_UploadMedia_SuccessAndDeduplication(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "media_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	h := NewMediaHandler(tempDir)
	userID := uuid.New()

	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("userID", userID)
		c.Next()
	})
	r.POST("/upload", h.UploadMedia)
	r.GET("/assets/:filename", h.ServeAsset)

	pngBytes := createTestPNG()

	// 1. Upload first time
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", "screenshot.png")
	if err != nil {
		t.Fatalf("failed to create form file: %v", err)
	}
	part.Write(pngBytes)
	writer.Close()

	req, _ := http.NewRequest("POST", "/upload", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse json response: %v", err)
	}

	url, ok := resp["url"].(string)
	if !ok || url == "" {
		t.Fatalf("expected url in response, got %v", resp)
	}
	filename, ok := resp["filename"].(string)
	if !ok || filename == "" {
		t.Fatalf("expected filename in response, got %v", resp)
	}

	// Verify file exists on disk
	storedPath := filepath.Join(tempDir, filename)
	if _, err := os.Stat(storedPath); os.IsNotExist(err) {
		t.Fatalf("expected file to be written to %s", storedPath)
	}

	// 2. Upload identical content second time (deduplication check)
	body2 := &bytes.Buffer{}
	writer2 := multipart.NewWriter(body2)
	part2, _ := writer2.CreateFormFile("file", "another_name.png")
	part2.Write(pngBytes)
	writer2.Close()

	req2, _ := http.NewRequest("POST", "/upload", body2)
	req2.Header.Set("Content-Type", writer2.FormDataContentType())
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)

	if w2.Code != http.StatusOK {
		t.Fatalf("second upload failed with %d: %s", w2.Code, w2.Body.String())
	}

	var resp2 map[string]interface{}
	json.Unmarshal(w2.Body.Bytes(), &resp2)
	if resp2["filename"] != filename {
		t.Errorf("expected deduplicated filename %s, got %v", filename, resp2["filename"])
	}

	// 3. Serve asset check
	req3, _ := http.NewRequest("GET", "/assets/"+filename, nil)
	w3 := httptest.NewRecorder()
	r.ServeHTTP(w3, req3)

	if w3.Code != http.StatusOK {
		t.Fatalf("expected status 200 on ServeAsset, got %d", w3.Code)
	}
	if cacheCtrl := w3.Header().Get("Cache-Control"); cacheCtrl == "" {
		t.Errorf("expected Cache-Control header to be set")
	}
}
