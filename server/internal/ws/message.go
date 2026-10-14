package ws

type ActionType string

const (
	ActionInsert ActionType = "INSERT"
	ActionUpdate ActionType = "UPDATE"
	ActionDelete ActionType = "DELETE"
)

type DeltaMessage struct {
	Type     string      `json:"type"` // "ENTITY_DELTA"
	Table    string      `json:"table"`
	Action   ActionType  `json:"action"`
	ID       string      `json:"id"`
	FolderID string      `json:"folder_id,omitempty"`
	Data     interface{} `json:"data,omitempty"`
}
