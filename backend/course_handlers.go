// course_handlers.go
package main

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// 课程信息结构
type CourseInfo struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	ImageURL    string    `json:"imageUrl"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
	UnitCount   int       `json:"unitCount"`
	Language    string    `json:"language"`
}

// 课程单元结构
type CourseUnitInfo struct {
	ID          string    `json:"id"`
	CourseID    string    `json:"courseId"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Order       int       `json:"order"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
	TrackCount  int       `json:"trackCount"`
}

// 获取课程列表
func getCoursesHandler(c *gin.Context) {
	// 获取用户ID
	_, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权访问"})
		return
	}

	// 模拟课程数据
	courses := []CourseInfo{
		{
			ID:          "course_1",
			Title:       "初级中文课程",
			Description: "适合初学者的中文课程",
			ImageURL:    "/static/images/courses/chinese_beginner.jpg",
			CreatedAt:   time.Now().AddDate(0, -1, 0),
			UpdatedAt:   time.Now().AddDate(0, 0, -5),
			UnitCount:   10,
			Language:    "中文",
		},
		{
			ID:          "course_2",
			Title:       "中级中文课程",
			Description: "适合有基础的学习者",
			ImageURL:    "/static/images/courses/chinese_intermediate.jpg",
			CreatedAt:   time.Now().AddDate(0, -2, 0),
			UpdatedAt:   time.Now().AddDate(0, 0, -10),
			UnitCount:   15,
			Language:    "中文",
		},
	}

	c.JSON(http.StatusOK, gin.H{
		"courses": courses,
	})
}

// 获取单一课程详情
func getCourseHandler(c *gin.Context) {
	// 获取课程ID
	courseID := c.Param("courseId")

	// 模拟课程数据
	course := CourseInfo{
		ID:          courseID,
		Title:       "初级中文课程",
		Description: "这是一门适合初学者的中文课程，涵盖基础词汇、常用表达和简单对话。",
		ImageURL:    "/static/images/courses/chinese_beginner.jpg",
		CreatedAt:   time.Now().AddDate(0, -1, 0),
		UpdatedAt:   time.Now().AddDate(0, 0, -5),
		UnitCount:   10,
		Language:    "中文",
	}

	c.JSON(http.StatusOK, gin.H{
		"course": course,
	})
}

// 获取课程单元
func getCourseUnitsHandler(c *gin.Context) {
	// 获取课程ID
	courseID := c.Param("courseId")

	// 模拟单元数据
	units := []CourseUnitInfo{
		{
			ID:          "unit_1",
			CourseID:    courseID,
			Title:       "基础问候语",
			Description: "学习最常用的中文问候语和自我介绍",
			Order:       1,
			CreatedAt:   time.Now().AddDate(0, -1, 0),
			UpdatedAt:   time.Now().AddDate(0, 0, -5),
			TrackCount:  5,
		},
		{
			ID:          "unit_2",
			CourseID:    courseID,
			Title:       "数字和时间表达",
			Description: "学习中文的数字和时间表达方式",
			Order:       2,
			CreatedAt:   time.Now().AddDate(0, -1, 0),
			UpdatedAt:   time.Now().AddDate(0, 0, -4),
			TrackCount:  6,
		},
		{
			ID:          "unit_3",
			CourseID:    courseID,
			Title:       "食物和饮料",
			Description: "学习与食物和饮料相关的常用词汇和表达",
			Order:       3,
			CreatedAt:   time.Now().AddDate(0, -1, 0),
			UpdatedAt:   time.Now().AddDate(0, 0, -3),
			TrackCount:  8,
		},
	}

	c.JSON(http.StatusOK, gin.H{
		"units": units,
	})
}

// 获取单元音轨
func getUnitTracksHandler(c *gin.Context) {
	// 获取参数
	courseID := c.Param("courseId")
	unitID := c.Param("unitId")

	// 获取用户ID
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权访问"})
		return
	}

	// 获取系统音轨
	systemTracks, err := getSystemTracks(courseID, unitID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取系统音轨失败"})
		return
	}

	// 获取用户自定义音轨
	userTracks, err := getUserCustomTracks(userID.(string), courseID, unitID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取用户音轨失败"})
		return
	}

	// 合并两种音轨
	allTracks := append(systemTracks, userTracks...)

	c.JSON(http.StatusOK, gin.H{
		"tracks": allTracks,
	})
}
