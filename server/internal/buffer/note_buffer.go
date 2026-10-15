package buffer

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"workbuddy-server/internal/database/sqlc"
	"workbuddy-server/internal/ws"
)

type BufferedNote struct {
	UserID      uuid.UUID
	NoteID      uuid.UUID
	Title       *string
	Content     *string
	LockVersion int64
	UpdatedAt   time.Time
	IsDirty     bool
}

type NoteBufferManager struct {
	mu      sync.Mutex
	items   map[uuid.UUID]*BufferedNote
	queries sqlc.Querier
	hub     *ws.Hub
	ticker  *time.Ticker
	stopCh  chan struct{}
	doneCh  chan struct{}
}

func NewNoteBufferManager(queries sqlc.Querier, hub *ws.Hub) *NoteBufferManager {
	return &NoteBufferManager{
		items:   make(map[uuid.UUID]*BufferedNote),
		queries: queries,
		hub:     hub,
		ticker:  time.NewTicker(2500 * time.Millisecond),
		stopCh:  make(chan struct{}),
		doneCh:  make(chan struct{}),
	}
}

func (m *NoteBufferManager) Start() {
	go func() {
		defer close(m.doneCh)
		for {
			select {
			case <-m.ticker.C:
				m.FlushDirty()
			case <-m.stopCh:
				m.ticker.Stop()
				m.FlushDirty()
				return
			}
		}
	}()
}

func (m *NoteBufferManager) Stop() {
	close(m.stopCh)
	<-m.doneCh
}

func (m *NoteBufferManager) BufferPatch(userID uuid.UUID, noteID uuid.UUID, title *string, content *string, lockVersion int64) {
	m.mu.Lock()
	defer m.mu.Unlock()

	item, exists := m.items[noteID]
	if !exists {
		item = &BufferedNote{
			UserID: userID,
			NoteID: noteID,
		}
		m.items[noteID] = item
	}

	if title != nil {
		item.Title = title
	}
	if content != nil {
		item.Content = content
	}
	item.LockVersion = lockVersion
	item.UpdatedAt = time.Now()
	item.IsDirty = true
}

func (m *NoteBufferManager) FlushDirty() {
	m.mu.Lock()
	var toFlush []*BufferedNote
	for _, item := range m.items {
		if item.IsDirty {
			toFlush = append(toFlush, item)
			item.IsDirty = false
		}
	}
	m.mu.Unlock()

	if len(toFlush) == 0 {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	for _, item := range toFlush {
		setTitle := item.Title != nil
		titleStr := ""
		if setTitle {
			titleStr = *item.Title
		}

		setContent := item.Content != nil
		contentStr := ""
		if setContent {
			contentStr = *item.Content
		}

		note, err := m.queries.PatchNote(ctx, sqlc.PatchNoteParams{
			ID:           pgtype.UUID{Bytes: item.NoteID, Valid: true},
			UserID:       pgtype.UUID{Bytes: item.UserID, Valid: true},
			SetTitle:     setTitle,
			Title:        titleStr,
			SetContent:   setContent,
			Content:      contentStr,
			SetSortOrder: false,
			SortOrder:    0,
			SetFolderID:  false,
			FolderID:     pgtype.UUID{},
			SetGroupID:   false,
			GroupID:      pgtype.UUID{},
			LockVersion:  item.LockVersion,
		})
		if err != nil {
			log.Printf("[NoteBuffer] Warning: flush note %s failed: %v", item.NoteID, err)
			continue
		}

		m.mu.Lock()
		if current, ok := m.items[item.NoteID]; ok {
			current.LockVersion = note.LockVersion
		}
		m.mu.Unlock()

		if m.hub != nil {
			m.hub.BroadcastToUser(item.UserID, nil, ws.DeltaMessage{
				Type:   "ENTITY_DELTA",
				Table:  "notes",
				Action: ws.ActionUpdate,
				ID:     item.NoteID.String(),
				Data:   note,
			})
		}
	}
}
