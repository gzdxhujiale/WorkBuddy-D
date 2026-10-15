package buffer

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"workbuddy-server/internal/database/sqlc"
)

type mockQuerier struct {
	sqlc.Querier
	mu           sync.Mutex
	patchedNotes []sqlc.PatchNoteParams
}

func (m *mockQuerier) PatchNote(ctx context.Context, arg sqlc.PatchNoteParams) (sqlc.Note, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.patchedNotes = append(m.patchedNotes, arg)
	return sqlc.Note{
		ID:          arg.ID,
		UserID:      arg.UserID,
		Title:       arg.Title,
		Content:     arg.Content,
		LockVersion: arg.LockVersion + 1,
	}, nil
}

type failingQuerier struct {
	sqlc.Querier
	mu           sync.Mutex
	patchedNotes []sqlc.PatchNoteParams
	failAttempts int
	calls        int
}

func (f *failingQuerier) PatchNote(ctx context.Context, arg sqlc.PatchNoteParams) (sqlc.Note, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls++
	if f.calls <= f.failAttempts {
		return sqlc.Note{}, errors.New("simulated database timeout")
	}
	f.patchedNotes = append(f.patchedNotes, arg)
	return sqlc.Note{
		ID:          arg.ID,
		UserID:      arg.UserID,
		Title:       arg.Title,
		Content:     arg.Content,
		LockVersion: arg.LockVersion + 1,
	}, nil
}

func TestNoteBufferManager_BufferAndFlush(t *testing.T) {
	mockQ := &mockQuerier{}
	mgr := NewNoteBufferManager(mockQ, nil)

	userID := uuid.New()
	noteID := uuid.New()
	title := "Buffered Title"
	content := "Buffered Content"

	mgr.BufferPatch(userID, noteID, &title, &content, 1)

	// Verify buffer item exists and is dirty
	item, ok := mgr.GetItem(noteID)
	if !ok {
		t.Fatalf("expected note %v to be buffered", noteID)
	}
	if !item.IsDirty {
		t.Errorf("expected item to be marked dirty")
	}
	if *item.Title != title || *item.Content != content {
		t.Errorf("expected buffered values match")
	}

	// Perform manual flush
	mgr.FlushDirty()

	// Verify dirty is cleared
	item, ok = mgr.GetItem(noteID)
	if !ok {
		t.Fatalf("expected note %v to exist", noteID)
	}
	if item.IsDirty {
		t.Errorf("expected dirty flag to be cleared after flush")
	}
	if item.LockVersion != 2 {
		t.Errorf("expected lock version updated to 2, got %d", item.LockVersion)
	}

	// Verify querier received patch call
	mockQ.mu.Lock()
	if len(mockQ.patchedNotes) != 1 {
		t.Errorf("expected 1 patch call, got %d", len(mockQ.patchedNotes))
	}
	mockQ.mu.Unlock()
}

func TestNoteBufferManager_RetryOnFailure(t *testing.T) {
	failQ := &failingQuerier{failAttempts: 1}
	mgr := NewNoteBufferManager(failQ, nil)

	userID := uuid.New()
	noteID := uuid.New()
	title := "Resilient Note"
	mgr.BufferPatch(userID, noteID, &title, nil, 1)

	// 1st flush should fail on DB layer
	mgr.FlushDirty()

	// Item must RETAIN dirty flag so it is retried
	item, ok := mgr.GetItem(noteID)
	if !ok {
		t.Fatalf("expected note to remain in buffer")
	}
	if !item.IsDirty {
		t.Errorf("expected item to RETAIN dirty flag after DB failure")
	}

	// 2nd flush succeeds
	mgr.FlushDirty()

	item, ok = mgr.GetItem(noteID)
	if !ok {
		t.Fatalf("expected note to exist in buffer")
	}
	if item.IsDirty {
		t.Errorf("expected dirty flag to be cleared after successful retry")
	}
	if item.LockVersion != 2 {
		t.Errorf("expected lock version updated to 2, got %d", item.LockVersion)
	}
}

func TestNoteBufferManager_EvictIdle(t *testing.T) {
	mockQ := &mockQuerier{}
	mgr := NewNoteBufferManager(mockQ, nil)

	userID := uuid.New()
	cleanNoteID := uuid.New()
	dirtyNoteID := uuid.New()

	titleClean := "Clean Note"
	titleDirty := "Dirty Note"

	mgr.BufferPatch(userID, cleanNoteID, &titleClean, nil, 1)
	mgr.BufferPatch(userID, dirtyNoteID, &titleDirty, nil, 1)

	// Flush cleanNoteID
	mgr.FlushDirty()

	// Verify cleanNote is not dirty, dirtyNote was also flushed
	// Now mark dirtyNote dirty again
	mgr.BufferPatch(userID, dirtyNoteID, &titleDirty, nil, 2)

	// Simulate passage of time for clean note
	mgr.mu.Lock()
	mgr.items[cleanNoteID].UpdatedAt = time.Now().Add(-10 * time.Minute)
	mgr.items[dirtyNoteID].UpdatedAt = time.Now().Add(-10 * time.Minute)
	mgr.mu.Unlock()

	// Evict clean notes idle > 5 minutes
	evicted := mgr.EvictIdle(5 * time.Minute)
	if evicted != 1 {
		t.Errorf("expected 1 item evicted, got %d", evicted)
	}

	// Clean note should be gone
	if _, exists := mgr.GetItem(cleanNoteID); exists {
		t.Errorf("expected clean idle note to be evicted")
	}

	// Dirty note must NEVER be evicted even if old
	if _, exists := mgr.GetItem(dirtyNoteID); !exists {
		t.Errorf("expected dirty note to be preserved against eviction")
	}
}

func TestNoteBufferManager_Lifecycle(t *testing.T) {
	mockQ := &mockQuerier{}
	mgr := NewNoteBufferManager(mockQ, nil)

	mgr.Start()

	userID := uuid.New()
	noteID := uuid.New()
	title := "Lifecycle Note"
	mgr.BufferPatch(userID, noteID, &title, nil, 1)

	// Stop must cleanly flush remaining dirty items and shut down without deadlocks
	mgr.Stop()

	item, ok := mgr.GetItem(noteID)
	if !ok {
		t.Fatalf("expected note to exist")
	}
	if item.IsDirty {
		t.Errorf("expected all dirty items flushed on Stop()")
	}

	mockQ.mu.Lock()
	if len(mockQ.patchedNotes) != 1 {
		t.Errorf("expected patch call executed on Stop(), got %d", len(mockQ.patchedNotes))
	}
	mockQ.mu.Unlock()
}

func TestNoteBufferManager_ConcurrentWrites(t *testing.T) {
	mockQ := &mockQuerier{}
	mgr := NewNoteBufferManager(mockQ, nil)

	userID := uuid.New()
	noteID := uuid.New()

	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			title := "Title"
			content := "Content"
			mgr.BufferPatch(userID, noteID, &title, &content, int64(idx))
			time.Sleep(2 * time.Millisecond)
		}(i)
	}

	wg.Wait()

	mgr.FlushDirty()

	mockQ.mu.Lock()
	if len(mockQ.patchedNotes) < 1 {
		t.Errorf("expected at least 1 flush call executed")
	}
	mockQ.mu.Unlock()
}
