package buffer

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"workbuddy-server/internal/database/sqlc"
	"workbuddy-server/internal/ws"
)

const DefaultIdleEvictionTTL = 5 * time.Minute

type BufferedNote struct {
	UserID      uuid.UUID
	NoteID      uuid.UUID
	Title       *string
	Content     *string
	LockVersion int64
	UpdatedAt   time.Time
	IsDirty     bool
}

type noteFlushSnapshot struct {
	noteID      uuid.UUID
	userID      uuid.UUID
	title       *string
	content     *string
	lockVersion int64
	updatedAt   time.Time
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
	var toFlush []noteFlushSnapshot
	for _, item := range m.items {
		if item.IsDirty {
			toFlush = append(toFlush, noteFlushSnapshot{
				noteID:      item.NoteID,
				userID:      item.UserID,
				title:       item.Title,
				content:     item.Content,
				lockVersion: item.LockVersion,
				updatedAt:   item.UpdatedAt,
			})
		}
	}
	m.mu.Unlock()

	if len(toFlush) > 0 {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		for _, item := range toFlush {
			setTitle := item.title != nil
			titleStr := ""
			if setTitle {
				titleStr = *item.title
			}

			setContent := item.content != nil
			contentStr := ""
			if setContent {
				contentStr = *item.content
			}

			note, err := m.queries.PatchNote(ctx, sqlc.PatchNoteParams{
				ID:           pgtype.UUID{Bytes: item.noteID, Valid: true},
				UserID:       pgtype.UUID{Bytes: item.userID, Valid: true},
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
				LockVersion:  item.lockVersion,
			})
			if err != nil {
				slog.Error("flush note failed; retaining dirty state for retry",
					slog.String("note_id", item.noteID.String()),
					slog.Any("error", err),
				)
				continue
			}

			m.mu.Lock()
			if current, ok := m.items[item.noteID]; ok {
				current.LockVersion = note.LockVersion
				if current.UpdatedAt.Equal(item.updatedAt) {
					current.IsDirty = false
				}
			}
			m.mu.Unlock()

			if m.hub != nil {
				m.hub.BroadcastToUser(item.userID, nil, ws.DeltaMessage{
					Type:   "ENTITY_DELTA",
					Table:  "notes",
					Action: ws.ActionUpdate,
					ID:     item.noteID.String(),
					Data:   note,
				})
			}
		}
	}

	// Evict clean items untouched beyond idle TTL
	m.EvictIdle(DefaultIdleEvictionTTL)
}

func (m *NoteBufferManager) EvictIdle(ttl time.Duration) int {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now()
	evicted := 0
	for id, item := range m.items {
		if !item.IsDirty && now.Sub(item.UpdatedAt) > ttl {
			delete(m.items, id)
			evicted++
		}
	}
	return evicted
}

func (m *NoteBufferManager) GetItem(id uuid.UUID) (*BufferedNote, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	item, ok := m.items[id]
	if !ok {
		return nil, false
	}
	// Return shallow copy
	cp := *item
	return &cp, true
}

func (m *NoteBufferManager) ItemCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.items)
}
