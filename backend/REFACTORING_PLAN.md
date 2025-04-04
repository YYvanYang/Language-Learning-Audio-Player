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
- [x] 重构课程模块 (`internal/course`)
  - [x] 课程领域模型
  - [x] 课程仓储层
  - [x] 课程服务层
  - [x] 课程处理器
- [x] 重构音轨模块 (`internal/track`)
  - [x] 音轨领域模型
  - [x] 音轨仓储层
  - [x] 音轨服务层
  - [x] 音轨处理器
- [x] 重构自定义音轨模块 (`internal/customtrack`)
  - [x] 自定义音轨领域模型
  - [x] 自定义音轨仓储层
  - [x] 自定义音轨服务层
  - [x] 自定义音轨处理器
- [x] 重构音频服务 (`internal/audio`)
  - [x] 音频领域模型
  - [x] 音频服务层
  - [x] 音频处理器
- [x] 重构管理员模块 (`internal/admin`)
  - [x] 管理员领域模型
  - [x] 管理员仓储层
  - [x] 管理员服务层
  - [x] 管理员处理器
- [x] 实现认证模块 (`internal/auth`)
  - [x] 认证领域模型
  - [x] 认证服务层
  - [x] 认证处理器
- [x] 重新组织入口点 (`cmd/api/main.go`)

### 2.2 进行中的部分

- [ ] 完成集成测试

### 2.3 下一步计划

- [ ] 优化性能和安全性

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
├── repository/
│   └── repository.go
├── service/
│   └── service.go
└── handler/
    └── handler.go
```

**领域模型**:
```go
// internal/domain/admin.go
package domain

// AdminStats 管理统计信息
type AdminStats struct {
	TotalUsers         int64
	ActiveUsers        int64
	TotalCourses       int64
	TotalTracks        int64
	TotalCustomTracks  int64
	StorageUsed        int64
	NewUsersLastWeek   int64
	NewUsersLastMonth  int64
	ActiveCoursesCount int64
}

// AdminService 管理员服务接口
type AdminService interface {
	// GetStats 获取系统统计信息
	GetStats() (*AdminStats, error)
	
	// GetAllUsers 获取所有用户
	GetAllUsers(page, pageSize int) ([]*User, int64, error)
	
	// GetUserByID 获取用户详情
	GetUserByID(id string) (*User, error)
	
	// UpdateUser 更新用户信息
	UpdateUser(user *User) error
	
	// DeleteUser 删除用户
	DeleteUser(id string) error
	
	// GetSystemLogs 获取系统日志
	GetSystemLogs(level string, startDate, endDate time.Time, page, pageSize int) ([]string, int64, error)
}
```

**服务层**:
```go
// internal/admin/service/service.go
package service

import (
	"github.com/YYvanYang/Language-Learning-Audio-Player/backend/internal/domain"
)

type AdminService struct {
	userRepo         domain.UserRepository
	courseRepo       domain.CourseRepository
	trackRepo        domain.TrackRepository
	customTrackRepo  domain.CustomTrackRepository
}

// NewAdminService 创建管理员服务实例
func NewAdminService(
	userRepo domain.UserRepository,
	courseRepo domain.CourseRepository,
	trackRepo domain.TrackRepository,
	customTrackRepo domain.CustomTrackRepository,
) *AdminService {
	return &AdminService{
		userRepo:        userRepo,
		courseRepo:      courseRepo,
		trackRepo:       trackRepo,
		customTrackRepo: customTrackRepo,
	}
}

// GetStats 获取系统统计信息
func (s *AdminService) GetStats() (*domain.AdminStats, error) {
	// 实现统计逻辑
}

// 更多方法实现...
```

### 3.6 认证模块 (`internal/auth`)

```
internal/auth/
├── repository/
│   └── repository.go
├── service/
│   └── service.go
└── handler/
    └── handler.go
```

**领域模型**:
```go
// internal/domain/auth.go
package domain

type RegisterRequest struct {
    Username string
    Email    string
    Password string
}

type LoginRequest struct {
    Username string
    Password string
}

type User struct {
    ID        string
    Username  string
    Email     string
    Password  string
    LastLogin time.Time
}

type AuthRepository interface {
    Register(req RegisterRequest) error
    Login(req LoginRequest) (*User, error)
    FindByID(id string) (*User, error)
    Update(user *User) error
    Delete(id string) error
}
```

**服务层**:
```go
// internal/auth/service/service.go
package service

import (
	"github.com/YYvanYang/Language-Learning-Audio-Player/backend/internal/domain"
)

type AuthService struct {
	userRepo domain.AuthRepository
}

func (s *AuthService) Register(req domain.RegisterRequest) error {
    // 实现注册逻辑
}

func (s *AuthService) Login(req domain.LoginRequest) (*domain.User, error) {
    // 实现登录逻辑
}

func (s *AuthService) FindByID(id string) (*domain.User, error) {
    // 实现根据ID查找用户逻辑
}

func (s *AuthService) Update(user *domain.User) error {
    // 实现更新用户逻辑
}

func (s *AuthService) Delete(id string) error {
    // 实现删除用户逻辑
}
```

**处理器**:
```go
// internal/auth/handler/handler.go
package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	authService *service.AuthService
}

func (h *AuthHandler) Register(c *gin.Context) {
    // 实现注册处理器逻辑
}

func (h *AuthHandler) Login(c *gin.Context) {
    // 实现登录处理器逻辑
}

func (h *AuthHandler) FindByID(c *gin.Context) {
    // 实现根据ID查找用户处理器逻辑
}

func (h *AuthHandler) Update(c *gin.Context) {
    // 实现更新用户处理器逻辑
}

func (h *AuthHandler) Delete(c *gin.Context) {
    // 实现删除用户处理器逻辑
}
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
- [x] 重构课程模块
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

### 5.3 日志集成

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

### 5.4 脚本目录组织

为保持项目结构清晰，对脚本目录进行了优化:

```
backend/scripts/
├── migrations/       # 数据库迁移和初始化脚本
│   ├── init-db.sql   # 数据库初始化脚本
│   └── update-db.sql # 数据库更新脚本
│
└── tools/            # 工具脚本
    └── update-status.js # 项目状态更新工具
```

所有后端相关脚本都统一放在 `backend/scripts` 目录下，并按功能分类:
- 迁移脚本 (`migrations/`) - 数据库初始化和更新相关脚本
- 工具脚本 (`tools/`) - 自动化工具和实用程序脚本

每个子目录包含自己的功能说明，确保脚本的用途明确。

### 5.5 存储目录组织

文件存储目录保持清晰的结构，以支持不同类型资源的存储需求:

```
backend/storage/
├── audio/           # 音频文件存储
│   ├── processed/   # 处理后的音频文件
│   ├── transcoded/  # 经过转码的音频文件
│   └── uploads/     # 上传的原始音频文件
│
├── covers/          # 封面图片存储
│
├── metadata/        # 元数据存储
│
├── temp/            # 临时文件存储
│
└── tracks/          # 音轨文件存储
```

所有文件存储都通过配置进行路径管理，而不是硬编码:
- 主存储路径通过 `STORAGE_PATH` 环境变量配置
- 音频存储路径通过 `AUDIO_STORAGE_PATH` 环境变量配置
- 配置对象提供统一的访问接口

```go
// 正确的存储路径访问方式
storagePath := cfg.Storage.StoragePath
audioPath := cfg.Audio.StoragePath

// 确保目录存在
os.MkdirAll(filepath.Join(storagePath, "temp"), 0755)
```

通过这种方式，系统能够灵活地适应不同的部署环境，同时保持代码的一致性。

### 5.6 模块名重构

为了使代码更简洁，我们对 Go 模块名进行了重构：

1. **原模块名**：
   ```go
   github.com/YYvanYang/Language-Learning-Audio-Player/backend
   ```

2. **新模块名**：
   ```go
   language-learning
   ```

重构模块名的好处：
- 显著缩短了导入路径长度，提高了代码可读性
- 更简洁，适合私有项目使用
- 使用全小写，符合 Go 的命名惯例

重构后仍需解决以下问题：
1. `RegisterRequest` 和 `LoginRequest` 结构体在 `auth.go` 和 `user.go` 中有不同定义
2. 一些 Repository 接口方法如 `CountActive`、`CountCreatedAfter` 等尚未实现
3. `User` 结构体中的 `LastLoginAt` 和 `Name` 字段可能需要更新

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

### 6.4 脚本目录组织

为保持项目结构清晰，对脚本目录进行了优化:

```
backend/scripts/
├── migrations/       # 数据库迁移和初始化脚本
│   ├── init-db.sql   # 数据库初始化脚本
│   └── update-db.sql # 数据库更新脚本
│
└── tools/            # 工具脚本
    └── update-status.js # 项目状态更新工具
```

所有后端相关脚本都统一放在 `backend/scripts` 目录下，并按功能分类:
- 迁移脚本 (`migrations/`) - 数据库初始化和更新相关脚本
- 工具脚本 (`tools/`) - 自动化工具和实用程序脚本

每个子目录包含自己的功能说明，确保脚本的用途明确。

### 6.5 存储目录组织

文件存储目录保持清晰的结构，以支持不同类型资源的存储需求:

```
backend/storage/
├── audio/           # 音频文件存储
│   ├── processed/   # 处理后的音频文件
│   ├── transcoded/  # 经过转码的音频文件
│   └── uploads/     # 上传的原始音频文件
│
├── covers/          # 封面图片存储
│
├── metadata/        # 元数据存储
│
├── temp/            # 临时文件存储
│
└── tracks/          # 音轨文件存储
```

所有文件存储都通过配置进行路径管理，而不是硬编码:
- 主存储路径通过 `STORAGE_PATH` 环境变量配置
- 音频存储路径通过 `AUDIO_STORAGE_PATH` 环境变量配置
- 配置对象提供统一的访问接口

```go
// 正确的存储路径访问方式
storagePath := cfg.Storage.StoragePath
audioPath := cfg.Audio.StoragePath

// 确保目录存在
os.MkdirAll(filepath.Join(storagePath, "temp"), 0755)
```

通过这种方式，系统能够灵活地适应不同的部署环境，同时保持代码的一致性。

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

## 10. API文档更新

为确保API文档与重构后的代码结构保持一致，需进行以下操作：

### 10.1 Swagger注释添加

- 为所有新的处理器函数添加完整的Swagger注释
- 确保注释中的路由路径与实际注册路径一致
- 解决"路由声明多次"的警告问题

```go
// 示例：为处理器函数添加Swagger注释
// GetStats godoc
// @Summary 获取系统统计信息
// @Description 获取系统运行的统计数据
// @Tags admin
// @Accept json
// @Produce json
// @Success 200 {object} domain.AdminStats "系统统计信息"
// @Failure 401 {object} domain.ErrorResponse "未授权访问"
// @Router /api/admin/stats [get]
// @Security BearerAuth
func (h *AdminHandler) GetStats(c *gin.Context) {
    // 处理逻辑...
}
```

### 10.2 模型定义完善

- 确保所有API响应模型都在domain包中定义
- 添加必要的自定义类型以满足Swagger生成需求

```go
// 在domain包中定义错误响应模型
// ErrorResponse API错误响应
type ErrorResponse struct {
    Error   string `json:"error"`
    Code    string `json:"code,omitempty"`
    Details string `json:"details,omitempty"`
}
```

### 10.3 文档更新流程

1. 添加Swagger注释到处理器函数
2. 在main.go中配置Swagger路由
3. 使用swag命令重新生成文档：
   ```bash
   swag init -g cmd/api/main.go -o ./docs
   ```
4. 启动服务器，访问`/swagger/index.html`验证文档

---

此重构计划将确保语言学习音频播放器后端系统采用现代化的架构模式，提高代码质量、可维护性和可扩展性，同时确保现有功能高度可用，满足生产级别、产品级别的要求。 