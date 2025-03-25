// migrations.go
package migrations

import (
	"github.com/jmoiron/sqlx"

	"github.com/your-username/language-learning-audio-player/backend/database"
)

// RegisterAllMigrations 注册所有迁移
func RegisterAllMigrations() {
	// 001_init_schema.go 中的迁移已经通过 init() 注册
}

// Function aliases to allow usage in other migration files
var (
	RegisterMigration = database.RegisterMigration
	MigrationFunc     = database.MigrationFunc
) 