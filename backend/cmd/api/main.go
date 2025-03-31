package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/YYvanYang/Language-Learning-Audio-Player/backend/internal/config"
	"github.com/YYvanYang/Language-Learning-Audio-Player/backend/internal/database"
	"github.com/YYvanYang/Language-Learning-Audio-Player/backend/internal/middleware"
)

func main() {
	// 加载配置
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("加载配置失败: %v", err)
	}

	// 设置运行模式
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// 连接数据库
	db, err := database.NewConnection(cfg)
	if err != nil {
		log.Fatalf("数据库连接失败: %v", err)
	}

	// 自动迁移数据库
	if err := db.AutoMigrate(); err != nil {
		log.Fatalf("数据库迁移失败: %v", err)
	}

	// 创建Gin实例
	r := gin.New()

	// 使用全局中间件
	r.Use(gin.Logger())
	r.Use(gin.Recovery())
	r.Use(middleware.CORS(cfg))
	r.Use(middleware.SecurityHeaders())

	// 设置路由
	setupRoutes(r, cfg, db)

	// 创建HTTP服务器
	srv := &http.Server{
		Addr:    fmt.Sprintf("%s:%d", cfg.ServerAddress, cfg.Port),
		Handler: r,
	}

	// 启动服务器(非阻塞)
	go func() {
		log.Printf("服务器启动于 %s:%d", cfg.ServerAddress, cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("服务器启动失败: %v", err)
		}
	}()

	// 优雅关闭
	gracefulShutdown(srv, db)
}

// setupRoutes 设置所有路由
func setupRoutes(r *gin.Engine, cfg *config.Config, db *database.Connection) {
	// 健康检查路由
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "ok",
			"time":   time.Now().Format(time.RFC3339),
		})
	})

	// API v1 路由组
	v1 := r.Group("/api/v1")

	// 设置认证路由
	// 这些路由都是公开的，不需要认证
	setupAuthRoutes(v1, cfg, db)

	// 认证中间件
	authMiddleware := middleware.AuthMiddleware(cfg)

	// 课程路由 - 需要认证
	courseRoutes := v1.Group("/courses")
	courseRoutes.Use(authMiddleware)
	setupCourseRoutes(courseRoutes, cfg, db)

	// 音频路由 - 一部分需要认证
	setupAudioRoutes(v1, r, cfg, db, authMiddleware)

	// 用户自定义音轨路由 - 需要认证
	customTracksRoutes := v1.Group("/tracks/custom")
	customTracksRoutes.Use(authMiddleware)
	setupCustomTracksRoutes(customTracksRoutes, cfg, db)

	// 管理员路由 - 需要认证和管理员角色
	adminRoutes := v1.Group("/admin")
	adminRoutes.Use(authMiddleware, middleware.RoleMiddleware("admin"))
	setupAdminRoutes(adminRoutes, cfg, db)
}

// setupAuthRoutes 设置认证相关路由
func setupAuthRoutes(rg *gin.RouterGroup, cfg *config.Config, db *database.Connection) {
	// TODO: 导入并使用重构后的auth服务和处理器
	auth := rg.Group("/auth")

	auth.POST("/login", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "登录功能即将实现"})
	})

	auth.POST("/register", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "注册功能即将实现"})
	})

	auth.GET("/validate", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "验证功能即将实现"})
	})
}

// setupCourseRoutes 设置课程相关路由
func setupCourseRoutes(rg *gin.RouterGroup, cfg *config.Config, db *database.Connection) {
	// TODO: 导入并使用重构后的课程服务和处理器
	rg.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "获取课程列表功能即将实现"})
	})

	rg.GET("/:id", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "获取单个课程功能即将实现"})
	})
}

// setupAudioRoutes 设置音频相关路由
func setupAudioRoutes(apiGroup *gin.RouterGroup, router *gin.Engine, cfg *config.Config, db *database.Connection, authMiddleware gin.HandlerFunc) {
	// TODO: 导入并使用重构后的音频服务和处理器

	// 公开音频令牌路由 - 需要认证
	audioTokenGroup := apiGroup.Group("/audio/token")
	audioTokenGroup.Use(authMiddleware)

	audioTokenGroup.GET("/:trackId", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "获取音频令牌功能即将实现"})
	})

	// 音频流路由 - 需要令牌验证
	// 注意这里使用根路由器以避免认证中间件干扰
	router.GET("/api/v1/audio/stream/:trackId", func(c *gin.Context) {
		c.String(http.StatusOK, "音频流功能即将实现")
	})

	// 音频元数据路由 - 需要认证
	audioMetadataGroup := apiGroup.Group("/audio/metadata")
	audioMetadataGroup.Use(authMiddleware)

	audioMetadataGroup.GET("/:trackId", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "获取音频元数据功能即将实现"})
	})
}

// setupCustomTracksRoutes 设置用户自定义音轨路由
func setupCustomTracksRoutes(rg *gin.RouterGroup, cfg *config.Config, db *database.Connection) {
	// TODO: 导入并使用重构后的自定义音轨服务和处理器
	rg.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "获取自定义音轨列表功能即将实现"})
	})

	rg.POST("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "上传自定义音轨功能即将实现"})
	})
}

// setupAdminRoutes 设置管理员路由
func setupAdminRoutes(rg *gin.RouterGroup, cfg *config.Config, db *database.Connection) {
	// TODO: 导入并使用重构后的管理员服务和处理器
	rg.GET("/users", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "获取用户列表功能即将实现"})
	})
}

// gracefulShutdown 实现优雅关闭
func gracefulShutdown(srv *http.Server, db *database.Connection) {
	// 等待中断信号
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("正在关闭服务器...")

	// 创建带超时的上下文
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 关闭服务器
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("服务器关闭失败: %v", err)
	}

	// 关闭数据库连接
	if err := db.Close(); err != nil {
		log.Fatalf("数据库连接关闭失败: %v", err)
	}

	log.Println("服务器已安全关闭")
}
