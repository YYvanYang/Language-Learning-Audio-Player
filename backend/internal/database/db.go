package database

import (
	"fmt"
	"log"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"language-learning/internal/config"
	"language-learning/internal/models"
)

// Connection 数据库连接结构
type Connection struct {
	DB *gorm.DB
}

// NewConnection 创建新的数据库连接
func NewConnection(cfg *config.Config) (*Connection, error) {
	// 构建DSN连接字符串
	dsn := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		cfg.Database.Host,
		cfg.Database.Port,
		cfg.Database.Username,
		cfg.Database.Password,
		cfg.Database.DBName,
		cfg.Database.SSLMode,
	)

	// 配置GORM
	gormConfig := &gorm.Config{
		Logger: logger.Default.LogMode(getLogLevel(cfg.Environment)),
	}

	// 连接数据库
	db, err := gorm.Open(postgres.Open(dsn), gormConfig)
	if err != nil {
		return nil, fmt.Errorf("连接数据库失败: %w", err)
	}

	// 配置连接池
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("获取底层SQL DB失败: %w", err)
	}

	// 设置连接池参数
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	log.Println("数据库连接成功")

	return &Connection{DB: db}, nil
}

// AutoMigrate 自动迁移数据库模型
func (c *Connection) AutoMigrate() error {
	// 自动迁移所有模型
	if err := c.DB.AutoMigrate(
		&models.User{},
		&models.Course{},
		&models.Unit{},
		&models.Track{},
		&models.UserProgress{},
		&models.CustomTrack{},
		// 添加更多模型...
	); err != nil {
		return fmt.Errorf("数据库迁移失败: %w", err)
	}

	log.Println("数据库迁移完成")
	return nil
}

// Close 关闭数据库连接
func (c *Connection) Close() error {
	sqlDB, err := c.DB.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

// 根据环境设置日志级别
func getLogLevel(env string) logger.LogLevel {
	switch env {
	case "production":
		return logger.Error
	case "test":
		return logger.Silent
	default:
		return logger.Info
	}
}

// GetDB 返回GORM数据库实例
func (c *Connection) GetDB() *gorm.DB {
	return c.DB
}
