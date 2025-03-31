// admin_handlers.go
package main

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// 系统用户结构
type SystemUser struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	Role      string    `json:"role"`
	Active    bool      `json:"active"`
	CreatedAt time.Time `json:"createdAt"`
	LastLogin time.Time `json:"lastLogin,omitempty"`
}

// 系统统计结构
type SystemStats struct {
	TotalUsers        int       `json:"totalUsers"`
	ActiveUsers       int       `json:"activeUsers"`
	TotalCourses      int       `json:"totalCourses"`
	TotalAudioFiles   int       `json:"totalAudioFiles"`
	TotalStorage      int64     `json:"totalStorage"` // 字节
	SystemUptime      float64   `json:"systemUptime"` // 小时
	LastRestart       time.Time `json:"lastRestart"`
	DatabaseSize      int64     `json:"databaseSize"`      // 字节
	AverageApiLatency float64   `json:"averageApiLatency"` // 毫秒
}

// 获取系统用户列表
// @Summary 获取系统用户列表
// @Description 获取所有系统用户的列表
// @Tags admin
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{} "用户列表"
// @Failure 401 {object} ErrorResponse "未授权访问"
// @Failure 403 {object} ErrorResponse "无管理员权限"
// @Router /api/admin/users [get]
// @Security BearerAuth
func getSystemUsersHandler(c *gin.Context) {
	// 模拟用户数据
	users := []SystemUser{
		{
			ID:        "user_1",
			Email:     "admin@example.com",
			Name:      "管理员",
			Role:      "admin",
			Active:    true,
			CreatedAt: time.Now().AddDate(0, -6, 0),
			LastLogin: time.Now().AddDate(0, 0, -1),
		},
		{
			ID:        "user_2",
			Email:     "teacher@example.com",
			Name:      "教师账号",
			Role:      "teacher",
			Active:    true,
			CreatedAt: time.Now().AddDate(0, -3, 0),
			LastLogin: time.Now().AddDate(0, 0, -3),
		},
		{
			ID:        "user_3",
			Email:     "student@example.com",
			Name:      "学生账号",
			Role:      "user",
			Active:    true,
			CreatedAt: time.Now().AddDate(0, -1, 0),
			LastLogin: time.Now().AddDate(0, 0, -5),
		},
	}

	c.JSON(http.StatusOK, gin.H{
		"users": users,
		"total": len(users),
	})
}

// 创建系统用户
// @Summary 创建系统用户
// @Description 创建新的系统用户
// @Tags admin
// @Accept json
// @Produce json
// @Param user body object true "用户信息"
// @Success 201 {object} map[string]interface{} "创建成功"
// @Failure 400 {object} ErrorResponse "请求无效"
// @Failure 401 {object} ErrorResponse "未授权访问"
// @Failure 403 {object} ErrorResponse "无管理员权限"
// @Router /api/admin/users [post]
// @Security BearerAuth
func createSystemUserHandler(c *gin.Context) {
	var newUser struct {
		Email    string `json:"email" binding:"required,email"`
		Name     string `json:"name" binding:"required"`
		Password string `json:"password" binding:"required,min=8"`
		Role     string `json:"role" binding:"required,oneof=admin teacher user"`
	}

	if err := c.ShouldBindJSON(&newUser); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的请求格式"})
		return
	}

	// 模拟创建用户
	user := SystemUser{
		ID:        "user_" + generateRandomString(6),
		Email:     newUser.Email,
		Name:      newUser.Name,
		Role:      newUser.Role,
		Active:    true,
		CreatedAt: time.Now(),
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "用户创建成功",
		"user":    user,
	})
}

// 更新系统用户
// @Summary 更新系统用户
// @Description 更新现有系统用户的信息
// @Tags admin
// @Accept json
// @Produce json
// @Param userId path string true "用户ID"
// @Param user body object true "用户更新信息"
// @Success 200 {object} map[string]interface{} "更新成功"
// @Failure 400 {object} ErrorResponse "请求无效"
// @Failure 401 {object} ErrorResponse "未授权访问"
// @Failure 403 {object} ErrorResponse "无管理员权限"
// @Failure 404 {object} ErrorResponse "用户不存在"
// @Router /api/admin/users/{userId} [put]
// @Security BearerAuth
func updateSystemUserHandler(c *gin.Context) {
	userID := c.Param("userId")

	var updateUser struct {
		Name   string `json:"name"`
		Role   string `json:"role" binding:"omitempty,oneof=admin teacher user"`
		Active *bool  `json:"active"`
	}

	if err := c.ShouldBindJSON(&updateUser); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的请求格式"})
		return
	}

	// 模拟更新用户
	user := SystemUser{
		ID:        userID,
		Email:     "updated@example.com",
		Name:      updateUser.Name,
		Role:      updateUser.Role,
		Active:    updateUser.Active != nil && *updateUser.Active,
		CreatedAt: time.Now().AddDate(0, -3, 0),
		LastLogin: time.Now().AddDate(0, 0, -2),
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "用户更新成功",
		"user":    user,
	})
}

// 删除系统用户
// @Summary 删除系统用户
// @Description 删除指定的系统用户
// @Tags admin
// @Accept json
// @Produce json
// @Param userId path string true "用户ID"
// @Success 200 {object} map[string]interface{} "删除成功"
// @Failure 401 {object} ErrorResponse "未授权访问"
// @Failure 403 {object} ErrorResponse "无管理员权限"
// @Failure 404 {object} ErrorResponse "用户不存在"
// @Router /api/admin/users/{userId} [delete]
// @Security BearerAuth
func deleteSystemUserHandler(c *gin.Context) {
	userID := c.Param("userId")

	// 模拟删除用户
	c.JSON(http.StatusOK, gin.H{
		"message": "用户删除成功",
		"userId":  userID,
	})
}

// 获取系统统计信息
// @Summary 获取系统统计信息
// @Description 获取系统运行的统计数据
// @Tags admin
// @Accept json
// @Produce json
// @Success 200 {object} SystemStats "系统统计信息"
// @Failure 401 {object} ErrorResponse "未授权访问"
// @Failure 403 {object} ErrorResponse "无管理员权限"
// @Router /api/admin/stats [get]
// @Security BearerAuth
func getSystemStatsHandler(c *gin.Context) {
	// 模拟系统统计数据
	stats := SystemStats{
		TotalUsers:        150,
		ActiveUsers:       78,
		TotalCourses:      12,
		TotalAudioFiles:   560,
		TotalStorage:      1024 * 1024 * 1024 * 5, // 5GB
		SystemUptime:      168.5,                  // 7天多
		LastRestart:       time.Now().AddDate(0, 0, -7),
		DatabaseSize:      1024 * 1024 * 256, // 256MB
		AverageApiLatency: 45.8,              // 45.8毫秒
	}

	c.JSON(http.StatusOK, gin.H{
		"stats": stats,
	})
}
