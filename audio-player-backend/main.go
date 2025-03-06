// main.go
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// 加载环境变量
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// 设置Gin模式
	if os.Getenv("GIN_MODE") == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	// 创建Gin引擎
	router := gin.Default()

	// 配置CORS
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000", os.Getenv("FRONTEND_URL")},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// 设置API版本
	v1 := router.Group("/api")

	// 音频流API
	audioRoutes := v1.Group("/audio")
	{
		// 简化的单一质量音频流API
		audioRoutes.POST("/stream", AuthMiddleware(), streamAudioHandler)

		// 音频导入API
		audioRoutes.POST("/import", AuthMiddleware(), importAudioHandler)

		// 音轨管理API
		trackRoutes := audioRoutes.Group("/track")
		{
			trackRoutes.POST("/update", AuthMiddleware(), updateTrackHandler)
			trackRoutes.POST("/reorder", AuthMiddleware(), reorderTrackHandler)
			trackRoutes.POST("/delete", AuthMiddleware(), deleteTrackHandler)
		}
	}

	// 课程信息API
	courseRoutes := v1.Group("/course")
	{
		courseRoutes.GET("/:courseId/unit/:unitId", AuthMiddleware(), getUnitHandler)
		courseRoutes.GET("/:courseId/cover", getCoverImageHandler)
		courseRoutes.POST("/tracks", AuthMiddleware(), getTracksHandler)

		// 自定义音轨列表API
		courseRoutes.GET("/:courseId/unit/:unitId/custom-tracks", AuthMiddleware(), getCustomTracksHandler)
	}

	// 身份验证API
	authRoutes := v1.Group("/auth")
	{
		authRoutes.POST("/login", loginHandler)
		authRoutes.GET("/validate", validateSessionHandler)
		authRoutes.POST("/logout", logoutHandler)
	}

	// 带宽测试API
	router.GET("/api/bandwidth-test", bandwidthTestHandler)

	// 健康检查
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// 创建存储目录
	createStorageDirectories()

	// 获取服务器端口
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// 创建HTTP服务器
	srv := &http.Server{
		Addr:    ":" + port,
		Handler: router,
	}

	// 在单独的goroutine中启动服务器
	go func() {
		log.Printf("Server starting on port %s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %s", err)
		}
	}()

	// 等待中断信号以优雅地关闭服务器
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	// 设置5秒的超时时间来关闭服务器
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	log.Println("Server exiting")
}

// 创建必要的存储目录
func createStorageDirectories() {
	dirs := []string{
		filepath.Join(getEnv("AUDIO_FILES_PATH", "./storage/audio")),
		filepath.Join(getEnv("AUDIO_FILES_PATH", "./storage/audio"), "pep-english", "grade2-unit1", "custom"),
		filepath.Join(getEnv("AUDIO_METADATA_PATH", "./storage/metadata")),
		filepath.Join(getEnv("AUDIO_METADATA_PATH", "./storage/metadata"), "pep-english", "grade2-unit1"),
		filepath.Join(getEnv("COURSE_COVERS_PATH", "./storage/covers")),
	}

	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			log.Printf("Warning: Unable to create directory %s: %v", dir, err)
		}
	}
}

// 从环境变量获取值，如果不存在则使用默认值
func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

// 带宽测试处理程序
func bandwidthTestHandler(c *gin.Context) {
	// 获取请求的数据大小（默认1MB）
	sizeStr := c.DefaultQuery("size", "1048576")
	size := 1024 * 1024 // 默认1MB

	// 设置响应头
	c.Header("Content-Type", "application/octet-stream")
	c.Header("Content-Length", sizeStr)
	c.Header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
	c.Header("Pragma", "no-cache")
	c.Header("Expires", "0")

	// 使用较小的缓冲区分块发送数据
	// 这可以模拟真实的流式传输
	buffer := make([]byte, 64*1024) // 64KB缓冲区
	bytesLeft := size

	for bytesLeft > 0 {
		chunkSize := min(bytesLeft, len(buffer))
		chunk := buffer[:chunkSize]

		// 填充随机数据
		for i := range chunk {
			chunk[i] = byte(i % 256)
		}

		// 写入响应
		_, err := c.Writer.Write(chunk)
		if err != nil {
			// 客户端可能已断开连接
			return
		}

		// 减少剩余字节
		bytesLeft -= chunkSize

		// 刷新写入器
		c.Writer.Flush()
	}
}

// min函数，返回两个整数中的较小值
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
