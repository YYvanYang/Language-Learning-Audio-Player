package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/YYvanYang/Language-Learning-Audio-Player/backend/internal/domain"
	"github.com/YYvanYang/Language-Learning-Audio-Player/backend/internal/track/service"
	"github.com/YYvanYang/Language-Learning-Audio-Player/backend/internal/utils/logger"

	"go.uber.org/zap"
)

// TrackHandler 音轨请求处理器
type TrackHandler struct {
	trackService *service.TrackService
}

// NewTrackHandler 创建音轨处理器实例
func NewTrackHandler(trackService *service.TrackService) *TrackHandler {
	return &TrackHandler{
		trackService: trackService,
	}
}

// GetTrack 获取音轨详情
func (h *TrackHandler) GetTrack(c *gin.Context) {
	trackID := c.Param("id")

	// 获取音轨信息
	track, err := h.trackService.GetTrackByID(trackID)
	if err != nil {
		logger.Error("获取音轨失败", zap.String("trackID", trackID), zap.Error(err))
		c.JSON(http.StatusNotFound, gin.H{
			"error": "音轨不存在",
		})
		return
	}

	// 返回音轨信息
	c.JSON(http.StatusOK, domain.NewTrackResponse(track))
}

// GetUnitTracks 获取单元音轨列表
func (h *TrackHandler) GetUnitTracks(c *gin.Context) {
	unitID := c.Param("unitId")

	// 获取单元音轨
	tracks, err := h.trackService.GetUnitTracks(unitID)
	if err != nil {
		logger.Error("获取单元音轨失败", zap.String("unitID", unitID), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "获取单元音轨失败",
		})
		return
	}

	// 转换为响应格式
	trackResponses := make([]*domain.TrackResponse, len(tracks))
	for i, track := range tracks {
		trackResponses[i] = domain.NewTrackResponse(track)
	}

	c.JSON(http.StatusOK, gin.H{
		"tracks": trackResponses,
	})
}

// CreateTrack 创建音轨
func (h *TrackHandler) CreateTrack(c *gin.Context) {
	var req domain.CreateTrackRequest

	// 解析请求
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的请求数据",
		})
		return
	}

	// 创建音轨
	track, err := h.trackService.CreateTrack(req)
	if err != nil {
		logger.Error("创建音轨失败", zap.String("title", req.Title), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "创建音轨失败",
		})
		return
	}

	// 返回创建的音轨
	c.JSON(http.StatusCreated, domain.NewTrackResponse(track))
}

// UpdateTrack 更新音轨
func (h *TrackHandler) UpdateTrack(c *gin.Context) {
	trackID := c.Param("id")
	var req domain.UpdateTrackRequest

	// 解析请求
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的请求数据",
		})
		return
	}

	// 更新音轨
	track, err := h.trackService.UpdateTrack(trackID, req)
	if err != nil {
		logger.Error("更新音轨失败", zap.String("trackID", trackID), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "更新音轨失败",
		})
		return
	}

	// 返回更新后的音轨
	c.JSON(http.StatusOK, domain.NewTrackResponse(track))
}

// DeleteTrack 删除音轨
func (h *TrackHandler) DeleteTrack(c *gin.Context) {
	trackID := c.Param("id")

	// 删除音轨
	err := h.trackService.DeleteTrack(trackID)
	if err != nil {
		logger.Error("删除音轨失败", zap.String("trackID", trackID), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "删除音轨失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "音轨已删除",
	})
}

// ReorderTracks 重新排序单元内的音轨
func (h *TrackHandler) ReorderTracks(c *gin.Context) {
	unitID := c.Param("unitId")
	var req domain.ReorderTracksRequest

	// 解析请求
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的请求数据",
		})
		return
	}

	// 重新排序音轨
	err := h.trackService.ReorderTracks(unitID, req)
	if err != nil {
		logger.Error("重新排序音轨失败", zap.String("unitID", unitID), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "重新排序音轨失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "音轨顺序已更新",
	})
}

// GetTrackBookmarks 获取音轨书签
func (h *TrackHandler) GetTrackBookmarks(c *gin.Context) {
	trackID := c.Param("id")

	// 获取当前用户ID
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "未认证",
		})
		return
	}

	// 获取音轨书签
	bookmarks, err := h.trackService.GetTrackBookmarks(userID.(string), trackID)
	if err != nil {
		logger.Error("获取音轨书签失败", zap.String("trackID", trackID), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "获取音轨书签失败",
		})
		return
	}

	// 转换为响应格式
	bookmarkResponses := make([]*domain.BookmarkResponse, len(bookmarks))
	for i, bookmark := range bookmarks {
		bookmarkResponses[i] = domain.NewBookmarkResponse(bookmark)
	}

	c.JSON(http.StatusOK, gin.H{
		"bookmarks": bookmarkResponses,
	})
}

// CreateBookmark 创建书签
func (h *TrackHandler) CreateBookmark(c *gin.Context) {
	var req domain.CreateBookmarkRequest

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

	// 创建书签
	bookmark, err := h.trackService.CreateBookmark(userID.(string), req)
	if err != nil {
		logger.Error("创建书签失败", zap.String("trackID", req.TrackID), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "创建书签失败",
		})
		return
	}

	// 返回创建的书签
	c.JSON(http.StatusCreated, domain.NewBookmarkResponse(bookmark))
}

// UpdateBookmark 更新书签
func (h *TrackHandler) UpdateBookmark(c *gin.Context) {
	bookmarkID := c.Param("id")
	var req domain.UpdateBookmarkRequest

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

	// 更新书签
	bookmark, err := h.trackService.UpdateBookmark(bookmarkID, userID.(string), req)
	if err != nil {
		logger.Error("更新书签失败", zap.String("bookmarkID", bookmarkID), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "更新书签失败",
		})
		return
	}

	// 返回更新后的书签
	c.JSON(http.StatusOK, domain.NewBookmarkResponse(bookmark))
}

// DeleteBookmark 删除书签
func (h *TrackHandler) DeleteBookmark(c *gin.Context) {
	bookmarkID := c.Param("id")

	// 获取当前用户ID
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "未认证",
		})
		return
	}

	// 删除书签
	err := h.trackService.DeleteBookmark(bookmarkID, userID.(string))
	if err != nil {
		logger.Error("删除书签失败", zap.String("bookmarkID", bookmarkID), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "删除书签失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "书签已删除",
	})
}

// RegisterRoutes 注册路由
func (h *TrackHandler) RegisterRoutes(router *gin.RouterGroup, authMiddleware gin.HandlerFunc, adminMiddleware gin.HandlerFunc) {
	// 需要认证的路由
	tracks := router.Group("/tracks")
	tracks.Use(authMiddleware)
	{
		// 获取单个音轨
		tracks.GET("/:id", h.GetTrack)

		// 获取单元的所有音轨
		tracks.GET("/unit/:unitId", h.GetUnitTracks)

		// 获取音轨的所有书签
		tracks.GET("/:id/bookmarks", h.GetTrackBookmarks)

		// 书签管理
		tracks.POST("/bookmarks", h.CreateBookmark)
		tracks.PUT("/bookmarks/:id", h.UpdateBookmark)
		tracks.DELETE("/bookmarks/:id", h.DeleteBookmark)
	}

	// 管理员路由 - 只有管理员可以创建、更新和删除音轨
	adminTracks := router.Group("/admin/tracks")
	adminTracks.Use(authMiddleware, adminMiddleware)
	{
		// 音轨管理
		adminTracks.POST("/", h.CreateTrack)
		adminTracks.PUT("/:id", h.UpdateTrack)
		adminTracks.DELETE("/:id", h.DeleteTrack)
		adminTracks.POST("/unit/:unitId/reorder", h.ReorderTracks)
	}
}
