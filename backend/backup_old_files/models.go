// models.go - Swagger文档使用的模型定义
package main

// ErrorResponse 错误响应结构
// @Description API错误响应
type ErrorResponse struct {
	// 错误信息
	Error string `json:"error" example:"未授权访问"`
}

// LoginResponse 登录响应结构
// @Description 登录成功响应
type LoginResponse struct {
	// 成功消息
	Message string `json:"message" example:"登录成功"`
	// 用户信息
	User struct {
		// 用户ID
		ID string `json:"id" example:"123e4567-e89b-12d3-a456-426614174000"`
		// 用户邮箱
		Email string `json:"email" example:"user@example.com"`
		// 用户名称
		Name string `json:"name" example:"测试用户"`
		// 用户角色
		Role string `json:"role" example:"user"`
	} `json:"user"`
	// JWT令牌
	Token string `json:"token" example:"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."`
}

// AudioTokenResponse 音频令牌响应结构
// @Description 音频访问令牌响应
type AudioTokenResponse struct {
	// 访问令牌
	Token string `json:"token" example:"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."`
	// 过期时间戳
	ExpiresAt int64 `json:"expiresAt" example:"1609459200"`
}

// HealthResponse 健康检查响应结构
// @Description 健康检查响应
type HealthResponse struct {
	// 服务状态
	Status string `json:"status" example:"ok"`
	// 数据库状态
	DB string `json:"db" example:"healthy"`
	// API版本
	Version string `json:"version" example:"1.0.0"`
}

// CourseResponse 课程响应结构
// @Description 课程信息响应
type CourseResponse struct {
	// 课程ID
	ID string `json:"id" example:"course-123"`
	// 课程标题
	Title string `json:"title" example:"初级汉语课程"`
	// 课程描述
	Description string `json:"description,omitempty" example:"适合初学者的汉语入门课程"`
	// 课程等级
	Level string `json:"level,omitempty" example:"beginner"`
	// 课程语言
	Language string `json:"language" example:"chinese"`
	// 封面图片URL
	CoverImage string `json:"coverImage,omitempty" example:"/api/courses/course-123/cover.jpg"`
	// 是否已发布
	Published bool `json:"published" example:"true"`
}

// UnitResponse 单元响应结构
// @Description 课程单元信息响应
type UnitResponse struct {
	// 单元ID
	ID string `json:"id" example:"unit-456"`
	// 课程ID
	CourseID string `json:"courseId" example:"course-123"`
	// 单元标题
	Title string `json:"title" example:"第一单元：基础问候"`
	// 单元描述
	Description string `json:"description,omitempty" example:"学习基本的中文问候语"`
	// 单元序号
	Sequence int `json:"sequence" example:"1"`
	// 是否已发布
	Published bool `json:"published" example:"true"`
}

// TrackResponse 音轨响应结构
// @Description 音轨信息响应
type TrackResponse struct {
	// 音轨ID
	ID string `json:"id" example:"track-789"`
	// 单元ID
	UnitID string `json:"unitId" example:"unit-456"`
	// 音轨标题
	Title string `json:"title" example:"听力练习1：问候语"`
	// 中文标题
	ChineseName string `json:"chineseName,omitempty" example:"听力练习1：问候语"`
	// 音轨时长(秒)
	Duration float64 `json:"duration" example:"65.5"`
	// 是否为自定义音轨
	Custom bool `json:"custom" example:"false"`
	// 排序顺序
	SortOrder int `json:"sortOrder" example:"1"`
}
