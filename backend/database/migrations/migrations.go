// migrations.go
package migrations

import (
	"github.com/YYvanYang/Language-Learning-Audio-Player/backend/database"
)

// RegisterAllMigrations 注册所有迁移
func RegisterAllMigrations() {
	// 001_init_schema.go 中的迁移已经通过 init() 注册
}

// Function aliases to allow usage in other migration files
var (
	RegisterMigration = database.RegisterMigration
)

// MigrationFunc 是数据库迁移函数的类型别名
type MigrationFunc = database.MigrationFunc
