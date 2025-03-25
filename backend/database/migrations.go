// migrations.go
package database

import (
	"fmt"
	"log"
	"sort"
	"time"

	"github.com/jmoiron/sqlx"
)

// Migration 定义迁移结构
type Migration struct {
	ID        string    `db:"id"`
	Name      string    `db:"name"`
	AppliedAt time.Time `db:"applied_at"`
}

// MigrationFunc 定义迁移函数类型
type MigrationFunc func(*sqlx.DB) error

// MigrationEntry 表示一个迁移项
type MigrationEntry struct {
	ID    string
	Name  string
	Up    MigrationFunc
	Down  MigrationFunc
}

// 注册的迁移列表
var migrations = []MigrationEntry{}

// RegisterMigration 注册迁移项
func RegisterMigration(id, name string, up, down MigrationFunc) {
	migrations = append(migrations, MigrationEntry{
		ID:    id,
		Name:  name,
		Up:    up,
		Down:  down,
	})

	// 按ID排序迁移项
	sort.Slice(migrations, func(i, j int) bool {
		return migrations[i].ID < migrations[j].ID
	})
}

// InitMigrationTable 初始化迁移表
func InitMigrationTable() error {
	// 创建迁移表（如果不存在）
	createTableSQL := `
	CREATE TABLE IF NOT EXISTS migrations (
		id VARCHAR(50) PRIMARY KEY,
		name VARCHAR(255) NOT NULL,
		applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
	);`

	_, err := DB.Exec(createTableSQL)
	if err != nil {
		return fmt.Errorf("创建迁移表失败: %w", err)
	}

	return nil
}

// RunMigrations 执行所有未应用的迁移
func RunMigrations() error {
	// 确保迁移表存在
	if err := InitMigrationTable(); err != nil {
		return err
	}

	// 获取已应用的迁移
	appliedMigrations := make(map[string]bool)
	var applied []Migration

	err := DB.Select(&applied, "SELECT id, name, applied_at FROM migrations ORDER BY id")
	if err != nil {
		return fmt.Errorf("获取已应用迁移失败: %w", err)
	}

	for _, m := range applied {
		appliedMigrations[m.ID] = true
	}

	// 应用未执行的迁移
	tx, err := DB.Beginx()
	if err != nil {
		return fmt.Errorf("开始事务失败: %w", err)
	}

	for _, migration := range migrations {
		if !appliedMigrations[migration.ID] {
			log.Printf("应用迁移: %s - %s", migration.ID, migration.Name)

			// 应用迁移
			if err := migration.Up(DB); err != nil {
				tx.Rollback()
				return fmt.Errorf("迁移 %s 失败: %w", migration.ID, err)
			}

			// 记录已应用的迁移
			_, err := tx.Exec("INSERT INTO migrations (id, name) VALUES ($1, $2)",
				migration.ID, migration.Name)
			if err != nil {
				tx.Rollback()
				return fmt.Errorf("记录迁移 %s 失败: %w", migration.ID, err)
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("提交事务失败: %w", err)
	}

	return nil
}

// RollbackMigration 回滚最后一个迁移
func RollbackMigration() error {
	// 确保迁移表存在
	if err := InitMigrationTable(); err != nil {
		return err
	}

	var lastMigration Migration
	err := DB.Get(&lastMigration, "SELECT id, name, applied_at FROM migrations ORDER BY id DESC LIMIT 1")
	if err != nil {
		return fmt.Errorf("获取最后一个迁移失败: %w", err)
	}

	// 查找对应的迁移项
	var migrationToRollback *MigrationEntry
	for i, m := range migrations {
		if m.ID == lastMigration.ID {
			migrationToRollback = &migrations[i]
			break
		}
	}

	if migrationToRollback == nil {
		return fmt.Errorf("找不到要回滚的迁移: %s", lastMigration.ID)
	}

	// 开始事务
	tx, err := DB.Beginx()
	if err != nil {
		return fmt.Errorf("开始事务失败: %w", err)
	}

	// 执行回滚
	log.Printf("回滚迁移: %s - %s", migrationToRollback.ID, migrationToRollback.Name)
	if err := migrationToRollback.Down(DB); err != nil {
		tx.Rollback()
		return fmt.Errorf("回滚迁移 %s 失败: %w", migrationToRollback.ID, err)
	}

	// 从迁移表中删除记录
	_, err = tx.Exec("DELETE FROM migrations WHERE id = $1", lastMigration.ID)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("删除迁移记录 %s 失败: %w", lastMigration.ID, err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("提交事务失败: %w", err)
	}

	return nil
}

// GetAppliedMigrations 获取所有已应用的迁移
func GetAppliedMigrations() ([]Migration, error) {
	var migrations []Migration
	err := DB.Select(&migrations, "SELECT id, name, applied_at FROM migrations ORDER BY id")
	if err != nil {
		return nil, fmt.Errorf("获取已应用迁移失败: %w", err)
	}
	return migrations, nil
} 