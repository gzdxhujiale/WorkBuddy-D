package handler

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"workbuddy-server/internal/buffer"
	"workbuddy-server/internal/database/sqlc"
	"workbuddy-server/internal/middleware"
	"workbuddy-server/internal/ws"
)

type NoteHandler struct {
	queries sqlc.Querier
	hub     *ws.Hub
	buffer  *buffer.NoteBufferManager
}

func NewNoteHandler(queries sqlc.Querier, hub *ws.Hub, bufMgr *buffer.NoteBufferManager) *NoteHandler {
	return &NoteHandler{queries: queries, hub: hub, buffer: bufMgr}
}

// --- Knowledge Bases ---

func (h *NoteHandler) ListKnowledgeBases(c *gin.Context) {
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	bases, err := h.queries.ListKnowledgeBases(c.Request.Context(), pgtype.UUID{Bytes: userID, Valid: true})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, bases)
}

type UpsertKBRequest struct {
	ID          string `json:"id"`
	Name        string `json:"name" binding:"required"`
	SortOrder   int32  `json:"sort_order"`
	LockVersion int64  `json:"lock_version"`
}

func (h *NoteHandler) CreateKnowledgeBase(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	var req UpsertKBRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	id := uuid.New()
	if req.ID != "" {
		if parsed, err := uuid.Parse(req.ID); err == nil {
			id = parsed
		}
	}

	kb, err := h.queries.UpsertKnowledgeBase(c.Request.Context(), sqlc.UpsertKnowledgeBaseParams{
		ID:        pgtype.UUID{Bytes: id, Valid: true},
		UserID:    pgtype.UUID{Bytes: userID, Valid: true},
		Name:      req.Name,
		SortOrder: req.SortOrder,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
		Type:   "ENTITY_DELTA",
		Table:  "knowledge_bases",
		Action: ws.ActionInsert,
		ID:     id.String(),
		Data:   kb,
	})

	c.JSON(http.StatusOK, kb)
}

func (h *NoteHandler) DeleteKnowledgeBase(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	if err := h.queries.SoftDeleteKnowledgeBase(c.Request.Context(), sqlc.SoftDeleteKnowledgeBaseParams{
		ID:     pgtype.UUID{Bytes: id, Valid: true},
		UserID: pgtype.UUID{Bytes: userID, Valid: true},
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	_ = h.queries.DetachFoldersFromKnowledgeBase(c.Request.Context(), sqlc.DetachFoldersFromKnowledgeBaseParams{
		KnowledgeBaseID: pgtype.UUID{Bytes: id, Valid: true},
		UserID:          pgtype.UUID{Bytes: userID, Valid: true},
	})

	h.hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
		Type:   "ENTITY_DELTA",
		Table:  "knowledge_bases",
		Action: ws.ActionDelete,
		ID:     id.String(),
	})

	c.JSON(http.StatusOK, gin.H{"success": true})
}

type ReorderItem struct {
	ID        string `json:"id"`
	SortOrder int32  `json:"sort_order"`
}

type ReorderRequest struct {
	Items []ReorderItem `json:"items" binding:"required"`
}

func (h *NoteHandler) ReorderKnowledgeBases(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	var req ReorderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var updated []sqlc.KnowledgeBasis
	for _, it := range req.Items {
		parsed, err := uuid.Parse(it.ID)
		if err != nil {
			continue
		}
		u, err := h.queries.UpdateKnowledgeBaseSortOrder(c.Request.Context(), sqlc.UpdateKnowledgeBaseSortOrderParams{
			ID:        pgtype.UUID{Bytes: parsed, Valid: true},
			UserID:    pgtype.UUID{Bytes: userID, Valid: true},
			SortOrder: it.SortOrder,
		})
		if err == nil {
			updated = append(updated, u)
		}
	}

	h.hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
		Type:   "ENTITY_DELTA",
		Table:  "knowledge_bases",
		Action: ws.ActionUpdate,
		Data:   updated,
	})

	c.JSON(http.StatusOK, updated)
}

// --- Folders ---

func (h *NoteHandler) ListFolders(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	folders, err := h.queries.ListFolders(c.Request.Context(), pgtype.UUID{Bytes: userID, Valid: true})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, folders)
}

type UpsertFolderRequest struct {
	ID              string  `json:"id"`
	KnowledgeBaseID *string `json:"knowledge_base_id"`
	Name            string  `json:"name" binding:"required"`
	SortOrder       int32   `json:"sort_order"`
	LockVersion     int64   `json:"lock_version"`
}

func (h *NoteHandler) CreateFolder(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	var req UpsertFolderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	id := uuid.New()
	if req.ID != "" {
		if parsed, err := uuid.Parse(req.ID); err == nil {
			id = parsed
		}
	}

	var kbUUID pgtype.UUID
	if req.KnowledgeBaseID != nil && *req.KnowledgeBaseID != "" {
		if parsed, err := uuid.Parse(*req.KnowledgeBaseID); err == nil {
			kbUUID = pgtype.UUID{Bytes: parsed, Valid: true}
		}
	}

	folder, err := h.queries.UpsertFolder(c.Request.Context(), sqlc.UpsertFolderParams{
		ID:              pgtype.UUID{Bytes: id, Valid: true},
		UserID:          pgtype.UUID{Bytes: userID, Valid: true},
		KnowledgeBaseID: kbUUID,
		Name:            req.Name,
		SortOrder:       req.SortOrder,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
		Type:   "ENTITY_DELTA",
		Table:  "knowledge_base_folders",
		Action: ws.ActionInsert,
		ID:     id.String(),
		Data:   folder,
	})

	c.JSON(http.StatusOK, folder)
}

func (h *NoteHandler) DeleteFolder(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	if err := h.queries.SoftDeleteFolder(c.Request.Context(), sqlc.SoftDeleteFolderParams{
		ID:     pgtype.UUID{Bytes: id, Valid: true},
		UserID: pgtype.UUID{Bytes: userID, Valid: true},
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	_ = h.queries.SoftDeleteFolderGroups(c.Request.Context(), sqlc.SoftDeleteFolderGroupsParams{
		FolderID: pgtype.UUID{Bytes: id, Valid: true},
		UserID:   pgtype.UUID{Bytes: userID, Valid: true},
	})
	_ = h.queries.SoftDeleteFolderNotes(c.Request.Context(), sqlc.SoftDeleteFolderNotesParams{
		FolderID: pgtype.UUID{Bytes: id, Valid: true},
		UserID:   pgtype.UUID{Bytes: userID, Valid: true},
	})

	h.hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
		Type:   "ENTITY_DELTA",
		Table:  "knowledge_base_folders",
		Action: ws.ActionDelete,
		ID:     id.String(),
	})

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *NoteHandler) ReorderFolders(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	var req ReorderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var updated []sqlc.KnowledgeBaseFolder
	for _, it := range req.Items {
		parsed, err := uuid.Parse(it.ID)
		if err != nil {
			continue
		}
		u, err := h.queries.UpdateFolderSortOrder(c.Request.Context(), sqlc.UpdateFolderSortOrderParams{
			ID:        pgtype.UUID{Bytes: parsed, Valid: true},
			UserID:    pgtype.UUID{Bytes: userID, Valid: true},
			SortOrder: it.SortOrder,
		})
		if err == nil {
			updated = append(updated, u)
		}
	}

	h.hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
		Type:   "ENTITY_DELTA",
		Table:  "knowledge_base_folders",
		Action: ws.ActionUpdate,
		Data:   updated,
	})

	c.JSON(http.StatusOK, updated)
}

type DuplicateFolderRequest struct {
	NewName string `json:"new_name" binding:"required"`
}

func (h *NoteHandler) DuplicateFolder(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	sourceIDStr := c.Param("id")
	sourceID, err := uuid.Parse(sourceIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid source id"})
		return
	}

	var req DuplicateFolderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userUUID := pgtype.UUID{Bytes: userID, Valid: true}
	srcFolderUUID := pgtype.UUID{Bytes: sourceID, Valid: true}

	srcFolder, err := h.queries.GetFolderByID(c.Request.Context(), sqlc.GetFolderByIDParams{
		ID:     srcFolderUUID,
		UserID: userUUID,
	})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "source folder not found"})
		return
	}

	newID := uuid.New()
	newFolderUUID := pgtype.UUID{Bytes: newID, Valid: true}
	cloned, err := h.queries.CreateFolder(c.Request.Context(), sqlc.CreateFolderParams{
		ID:              newFolderUUID,
		UserID:          userUUID,
		KnowledgeBaseID: srcFolder.KnowledgeBaseID,
		Name:            req.NewName,
		SortOrder:       srcFolder.SortOrder + 1,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 1. Deep clone groups and build mapping
	oldGroups, _ := h.queries.ListFolderGroups(c.Request.Context(), sqlc.ListFolderGroupsParams{
		UserID:   userUUID,
		FolderID: srcFolderUUID,
	})
	oldGroupMap := make(map[uuid.UUID]pgtype.UUID)
	for _, g := range oldGroups {
		newGroupID := uuid.New()
		newGroupUUID := pgtype.UUID{Bytes: newGroupID, Valid: true}
		oldGroupMap[g.ID.Bytes] = newGroupUUID
		clonedG, err := h.queries.CreateFolderGroup(c.Request.Context(), sqlc.CreateFolderGroupParams{
			ID:        newGroupUUID,
			UserID:    userUUID,
			FolderID:  newFolderUUID,
			Name:      g.Name,
			SortOrder: g.SortOrder,
		})
		if err == nil {
			h.hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
				Type:     "ENTITY_DELTA",
				Table:    "folder_note_groups",
				Action:   ws.ActionInsert,
				ID:       newGroupID.String(),
				FolderID: newID.String(),
				Data:     clonedG,
			})
		}
	}

	// 2. Deep clone notes with content
	notes, _ := h.queries.ListNotesWithContentInFolder(c.Request.Context(), sqlc.ListNotesWithContentInFolderParams{
		UserID:   userUUID,
		FolderID: srcFolderUUID,
	})
	for _, n := range notes {
		newNoteID := uuid.New()
		newNoteUUID := pgtype.UUID{Bytes: newNoteID, Valid: true}
		newGroupUUID := pgtype.UUID{}
		if n.GroupID.Valid {
			if mapped, ok := oldGroupMap[n.GroupID.Bytes]; ok {
				newGroupUUID = mapped
			}
		}
		clonedN, err := h.queries.CreateNote(c.Request.Context(), sqlc.CreateNoteParams{
			ID:        newNoteUUID,
			UserID:    userUUID,
			FolderID:  newFolderUUID,
			GroupID:   newGroupUUID,
			Title:     n.Title,
			Content:   n.Content,
			SortOrder: n.SortOrder,
		})
		if err == nil {
			h.hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
				Type:     "ENTITY_DELTA",
				Table:    "notes",
				Action:   ws.ActionInsert,
				ID:       newNoteID.String(),
				FolderID: newID.String(),
				Data:     clonedN,
			})
		}
	}

	h.hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
		Type:   "ENTITY_DELTA",
		Table:  "knowledge_base_folders",
		Action: ws.ActionInsert,
		ID:     newID.String(),
		Data:   cloned,
	})

	c.JSON(http.StatusCreated, cloned)
}

// --- Folder Groups ---

func (h *NoteHandler) ListFolderGroups(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	folderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid folder id"})
		return
	}

	groups, err := h.queries.ListFolderGroups(c.Request.Context(), sqlc.ListFolderGroupsParams{
		UserID:   pgtype.UUID{Bytes: userID, Valid: true},
		FolderID: pgtype.UUID{Bytes: folderID, Valid: true},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, groups)
}

type UpsertGroupRequest struct {
	ID          string `json:"id"`
	FolderID    string `json:"folder_id" binding:"required"`
	Name        string `json:"name" binding:"required"`
	SortOrder   int32  `json:"sort_order"`
	LockVersion int64  `json:"lock_version"`
}

func (h *NoteHandler) CreateFolderGroup(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	var req UpsertGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	id := uuid.New()
	if req.ID != "" {
		if parsed, err := uuid.Parse(req.ID); err == nil {
			id = parsed
		}
	}

	folderID, err := uuid.Parse(req.FolderID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid folder id"})
		return
	}

	group, err := h.queries.UpsertFolderGroup(c.Request.Context(), sqlc.UpsertFolderGroupParams{
		ID:        pgtype.UUID{Bytes: id, Valid: true},
		UserID:    pgtype.UUID{Bytes: userID, Valid: true},
		FolderID:  pgtype.UUID{Bytes: folderID, Valid: true},
		Name:      req.Name,
		SortOrder: req.SortOrder,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
		Type:     "ENTITY_DELTA",
		Table:    "folder_note_groups",
		Action:   ws.ActionInsert,
		ID:       id.String(),
		FolderID: folderID.String(),
		Data:     group,
	})

	c.JSON(http.StatusOK, group)
}

func (h *NoteHandler) DeleteFolderGroup(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}

	if err := h.queries.SoftDeleteFolderGroup(c.Request.Context(), sqlc.SoftDeleteFolderGroupParams{
		ID:     pgtype.UUID{Bytes: id, Valid: true},
		UserID: pgtype.UUID{Bytes: userID, Valid: true},
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	_ = h.queries.UngroupNotesInGroup(c.Request.Context(), sqlc.UngroupNotesInGroupParams{
		GroupID: pgtype.UUID{Bytes: id, Valid: true},
		UserID:  pgtype.UUID{Bytes: userID, Valid: true},
	})

	h.hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
		Type:   "ENTITY_DELTA",
		Table:  "folder_note_groups",
		Action: ws.ActionDelete,
		ID:     id.String(),
	})

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// --- Notes ---

func (h *NoteHandler) ListNotesInFolder(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	folderIDStr := c.Param("id")
	folderID, err := uuid.Parse(folderIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid folder id"})
		return
	}

	notes, err := h.queries.ListNotesInFolder(c.Request.Context(), sqlc.ListNotesInFolderParams{
		UserID:   pgtype.UUID{Bytes: userID, Valid: true},
		FolderID: pgtype.UUID{Bytes: folderID, Valid: true},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, notes)
}

func (h *NoteHandler) GetNote(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	noteIDStr := c.Param("id")
	noteID, err := uuid.Parse(noteIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid note id"})
		return
	}

	note, err := h.queries.GetNoteByID(c.Request.Context(), sqlc.GetNoteByIDParams{
		ID:     pgtype.UUID{Bytes: noteID, Valid: true},
		UserID: pgtype.UUID{Bytes: userID, Valid: true},
	})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "note not found"})
		return
	}
	c.JSON(http.StatusOK, note)
}

type CreateNoteRequest struct {
	ID        string  `json:"id"`
	FolderID  string  `json:"folder_id" binding:"required"`
	GroupID   *string `json:"group_id"`
	Title     string  `json:"title"`
	Content   string  `json:"content"`
	SortOrder int32   `json:"sort_order"`
}

func (h *NoteHandler) CreateNote(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	var req CreateNoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	noteID := uuid.New()
	if req.ID != "" {
		if parsed, err := uuid.Parse(req.ID); err == nil {
			noteID = parsed
		}
	}

	folderID, err := uuid.Parse(req.FolderID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid folder id"})
		return
	}

	var groupUUID pgtype.UUID
	if req.GroupID != nil && *req.GroupID != "" {
		if parsed, err := uuid.Parse(*req.GroupID); err == nil {
			groupUUID = pgtype.UUID{Bytes: parsed, Valid: true}
		}
	}

	note, err := h.queries.UpsertNote(c.Request.Context(), sqlc.UpsertNoteParams{
		ID:        pgtype.UUID{Bytes: noteID, Valid: true},
		UserID:    pgtype.UUID{Bytes: userID, Valid: true},
		FolderID:  pgtype.UUID{Bytes: folderID, Valid: true},
		GroupID:   groupUUID,
		Title:     req.Title,
		Content:   req.Content,
		SortOrder: req.SortOrder,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
		Type:     "ENTITY_DELTA",
		Table:    "notes",
		Action:   ws.ActionInsert,
		ID:       noteID.String(),
		FolderID: folderID.String(),
		Data:     note,
	})

	c.JSON(http.StatusOK, note)
}

type PatchNoteRequest struct {
	Title       *string `json:"title"`
	Content     *string `json:"content"`
	SortOrder   *int32  `json:"sort_order"`
	FolderID    *string `json:"folder_id"`
	GroupID     *string `json:"group_id"`
	LockVersion int64   `json:"lock_version" binding:"required"`
}

func (h *NoteHandler) PatchNote(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	noteIDStr := c.Param("id")
	noteID, err := uuid.Parse(noteIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid note id"})
		return
	}

	var req PatchNoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var folderUUID pgtype.UUID
	setFolder := false
	if req.FolderID != nil {
		setFolder = true
		if *req.FolderID != "" {
			if p, err := uuid.Parse(*req.FolderID); err == nil {
				folderUUID = pgtype.UUID{Bytes: p, Valid: true}
			}
		}
	}

	var groupUUID pgtype.UUID
	setGroup := false
	if req.GroupID != nil {
		setGroup = true
		if *req.GroupID != "" {
			if p, err := uuid.Parse(*req.GroupID); err == nil {
				groupUUID = pgtype.UUID{Bytes: p, Valid: true}
			}
		}
	}

	setTitle := req.Title != nil
	titleStr := ""
	if setTitle {
		titleStr = *req.Title
	}

	setContent := req.Content != nil
	contentStr := ""
	if setContent {
		contentStr = *req.Content
	}

	setSortOrder := req.SortOrder != nil
	sortOrder := int32(0)
	if setSortOrder {
		sortOrder = *req.SortOrder
	}

	note, err := h.queries.PatchNote(c.Request.Context(), sqlc.PatchNoteParams{
		ID:           pgtype.UUID{Bytes: noteID, Valid: true},
		UserID:       pgtype.UUID{Bytes: userID, Valid: true},
		SetTitle:     setTitle,
		Title:        titleStr,
		SetContent:   setContent,
		Content:      contentStr,
		SetSortOrder: setSortOrder,
		SortOrder:    sortOrder,
		SetFolderID:  setFolder,
		FolderID:     folderUUID,
		SetGroupID:   setGroup,
		GroupID:      groupUUID,
		LockVersion:  req.LockVersion,
	})
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "VERSION_CONFLICT or note not found", "details": err.Error()})
		return
	}

	h.hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
		Type:   "ENTITY_DELTA",
		Table:  "notes",
		Action: ws.ActionUpdate,
		ID:     noteID.String(),
		Data:   note,
	})

	c.JSON(http.StatusOK, note)
}

func (h *NoteHandler) BufferPatchNote(c *gin.Context) {
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	noteIDStr := c.Param("id")
	noteID, err := uuid.Parse(noteIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid note id"})
		return
	}

	var req PatchNoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if h.buffer != nil {
		h.buffer.BufferPatch(userID, noteID, req.Title, req.Content, req.LockVersion)
		c.JSON(http.StatusOK, gin.H{
			"status":       "buffered",
			"id":           noteIDStr,
			"lock_version": req.LockVersion,
		})
		return
	}

	// Fallback to direct synchronous patch if buffer manager not initialized
	h.PatchNote(c)
}

func (h *NoteHandler) SearchNotes(c *gin.Context) {
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusOK, []interface{}{})
		return
	}

	results, err := h.queries.SearchNotes(c.Request.Context(), sqlc.SearchNotesParams{
		UserID:  pgtype.UUID{Bytes: userID, Valid: true},
		Column2: query,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, results)
}

func (h *NoteHandler) ReorderNotes(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	var req ReorderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var updated []sqlc.Note
	for _, it := range req.Items {
		parsed, err := uuid.Parse(it.ID)
		if err != nil {
			continue
		}
		u, err := h.queries.UpdateNoteSortOrder(c.Request.Context(), sqlc.UpdateNoteSortOrderParams{
			ID:        pgtype.UUID{Bytes: parsed, Valid: true},
			UserID:    pgtype.UUID{Bytes: userID, Valid: true},
			SortOrder: it.SortOrder,
		})
		if err == nil {
			updated = append(updated, u)
		}
	}

	h.hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
		Type:   "ENTITY_DELTA",
		Table:  "notes",
		Action: ws.ActionUpdate,
		Data:   updated,
	})

	c.JSON(http.StatusOK, updated)
}

type MoveNoteRequest struct {
	FolderID  string  `json:"folder_id" binding:"required"`
	GroupID   *string `json:"group_id"`
	SortOrder int32   `json:"sort_order"`
}

func (h *NoteHandler) MoveNote(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	noteIDStr := c.Param("id")
	noteID, err := uuid.Parse(noteIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid note id"})
		return
	}

	var req MoveNoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	folderID, err := uuid.Parse(req.FolderID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid folder id"})
		return
	}

	var groupUUID pgtype.UUID
	if req.GroupID != nil && *req.GroupID != "" {
		if p, err := uuid.Parse(*req.GroupID); err == nil {
			groupUUID = pgtype.UUID{Bytes: p, Valid: true}
		}
	}

	note, err := h.queries.MoveNote(c.Request.Context(), sqlc.MoveNoteParams{
		ID:        pgtype.UUID{Bytes: noteID, Valid: true},
		UserID:    pgtype.UUID{Bytes: userID, Valid: true},
		FolderID:  pgtype.UUID{Bytes: folderID, Valid: true},
		GroupID:   groupUUID,
		SortOrder: req.SortOrder,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
		Type:     "ENTITY_DELTA",
		Table:    "notes",
		Action:   ws.ActionUpdate,
		ID:       noteID.String(),
		FolderID: folderID.String(),
		Data:     note,
	})

	c.JSON(http.StatusOK, note)
}

func (h *NoteHandler) DeleteNote(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	noteIDStr := c.Param("id")
	noteID, err := uuid.Parse(noteIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid note id"})
		return
	}

	if err := h.queries.SoftDeleteNote(c.Request.Context(), sqlc.SoftDeleteNoteParams{
		ID:     pgtype.UUID{Bytes: noteID, Valid: true},
		UserID: pgtype.UUID{Bytes: userID, Valid: true},
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
		Type:   "ENTITY_DELTA",
		Table:  "notes",
		Action: ws.ActionDelete,
		ID:     noteID.String(),
	})

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// --- KB Templates ---

type TemplateResponse struct {
	ID          string          `json:"id"`
	UserID      string          `json:"user_id"`
	Name        string          `json:"name"`
	Content     json.RawMessage `json:"content"`
	LockVersion int64           `json:"lock_version"`
}

func formatTemplateResponse(t sqlc.KnowledgeBaseTemplate) TemplateResponse {
	contentRaw := json.RawMessage(t.Content)
	if len(contentRaw) == 0 || !json.Valid(contentRaw) {
		b, _ := json.Marshal(string(t.Content))
		contentRaw = json.RawMessage(b)
	}
	return TemplateResponse{
		ID:          uuid.UUID(t.ID.Bytes).String(),
		UserID:      uuid.UUID(t.UserID.Bytes).String(),
		Name:        t.Name,
		Content:     contentRaw,
		LockVersion: t.LockVersion,
	}
}

func (h *NoteHandler) ListTemplates(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	templates, err := h.queries.ListKnowledgeBaseTemplates(c.Request.Context(), pgtype.UUID{Bytes: userID, Valid: true})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	resp := make([]TemplateResponse, len(templates))
	for i, t := range templates {
		resp[i] = formatTemplateResponse(t)
	}
	c.JSON(http.StatusOK, resp)
}

type UpsertKBTemplateRequest struct {
	ID          string          `json:"id"`
	Name        string          `json:"name" binding:"required"`
	Content     json.RawMessage `json:"content"`
	LockVersion int64           `json:"lock_version"`
}

func (h *NoteHandler) UpsertTemplate(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	var req UpsertKBTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	id := uuid.New()
	if req.ID != "" {
		if p, err := uuid.Parse(req.ID); err == nil {
			id = p
		}
	}

	contentBytes := req.Content
	if len(contentBytes) == 0 {
		contentBytes = []byte("{}")
	}

	tmpl, err := h.queries.UpsertKnowledgeBaseTemplate(c.Request.Context(), sqlc.UpsertKnowledgeBaseTemplateParams{
		ID:      pgtype.UUID{Bytes: id, Valid: true},
		UserID:  pgtype.UUID{Bytes: userID, Valid: true},
		Name:    req.Name,
		Content: contentBytes,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	resp := formatTemplateResponse(tmpl)
	h.hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
		Type:   "ENTITY_DELTA",
		Table:  "knowledge_base_templates",
		Action: ws.ActionUpdate,
		ID:     id.String(),
		Data:   resp,
	})

	c.JSON(http.StatusOK, resp)
}

func (h *NoteHandler) DeleteTemplate(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid template id"})
		return
	}

	if err := h.queries.SoftDeleteKnowledgeBaseTemplate(c.Request.Context(), sqlc.SoftDeleteKnowledgeBaseTemplateParams{
		ID:     pgtype.UUID{Bytes: id, Valid: true},
		UserID: pgtype.UUID{Bytes: userID, Valid: true},
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
		Type:   "ENTITY_DELTA",
		Table:  "knowledge_base_templates",
		Action: ws.ActionDelete,
		ID:     id.String(),
	})

	c.JSON(http.StatusOK, gin.H{"success": true})
}

type UpdateNoteRequest struct {
	Title       string  `json:"title"`
	Content     string  `json:"content"`
	GroupID     *string `json:"group_id"`
	SortOrder   int32   `json:"sort_order"`
	LockVersion int64   `json:"lock_version"`
}

func (h *NoteHandler) UpdateNote(c *gin.Context) {
	userID, _ := middleware.GetUserID(c)
	noteIDStr := c.Param("id")
	noteID, err := uuid.Parse(noteIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid note id"})
		return
	}

	var req UpdateNoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var groupUUID pgtype.UUID
	if req.GroupID != nil && *req.GroupID != "" {
		if parsed, err := uuid.Parse(*req.GroupID); err == nil {
			groupUUID = pgtype.UUID{Bytes: parsed, Valid: true}
		}
	}

	note, err := h.queries.UpdateNote(c.Request.Context(), sqlc.UpdateNoteParams{
		ID:          pgtype.UUID{Bytes: noteID, Valid: true},
		UserID:      pgtype.UUID{Bytes: userID, Valid: true},
		Title:       req.Title,
		Content:     req.Content,
		GroupID:     groupUUID,
		SortOrder:   req.SortOrder,
		LockVersion: req.LockVersion,
	})
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "VERSION_CONFLICT or note not found", "details": err.Error()})
		return
	}

	h.hub.BroadcastToUser(userID, nil, ws.DeltaMessage{
		Type:   "ENTITY_DELTA",
		Table:  "notes",
		Action: ws.ActionUpdate,
		ID:     noteID.String(),
		Data:   note,
	})

	c.JSON(http.StatusOK, note)
}

