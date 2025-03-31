# 语言学习音频播放器后端重构计划文档

## 1. 重构目标

本重构项目旨在将现有的扁平结构后端系统重构为模块化分层架构，以提高代码质量、可维护性和可扩展性。

### 1.1 核心目标

- 实现清晰的分层架构（领域、仓储、服务、API 层）
- 提高代码组织结构，减少组件间耦合
- 标准化错误处理和日志记录
- 增强系统的可测试性
- 保持 API 向后兼容性，确保前端无需修改

### 1.2 技术栈

- **框架**: Gin Web框架
- **ORM**: GORM
- **认证**: JWT + Cookie
- **配置**: Viper + 环境变量
- **日志**: Zap
- **依赖注入**: 手动依赖注入(可后续升级到Wire)

## 2. 当前重构进度

### 2.1 已完成部分

- [x] 创建新的目录结构
- [x] 实现配置管理功能 (`internal/config`)
- [x] 实现数据库连接管理 (`internal/database`)
- [x] 实现日志系统 (`internal/utils/logger`)
- [x] 实现中间件 (`internal/middleware`)
  - [x] 认证中间件 (JWT)
  - [x] CORS 中间件
  - [x] 安全头中间件
- [x] 实现数据库模型 (`internal/models`)
- [x] 重构用户模块 (`internal/user`)
  - [x] 用户领域模型
  - [x] 用户仓储层
  - [x] 用户服务层
  - [x] 用户处理器

### 2.2 进行中的部分

- [ ] 重新组织入口点 (`cmd/api/main.go`)
- [ ] 修复模块导入路径问题

## 3. 模块重构计划

以下是剩余模块的重构计划，按照优先级排序：

### 3.1 课程模块 (`internal/course`)

```
internal/course/
├── repository/
│   └── repository.go
├── service/
│   └── service.go
└── handler/
    └── handler.go
```

**领域模型**:
```go
// internal/domain/course.go
package domain

type Course struct {
    ID          string
    Title       string
    Description string
    Level       string
    Language    string
    ImageURL    string
    IsPublic    bool
    CreatedAt   time.Time
    UpdatedAt   time.Time
    Units       []*Unit
}

type CourseRepository interface {
    FindByID(id string) (*Course, error)
    FindAll(page, limit int) ([]*Course, int64, error)
    Create(course *Course) error
    Update(course *Course) error
    Delete(id string) error
    // 更多方法...
}
```

### 3.2 音轨模块 (`internal/track`)

```
internal/track/
├── repository/
│   └── repository.go
├── service/
│   └── service.go
└── handler/
    └── handler.go
```

**领域模型**:
```go
// internal/domain/track.go
package domain

type Track struct {
    ID          string
    UnitID      string
    Title       string
    Description string
    FilePath    string
    Duration    float64
    OrderIndex  int
    IsSystem    bool
    CreatedAt   time.Time
    UpdatedAt   time.Time
}

type TrackRepository interface {
    FindByID(id string) (*Track, error)
    FindByUnitID(unitID string) ([]*Track, error)
    Create(track *Track) error
    Update(track *Track) error
    Delete(id string) error
    // 更多方法...
}
```

### 3.3 自定义音轨模块 (`internal/customtrack`)

```
internal/customtrack/
├── repository/
│   └── repository.go
├── service/
│   └── service.go
└── handler/
    └── handler.go
```

### 3.4 音频服务模块 (`internal/audio`)

该模块负责音频流处理和安全令牌生成：

```
internal/audio/
├── service/
│   └── service.go
└── handler/
    └── handler.go
```

**服务层**:
```go
// internal/audio/service/service.go
package service

type AudioService struct {
    tokenSecret string
    storagePath string
}

func (s *AudioService) GenerateToken(userID, trackID string) (string, time.Time, error) {
    // 生成音频访问令牌
}

func (s *AudioService) ValidateToken(token, trackID string) (bool, error) {
    // 验证音频访问令牌
}

func (s *AudioService) GetAudioFilePath(trackID string) (string, error) {
    // 获取音频文件路径
}

func (s *AudioService) GetAudioMetadata(trackID string) (*domain.AudioMetadata, error) {
    // 获取音频元数据
}
```

### 3.5 管理员模块 (`internal/admin`)

```
internal/admin/
├── service/
│   └── service.go
└── handler/
    └── handler.go
```

## 4. 实施计划

### 4.1 阶段一：基础结构调整 (已完成)

- [x] 创建新的目录结构
- [x] 实现配置管理
- [x] 实现中间件
- [x] 实现日志系统
- [x] 重构数据库连接

### 4.2 阶段二：核心模块迁移 (进行中)

- [x] 重构用户模块
- [ ] 重构课程模块
- [ ] 重构音轨模块
- [ ] 重构自定义音轨模块
- [ ] 重构音频服务

### 4.3 阶段三：集成和测试

- [ ] 更新主程序入口点
- [ ] 实现单元测试
- [ ] 实现集成测试
- [ ] 性能测试

### 4.4 阶段四：生产部署准备

- [ ] 补充文档
- [ ] 添加健康检查
- [ ] 实现监控支持
- [ ] 部署脚本优化

## 5. 关键技术实现要点

### 5.1 音频安全机制

音频服务需确保:
- 短期令牌验证 (5-10分钟有效期)
- 防盗链设计 (Referer检查)
- 范围请求支持 (用于音频跳转)

```go
// 创建安全的音频流URL
func createSecureAudioURL(trackID, token string) string {
    return fmt.Sprintf("/api/v1/audio/stream/%s?token=%s", trackID, token)
}

// 音频流处理器
func streamAudioHandler(c *gin.Context) {
    trackID := c.Param("trackID")
    token := c.Query("token")
    
    // 验证令牌
    valid, err := audioService.ValidateToken(token, trackID)
    if !valid || err != nil {
        c.AbortWithStatus(http.StatusUnauthorized)
        return
    }
    
    // 获取文件路径
    filePath, err := audioService.GetAudioFilePath(trackID)
    if err != nil {
        c.AbortWithStatus(http.StatusNotFound)
        return
    }
    
    // 设置安全标头
    c.Header("Content-Type", "audio/mpeg")
    c.Header("Accept-Ranges", "bytes")
    c.Header("Cache-Control", "no-store, no-cache, must-revalidate")
    c.Header("Content-Disposition", "inline")
    
    // 处理范围请求
    // ...
}
```

### 5.2 统一错误处理

所有模块使用一致的错误处理方式:

```go
// 定义应用错误
type AppError struct {
    Code    string
    Message string
    Err     error
}

func (e AppError) Error() string {
    return e.Message
}

func (e AppError) Unwrap() error {
    return e.Err
}

// 错误处理中间件
func ErrorHandler() gin.HandlerFunc {
    return func(c *gin.Context) {
        c.Next()
        
        if len(c.Errors) > 0 {
            err := c.Errors.Last().Err
            var appErr AppError
            if errors.As(err, &appErr) {
                c.JSON(http.StatusBadRequest, gin.H{
                    "code":    appErr.Code,
                    "message": appErr.Message,
                })
                return
            }
            
            c.JSON(http.StatusInternalServerError, gin.H{
                "message": "服务器内部错误",
            })
        }
    }
}
```

## 6. 改进点和注意事项

### 6.1 路径问题修复

当前导入路径使用`github.com/your-project/backend`，需要更新为实际项目路径:
```go
github.com/YYvanYang/Language-Learning-Audio-Player/backend
```

### 6.2 依赖管理

运行`go mod tidy`解决当前的依赖问题，确保依赖版本兼容:
```bash
cd backend
go mod tidy
```

### 6.3 日志集成

确保所有模块使用统一的日志记录器:
```go
// 在服务层使用日志
import "github.com/YYvanYang/Language-Learning-Audio-Player/backend/internal/utils/logger"

func (s *UserService) Register(req domain.RegisterRequest) (*domain.User, error) {
    logger.Info("开始处理用户注册",
        zap.String("username", req.Username),
        zap.String("email", req.Email))
    
    // 业务逻辑...
}
```

## 7. 后续扩展计划

完成基础重构后，可考虑以下高级特性:

- 缓存层实现 (Redis)
- 异步任务处理
- 配置热更新
- 多环境部署配置
- API版本控制

## 8. 重构测试标准

每个模块重构完成需通过以下测试:

1. 单元测试覆盖率 > 80%
2. 所有API端点功能测试通过
3. 非功能性测试:
   - 性能测试
   - 并发测试
   - 安全测试

## 9. 文档与知识传递

- 每个模块创建相应README文档
- 确保代码注释完整
- 业务逻辑文档化
- API文档保持更新

---

此重构计划将确保语言学习音频播放器后端系统采用现代化的架构模式，提高代码质量、可维护性和可扩展性，同时确保现有功能高度可用，满足生产级别、产品级别的要求。 