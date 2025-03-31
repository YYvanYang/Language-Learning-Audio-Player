// 数据库种子器，负责初始化数据库示例数据
package database

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
)

// SeedDatabase 初始化数据库示例数据
// 参数:
// - forceReset: 是否强制重置数据库(删除所有现有数据)
// - seedScriptPath: 种子脚本路径，默认为"./scripts/init-db.sql"
func SeedDatabase(forceReset bool, seedScriptPath string) error {
	// 检查数据库连接
	if DB == nil {
		return fmt.Errorf("数据库未初始化")
	}

	// 使用默认脚本路径(如果未提供)
	if seedScriptPath == "" {
		seedScriptPath = "./scripts/init-db.sql"
	}

	// 如果不强制重置，先检查数据库是否已有数据
	if !forceReset {
		var courseCount int
		err := DB.QueryRow("SELECT COUNT(*) FROM courses").Scan(&courseCount)
		if err == nil && courseCount > 0 {
			log.Println("数据库已包含数据，跳过初始化")
			return nil
		}
	}

	// 读取SQL脚本文件
	sqlBytes, err := os.ReadFile(seedScriptPath)
	if err != nil {
		// 尝试从上级目录读取
		parentPath := filepath.Join("..", seedScriptPath)
		sqlBytes, err = os.ReadFile(parentPath)
		if err != nil {
			return fmt.Errorf("无法读取种子脚本: %v", err)
		}
	}

	sqlContent := string(sqlBytes)

	// 执行SQL脚本
	log.Println("正在初始化数据库...")

	// 分割SQL语句并逐条执行
	statements := splitSQLStatements(sqlContent)
	for _, stmt := range statements {
		if strings.TrimSpace(stmt) == "" {
			continue
		}

		_, err = DB.Exec(stmt)
		if err != nil {
			log.Printf("执行SQL语句时出错: %v\n语句: %s", err, stmt)
			return fmt.Errorf("初始化数据库失败: %v", err)
		}
	}

	log.Println("数据库初始化完成！")
	return nil
}

// splitSQLStatements 分割SQL脚本为单独的语句
func splitSQLStatements(content string) []string {
	// 按分号分割，但忽略引号内的分号
	var statements []string
	var currentStmt strings.Builder
	inString := false

	for _, char := range content {
		switch char {
		case '\'':
			inString = !inString
			currentStmt.WriteRune(char)
		case ';':
			if !inString {
				statements = append(statements, currentStmt.String())
				currentStmt.Reset()
			} else {
				currentStmt.WriteRune(char)
			}
		default:
			currentStmt.WriteRune(char)
		}
	}

	// 添加最后一个语句(如果有)
	lastStmt := strings.TrimSpace(currentStmt.String())
	if lastStmt != "" {
		statements = append(statements, lastStmt)
	}

	return statements
}
