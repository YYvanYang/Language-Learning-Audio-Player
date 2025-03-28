// auth_handlers.go
package main

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v4"

	"github.com/YYvanYang/Language-Learning-Audio-Player/backend/database"
	"github.com/YYvanYang/Language-Learning-Audio-Player/backend/database/models"
)

// 登录请求结构
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// 注册请求结构
type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
	Name     string `json:"name" binding:"required"`
	Username string `json:"username" binding:"omitempty"`
}

// JWT声明结构
type JWTClaims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

// 登录处理程序
func loginHandler(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的请求格式"})
		return
	}

	// 创建用户仓库
	userRepo := models.NewUserRepository(database.DB)

	// 查找用户
	user, err := userRepo.GetByEmail(req.Email)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "邮箱或密码错误"})
		return
	}

	// 验证密码
	if !models.VerifyPassword(user.PasswordHash, req.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "邮箱或密码错误"})
		return
	}

	// 更新最后登录时间
	if err := userRepo.UpdateLastLogin(user.ID); err != nil {
		// 只记录错误，不影响登录流程
		fmt.Printf("更新最后登录时间失败: %v\n", err)
	}

	// 创建JWT令牌
	token, err := createJWTToken(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建令牌失败"})
		return
	}

	// 设置Cookie
	c.SetCookie(
		"auth_token",                // 名称
		token,                       // 值
		int(time.Hour*24*7),         // 最大寿命（秒）
		"/",                         // 路径
		getEnv("COOKIE_DOMAIN", ""), // 域名
		getEnv("COOKIE_SECURE", "false") == "true", // 仅HTTPS
		true, // HTTP专用
	)

	// 添加调试信息
	log.Printf("登录成功: 用户ID=%s, 令牌长度=%d", user.ID, len(token))
	log.Printf("Cookie设置: auth_token, domain=%s, path=/, secure=%v, httpOnly=true",
		getEnv("COOKIE_DOMAIN", ""),
		getEnv("COOKIE_SECURE", "false") == "true")

	// 返回用户信息（不包含敏感数据）
	c.JSON(http.StatusOK, gin.H{
		"message": "登录成功",
		"user": gin.H{
			"id":    user.ID,
			"email": user.Email,
			"name":  user.Name,
			"role":  user.Role,
		},
		"token": token,
	})
}

// 注册处理程序
func registerHandler(c *gin.Context) {
	log.Printf("注册请求开始处理: %s", c.Request.RemoteAddr)

	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("请求数据绑定失败: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的请求格式"})
		return
	}

	log.Printf("注册请求数据: email=%s, name=%s", req.Email, req.Name)

	// 如果name为空但username不为空，则使用username
	if req.Name == "" && req.Username != "" {
		req.Name = req.Username
	}

	// 创建用户仓库
	userRepo := models.NewUserRepository(database.DB)
	log.Printf("用户仓库创建成功")

	// 检查邮箱是否已存在
	exists, err := userRepo.CheckEmailExists(req.Email)
	if err != nil {
		log.Printf("检查邮箱存在性失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "服务器错误"})
		return
	}

	if exists {
		log.Printf("邮箱已被注册: %s", req.Email)
		c.JSON(http.StatusBadRequest, gin.H{"error": "邮箱已被注册"})
		return
	}

	log.Printf("邮箱检查通过，开始生成密码哈希")

	// 生成密码哈希
	passwordHash, err := models.HashPassword(req.Password)
	if err != nil {
		log.Printf("密码哈希生成失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "密码处理失败"})
		return
	}

	log.Printf("密码哈希生成成功，开始创建用户")

	// 创建用户
	user := &models.User{
		Email:        req.Email,
		PasswordHash: passwordHash,
		Name:         req.Name,
		Role:         "user", // 默认角色
		Active:       true,   // 默认活跃状态
	}

	if err := userRepo.Create(user); err != nil {
		log.Printf("创建用户失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建用户失败"})
		return
	}

	log.Printf("用户创建成功: id=%s, 开始生成JWT令牌", user.ID)

	// 创建JWT令牌
	token, err := createJWTToken(user)
	if err != nil {
		log.Printf("JWT令牌创建失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建令牌失败"})
		return
	}

	log.Printf("JWT令牌创建成功，开始设置Cookie")

	// 设置Cookie
	c.SetCookie(
		"auth_token",                // 名称
		token,                       // 值
		int(time.Hour*24*7),         // 最大寿命（秒）
		"/",                         // 路径
		getEnv("COOKIE_DOMAIN", ""), // 域名
		getEnv("COOKIE_SECURE", "false") == "true", // 仅HTTPS
		true, // HTTP专用
	)

	log.Printf("注册成功完成，返回用户信息: id=%s, email=%s", user.ID, user.Email)

	// 返回用户信息
	c.JSON(http.StatusCreated, gin.H{
		"message": "注册成功",
		"user": gin.H{
			"id":    user.ID,
			"email": user.Email,
			"name":  user.Name,
			"role":  user.Role,
		},
		"token": token,
	})
}

// 会话验证处理程序
func validateTokenHandler(c *gin.Context) {
	userID, _ := c.Get("user_id")
	userRepo := models.NewUserRepository(database.DB)

	user, err := userRepo.GetByID(userID.(string))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "无效会话"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"id":    user.ID,
			"email": user.Email,
			"name":  user.Name,
			"role":  user.Role,
		},
	})
}

// 登出处理程序
func logoutHandler(c *gin.Context) {
	// 清除Cookie
	c.SetCookie(
		"auth_token",                // 名称
		"",                          // 值（空）
		-1,                          // 最大寿命（立即过期）
		"/",                         // 路径
		getEnv("COOKIE_DOMAIN", ""), // 域名
		getEnv("COOKIE_SECURE", "false") == "true", // 仅HTTPS
		true, // HTTP专用
	)

	c.JSON(http.StatusOK, gin.H{
		"message": "已成功登出",
	})
}

// 创建JWT令牌
func createJWTToken(user *models.User) (string, error) {
	// 设置过期时间
	expiresAt := time.Now().Add(time.Hour * 24 * 7) // 7天有效期

	// 创建声明
	claims := JWTClaims{
		UserID: user.ID,
		Email:  user.Email,
		Role:   user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    "language-learning-audio-player",
			Subject:   user.ID,
		},
	}

	// 创建令牌
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	// 使用密钥签名令牌
	jwtSecretKey := getEnv("JWT_SECRET", "your-default-secret-key-replace-in-production")
	tokenString, err := token.SignedString([]byte(jwtSecretKey))
	if err != nil {
		return "", err
	}

	return tokenString, nil
}
