package handler

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"workbuddy-server/internal/config"
	"workbuddy-server/internal/database/sqlc"
	"workbuddy-server/internal/middleware"
)

type AuthHandler struct {
	queries sqlc.Querier
	cfg     *config.Config
}

func NewAuthHandler(queries sqlc.Querier, cfg *config.Config) *AuthHandler {
	return &AuthHandler{queries: queries, cfg: cfg}
}

type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

type AuthResponse struct {
	Token string    `json:"token"`
	User  UserDTO   `json:"user"`
}

type UserDTO struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}

	user, err := h.queries.CreateUser(c.Request.Context(), sqlc.CreateUserParams{
		Email:        req.Email,
		PasswordHash: string(hash),
	})
	if err != nil {
		slog.Warn("auth register failed", slog.String("email", req.Email), slog.Any("error", err))
		c.JSON(http.StatusConflict, gin.H{"error": "email already exists or registration failed"})
		return
	}

	uidStr := uuid.UUID(user.ID.Bytes).String()
	token, err := middleware.GenerateToken(uidStr, user.Email, h.cfg.JWTSecret, 30*24*time.Hour)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusCreated, AuthResponse{
		Token: token,
		User:  UserDTO{ID: uidStr, Email: user.Email},
	})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.queries.GetUserByEmail(c.Request.Context(), req.Email)
	if err != nil {
		slog.Warn("auth login failed: user not found", slog.String("email", req.Email), slog.Any("error", err))
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		slog.Warn("auth login failed: invalid password", slog.String("email", req.Email), slog.Any("error", err))
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
		return
	}

	uidStr := uuid.UUID(user.ID.Bytes).String()
	token, err := middleware.GenerateToken(uidStr, user.Email, h.cfg.JWTSecret, 30*24*time.Hour)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, AuthResponse{
		Token: token,
		User:  UserDTO{ID: uidStr, Email: user.Email},
	})
}

func (h *AuthHandler) Me(c *gin.Context) {
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	email, _ := c.Get("userEmail")
	c.JSON(http.StatusOK, UserDTO{
		ID:    userID.String(),
		Email: email.(string),
	})
}
