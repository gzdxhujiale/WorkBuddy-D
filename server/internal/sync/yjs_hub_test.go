package sync

import (
	"bytes"
	"testing"

	"github.com/google/uuid"
)

func TestVarUintEncodingDecoding(t *testing.T) {
	testValues := []uint64{0, 1, 127, 128, 255, 300, 16384, 1000000}
	for _, val := range testValues {
		encoded := WriteVarUint(val)
		decoded, n, err := ReadVarUint(encoded)
		if err != nil {
			t.Fatalf("unexpected error decoding %d: %v", val, err)
		}
		if decoded != val {
			t.Fatalf("expected %d, got %d", val, decoded)
		}
		if n != len(encoded) {
			t.Fatalf("expected read length %d, got %d", len(encoded), n)
		}
	}
}

func TestVarUint8ArrayEncodingDecoding(t *testing.T) {
	testData := []byte("hello yjs crdt state vector update")
	encoded := WriteVarUint8Array(testData)
	decoded, n, err := ReadVarUint8Array(encoded)
	if err != nil {
		t.Fatalf("unexpected error decoding varUint8Array: %v", err)
	}
	if !bytes.Equal(decoded, testData) {
		t.Fatalf("expected %s, got %s", string(testData), string(decoded))
	}
	if n != len(encoded) {
		t.Fatalf("expected read length %d, got %d", len(encoded), n)
	}
}

func TestBuildSyncMessages(t *testing.T) {
	step1 := BuildSyncStep1Message([]byte{1, 2, 3})
	if len(step1) == 0 {
		t.Fatal("step1 message should not be empty")
	}
	msgType, offset, err := ReadVarUint(step1)
	if err != nil || msgType != MsgSync {
		t.Fatalf("expected MsgSync (0), got %d, err: %v", msgType, err)
	}
	syncType, _, err := ReadVarUint(step1[offset:])
	if err != nil || syncType != SyncStep1 {
		t.Fatalf("expected SyncStep1 (0), got %d, err: %v", syncType, err)
	}

	dummyUpdate := []byte("binary update payload")
	step2 := BuildSyncStep2Message(dummyUpdate)
	msgType2, offset2, err := ReadVarUint(step2)
	if err != nil || msgType2 != MsgSync {
		t.Fatalf("expected MsgSync (0), got %d, err: %v", msgType2, err)
	}
	syncType2, syncOffset2, err := ReadVarUint(step2[offset2:])
	if err != nil || syncType2 != SyncStep2 {
		t.Fatalf("expected SyncStep2 (1), got %d, err: %v", syncType2, err)
	}
	updatePayload, _, err := ReadVarUint8Array(step2[offset2+syncOffset2:])
	if err != nil || !bytes.Equal(updatePayload, dummyUpdate) {
		t.Fatalf("expected update payload %s, got %s", string(dummyUpdate), string(updatePayload))
	}
}

func TestYjsRoomAndHub(t *testing.T) {
	hub := NewYjsHub(nil)
	noteID := uuid.New().String()

	room := hub.GetOrCreateRoom(noteID)
	if room == nil {
		t.Fatal("room should not be nil")
	}

	clientA := &YjsClient{
		Hub:    hub,
		Room:   room,
		UserID: uuid.New(),
		Send:   make(chan []byte, 10),
	}
	clientB := &YjsClient{
		Hub:    hub,
		Room:   room,
		UserID: uuid.New(),
		Send:   make(chan []byte, 10),
	}

	room.AddClient(clientA)
	room.AddClient(clientB)

	// Broadcast from Client A to Client B
	testMsg := []byte("update from client A")
	room.Broadcast(clientA, testMsg)

	select {
	case msg := <-clientB.Send:
		if !bytes.Equal(msg, testMsg) {
			t.Fatalf("client B received unexpected message: %s", string(msg))
		}
	default:
		t.Fatal("client B did not receive message")
	}

	// Client A should NOT receive its own message
	select {
	case <-clientA.Send:
		t.Fatal("client A should not receive its own broadcast")
	default:
		// OK
	}

	// Remove clients
	hub.RemoveClient(clientA)
	if len(room.Clients) != 1 {
		t.Fatalf("expected 1 remaining client, got %d", len(room.Clients))
	}

	hub.RemoveClient(clientB)
	// Room should be cleaned up from hub
	hub.mu.RLock()
	_, exists := hub.Rooms[noteID]
	hub.mu.RUnlock()
	if exists {
		t.Fatal("room should be deleted from hub when empty")
	}
}
