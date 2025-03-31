package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v4"

	"github.com/your-project/backend/internal/config"
	"github.com/your-project/backend/internal/domain"
	"github.com/your-project/backend/internal/middleware"
	"github.com/your-project/backend/internal/user/service"
)

// UserHandler 用户请求处理器
type UserHandler struct {
	userService *service.UserService
	config      *config.Config
}

// NewUserHandler 创建用户处理器实例
func NewUserHandler(userService *service.UserService, cfg *config.Config) *UserHandler {
	return &UserHandler{
		userService: userService,
		config:      cfg,
	}
}

// Register 用户注册
func (h *UserHandler) Register(c *gin.Context) {
	var req domain.RegisterRequest

	// 解析请求
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "请求参数错误",
		})
		return
	}

	// 调用服务层注册用户
	user, err := h.userService.Register(req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	// 生成JWT令牌
	token, expiresAt, err := h.generateToken(user.ID, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "生成令牌失败",
		})
		return
	}

	// 设置Cookie
	h.setAuthCookie(c, token, expiresAt)

	// 返回用户信息和令牌
	c.JSON(http.StatusCreated, gin.H{
		"message":   "注册成功",
		"user":      domain.NewUserResponse(user),
		"token":     token,
		"expiresAt": expiresAt,
	})
}

// Login 用户登录
func (h *UserHandler) Login(c *gin.Context) {
	var req domain.LoginRequest

	// 解析请求
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "请求参数错误",
		})
		return
	}

	// 调用服务层登录用户
	user, err := h.userService.Login(req)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": err.Error(),
		})
		return
	}

	// 生成JWT令牌
	token, expiresAt, err := h.generateToken(user.ID, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "生成令牌失败",
		})
		return
	}

	// 设置Cookie
	h.setAuthCookie(c, token, expiresAt)

	// 返回用户信息和令牌
	c.JSON(http.StatusOK, gin.H{
		"message":   "登录成功",
		"user":      domain.NewUserResponse(user),
		"token":     token,
		"expiresAt": expiresAt,
	})
}

// Logout 用户登出
func (h *UserHandler) Logout(c *gin.Context) {
	// 清除Cookie
	c.SetCookie(
		"auth_token",                         // 名称
		"",                                   // 值
		-1,                                   // 最大生命周期（负值表示删除）
		"/",                                  // 路径
		"",                                   // 域名
		h.config.Environment == "production", // 仅HTTPS
		true,                                 // HTTP-only
	)

	c.JSON(http.StatusOK, gin.H{
		"message": "登出成功",
	})
}

// ValidateToken 验证令牌
func (h *UserHandler) ValidateToken(c *gin.Context) {
	// 用户ID和角色已经由认证中间件验证并存储在上下文中
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "未认证",
		})
		return
	}

	// 获取用户信息
	user, err := h.userService.GetUserByID(userID.(string))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "用户不存在或已被删除",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"valid": true,
		"user":  domain.NewUserResponse(user),
	})
}

// GetUser 获取用户信息
func (h *UserHandler) GetUser(c *gin.Context) {
	id := c.Param("id")

	// 获取当前用户ID
	currentUserID, _ := c.Get("userID")
	currentRole, _ := c.Get("role")

	// 如果不是管理员且不是获取自己的信息，则拒绝
	if currentRole != "admin" && currentUserID != id {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "无权限查看其他用户信息",
		})
		return
	}

	// 获取用户信息
	user, err := h.userService.GetUserByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "用户不存在",
		})
		return
	}

	c.JSON(http.StatusOK, domain.NewUserResponse(user))
}

// ListUsers 获取用户列表
func (h *UserHandler) ListUsers(c *gin.Context) {
	// 获取分页参数
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

	// 获取用户列表
	users, total, err := h.userService.ListUsers(page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "获取用户列表失败",
		})
		return
	}

	// 转换为响应格式
	userResponses := make([]*domain.UserResponse, len(users))
	for i, user := range users {
		userResponses[i] = domain.NewUserResponse(user)
	}

	c.JSON(http.StatusOK, gin.H{
		"users": userResponses,
		"pagination": gin.H{
			"total": total,
			"page":  page,
			"limit": limit,
		},
	})
}

// UpdateUser 更新用户信息
func (h *UserHandler) UpdateUser(c *gin.Context) {
	id := c.Param("id")

	// 获取当前用户ID和角色
	currentUserID, _ := c.Get("userID")
	currentRole, _ := c.Get("role")

	// 如果不是管理员且不是更新自己的信息，则拒绝
	if currentRole != "admin" && currentUserID != id {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "无权限更新其他用户信息",
		})
		return
	}

	// 获取要更新的用户
	user, err := h.userService.GetUserByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "用户不存在",
		})
		return
	}

	// 解析请求
	var req struct {
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
		Email     string `json:"email"`
		Active    *bool  `json:"active"`
		Role      string `json:"role"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "请求参数错误",
		})
		return
	}

	// 更新用户信息
	if req.FirstName != "" {
		user.FirstName = req.FirstName
	}
	if req.LastName != "" {
		user.LastName = req.LastName
	}
	if req.Email != "" {
		user.Email = req.Email
	}
	if req.Active != nil {
		user.Active = *req.Active
	}

	// 只有管理员可以更新角色
	if currentRole == "admin" && req.Role != "" {
		user.Role = req.Role
	}

	// 调用服务层更新用户
	if err := h.userService.UpdateUser(user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "更新用户失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "用户更新成功",
		"user":    domain.NewUserResponse(user),
	})
}

// DeleteUser 删除用户
func (h *UserHandler) DeleteUser(c *gin.Context) {
	id := c.Param("id")

	// 获取当前用户ID和角色
	currentRole, _ := c.Get("role")

	// 只有管理员可以删除用户
	if currentRole != "admin" {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "无权限删除用户",
		})
		return
	}

	// 调用服务层删除用户
	if err := h.userService.DeleteUser(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "删除用户失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "用户删除成功",
	})
}

// ChangePassword 修改密码
func (h *UserHandler) ChangePassword(c *gin.Context) {
	// 获取当前用户ID
	userID, _ := c.Get("userID")

	// 解析请求
	var req struct {
		CurrentPassword string `json:"currentPassword" binding:"required"`
		NewPassword     string `json:"newPassword" binding:"required,min=8"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "请求参数错误",
		})
		return
	}

	// 调用服务层修改密码
	if err := h.userService.ChangePassword(userID.(string), req.CurrentPassword, req.NewPassword); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "密码修改成功",
	})
}

// RegisterRoutes 注册路由
func (h *UserHandler) RegisterRoutes(router *gin.Engine, authMiddleware gin.HandlerFunc) {
	// 公开路由
	auth := router.Group("/api/v1/auth")
	{
		auth.POST("/register", h.Register)
		auth.POST("/login", h.Login)
		auth.POST("/logout", h.Logout)
		auth.GET("/validate", authMiddleware, h.ValidateToken)
	}

	// 需要认证的路由
	users := router.Group("/api/v1/users")
	users.Use(authMiddleware)
	{
		users.GET("/:id", h.GetUser)
		users.PUT("/:id", h.UpdateUser)
		users.DELETE("/:id", h.DeleteUser)
		users.POST("/change-password", h.ChangePassword)
	}

	// 管理员路由
	admin := router.Group("/api/v1/admin")
	admin.Use(authMiddleware, middleware.RoleMiddleware("admin"))
	{
		admin.GET("/users", h.ListUsers)
	}
}

// 生成JWT令牌
func (h *UserHandler) generateToken(userID, role string) (string, int64, error) {
	// 设置令牌过期时间
	expiresAt := time.Now().Add(time.Duration(h.config.JWT.ExpiresIn) * time.Hour).Unix()

	// 创建令牌
	claims := middleware.JWTClaims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Unix(expiresAt, 0)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(h.config.JWT.Secret))

	return tokenString, expiresAt, err
}

// 设置认证Cookie
func (h *UserHandler) setAuthCookie(c *gin.Context, token string, expiresAt int64) {
	maxAge := int(time.Unix(expiresAt, 0).Sub(time.Now()).Seconds())

	c.SetCookie(
		"auth_token",                         // 名称
		token,                                // 值
		maxAge,                               // 最大生命周期
		"/",                                  // 路径
		"",                                   // 域名
		h.config.Environment == "production", // 仅HTTPS
		true,                                 // HTTP-only
	)
}
