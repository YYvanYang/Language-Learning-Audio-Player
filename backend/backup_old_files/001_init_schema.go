// 001_init_schema.go
package migrations

import (
	"fmt"

	"github.com/jmoiron/sqlx"
)

// 注册迁移
func init() {
	// 注册初始模式迁移
	RegisterMigration("001", "初始数据库架构", MigrateInitSchema, RollbackInitSchema)
}

// MigrateInitSchema 初始化数据库架构
func MigrateInitSchema(db *sqlx.DB) error {
	// 用户表
	_, err := db.Exec(`
	CREATE TABLE IF NOT EXISTS users (
		id VARCHAR(50) PRIMARY KEY,
		email VARCHAR(255) UNIQUE NOT NULL,
		password_hash VARCHAR(255) NOT NULL,
		name VARCHAR(255) NOT NULL,
		role VARCHAR(50) NOT NULL DEFAULT 'user',
		active BOOLEAN NOT NULL DEFAULT FALSE,
		activation_token VARCHAR(255),
		created_at TIMESTAMP WITH TIME ZONE NOT NULL,
		updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
		last_login_at TIMESTAMP WITH TIME ZONE
	);
	CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
	`)
	if err != nil {
		return err
	}

	// 检查email列是否存在，然后创建索引
	_, err = db.Exec(`
	DO $$
	BEGIN
	  IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_name = 'users' AND column_name = 'email'
	  ) THEN
		EXECUTE 'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)';
	  END IF;
	END
	$$;`)
	if err != nil {
		// 记录错误但继续执行
		fmt.Printf("创建users.email索引失败: %v\n", err)
	}

	// 课程表
	_, err = db.Exec(`
	CREATE TABLE IF NOT EXISTS courses (
		id VARCHAR(50) PRIMARY KEY,
		title VARCHAR(255) NOT NULL,
		description TEXT,
		level VARCHAR(50),
		language VARCHAR(50) NOT NULL,
		cover_image VARCHAR(255),
		published BOOLEAN NOT NULL DEFAULT FALSE,
		created_at TIMESTAMP WITH TIME ZONE NOT NULL,
		updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
		created_by VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL
	)`)
	if err != nil {
		return err
	}

	// 检查language列是否存在，然后创建索引
	_, err = db.Exec(`
	DO $$
	BEGIN
	  IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_name = 'courses' AND column_name = 'language'
	  ) THEN
		EXECUTE 'CREATE INDEX IF NOT EXISTS idx_courses_language ON courses(language)';
	  END IF;
	END
	$$;`)
	if err != nil {
		// 记录错误但继续执行
		fmt.Printf("创建language索引失败: %v\n", err)
	}

	// 检查level列是否存在，然后创建索引
	_, err = db.Exec(`
	DO $$
	BEGIN
	  IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_name = 'courses' AND column_name = 'level'
	  ) THEN
		EXECUTE 'CREATE INDEX IF NOT EXISTS idx_courses_level ON courses(level)';
	  END IF;
	END
	$$;`)
	if err != nil {
		// 记录错误但继续执行
		fmt.Printf("创建level索引失败: %v\n", err)
	}

	// 用户-课程关联表
	_, err = db.Exec(`
	CREATE TABLE IF NOT EXISTS user_courses (
		user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
		course_id VARCHAR(50) REFERENCES courses(id) ON DELETE CASCADE,
		granted_at TIMESTAMP WITH TIME ZONE NOT NULL,
		PRIMARY KEY (user_id, course_id)
	)`)
	if err != nil {
		return err
	}

	// 检查user_id列是否存在，然后创建索引
	_, err = db.Exec(`
	DO $$
	BEGIN
	  IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_name = 'user_courses' AND column_name = 'user_id'
	  ) THEN
		EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_courses_user_id ON user_courses(user_id)';
	  END IF;
	END
	$$;`)
	if err != nil {
		// 记录错误但继续执行
		fmt.Printf("创建user_courses.user_id索引失败: %v\n", err)
	}

	// 检查course_id列是否存在，然后创建索引
	_, err = db.Exec(`
	DO $$
	BEGIN
	  IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_name = 'user_courses' AND column_name = 'course_id'
	  ) THEN
		EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_courses_course_id ON user_courses(course_id)';
	  END IF;
	END
	$$;`)
	if err != nil {
		// 记录错误但继续执行
		fmt.Printf("创建user_courses.course_id索引失败: %v\n", err)
	}

	// 单元表
	_, err = db.Exec(`
	CREATE TABLE IF NOT EXISTS units (
		id VARCHAR(50) PRIMARY KEY,
		course_id VARCHAR(50) REFERENCES courses(id) ON DELETE CASCADE,
		title VARCHAR(255) NOT NULL,
		description TEXT,
		sequence INTEGER NOT NULL DEFAULT 0,
		published BOOLEAN NOT NULL DEFAULT FALSE,
		created_at TIMESTAMP WITH TIME ZONE NOT NULL,
		updated_at TIMESTAMP WITH TIME ZONE NOT NULL
	)`)
	if err != nil {
		return err
	}

	// 检查course_id列是否存在，然后创建索引
	_, err = db.Exec(`
	DO $$
	BEGIN
	  IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_name = 'units' AND column_name = 'course_id'
	  ) THEN
		EXECUTE 'CREATE INDEX IF NOT EXISTS idx_units_course_id ON units(course_id)';
	  END IF;
	END
	$$;`)
	if err != nil {
		// 记录错误但继续执行
		fmt.Printf("创建units.course_id索引失败: %v\n", err)
	}

	// 音轨表
	_, err = db.Exec(`
	CREATE TABLE IF NOT EXISTS tracks (
		id VARCHAR(50) PRIMARY KEY,
		unit_id VARCHAR(50) REFERENCES units(id) ON DELETE CASCADE,
		title VARCHAR(255) NOT NULL,
		description TEXT,
		file_name VARCHAR(255) NOT NULL,
		file_path VARCHAR(255) NOT NULL,
		file_size BIGINT NOT NULL,
		duration FLOAT NOT NULL,
		format VARCHAR(50) NOT NULL,
		sample_rate INTEGER,
		channels INTEGER,
		bit_rate INTEGER,
		waveform_path VARCHAR(255),
		transcript_path VARCHAR(255),
		has_transcript BOOLEAN NOT NULL DEFAULT FALSE,
		sequence INTEGER NOT NULL DEFAULT 0,
		is_system BOOLEAN NOT NULL DEFAULT TRUE,
		created_by VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
		created_at TIMESTAMP WITH TIME ZONE NOT NULL,
		updated_at TIMESTAMP WITH TIME ZONE NOT NULL
	)`)
	if err != nil {
		return err
	}

	// 检查unit_id列是否存在，然后创建索引
	_, err = db.Exec(`
	DO $$
	BEGIN
	  IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_name = 'tracks' AND column_name = 'unit_id'
	  ) THEN
		EXECUTE 'CREATE INDEX IF NOT EXISTS idx_tracks_unit_id ON tracks(unit_id)';
	  END IF;
	END
	$$;`)
	if err != nil {
		// 记录错误但继续执行
		fmt.Printf("创建tracks.unit_id索引失败: %v\n", err)
	}

	// 书签表
	_, err = db.Exec(`
	CREATE TABLE IF NOT EXISTS bookmarks (
		id VARCHAR(50) PRIMARY KEY,
		user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
		track_id VARCHAR(50) REFERENCES tracks(id) ON DELETE CASCADE,
		time_point FLOAT NOT NULL,
		label VARCHAR(255),
		color VARCHAR(50),
		notes TEXT,
		created_at TIMESTAMP WITH TIME ZONE NOT NULL,
		updated_at TIMESTAMP WITH TIME ZONE NOT NULL
	)`)
	if err != nil {
		return err
	}

	// 检查user_id和track_id列是否存在，然后创建索引
	_, err = db.Exec(`
	DO $$
	BEGIN
	  IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_name = 'bookmarks' AND column_name = 'user_id'
	  ) AND EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_name = 'bookmarks' AND column_name = 'track_id'
	  ) THEN
		EXECUTE 'CREATE INDEX IF NOT EXISTS idx_bookmarks_user_track ON bookmarks(user_id, track_id)';
	  END IF;
	END
	$$;`)
	if err != nil {
		// 记录错误但继续执行
		fmt.Printf("创建bookmarks复合索引失败: %v\n", err)
	}

	// 用户进度表
	_, err = db.Exec(`
	CREATE TABLE IF NOT EXISTS user_progress (
		id VARCHAR(50) PRIMARY KEY,
		user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
		track_id VARCHAR(50) REFERENCES tracks(id) ON DELETE CASCADE,
		last_position FLOAT NOT NULL DEFAULT 0,
		play_count INTEGER NOT NULL DEFAULT 0,
		completion_rate FLOAT NOT NULL DEFAULT 0,
		last_accessed TIMESTAMP WITH TIME ZONE NOT NULL,
		created_at TIMESTAMP WITH TIME ZONE NOT NULL,
		updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
		UNIQUE(user_id, track_id)
	)`)
	if err != nil {
		return err
	}

	// 检查user_id列是否存在，然后创建索引
	_, err = db.Exec(`
	DO $$
	BEGIN
	  IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_name = 'user_progress' AND column_name = 'user_id'
	  ) THEN
		EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id)';
	  END IF;
	END
	$$;`)
	if err != nil {
		// 记录错误但继续执行
		fmt.Printf("创建user_progress.user_id索引失败: %v\n", err)
	}

	// 检查track_id列是否存在，然后创建索引
	_, err = db.Exec(`
	DO $$
	BEGIN
	  IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_name = 'user_progress' AND column_name = 'track_id'
	  ) THEN
		EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_progress_track_id ON user_progress(track_id)';
	  END IF;
	END
	$$;`)
	if err != nil {
		// 记录错误但继续执行
		fmt.Printf("创建user_progress.track_id索引失败: %v\n", err)
	}

	// 用户上传音轨表
	_, err = db.Exec(`
	CREATE TABLE IF NOT EXISTS user_tracks (
		id VARCHAR(50) PRIMARY KEY,
		user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
		course_id VARCHAR(50) REFERENCES courses(id) ON DELETE SET NULL,
		unit_id VARCHAR(50) REFERENCES units(id) ON DELETE SET NULL,
		title VARCHAR(255) NOT NULL,
		description TEXT,
		file_name VARCHAR(255) NOT NULL,
		file_path VARCHAR(255) NOT NULL,
		original_file_name VARCHAR(255) NOT NULL,
		file_size BIGINT NOT NULL,
		duration FLOAT NOT NULL,
		format VARCHAR(50) NOT NULL,
		upload_time TIMESTAMP WITH TIME ZONE NOT NULL,
		last_access_time TIMESTAMP WITH TIME ZONE NOT NULL,
		track_id VARCHAR(50) REFERENCES tracks(id) ON DELETE SET NULL
	)`)
	if err != nil {
		return err
	}

	// 检查user_id列是否存在，然后创建索引
	_, err = db.Exec(`
	DO $$
	BEGIN
	  IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_name = 'user_tracks' AND column_name = 'user_id'
	  ) THEN
		EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_tracks_user_id ON user_tracks(user_id)';
	  END IF;
	END
	$$;`)
	if err != nil {
		// 记录错误但继续执行
		fmt.Printf("创建user_tracks.user_id索引失败: %v\n", err)
	}

	// 检查course_id列是否存在，然后创建索引
	_, err = db.Exec(`
	DO $$
	BEGIN
	  IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_name = 'user_tracks' AND column_name = 'course_id'
	  ) THEN
		EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_tracks_course_id ON user_tracks(course_id)';
	  END IF;
	END
	$$;`)
	if err != nil {
		// 记录错误但继续执行
		fmt.Printf("创建user_tracks.course_id索引失败: %v\n", err)
	}

	// 检查unit_id列是否存在，然后创建索引
	_, err = db.Exec(`
	DO $$
	BEGIN
	  IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_name = 'user_tracks' AND column_name = 'unit_id'
	  ) THEN
		EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_tracks_unit_id ON user_tracks(unit_id)';
	  END IF;
	END
	$$;`)
	if err != nil {
		// 记录错误但继续执行
		fmt.Printf("创建user_tracks.unit_id索引失败: %v\n", err)
	}

	return nil
}

// RollbackInitSchema 回滚初始数据库架构
func RollbackInitSchema(db *sqlx.DB) error {
	// 按照依赖关系顺序删除表
	_, err := db.Exec(`
	DROP TABLE IF EXISTS user_tracks;
	DROP TABLE IF EXISTS user_progress;
	DROP TABLE IF EXISTS bookmarks;
	DROP TABLE IF EXISTS tracks;
	DROP TABLE IF EXISTS units;
	DROP TABLE IF EXISTS user_courses;
	DROP TABLE IF EXISTS courses;
	DROP TABLE IF EXISTS users;
	`)
	return err
}
