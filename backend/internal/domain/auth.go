package domain

import "time"

// LoginRequest 登录请求
type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// RegisterRequest 注册请求
type RegisterRequest struct {
	Username string `json:"username" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	Name     string `json:"name" binding:"required"`
}

// TokenResponse 令牌响应
type TokenResponse struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expiresAt"`
	UserID    string    `json:"userId"`
}

// ValidationResponse 令牌验证响应
type ValidationResponse struct {
	Valid  bool   `json:"valid"`
	UserID string `json:"userId,omitempty"`
	Role   string `json:"role,omitempty"`
}

// AuthService 认证服务接口
type AuthService interface {
	// Login 用户登录，返回JWT令牌
	Login(req LoginRequest) (*TokenResponse, error)

	// Register 用户注册
	Register(req RegisterRequest) (*User, error)

	// ValidateToken 验证令牌
	ValidateToken(token string) (*ValidationResponse, error)

	// RefreshToken 刷新令牌
	RefreshToken(token string) (*TokenResponse, error)

	// Logout 用户登出（撤销令牌）
	Logout(token string) error
}
