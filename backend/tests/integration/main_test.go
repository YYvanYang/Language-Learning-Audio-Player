package integration

import (
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"language-learning/internal/config"
	"language-learning/internal/database"
	"language-learning/internal/middleware"
	"language-learning/internal/models"
)

var (
	testServer   *httptest.Server
	testRouter   *gin.Engine
	testDB       *database.Connection
	testConfig   *config.Config
	adminToken   string
	userToken    string
	testUserID   string
	testCourseID string
	testTrackID  string
)

// TestMain 运行所有测试的入口点
func TestMain(m *testing.M) {
	// 设置测试模式
	gin.SetMode(gin.TestMode)

	// 初始化测试环境
	setup()

	// 运行测试
	exitCode := m.Run()

	// 清理测试环境
	teardown()

	// 退出
	os.Exit(exitCode)
}

// setup 设置测试环境
func setup() {
	// 加载测试配置
	var err error
	testConfig, err = config.Load()
	if err != nil {
		log.Fatalf("加载配置失败: %v", err)
	}

	// 设置测试数据库连接
	testConfig.Database.DBName = "language_learning_test" // 使用专门的测试数据库
	testDB, err = database.NewConnection(testConfig)
	if err != nil {
		log.Fatalf("连接测试数据库失败: %v", err)
	}

	// 强制重置测试数据库 - 谨慎使用
	if err := testDB.GetDB().Migrator().DropTable(&models.User{}, &models.Course{}, &models.Unit{}, &models.Track{}, &models.CustomTrack{}); err != nil {
		log.Printf("清空测试数据库表失败: %v", err)
	}

	// 数据库迁移
	if err := testDB.AutoMigrate(); err != nil {
		log.Fatalf("测试数据库迁移失败: %v", err)
	}

	// 创建 Gin 路由器
	testRouter = gin.New()
	testRouter.Use(gin.Recovery())
	testRouter.Use(middleware.CORS(testConfig))
	testRouter.Use(middleware.SecurityHeaders())

	// 设置测试路由
	setupTestRoutes(testRouter, testConfig, testDB)

	// 启动测试服务器
	testServer = httptest.NewServer(testRouter)

	// 创建测试数据
	createTestData()
}

// teardown 清理测试环境
func teardown() {
	// 关闭测试服务器
	testServer.Close()

	// 关闭数据库连接
	if err := testDB.Close(); err != nil {
		log.Printf("关闭测试数据库连接失败: %v", err)
	}
}

// setupTestRoutes 设置测试路由
func setupTestRoutes(r *gin.Engine, cfg *config.Config, db *database.Connection) {
	// 设置API路由，与main.go中的setupRoutes函数相同
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

// createTestData 创建测试数据
func createTestData() {
	// 注册测试用户
	testUserID = createTestUser("testuser", "testuser@example.com", "password123", "Test User", "user")

	// 注册测试管理员
	createTestUser("admin", "admin@example.com", "admin123", "Admin User", "admin")

	// 创建测试课程
	testCourseID = createTestCourse("测试课程", "这是一个测试课程", "初级", "英语")

	// 创建测试音轨
	testTrackID = createTestTrack(testCourseID, "测试音轨", "这是一个测试音轨")

	// 获取测试令牌
	userToken = getTestToken("testuser", "password123")
	adminToken = getTestToken("admin", "admin123")
}

// createTestUser 创建测试用户并返回用户ID
func createTestUser(username, email, password, name, role string) string {
	user := models.User{
		Username:     username,
		Email:        email,
		PasswordHash: hashPassword(password),
		Name:         name,
		Role:         role,
		Active:       true,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := testDB.GetDB().Create(&user).Error; err != nil {
		log.Fatalf("创建测试用户失败: %v", err)
	}

	return user.ID
}

// createTestCourse 创建测试课程并返回课程ID
func createTestCourse(title, description, level, language string) string {
	course := models.Course{
		Title:       title,
		Description: description,
		Level:       level,
		Language:    language,
		IsPublic:    true,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := testDB.GetDB().Create(&course).Error; err != nil {
		log.Fatalf("创建测试课程失败: %v", err)
	}

	// 创建测试单元
	unit := models.Unit{
		CourseID:    course.ID,
		Title:       "测试单元",
		Description: "这是一个测试单元",
		OrderIndex:  1,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := testDB.GetDB().Create(&unit).Error; err != nil {
		log.Fatalf("创建测试单元失败: %v", err)
	}

	return course.ID
}

// createTestTrack 创建测试音轨并返回音轨ID
func createTestTrack(courseID, title, description string) string {
	// 查找单元
	var unit models.Unit
	if err := testDB.GetDB().Where("course_id = ?", courseID).First(&unit).Error; err != nil {
		log.Fatalf("查找单元失败: %v", err)
	}

	track := models.Track{
		UnitID:      unit.ID,
		Title:       title,
		Description: description,
		FilePath:    "test/audio.mp3", // 测试文件路径
		Duration:    120.0,            // 2分钟
		OrderIndex:  1,
		IsSystem:    true,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := testDB.GetDB().Create(&track).Error; err != nil {
		log.Fatalf("创建测试音轨失败: %v", err)
	}

	return track.ID
}

// getTestToken 获取测试用户的认证令牌
func getTestToken(username, password string) string {
	// TODO: 实现获取测试令牌的逻辑
	// 这里简化处理，实际应调用登录API获取令牌
	return "test_token"
}

// hashPassword 散列密码
func hashPassword(password string) string {
	// TODO: 实现密码散列
	return password // 简化示例，实际应使用bcrypt
}

// 导入路由设置函数
func setupAuthRoutes(rg *gin.RouterGroup, cfg *config.Config, db *database.Connection) {
	// TODO: 实现认证路由设置
}

func setupCourseRoutes(rg *gin.RouterGroup, cfg *config.Config, db *database.Connection) {
	// TODO: 实现课程路由设置
}

func setupAudioRoutes(apiGroup *gin.RouterGroup, router *gin.Engine, cfg *config.Config, db *database.Connection, authMiddleware gin.HandlerFunc) {
	// TODO: 实现音频路由设置
}

func setupCustomTracksRoutes(rg *gin.RouterGroup, cfg *config.Config, db *database.Connection) {
	// TODO: 实现自定义音轨路由设置
}

func setupAdminRoutes(rg *gin.RouterGroup, cfg *config.Config, db *database.Connection) {
	// TODO: 实现管理员路由设置
}
