// main.go
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"github.com/YYvanYang/Language-Learning-Audio-Player/backend/database"
	_ "github.com/YYvanYang/Language-Learning-Audio-Player/backend/database/migrations" // 引入所有迁移
)

func main() {
	// 加载环境变量
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// 初始化随机数种子
	initRandomSeed()

	// 初始化数据库连接
	if err := database.InitDB(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer database.CloseDB()

	// 执行数据库迁移
	if err := database.RunMigrations(); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// 设置Gin模式
	if os.Getenv("GIN_MODE") == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	// 创建Gin引擎
	router := gin.Default()

	// 应用自定义中间件
	router.Use(CORSMiddleware())
	router.Use(SecurityHeadersMiddleware())
	router.Use(SecurityLoggingMiddleware())

	// 确保存储目录存在
	createStorageDirectories()

	// 设置API版本
	v1 := router.Group("/api")

	// 音频相关路由
	audioRoutes := v1.Group("/audio")
	{
		// 获取音频访问令牌
		audioRoutes.GET("/token/:trackId", AuthMiddleware(), getAudioTokenHandler)

		// 音频流式传输 - 带令牌验证
		audioRoutes.GET("/stream/:trackId", streamAudioHandler)

		// 自适应音频流式传输 - 带令牌验证和自动质量选择
		audioRoutes.GET("/adaptive/:trackId", getAdaptiveStreamHandler)

		// 音频元数据
		audioRoutes.GET("/metadata/:trackId", AuthMiddleware(), getAudioMetadataHandler)

		// 上传自定义音频
		audioRoutes.POST("/upload", AuthMiddleware(), uploadAudioHandler)

		// 用户音频列表
		audioRoutes.GET("/user-tracks", AuthMiddleware(), getUserTracksHandler)
	}

	// 验证路由
	authRoutes := v1.Group("/auth")
	{
		authRoutes.POST("/login", loginHandler)
		authRoutes.POST("/register", registerHandler)
		authRoutes.POST("/logout", logoutHandler)
		authRoutes.GET("/validate", AuthMiddleware(), validateTokenHandler)
	}

	// 课程路由
	courseRoutes := v1.Group("/courses")
	{
		// 获取课程列表
		courseRoutes.GET("/", AuthMiddleware(), getCoursesHandler)

		// 获取单一课程详情
		courseRoutes.GET("/:courseId", AuthMiddleware(), CourseAccessMiddleware(), getCourseHandler)

		// 获取课程单元
		courseRoutes.GET("/:courseId/units", AuthMiddleware(), CourseAccessMiddleware(), getCourseUnitsHandler)

		// 获取单元音轨
		courseRoutes.GET("/:courseId/units/:unitId/tracks", AuthMiddleware(), CourseAccessMiddleware(), getUnitTracksHandler)
	}

	// 系统管理路由
	adminRoutes := v1.Group("/admin")
	{
		// 需要管理员权限
		adminRoutes.Use(AuthMiddleware())
		adminRoutes.Use(AdminMiddleware())

		// 用户管理
		adminRoutes.GET("/users", getSystemUsersHandler)
		adminRoutes.POST("/users", createSystemUserHandler)
		adminRoutes.PUT("/users/:userId", updateSystemUserHandler)
		adminRoutes.DELETE("/users/:userId", deleteSystemUserHandler)

		// 系统状态
		adminRoutes.GET("/stats", getSystemStatsHandler)
	}

	// 设置静态文件服务 - 仅用于开发环境
	if gin.Mode() != gin.ReleaseMode {
		router.Static("/static", "./static")
	}

	// 获取端口
	port := getEnv("PORT", "8080")

	// 创建HTTP服务器
	srv := &http.Server{
		Addr:    ":" + port,
		Handler: router,
	}

	// 优雅关闭服务器
	go func() {
		// 启动服务器
		log.Printf("Server is running on http://localhost:%s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %s", err)
		}
	}()

	// 监听中断信号
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	// 设置超时上下文
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 优雅关闭服务器
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server shutdown error: %s", err)
	}

	log.Println("Server exited")
}

// 初始化随机数种子
func initRandomSeed() {
	time.Now().UnixNano()
}

// 创建必要的存储目录
func createStorageDirectories() {
	dirs := []string{
		"storage/audio",
		"storage/audio/uploads",
		"storage/audio/processed",
		"storage/audio/transcoded", // 新增的转码文件目录
		"storage/audio/transcoded/high",
		"storage/audio/transcoded/medium",
		"storage/audio/transcoded/low",
		"storage/audio/transcoded/very_low",
		"storage/temp",
		"storage/tracks",
	}

	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			log.Fatalf("Failed to create directory: %s, error: %s", dir, err)
		}
	}
}

// 获取环境变量或默认值
func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

// AdminMiddleware 管理员权限中间件
func AdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("user_role")
		if !exists || role.(string) != "admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "需要管理员权限",
			})
			return
		}
		c.Next()
	}
}
