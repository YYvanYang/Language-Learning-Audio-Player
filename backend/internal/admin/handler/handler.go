package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"language-learning/internal/domain"
	"language-learning/internal/utils/logger"

	"go.uber.org/zap"
)

// AdminHandler 管理员请求处理器
type AdminHandler struct {
	adminService domain.AdminService
}

// NewAdminHandler 创建管理员处理器实例
func NewAdminHandler(adminService domain.AdminService) *AdminHandler {
	return &AdminHandler{
		adminService: adminService,
	}
}

// GetStats godoc
// @Summary 获取系统统计信息
// @Description 获取系统运行的统计数据
// @Tags admin
// @Accept json
// @Produce json
// @Success 200 {object} domain.AdminStats "系统统计信息"
// @Failure 401 {object} domain.ErrorResponse "未授权访问"
// @Failure 403 {object} domain.ErrorResponse "无管理员权限"
// @Router /api/admin/stats [get]
// @Security BearerAuth
func (h *AdminHandler) GetStats(c *gin.Context) {
	logger.Debug("处理获取系统统计信息请求")

	stats, err := h.adminService.GetStats()
	if err != nil {
		logger.Error("获取系统统计信息失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "获取系统统计信息失败",
		})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// GetAllUsers godoc
// @Summary 获取系统用户列表
// @Description 获取所有系统用户的列表，支持分页
// @Tags admin
// @Accept json
// @Produce json
// @Param page query int false "页码，默认为1"
// @Param size query int false "每页数量，默认为10"
// @Success 200 {object} map[string]interface{} "用户列表"
// @Failure 401 {object} domain.ErrorResponse "未授权访问"
// @Failure 403 {object} domain.ErrorResponse "无管理员权限"
// @Router /api/admin/users [get]
// @Security BearerAuth
func (h *AdminHandler) GetAllUsers(c *gin.Context) {
	// 获取分页参数
	page, pageSize := getPagination(c)

	users, total, err := h.adminService.GetAllUsers(page, pageSize)
	if err != nil {
		logger.Error("获取所有用户失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "获取所有用户失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"users": users,
		"total": total,
		"page":  page,
		"size":  pageSize,
	})
}

// GetUserByID 获取用户详情
func (h *AdminHandler) GetUserByID(c *gin.Context) {
	userID := c.Param("id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "缺少用户ID",
		})
		return
	}

	user, err := h.adminService.GetUserByID(userID)
	if err != nil {
		logger.Error("获取用户详情失败", zap.String("id", userID), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "获取用户详情失败",
		})
		return
	}

	if user == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "用户不存在",
		})
		return
	}

	c.JSON(http.StatusOK, user)
}

// UpdateUser 更新用户信息
func (h *AdminHandler) UpdateUser(c *gin.Context) {
	userID := c.Param("id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "缺少用户ID",
		})
		return
	}

	var userUpdate domain.User
	if err := c.ShouldBindJSON(&userUpdate); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的请求数据",
		})
		return
	}

	// 确保ID一致
	userUpdate.ID = userID

	err := h.adminService.UpdateUser(&userUpdate)
	if err != nil {
		logger.Error("更新用户失败", zap.String("id", userID), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "更新用户失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "用户更新成功",
	})
}

// DeleteUser 删除用户
func (h *AdminHandler) DeleteUser(c *gin.Context) {
	userID := c.Param("id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "缺少用户ID",
		})
		return
	}

	err := h.adminService.DeleteUser(userID)
	if err != nil {
		logger.Error("删除用户失败", zap.String("id", userID), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "删除用户失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "用户删除成功",
	})
}

// GetSystemLogs 获取系统日志
func (h *AdminHandler) GetSystemLogs(c *gin.Context) {
	// 获取请求参数
	level := c.Query("level")
	if level == "" {
		level = "INFO" // 默认级别
	}

	// 获取日期范围
	startDate, endDate := getDateRange(c)

	// 获取分页参数
	page, pageSize := getPagination(c)

	logs, total, err := h.adminService.GetSystemLogs(level, startDate, endDate, page, pageSize)
	if err != nil {
		logger.Error("获取系统日志失败", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "获取系统日志失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"logs":  logs,
		"total": total,
		"page":  page,
		"size":  pageSize,
	})
}

// RegisterRoutes 注册路由
func (h *AdminHandler) RegisterRoutes(rg *gin.RouterGroup) {
	// 系统统计信息路由
	rg.GET("/stats", h.GetStats)

	// 用户管理路由
	rg.GET("/users", h.GetAllUsers)
	rg.GET("/users/:id", h.GetUserByID)
	rg.PUT("/users/:id", h.UpdateUser)
	rg.DELETE("/users/:id", h.DeleteUser)

	// 系统日志路由
	rg.GET("/logs", h.GetSystemLogs)
}

// 辅助函数: 获取分页参数
func getPagination(c *gin.Context) (int, int) {
	pageStr := c.DefaultQuery("page", "1")
	pageSizeStr := c.DefaultQuery("size", "10")

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

// 辅助函数: 获取日期范围
func getDateRange(c *gin.Context) (time.Time, time.Time) {
	startDateStr := c.DefaultQuery("startDate", "")
	endDateStr := c.DefaultQuery("endDate", "")

	var startDate time.Time
	var endDate time.Time
	var err error

	// 解析开始日期
	if startDateStr != "" {
		startDate, err = time.Parse(time.RFC3339, startDateStr)
		if err != nil {
			// 默认为30天前
			startDate = time.Now().AddDate(0, 0, -30)
		}
	} else {
		// 默认为30天前
		startDate = time.Now().AddDate(0, 0, -30)
	}

	// 解析结束日期
	if endDateStr != "" {
		endDate, err = time.Parse(time.RFC3339, endDateStr)
		if err != nil {
			// 默认为当前时间
			endDate = time.Now()
		}
	} else {
		// 默认为当前时间
		endDate = time.Now()
	}

	return startDate, endDate
}
