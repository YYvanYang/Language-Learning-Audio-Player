# 后端脚本目录

本目录包含与后端系统相关的各种脚本，包括数据库迁移、工具脚本等。

## 目录结构

```
scripts/
├── migrations/       # 数据库迁移和初始化脚本
│   ├── init-db.sql   # 数据库初始化脚本
│   └── update-db.sql # 数据库更新脚本
│
└── tools/            # 工具脚本
    └── update-status.js # 项目状态更新工具
```

## 脚本说明

### 数据库迁移脚本

- **init-db.sql**: 初始化数据库表结构和基础数据
- **update-db.sql**: 更新数据库结构（增加新表、修改字段等）

### 工具脚本

- **update-status.js**: 项目状态更新工具，用于跟踪和更新项目状态

## 使用方法

### 数据库初始化

```bash
# 连接到PostgreSQL并执行初始化脚本
psql -U postgres -d language_learning -f scripts/migrations/init-db.sql
```

### 数据库更新

```bash
# 执行数据库更新脚本
psql -U postgres -d language_learning -f scripts/migrations/update-db.sql
```

### 项目状态更新

```bash
# 运行状态更新工具
node scripts/tools/update-status.js
``` 