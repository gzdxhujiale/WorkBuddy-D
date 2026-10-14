package middleware

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type CustomClaims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	jwt.RegisteredClaims
}

func GenerateToken(userID string, email string, secret string, ttl time.Duration) (string, error) {
	claims := CustomClaims{
		UserID: userID,
		Email:  email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(ttl)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func Auth(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenStr := ""
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
			tokenStr = strings.TrimPrefix(authHeader, "Bearer ")
		} else {
			// Also support token query parameter for WebSocket upgrade
			tokenStr = c.Query("token")
		}

		if tokenStr == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing authorization token"})
			return
		}

		token, err := jwt.ParseWithClaims(tokenStr, &CustomClaims{}, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, errors.New("unexpected signing method")
			}
			return []byte(secret), nil
		})

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}

		claims, ok := token.Claims.(*CustomClaims)
		if !ok || claims.UserID == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token payload"})
			return
		}

		parsedUUID, err := uuid.Parse(claims.UserID)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "malformed user id in token"})
			return
		}

		c.Set("userID", parsedUUID)
		c.Set("userEmail", claims.Email)
		c.Next()
	}
}

func GetUserID(c *gin.Context) (uuid.UUID, error) {
	val, exists := c.Get("userID")
	if !exists {
		return uuid.Nil, errors.New("user id not found in context")
	}
	uid, ok := val.(uuid.UUID)
	if !ok {
		return uuid.Nil, errors.New("invalid user id type")
	}
	return uid, nil
}
