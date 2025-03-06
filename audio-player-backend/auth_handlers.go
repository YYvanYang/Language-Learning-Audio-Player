// auth_handlers.go
package main

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v4"
	"golang.org/x/crypto/bcrypt"
)

// 登录请求结构
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// 用户信息结构
type User struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"createdAt"`
}

// 登录处理程序
func loginHandler(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的请求格式"})
		return
	}

	// 验证用户凭据
	user, err := authenticateUser(req.Email, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "邮箱或密码错误"})
		return
	}

	// 创建会话令牌
	token, err := createSessionToken(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建会话失败"})
		return
	}

	// 设置Cookie
	c.SetCookie(
		"session",                   // 名称
		token,                       // 值
		int(time.Hour*24),           // 最大寿命（秒）
		"/",                         // 路径
		getEnv("COOKIE_DOMAIN", ""), // 域名
		getEnv("COOKIE_SECURE", "false") == "true", // 仅HTTPS
		true, // HTTP专用
	)

	// 返回用户信息（不包含敏感数据）
	c.JSON(http.StatusOK, gin.H{
		"message": "登录成功",
		"user": User{
			ID:    user.ID,
			Email: user.Email,
			Name:  user.Name,
			Role:  user.Role,
		},
	})
}

// 会话验证处理程序
func validateSessionHandler(c *gin.Context) {
	// 从Cookie中获取会话令牌
	token, err := c.Cookie("session")
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"valid": false})
		return
	}

	// 验证会话令牌
	claims := &Claims{}
	parsedToken, err := jwt.ParseWithClaims(token, claims, func(token *jwt.Token) (interface{}, error) {
		return []byte(getSecretKey()), nil
	})

	if err != nil || !parsedToken.Valid {
		c.JSON(http.StatusUnauthorized, gin.H{"valid": false})
		return
	}

	// 返回验证结果和用户信息
	c.JSON(http.StatusOK, gin.H{
		"valid": true,
		"user": gin.H{
			"id":    claims.UserID,
			"email": claims.Email,
		},
	})
}

// 退出登录处理程序
func logoutHandler(c *gin.Context) {
	// 清除Cookie
	c.SetCookie(
		"session",                   // 名称
		"",                          // 值
		-1,                          // 最大寿命（负数表示立即过期）
		"/",                         // 路径
		getEnv("COOKIE_DOMAIN", ""), // 域名
		getEnv("COOKIE_SECURE", "false") == "true", // 仅HTTPS
		true, // HTTP专用
	)

	c.JSON(http.StatusOK, gin.H{"message": "退出登录成功"})
}

// 创建会话令牌
func createSessionToken(user *User) (string, error) {
	// 设置令牌有效期（24小时）
	expirationTime := time.Now().Add(24 * time.Hour)

	// 创建JWT声明
	claims := &Claims{
		UserID: user.ID,
		Email:  user.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
		},
	}

	// 创建JWT令牌
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	// 签名令牌
	tokenString, err := token.SignedString([]byte(getSecretKey()))
	if err != nil {
		return "", err
	}

	return tokenString, nil
}

// 用户认证（模拟数据库查询）
func authenticateUser(email, password string) (*User, error) {
	// 在实际应用中，这里应该从数据库查询用户信息并验证密码
	// 现在使用模拟数据作为示例

	// 模拟用户数据
	mockUsers := map[string]struct {
		ID           string
		PasswordHash string
		Name         string
		Role         string
	}{
		"user@example.com": {
			ID:           "usr_123456",
			PasswordHash: "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy", // 密码：password123
			Name:         "测试用户",
			Role:         "student",
		},
		"teacher@example.com": {
			ID:           "usr_789012",
			PasswordHash: "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy", // 密码：password123
			Name:         "测试教师",
			Role:         "teacher",
		},
	}

	// 查找用户
	mockUser, exists := mockUsers[email]
	if !exists {
		return nil, fmt.Errorf("用户不存在")
	}

	// 验证密码
	err := bcrypt.CompareHashAndPassword([]byte(mockUser.PasswordHash), []byte(password))
	if err != nil {
		return nil, fmt.Errorf("密码错误")
	}

	// 返回用户信息
	return &User{
		ID:        mockUser.ID,
		Email:     email,
		Name:      mockUser.Name,
		Role:      mockUser.Role,
		CreatedAt: time.Now().Add(-30 * 24 * time.Hour), // 假设用户是30天前创建的
	}, nil
}
