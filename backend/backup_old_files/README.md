# 语言学习音频播放器数据库组件

本文档详细介绍了语言学习音频播放器后端的数据库组件架构、使用方法和注意事项。

## 数据库概览

项目使用 PostgreSQL 作为主要数据库，通过 `sqlx` 库进行数据库交互，实现了：

- 数据库连接与初始化
- 数据模型定义
- 数据库迁移管理
- 仓库模式（Repository Pattern）实现数据访问层

## 目录结构

```
backend/database/
├── db.go                 # 数据库连接与初始化代码
├── migrations.go         # 数据库迁移基础设施
├── models/               # 数据模型定义
│   ├── user.go           # 用户模型及相关仓库
│   ├── course.go         # 课程和单元模型及相关仓库
│   └── track.go          # 音轨、书签、用户进度模型及仓库
└── migrations/           # 数据库迁移文件
    ├── migrations.go     # 迁移包初始化
    └── 001_init_schema.go # 初始架构迁移
```

## 主要模型

1. **用户模型（User）**
   - 基本用户信息
   - 认证与权限控制
   - 用户状态管理

2. **课程模型（Course）**
   - 课程基本信息
   - 课程分级（难度级别）
   - 课程分类（语言类别）

3. **单元模型（Unit）**
   - 单元基本信息
   - 所属课程关联
   - 单元顺序管理

4. **音轨模型（Track）**
   - 音频文件元数据
   - 文件路径和格式信息
   - 转写本和波形数据

5. **书签模型（Bookmark）**
   - 用户创建的音频标记点
   - 书签标签和注释
   - 时间点定位

6. **用户进度模型（UserProgress）**
   - 跟踪用户学习进度
   - 音频播放位置记录
   - 完成率统计

7. **用户上传音轨模型（UserTrack）**
   - 用户自定义音频
   - 原始文件信息
   - 处理后的音频关联

## 数据库迁移

系统使用简单的迁移机制管理数据库架构变更：

1. 所有迁移按顺序自动执行
2. 迁移版本记录在数据库中
3. 支持迁移回滚功能
4. 使用事务确保迁移的原子性

### 创建新迁移

1. 在 `migrations` 目录下创建新的迁移文件，按序号命名（例如 `002_add_indexes.go`）
2. 实现 `Up` 和 `Down` 迁移函数
3. 在 `init()` 中注册迁移

示例：

```go
package migrations

import (
    "github.com/jmoiron/sqlx"
)

func init() {
    RegisterMigration("002", "添加索引", MigrateAddIndexes, RollbackAddIndexes)
}

func MigrateAddIndexes(db *sqlx.DB) error {
    _, err := db.Exec(`
    CREATE INDEX idx_tracks_title ON tracks(title);
    `)
    return err
}

func RollbackAddIndexes(db *sqlx.DB) error {
    _, err := db.Exec(`DROP INDEX IF EXISTS idx_tracks_title;`)
    return err
}
```

## 仓库使用示例

使用仓库模式访问数据库：

```go
// 创建用户仓库
userRepo := models.NewUserRepository(database.DB)

// 创建用户
user := &models.User{
    Email:        "user@example.com",
    PasswordHash: passwordHash,
    Name:         "示例用户",
    Role:         "user",
    Active:       true,
}
if err := userRepo.Create(user); err != nil {
    // 处理错误
}

// 查询用户
user, err := userRepo.GetByID("user_123")
if err != nil {
    // 处理错误
}

// 更新用户
user.Name = "新名称"
if err := userRepo.Update(user); err != nil {
    // 处理错误
}

// 课程相关操作类似
courseRepo := models.NewCourseRepository(database.DB)
// ...
```

## 注意事项

1. 所有数据库操作应使用参数化查询防止SQL注入
2. 确保在事务中执行复杂的多表操作
3. 正确处理所有错误，记录详细的错误信息
4. 避免在控制器中直接使用SQL语句，应通过仓库访问数据
5. 保持模型之间的关系清晰（外键约束） 