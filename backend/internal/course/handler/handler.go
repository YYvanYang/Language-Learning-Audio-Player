package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"language-learning/internal/course/service"
	"language-learning/internal/domain"
	"language-learning/internal/utils/logger"

	"go.uber.org/zap"
)

// CourseHandler 课程请求处理器
type CourseHandler struct {
	courseService *service.CourseService
}

// NewCourseHandler 创建课程处理器实例
func NewCourseHandler(courseService *service.CourseService) *CourseHandler {
	return &CourseHandler{
		courseService: courseService,
	}
}

// GetCourse 获取课程详情
func (h *CourseHandler) GetCourse(c *gin.Context) {
	courseID := c.Param("id")

	// 获取当前用户ID
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "未认证",
		})
		return
	}

	// 获取课程信息
	course, err := h.courseService.GetCourseByID(courseID)
	if err != nil {
		logger.Error("获取课程失败", zap.String("courseID", courseID), zap.Error(err))
		c.JSON(http.StatusNotFound, gin.H{
			"error": "课程不存在",
		})
		return
	}

	// 如果课程不是公开的，检查用户是否有权限访问
	if !course.IsPublic {
		// 获取用户角色
		role, roleExists := c.Get("role")
		if !roleExists || (role != "admin" && userID != course.ID) {
			// 这里简化了权限检查，实际可能需要更复杂的逻辑
			c.JSON(http.StatusForbidden, gin.H{
				"error": "没有访问权限",
			})
			return
		}
	}

	// 返回课程信息
	c.JSON(http.StatusOK, domain.NewCourseResponse(course))
}

// ListCourses 获取课程列表
func (h *CourseHandler) ListCourses(c *gin.Context) {
	// 获取分页参数
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

	// 获取过滤参数
	filter := c.DefaultQuery("filter", "all")

	var courses []*domain.Course
	var total int64
	var err error

	// 根据过滤参数获取不同类型的课程
	switch filter {
	case "public":
		courses, total, err = h.courseService.GetPublicCourses(page, limit)
	case "user":
		// 获取当前用户ID
		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "未认证",
			})
			return
		}
		courses, total, err = h.courseService.GetUserCourses(userID.(string), page, limit)
	default:
		// 获取当前用户角色
		role, exists := c.Get("role")
		if exists && role == "admin" {
			// 管理员可以看到所有课程
			courses, total, err = h.courseService.GetAllCourses(page, limit)
		} else {
			// 非管理员只能看到公开课程
			courses, total, err = h.courseService.GetPublicCourses(page, limit)
		}
	}

	if err != nil {
		logger.Error("获取课程列表失败", zap.String("filter", filter), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "获取课程列表失败",
		})
		return
	}

	// 转换为响应格式
	courseResponses := make([]*domain.CourseResponse, len(courses))
	for i, course := range courses {
		courseResponses[i] = domain.NewCourseResponse(course)
	}

	c.JSON(http.StatusOK, gin.H{
		"courses": courseResponses,
		"pagination": gin.H{
			"total": total,
			"page":  page,
			"limit": limit,
		},
	})
}

// CreateCourse 创建课程
func (h *CourseHandler) CreateCourse(c *gin.Context) {
	var req domain.CreateCourseRequest

	// 解析请求
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的请求数据",
		})
		return
	}

	// 创建课程
	course, err := h.courseService.CreateCourse(req)
	if err != nil {
		logger.Error("创建课程失败", zap.String("title", req.Title), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "创建课程失败",
		})
		return
	}

	// 返回创建的课程
	c.JSON(http.StatusCreated, domain.NewCourseResponse(course))
}

// UpdateCourse 更新课程
func (h *CourseHandler) UpdateCourse(c *gin.Context) {
	courseID := c.Param("id")
	var req domain.UpdateCourseRequest

	// 解析请求
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的请求数据",
		})
		return
	}

	// 更新课程
	course, err := h.courseService.UpdateCourse(courseID, req)
	if err != nil {
		logger.Error("更新课程失败", zap.String("courseID", courseID), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "更新课程失败",
		})
		return
	}

	// 返回更新后的课程
	c.JSON(http.StatusOK, domain.NewCourseResponse(course))
}

// DeleteCourse 删除课程
func (h *CourseHandler) DeleteCourse(c *gin.Context) {
	courseID := c.Param("id")

	// 删除课程
	err := h.courseService.DeleteCourse(courseID)
	if err != nil {
		logger.Error("删除课程失败", zap.String("courseID", courseID), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "删除课程失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "课程已删除",
	})
}

// GetCourseUnits 获取课程单元
func (h *CourseHandler) GetCourseUnits(c *gin.Context) {
	courseID := c.Param("id")

	// 获取课程单元
	units, err := h.courseService.GetCourseUnits(courseID)
	if err != nil {
		logger.Error("获取课程单元失败", zap.String("courseID", courseID), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "获取课程单元失败",
		})
		return
	}

	// 转换为响应格式
	unitResponses := make([]*domain.UnitResponse, len(units))
	for i, unit := range units {
		unitResponses[i] = domain.NewUnitResponse(unit)
	}

	c.JSON(http.StatusOK, gin.H{
		"units": unitResponses,
	})
}

// CreateUnit 创建课程单元
func (h *CourseHandler) CreateUnit(c *gin.Context) {
	var req domain.CreateUnitRequest

	// 解析请求
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的请求数据",
		})
		return
	}

	// 创建单元
	unit, err := h.courseService.CreateUnit(req)
	if err != nil {
		logger.Error("创建单元失败", zap.String("courseID", req.CourseID), zap.String("title", req.Title), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "创建单元失败",
		})
		return
	}

	// 返回创建的单元
	c.JSON(http.StatusCreated, domain.NewUnitResponse(unit))
}

// UpdateUnit 更新课程单元
func (h *CourseHandler) UpdateUnit(c *gin.Context) {
	unitID := c.Param("id")
	var req domain.UpdateUnitRequest

	// 解析请求
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的请求数据",
		})
		return
	}

	// 更新单元
	unit, err := h.courseService.UpdateUnit(unitID, req)
	if err != nil {
		logger.Error("更新单元失败", zap.String("unitID", unitID), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "更新单元失败",
		})
		return
	}

	// 返回更新后的单元
	c.JSON(http.StatusOK, domain.NewUnitResponse(unit))
}

// DeleteUnit 删除课程单元
func (h *CourseHandler) DeleteUnit(c *gin.Context) {
	unitID := c.Param("id")

	// 删除单元
	err := h.courseService.DeleteUnit(unitID)
	if err != nil {
		logger.Error("删除单元失败", zap.String("unitID", unitID), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "删除单元失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "单元已删除",
	})
}

// ReorderUnits 重新排序课程单元
func (h *CourseHandler) ReorderUnits(c *gin.Context) {
	courseID := c.Param("id")
	var req domain.ReorderUnitsRequest

	// 解析请求
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "无效的请求数据",
		})
		return
	}

	// 重新排序单元
	err := h.courseService.ReorderCourseUnits(courseID, req)
	if err != nil {
		logger.Error("重新排序单元失败", zap.String("courseID", courseID), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "重新排序单元失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "单元排序已更新",
	})
}

// RegisterRoutes 注册路由
func (h *CourseHandler) RegisterRoutes(router *gin.RouterGroup, authMiddleware gin.HandlerFunc, adminMiddleware gin.HandlerFunc) {
	// 需要认证的路由
	courses := router.Group("/courses")
	courses.Use(authMiddleware)
	{
		// 获取课程列表
		courses.GET("/", h.ListCourses)

		// 获取单个课程
		courses.GET("/:id", h.GetCourse)

		// 获取课程单元
		courses.GET("/:id/units", h.GetCourseUnits)
	}

	// 管理员路由 - 只有管理员可以创建、更新和删除课程
	adminCourses := router.Group("/admin/courses")
	adminCourses.Use(authMiddleware, adminMiddleware)
	{
		// 课程管理
		adminCourses.POST("/", h.CreateCourse)
		adminCourses.PUT("/:id", h.UpdateCourse)
		adminCourses.DELETE("/:id", h.DeleteCourse)

		// 单元管理
		adminCourses.POST("/units", h.CreateUnit)
		adminCourses.PUT("/units/:id", h.UpdateUnit)
		adminCourses.DELETE("/units/:id", h.DeleteUnit)
		adminCourses.POST("/:id/reorder-units", h.ReorderUnits)
	}
}
