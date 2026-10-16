package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"workbuddy-server/internal/buffer"
	"workbuddy-server/internal/ai/gateway"
	"workbuddy-server/internal/ai/monitor"
	"workbuddy-server/internal/ai/tools"
	"workbuddy-server/internal/config"
	"workbuddy-server/internal/database"
	"workbuddy-server/internal/database/sqlc"
	"workbuddy-server/internal/handler"
	"workbuddy-server/internal/mcp"
	"workbuddy-server/internal/middleware"
	"workbuddy-server/internal/ws"
)

func main() {
	// Initialize default structured logger
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	cfg := config.Load()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Connect to PostgreSQL via pgxpool
	db, err := database.Connect(ctx, cfg.DBDSN)
	if err != nil {
		slog.Error("failed to connect to database", slog.Any("error", err))
		os.Exit(1)
	}
	defer db.Close()

	queries := sqlc.New(db.Pool)
	hub := ws.NewHub(queries)

	// Check if invoked via CLI for MCP stdio transport (e.g. `server mcp`)
	if len(os.Args) > 1 && os.Args[1] == "mcp" {
		if err := mcp.RunStdioServer(queries, hub); err != nil {
			slog.Error("MCP stdio server error", slog.Any("error", err))
			os.Exit(1)
		}
		return
	}

	noteBufferMgr := buffer.NewNoteBufferManager(queries, hub)
	noteBufferMgr.Start()

	// Initialize Gin Engine
	r := gin.Default()

	// CORS config
	corsCfg := cors.DefaultConfig()
	corsCfg.AllowAllOrigins = true
	corsCfg.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization"}
	corsCfg.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
	r.Use(cors.New(corsCfg))

	// Handlers
	authH := handler.NewAuthHandler(queries, cfg)
	syncH := handler.NewSyncHandler(queries)
	noteH := handler.NewNoteHandler(queries, hub, noteBufferMgr)
	taskH := handler.NewTaskHandler(queries, hub)
	habitH := handler.NewHabitHandler(queries, hub)
	focusH := handler.NewFocusHandler(queries, hub)
	projectH := handler.NewProjectHandler(queries, hub)
	dailyReviewH := handler.NewDailyReviewHandler(queries, hub)
	aiFactory := gateway.NewFactory()
	aiRouter := gateway.NewRouter(queries, aiFactory)
	aiRecorder := monitor.NewRecorder(queries)
	aiToolsReg, err := tools.NewRegistry(queries, hub)
	if err != nil {
		slog.Error("failed to create AI tools registry", slog.Any("error", err))
	}
	aiH := handler.NewAIHandler(queries, aiFactory, aiRouter, aiRecorder, aiToolsReg)
	mcpH := mcp.NewMCPHandler(queries, hub)

	// Public Routes
	api := r.Group("/api/v1")
	{
		api.GET("/health", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "workbuddy-server"})
		})
		api.POST("/auth/register", authH.Register)
		api.POST("/auth/login", authH.Login)
	}

	// WebSocket Route (Authenticated via query token or Bearer)
	r.GET("/ws", middleware.Auth(cfg.JWTSecret), hub.HandleWebSocket)

	// Protected Routes
	protected := api.Group("")
	protected.Use(middleware.Auth(cfg.JWTSecret))
	{
		protected.GET("/auth/me", authH.Me)
		protected.GET("/sync", syncH.SyncChanges)

		// Knowledge Base & Folders
		protected.GET("/knowledge-bases", noteH.ListKnowledgeBases)
		protected.POST("/knowledge-bases", noteH.CreateKnowledgeBase)
		protected.POST("/knowledge-bases/reorder", noteH.ReorderKnowledgeBases)
		protected.DELETE("/knowledge-bases/:id", noteH.DeleteKnowledgeBase)

		protected.GET("/folders", noteH.ListFolders)
		protected.POST("/folders", noteH.CreateFolder)
		protected.POST("/folders/reorder", noteH.ReorderFolders)
		protected.DELETE("/folders/:id", noteH.DeleteFolder)
		protected.POST("/folders/:id/duplicate", noteH.DuplicateFolder)

		// Groups
		protected.GET("/folders/:id/groups", noteH.ListFolderGroups)
		protected.POST("/folders/:id/groups", noteH.CreateFolderGroup)
		protected.DELETE("/groups/:id", noteH.DeleteFolderGroup)

		// Notes
		protected.GET("/notes/search", noteH.SearchNotes)
		protected.GET("/folders/:id/notes", noteH.ListNotesInFolder)
		protected.GET("/notes/:id", noteH.GetNote)
		protected.POST("/notes", noteH.CreateNote)
		protected.PUT("/notes/:id", noteH.UpdateNote)
		protected.PATCH("/notes/:id", noteH.PatchNote)
		protected.PATCH("/notes/:id/buffer", noteH.BufferPatchNote)
		protected.POST("/notes/:id/move", noteH.MoveNote)
		protected.POST("/notes/reorder", noteH.ReorderNotes)
		protected.DELETE("/notes/:id", noteH.DeleteNote)

		// Knowledge Base Templates
		protected.GET("/templates", noteH.ListTemplates)
		protected.POST("/templates", noteH.UpsertTemplate)
		protected.DELETE("/templates/:id", noteH.DeleteTemplate)

		// Tasks
		protected.GET("/tasks", taskH.ListTasks)
		protected.POST("/tasks", taskH.CreateTask)
		protected.PUT("/tasks/:id", taskH.UpdateTask)
		protected.DELETE("/tasks/:id", taskH.DeleteTask)

		// Habits
		protected.GET("/habits", habitH.ListHabits)
		protected.POST("/habits", habitH.CreateHabit)
		protected.PUT("/habits/:id", habitH.UpdateHabit)
		protected.DELETE("/habits/:id", habitH.DeleteHabit)
		protected.GET("/habits/checkins", habitH.ListCheckins)
		protected.POST("/habits/checkin", habitH.UpsertCheckin)

		// Focus Sessions
		protected.GET("/focus/sessions", focusH.ListFocusSessions)
		protected.POST("/focus/sessions", focusH.CreateSession)
		protected.PUT("/focus/sessions/:id", focusH.UpdateSession)
		protected.POST("/focus/interrupt", focusH.InterruptOpenSessions)

		// Projects & Stages & Templates
		protected.GET("/projects", projectH.ListProjects)
		protected.POST("/projects", projectH.CreateProject)
		protected.DELETE("/projects/:id", projectH.DeleteProject)

		protected.GET("/projects/stages", projectH.ListAllStages)
		protected.POST("/projects/stages", projectH.UpsertStage)
		protected.POST("/projects/stages/reorder", projectH.ReorderStages)
		protected.DELETE("/projects/stages/:id", projectH.DeleteStage)

		protected.GET("/projects/templates", projectH.ListTemplates)
		protected.POST("/projects/templates", projectH.UpsertTemplate)
		protected.DELETE("/projects/templates/:id", projectH.DeleteTemplate)

		// Daily Reviews
		protected.GET("/daily-reviews", dailyReviewH.ListDailyReviews)
		protected.GET("/daily-reviews/summaries", dailyReviewH.ListDailyReviewSummaries)
		protected.GET("/daily-reviews/stats", dailyReviewH.GetStats)
		protected.GET("/daily-reviews/heatmap", dailyReviewH.GetHeatmap)
		protected.GET("/daily-reviews/:date", dailyReviewH.GetDailyReviewByDate)
		protected.POST("/daily-reviews", dailyReviewH.UpsertReview)

		// AI Gateway, Channels, Metrics, Skills & Chat
		protected.GET("/ai/channels", aiH.ListChannels)
		protected.POST("/ai/channels", aiH.CreateChannel)
		protected.PUT("/ai/channels/:id", aiH.UpdateChannel)
		protected.DELETE("/ai/channels/:id", aiH.DeleteChannel)
		protected.POST("/ai/channels/:id/ping", aiH.PingChannel)
		protected.GET("/ai/metrics", aiH.GetMetrics)
		protected.GET("/ai/skills", aiH.ListSkills)
		protected.POST("/ai/chat", aiH.ChatStream)

		// AI Conversation Sessions & History
		protected.GET("/ai/sessions", aiH.ListSessions)
		protected.POST("/ai/sessions", aiH.CreateSession)
		protected.GET("/ai/sessions/:id", aiH.GetSession)
		protected.PUT("/ai/sessions/:id", aiH.UpdateSession)
		protected.DELETE("/ai/sessions/:id", aiH.DeleteSession)
		protected.GET("/ai/sessions/:id/messages", aiH.ListSessionMessages)

		// MCP Protocol Endpoints (SSE & JSON-RPC message calls)
		protected.GET("/mcp/sse", mcpH.HandleSSE)
		protected.POST("/mcp/messages", mcpH.HandleMessages)
	}

	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: r,
	}

	go func() {
		slog.Info("starting server", slog.String("port", cfg.Port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server listen failed", slog.Any("error", err))
			os.Exit(1)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	slog.Info("shutting down gracefully...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("forced to shutdown server", slog.Any("error", err))
		os.Exit(1)
	}

	slog.Info("flushing note buffers...")
	noteBufferMgr.Stop()
	slog.Info("server exited cleanly")
}
