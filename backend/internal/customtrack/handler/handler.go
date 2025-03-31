package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"language-learning/internal/customtrack/service"
	"language-learning/internal/domain"
	"language-learning/internal/utils/logger"

	"go.uber.org/zap"
)

// CustomTrackHandler 自定义音轨请求处理器
type CustomTrackHandler struct {
	customTrackService *service.CustomTrackService
}

// NewCustomTrackHandler 创建自定义音轨处理器实例
func NewCustomTrackHandler(customTrackService *service.CustomTrackService) *CustomTrackHandler {
	return &CustomTrackHandler{
		customTrackService: customTrackService,
	}
}

// GetCustomTrack 获取自定义音轨详情
func (h *CustomTrackHandler) GetCustomTrack(c *gin.Context) {
	trackID := c.Param("id")

	// 获取自定义音轨信息
	track, err := h.customTrackService.GetCustomTrackByID(trackID)
	if err != nil {
		logger.Error("获取自定义音轨失败", zap.String("trackID", trackID), zap.Error(err))
		c.JSON(http.StatusNotFound, gin.H{
			"error": "自定义音轨不存在",
		})
		return
	}

	// 检查访问权限
	userID, exists := c.Get("userID")
	if !exists {
		userID = ""
	}

	// 非公开音轨需要验证权限
	if !track.IsPublic && track.UserID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{
			"error": "无权限访问此自定义音轨",
		})
		return
	}

	// 返回自定义音轨信息
	c.JSON(http.StatusOK, domain.NewCustomTrackResponse(track))
}

// GetUserCustomTracks 获取用户的所有自定义音轨
func (h *CustomTrackHandler) GetUserCustomTracks(c *gin.Context) {
	// 获取当前用户ID
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "未认证",
		})
		return
	}

	// 获取分页参数
	page, pageSize := getPaginationParams(c)

	// 获取用户自定义音轨
	tracks, total, err := h.customTrackService.GetUserCustomTracks(userID.(string), page, pageSize)
	if err != nil {
		logger.Error("获取用户自定义音轨失败", zap.String("userID", userID.(string)), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "获取用户自定义音轨失败",
		})
		return
	}

	// 转换为响应格式
	trackResponses := make([]*domain.CustomTrackResponse, len(tracks))
	for i, track := range tracks {
		trackResponses[i] = domain.NewCustomTrackResponse(track)
	}

	c.JSON(http.StatusOK, gin.H{
		"tracks": trackResponses,
		"pagination": gin.H{
			"total":     total,
			"page":      page,
			"page_size": pageSize,
			"pages":     (total + int64(pageSize) - 1) / int64(pageSize),
		},
	})
}

// GetPublicCustomTracks 获取公开的自定义音轨
func (h *CustomTrackHandler) GetPublicCustomTracks(c *gin.Context) {
	// 获取分页参数
	page, pageSize := getPaginationParams(c)

	// 获取公开自定义音轨
	tracks, total, err := h.customTrackService.GetPublicCustomTracks(page, pageSize)
	if err != nil {
		logger.Error("获取公开自定义音轨失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "获取公开自定义音轨失败",
		})
		return
	}

	// 转换为响应格式
	trackResponses := make([]*domain.CustomTrackResponse, len(tracks))
	for i, track := range tracks {
		trackResponses[i] = domain.NewCustomTrackResponse(track)
	}

	c.JSON(http.StatusOK, gin.H{
		"tracks": trackResponses,
		"pagination": gin.H{
			"total":     total,
			"page":      page,
			"page_size": pageSize,
			"pages":     (total + int64(pageSize) - 1) / int64(pageSize),
		},
	})
}

// CreateCustomTrack 创建自定义音轨
func (h *CustomTrackHandler) CreateCustomTrack(c *gin.Context) {
	var req domain.CreateCustomTrackRequest

	// 获取当前用户ID
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "未认证",
		})
		return
	}

	// 解析请求
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的请求数据",
		})
		return
	}

	// 创建自定义音轨
	track, err := h.customTrackService.CreateCustomTrack(userID.(string), req)
	if err != nil {
		logger.Error("创建自定义音轨失败", zap.String("userID", userID.(string)), zap.String("title", req.Title), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "创建自定义音轨失败",
		})
		return
	}

	// 返回创建的自定义音轨
	c.JSON(http.StatusCreated, domain.NewCustomTrackResponse(track))
}

// UpdateCustomTrack 更新自定义音轨
func (h *CustomTrackHandler) UpdateCustomTrack(c *gin.Context) {
	trackID := c.Param("id")
	var req domain.UpdateCustomTrackRequest

	// 获取当前用户ID
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "未认证",
		})
		return
	}

	// 解析请求
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的请求数据",
		})
		return
	}

	// 更新自定义音轨
	track, err := h.customTrackService.UpdateCustomTrack(trackID, userID.(string), req)
	if err != nil {
		logger.Error("更新自定义音轨失败", zap.String("trackID", trackID), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "更新自定义音轨失败",
		})
		return
	}

	// 返回更新后的自定义音轨
	c.JSON(http.StatusOK, domain.NewCustomTrackResponse(track))
}

// DeleteCustomTrack 删除自定义音轨
func (h *CustomTrackHandler) DeleteCustomTrack(c *gin.Context) {
	trackID := c.Param("id")

	// 获取当前用户ID
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "未认证",
		})
		return
	}

	// 删除自定义音轨
	err := h.customTrackService.DeleteCustomTrack(trackID, userID.(string))
	if err != nil {
		logger.Error("删除自定义音轨失败", zap.String("trackID", trackID), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "删除自定义音轨失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "自定义音轨已删除",
	})
}

// SearchCustomTracks 搜索自定义音轨
func (h *CustomTrackHandler) SearchCustomTracks(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "搜索关键词不能为空",
		})
		return
	}

	// 获取分页参数
	page, pageSize := getPaginationParams(c)

	// 获取用户ID（如果已登录）
	var userID string
	userIDValue, exists := c.Get("userID")
	if exists {
		userID = userIDValue.(string)
	}

	// 确定搜索范围（我的/公开）
	scope := c.Query("scope")
	if scope == "my" && userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "未认证，无法搜索个人自定义音轨",
		})
		return
	}

	// 执行搜索
	var tracks []*domain.CustomTrack
	var total int64
	var err error

	if scope == "my" {
		// 搜索自己的自定义音轨
		tracks, total, err = h.customTrackService.SearchCustomTracks(query, userID, page, pageSize)
	} else {
		// 搜索公开的自定义音轨
		tracks, total, err = h.customTrackService.SearchCustomTracks(query, "", page, pageSize)
	}

	if err != nil {
		logger.Error("搜索自定义音轨失败", zap.String("query", query), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "搜索自定义音轨失败",
		})
		return
	}

	// 转换为响应格式
	trackResponses := make([]*domain.CustomTrackResponse, len(tracks))
	for i, track := range tracks {
		trackResponses[i] = domain.NewCustomTrackResponse(track)
	}

	c.JSON(http.StatusOK, gin.H{
		"tracks": trackResponses,
		"pagination": gin.H{
			"total":     total,
			"page":      page,
			"page_size": pageSize,
			"pages":     (total + int64(pageSize) - 1) / int64(pageSize),
		},
	})
}

// RegisterRoutes 注册路由
func (h *CustomTrackHandler) RegisterRoutes(router *gin.RouterGroup, authMiddleware gin.HandlerFunc) {
	// 公开路由 - 不需要认证
	customTrackPublic := router.Group("/custom-tracks")
	{
		// 获取公开的自定义音轨
		customTrackPublic.GET("/public", h.GetPublicCustomTracks)

		// 搜索公开的自定义音轨
		customTrackPublic.GET("/search", h.SearchCustomTracks)
	}

	// 需要认证的路由
	customTrack := router.Group("/custom-tracks")
	customTrack.Use(authMiddleware)
	{
		// 获取单个自定义音轨（权限检查在处理器中）
		customTrack.GET("/:id", h.GetCustomTrack)

		// 获取用户的所有自定义音轨
		customTrack.GET("/my", h.GetUserCustomTracks)

		// 创建自定义音轨
		customTrack.POST("/", h.CreateCustomTrack)

		// 更新自定义音轨
		customTrack.PUT("/:id", h.UpdateCustomTrack)

		// 删除自定义音轨
		customTrack.DELETE("/:id", h.DeleteCustomTrack)
	}
}

// 辅助函数：获取分页参数
func getPaginationParams(c *gin.Context) (int, int) {
	pageStr := c.DefaultQuery("page", "1")
	pageSizeStr := c.DefaultQuery("page_size", "10")

	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		page = 1
	}

	pageSize, err := strconv.Atoi(pageSizeStr)
	if err != nil || pageSize < 1 || pageSize > 100 {
		pageSize = 10
	}

	return page, pageSize
}
