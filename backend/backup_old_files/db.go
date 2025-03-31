// db.go
package database

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

// DB 全局数据库连接
var DB *sqlx.DB

// 初始化数据库连接
func InitDB() error {
	// 获取环境变量
	host := getEnv("DB_HOST", "localhost")
	port := getEnv("DB_PORT", "5432")
	user := getEnv("DB_USER", "postgres")
	password := getEnv("DB_PASSWORD", "password")
	dbname := getEnv("DB_NAME", "audio_player")
	sslmode := getEnv("DB_SSL_MODE", "disable")

	// 构建连接字符串
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		host, port, user, password, dbname, sslmode)

	// 尝试连接数据库
	var err error
	DB, err = sqlx.Connect("postgres", connStr)
	if err != nil {
		return fmt.Errorf("数据库连接失败: %w", err)
	}

	// 设置连接池参数
	DB.SetMaxOpenConns(25)           // 最大打开连接数
	DB.SetMaxIdleConns(5)            // 最大空闲连接数
	DB.SetConnMaxLifetime(5 * time.Minute) // 连接最大生命周期

	log.Println("数据库连接成功")
	return nil
}

// 关闭数据库连接
func CloseDB() {
	if DB != nil {
		DB.Close()
		log.Println("数据库连接已关闭")
	}
}

// 获取环境变量
func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

// PingDB 检查数据库连接是否正常
func PingDB() error {
	if DB == nil {
		return fmt.Errorf("数据库未初始化")
	}
	return DB.Ping()
} 