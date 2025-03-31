package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"language-learning/internal/domain"
	"language-learning/internal/utils/logger"

	"go.uber.org/zap"
)

// AuthHandler 认证处理器
type AuthHandler struct {
	authService domain.AuthService
}

// NewAuthHandler 创建认证处理器实例
func NewAuthHandler(authService domain.AuthService) *AuthHandler {
	return &AuthHandler{
		authService: authService,
	}
}

// Login 处理登录请求
func (h *AuthHandler) Login(c *gin.Context) {
	var loginReq domain.LoginRequest
	if err := c.ShouldBindJSON(&loginReq); err != nil {
		logger.Warn("登录请求解析失败", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的登录请求",
		})
		return
	}

	// 登录验证
	resp, err := h.authService.Login(loginReq)
	if err != nil {
		logger.Error("登录失败", zap.String("username", loginReq.Username), zap.Error(err))
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": err.Error(),
		})
		return
	}

	// 设置Cookie
	c.SetCookie(
		"auth_token", // 名称
		resp.Token,   // 值
		int((resp.ExpiresAt.Unix() - time.Now().Unix())), // 过期时间(秒)
		"/",   // 路径
		"",    // 域名
		false, // 仅HTTPS
		true,  // HTTP-only
	)

	c.JSON(http.StatusOK, gin.H{
		"message":   "登录成功",
		"userId":    resp.UserID,
		"expiresAt": resp.ExpiresAt,
	})
}

// Register 处理注册请求
func (h *AuthHandler) Register(c *gin.Context) {
	var registerReq domain.RegisterRequest
	if err := c.ShouldBindJSON(&registerReq); err != nil {
		logger.Warn("注册请求解析失败", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的注册请求",
		})
		return
	}

	// 注册用户
	user, err := h.authService.Register(registerReq)
	if err != nil {
		logger.Error("注册失败",
			zap.String("username", registerReq.Username),
			zap.String("email", registerReq.Email),
			zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "注册成功",
		"userId":  user.ID,
	})
}

// Validate 处理令牌验证请求
func (h *AuthHandler) Validate(c *gin.Context) {
	// 获取令牌
	tokenCookie, err := c.Cookie("auth_token")
	if err != nil {
		// 尝试从Authorization头获取
		tokenCookie = c.GetHeader("Authorization")
		// 移除Bearer前缀(如果有)
		if len(tokenCookie) > 7 && tokenCookie[:7] == "Bearer " {
			tokenCookie = tokenCookie[7:]
		}
	}

	// 验证令牌
	resp, err := h.authService.ValidateToken(tokenCookie)
	if err != nil {
		logger.Error("令牌验证出错", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "服务器内部错误",
		})
		return
	}

	if !resp.Valid {
		logger.Debug("令牌无效")
		c.JSON(http.StatusUnauthorized, gin.H{
			"valid": false,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"valid":  true,
		"userId": resp.UserID,
		"role":   resp.Role,
	})
}

// Refresh 处理令牌刷新请求
func (h *AuthHandler) Refresh(c *gin.Context) {
	// 获取当前令牌
	tokenCookie, err := c.Cookie("auth_token")
	if err != nil {
		logger.Warn("令牌Cookie不存在", zap.Error(err))
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "未提供令牌",
		})
		return
	}

	// 刷新令牌
	resp, err := h.authService.RefreshToken(tokenCookie)
	if err != nil {
		logger.Error("令牌刷新失败", zap.Error(err))
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": err.Error(),
		})
		return
	}

	// 设置新Cookie
	c.SetCookie(
		"auth_token", // 名称
		resp.Token,   // 值
		int((resp.ExpiresAt.Unix() - time.Now().Unix())), // 过期时间(秒)
		"/",   // 路径
		"",    // 域名
		false, // 仅HTTPS
		true,  // HTTP-only
	)

	c.JSON(http.StatusOK, gin.H{
		"message":   "令牌刷新成功",
		"userId":    resp.UserID,
		"expiresAt": resp.ExpiresAt,
	})
}

// Logout 处理登出请求
func (h *AuthHandler) Logout(c *gin.Context) {
	// 获取令牌
	tokenCookie, _ := c.Cookie("auth_token")

	// 撤销令牌
	_ = h.authService.Logout(tokenCookie)

	// 清除Cookie
	c.SetCookie(
		"auth_token", // 名称
		"",           // 值
		-1,           // 过期时间(负数表示立即过期)
		"/",          // 路径
		"",           // 域名
		false,        // 仅HTTPS
		true,         // HTTP-only
	)

	c.JSON(http.StatusOK, gin.H{
		"message": "登出成功",
	})
}

// RegisterRoutes 注册路由
func (h *AuthHandler) RegisterRoutes(rg *gin.RouterGroup) {
	auth := rg.Group("/auth")

	auth.POST("/login", h.Login)
	auth.POST("/register", h.Register)
	auth.GET("/validate", h.Validate)
	auth.POST("/refresh", h.Refresh)
	auth.POST("/logout", h.Logout)
}
