package handler

import (
	"encoding/json"
	"testing"
)

func TestIsReviewContentEmpty(t *testing.T) {
	tests := []struct {
		name     string
		content  string
		expected bool
	}{
		{"nil or empty", "", true},
		{"empty json object", "{}", true},
		{"null literal", "null", true},
		{"empty string json", `""`, true},
		{"whitespace string", `"   "`, true},
		{"wrapper with empty text", `{"text":""}`, true},
		{"wrapper with whitespace text", `{"text":"   "}`, true},
		{"wrapper with empty html", `{"text":"<p></p>"}`, true},
		{"wrapper with break tag", `{"text":"<p><br></p>"}`, true},
		{"wrapper with tiptap empty paragraph", `{"text":"{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\"}]}"}`, true},
		{"direct tiptap empty doc", `{"type":"doc","content":[{"type":"paragraph"}]}`, true},
		{"direct tiptap empty doc with empty content array", `{"type":"doc","content":[]}`, true},
		{"direct tiptap doc with empty text node", `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"   "}]}]}`, true},
		{"wrapper with real text", `{"text":"Today went great!"}`, false},
		{"wrapper with serialized tiptap with text", `{"text":"{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"Productive day\"}]}]}"}`, false},
		{"direct tiptap doc with text", `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hello World"}]}]}`, false},
		{"wrapper with html text", `{"text":"<p>Achievement unlocked</p>"}`, false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			actual := isReviewContentEmpty(json.RawMessage(tc.content))
			if actual != tc.expected {
				t.Errorf("[%s] expected %v, got %v for content %s", tc.name, tc.expected, actual, tc.content)
			}
		})
	}
}
