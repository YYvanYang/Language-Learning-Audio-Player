# 音频播放系统 - 技术文档

## 系统概述

本文档详细描述了音频播放系统的技术实现，该系统专为教育场景设计，支持系统预设内容和用户自定义音频。系统采用现代技术栈构建，实现防下载的安全播放、高级音频处理功能和直观的用户界面。

## 技术栈

### 前端
- **框架**: Next.js 15 (App Router)
- **UI库**: React 19
- **样式**: Tailwind CSS 4.0
- **高性能音频处理**: Rust + WebAssembly
- **状态管理**: React Context API + Hooks
- **HTTP客户端**: 原生Fetch API

### 后端
- **语言**: Golang
- **Web框架**: Gin
- **音频处理**: FFmpeg
- **存储**: 文件系统
- **认证**: JWT + Cookie
- **API安全**: 加密令牌 + CORS

## 系统架构

### 总体架构
```
┌────────────────┐      ┌────────────────┐
│                │      │                │
│  Next.js 前端  │◄────►│  Golang 后端   │
│                │      │                │
└────────▲───────┘      └────────▲───────┘
         │                       │
         │                       │
┌────────▼───────┐      ┌────────▼───────┐
│                │      │                │
│Rust WebAssembly│      │  文件存储系统  │
│                │      │                │
└────────────────┘      └────────────────┘
```

### 前端架构
```
┌─────────────────────────────────────────┐
│              Next.js App                │
├─────────────────────────────────────────┤
│ ┌─────────────┐    ┌───────────────┐    │
│ │  页面组件   │    │  全局状态管理  │    │
│ └──────┬──────┘    └───────────────┘    │
│        │                                │
│ ┌──────▼──────┐    ┌───────────────┐    │
│ │ 功能组件    │◄───►│ 工具函数库    │    │
│ └──────┬──────┘    └───────────────┘    │
│        │                                │
│ ┌──────▼──────┐    ┌───────────────┐    │
│ │ UI组件      │    │ WebAssembly   │    │
│ └─────────────┘    └───────────────┘    │
└─────────────────────────────────────────┘
```

### 后端架构
```
┌─────────────────────────────────────────┐
│               Gin Web框架               │
├─────────────────────────────────────────┤
│ ┌─────────────┐    ┌───────────────┐    │
│ │ 中间件      │    │ 路由管理       │    │
│ └──────┬──────┘    └───────┬───────┘    │
│        │                   │            │
│ ┌──────▼──────┐    ┌───────▼───────┐    │
│ │ 认证和授权  │    │ API处理程序    │    │
│ └─────────────┘    └───────┬───────┘    │
│                            │            │
│ ┌─────────────┐    ┌───────▼───────┐    │
│ │ 数据存取    │◄───►│ 业务逻辑      │    │
│ └─────────────┘    └───────────────┘    │
└─────────────────────────────────────────┘
```

## 详细组件说明

### 前端组件

#### 1. AudioPlayer.jsx
**功能**: 核心音频播放器组件
**职责**:
- 音频加载和解码
- 播放控制（播放/暂停/快进/快退）
- 音轨切换和管理
- 整合波形可视化、书签和AB循环功能
- 音频处理（均衡器、音量控制）

```javascript
// 关键API
const playAudioBuffer = (startOffset = 0) => { ... }
const handleProgressChange = (e) => { ... }
const togglePlay = () => { ... }
```

#### 2. WaveformVisualizer.jsx
**功能**: 波形可视化和交互导航
**职责**:
- 显示音频波形
- 支持点击/拖动导航
- 通过Alt+拖动设置AB循环区域
- 双击添加书签
- 直观显示播放进度

```javascript
// 关键API
const handleMouseDown = (e) => { ... }
const handleDoubleClick = (e) => { ... }
```

#### 3. BookmarkList.jsx
**功能**: 书签管理列表
**职责**:
- 显示已添加的书签
- 提供编辑和删除功能
- 支持点击跳转到书签位置
- 管理书签元数据

```javascript
// 关键API
const handleEdit = (bookmark) => { ... }
const handleSave = (bookmarkId) => { ... }
```

#### 4. ABLoopControl.jsx
**功能**: AB循环控制面板
**职责**:
- 显示当前循环区域
- 提供精细调整功能
- 支持启用/禁用循环
- 格式化时间显示

```javascript
// 关键参数
loopRegion = { start: 25, end: 75 } // 百分比表示
```

#### 5. AudioImportForm.jsx
**功能**: 音频导入表单
**职责**:
- 文件选择和验证
- 音频元数据编辑
- 上传进度显示
- 错误处理和用户反馈

```javascript
// 关键API
const handleFileChange = (e) => { ... }
const handleUpload = async (e) => { ... }
```

#### 6. TrackManager.jsx
**功能**: 音轨管理组件
**职责**:
- 显示可用音轨列表
- 支持重命名和删除
- 实现轨道排序
- 区分系统轨道和用户轨道

```javascript
// 关键API
const submitRename = async (track) => { ... }
const submitDelete = async (track) => { ... }
const moveTrack = async (track, direction) => { ... }
```

### 前端工具类

#### 1. auth.js
**功能**: 认证和令牌管理
**职责**:
- 用户会话管理
- 登录和注销功能
- 安全令牌生成
- 权限验证

```javascript
// 关键API
export const generateToken = (payload) => { ... }
export function useAuth() { ... }
```

#### 2. processing.js
**功能**: WebAssembly音频处理包装器
**职责**:
- 加载和初始化WebAssembly模块
- 提供音频处理API
- 实现降级策略（当WebAssembly不可用时）
- 内存管理和优化

```javascript
// 关键API
export async function initAudioProcessor() { ... }
async function createWasmProcessor(wasmModule) { ... }
```

#### 3. bandwidth-detector.js
**功能**: 网络带宽检测
**职责**:
- 测量当前网络速度
- 选择最佳音频质量
- 缓存测量结果
- 提供带宽信息

```javascript
// 关键API
export async function detectBandwidth() { ... }
export function selectAudioQuality(bandwidth) { ... }
```

### 后端组件

#### 1. audio_handlers.go
**功能**: 音频流处理
**职责**:
- 安全地提供音频文件
- 支持范围请求
- 防止直接下载
- 用户权限验证

```go
// 关键函数
func streamAudioHandler(c *gin.Context) { ... }
func getTracksHandler(c *gin.Context) { ... }
```

#### 2. audio_import_handler.go
**功能**: 音频导入处理
**职责**:
- 处理文件上传
- 验证文件类型和大小
- 提取音频元数据
- 存储文件和元数据

```go
// 关键函数
func importAudioHandler(c *gin.Context) { ... }
func getAudioDuration(filePath string) (float64, error) { ... }
```

#### 3. track_management_handlers.go
**功能**: 音轨管理API
**职责**:
- 处理音轨重命名
- 处理音轨删除
- 处理排序更新
- 权限检查

```go
// 关键函数
func updateTrackHandler(c *gin.Context) { ... }
func deleteTrackHandler(c *gin.Context) { ... }
func reorderTrackHandler(c *gin.Context) { ... }
```

#### 4. custom_tracks_handler.go
**功能**: 用户自定义音轨API
**职责**:
- 获取用户上传的音轨列表
- 过滤和排序轨道
- 提供元数据信息
- 格式化响应

```go
// 关键函数
func getCustomTracksHandler(c *gin.Context) { ... }
func getUserCustomTracks(userID, courseID, unitID string) ([]TrackInfo, error) { ... }
```

#### 5. token.go
**功能**: 令牌处理和验证
**职责**:
- 处理访问令牌加密/解密
- 验证令牌有效性
- 防止重放攻击
- 实现认证中间件

```go
// 关键函数
func ParseAccessToken(encryptedToken string, secretKey string) (*AudioAccessToken, error) { ... }
func AuthMiddleware() gin.HandlerFunc { ... }
```

#### 6. auth_handlers.go
**功能**: 用户认证API
**职责**:
- 处理登录请求
- 处理会话验证
- 处理注销请求
- 管理JWT令牌

```go
// 关键函数
func loginHandler(c *gin.Context) { ... }
func validateSessionHandler(c *gin.Context) { ... }
func logoutHandler(c *gin.Context) { ... }
```

### Rust WebAssembly组件

#### 1. lib.rs
**功能**: 高性能音频处理
**职责**:
- 实现均衡器算法
- 实现压缩器功能
- 生成波形数据
- 提供AB循环计算

```rust
// 关键函数
pub fn apply_equalizer(&mut self, audio_data: &mut [f32], bass: f32, mid: f32, treble: f32) { ... }
pub fn generate_waveform_data(&self, audio_data: &[f32], num_points: u32) -> Box<[f32]> { ... }
```

## 数据流和交互

### 音频播放流程
1. 用户选择音轨
2. 前端生成安全令牌
3. 前端请求音频数据
4. 后端验证令牌和权限
5. 后端流式传输音频
6. WebAudio API解码并播放音频
7. WebAssembly模块处理音频（如果启用）
8. UI实时更新播放状态

### 音频导入流程
1. 用户选择文件并填写元数据
2. 前端验证文件类型和大小
3. 前端上传文件和元数据
4. 后端验证请求合法性
5. 后端保存文件并提取音频信息
6. 后端保存元数据
7. 前端更新轨道列表
8. 用户可立即使用新音轨

### 书签操作流程
1. 用户在波形上双击创建书签
2. 书签显示在列表中
3. 用户可编辑书签文本
4. 用户可点击书签跳转到对应位置
5. 书签状态保存在前端

### AB循环设置流程
1. 用户按Alt键并在波形上拖动
2. 系统标记起点和终点
3. 循环区域在波形上高亮显示
4. 用户可精细调整循环点
5. 播放到终点时自动跳回起点

## 安全机制

### 音频内容保护
1. **令牌验证**:
   - 所有音频请求需要加密令牌
   - 令牌包含用户ID、资源ID和时间戳
   - 令牌有效期为5分钟
   - 每次请求使用唯一随机盐

2. **流式传输**:
   - 不提供完整文件下载
   - 支持范围请求但防止完整缓存
   - 设置禁止缓存头部
   - 响应不包含具体文件路径

3. **权限控制**:
   - 用户只能访问已授权的课程
   - 用户只能修改自己上传的音轨
   - 所有操作经过认证中间件验证
   - 敏感操作需要二次验证

### 用户认证
1. **JWT认证**:
   - 使用JWT令牌管理会话
   - 令牌存储在HTTP Only Cookie中
   - 支持24小时有效期
   - 包含必要用户信息但不含敏感数据

2. **CORS保护**:
   - 严格的跨域资源共享策略
   - 仅允许指定域名访问
   - 限制HTTP方法和头部
   - 启用凭证支持但限制来源

## 性能优化

### 前端优化
1. **资源加载**:
   - 按需加载组件
   - 代码分割减小初始包大小
   - 懒加载非关键资源
   - 预加载下一个可能的音轨

2. **渲染优化**:
   - 使用虚拟列表处理长列表
   - 优化Canvas绘制算法

3. **WebAssembly优化**:
   - 使用SharedArrayBuffer共享内存（如果可用）
   - 批处理音频操作减少开销
   - 实现JavaScript后备方案
   - 优化内存使用和释放

### 后端优化
1. **文件处理**:
   - 高效的范围请求处理
   - 文件缓存策略
   - 流式处理减少内存使用
   - 使用goroutine并行处理请求

2. **IO优化**:
   - 异步文件操作
   - 缓冲区管理
   - 优化元数据存储和检索
   - 延迟加载非关键数据

## 存储结构

### 文件存储
```
storage/
├── audio/                  # 音频文件
│   └── {courseId}/
│       └── {unitId}/
│           ├── track1.mp3  # 系统音轨
│           ├── track2.mp3
│           └── custom/     # 用户上传音轨
│               └── {trackId}.mp3
├── metadata/               # 音轨元数据
│   └── {courseId}/
│       └── {unitId}/
│           └── {trackId}.json
└── covers/                 # 课程封面图片
    └── {courseId}.jpg
```

### 元数据结构
```json
{
  "trackId": "trk_ab12cd34ef56gh78",
  "title": "自定义音频标题",
  "description": "这是用户上传的音频描述",
  "fileName": "original.mp3",
  "fileSize": 2048576,
  "duration": 65.23,
  "fileType": "audio/mpeg",
  "uploadedBy": "usr_123456",
  "createdAt": "2024-01-01T12:00:00Z",
  "courseId": "pep-english",
  "unitId": "grade2-unit1",
  "fileChecksum": "a1b2c3d4e5f6...",
  "sortOrder": 4
}
```

## 配置参数

### 环境变量
```
# 服务器配置
PORT=8080
GIN_MODE=release  # 生产环境使用 release

# 前端URL (CORS配置)
FRONTEND_URL=http://localhost:3000

# 安全密钥
JWT_SECRET=your-jwt-secret-key
AUDIO_SECRET_KEY=your-audio-secret-key

# Cookie配置
COOKIE_DOMAIN=localhost
COOKIE_SECURE=false  # 生产环境使用 true

# 存储路径
AUDIO_FILES_PATH=./storage/audio
AUDIO_METADATA_PATH=./storage/metadata
COURSE_COVERS_PATH=./storage/covers
```

## 测试说明

### 单元测试
- 前端使用Jest + React Testing Library
- 后端使用Go内置测试框架
- WebAssembly使用wasm-bindgen-test

### 集成测试
- 使用Cypress进行前端集成测试
- 使用Postman/Newman测试API端点
- 模拟不同网络条件测试自适应流

### 性能测试
- 使用Lighthouse测量前端性能
- 使用Apache Bench测试API性能
- 测量不同设备上的WebAssembly性能

## 部署流程

### 开发环境
1. 克隆代码库
2. 安装依赖
   ```
   # 前端
   cd frontend
   npm install
   
   # 后端
   cd backend
   go mod download
   ```
3. 编译WebAssembly模块
   ```
   cd rust/audio_processing
   wasm-pack build --target web
   ```
4. 启动前端开发服务器
   ```
   npm run dev
   ```
5. 启动后端服务器
   ```
   go run *.go
   ```

### 生产环境
1. 构建前端
   ```
   npm run build
   ```
2. 构建后端
   ```
   go build -o audio-server
   ```
3. 配置环境变量
4. 启动服务
   ```
   ./audio-server
   ```

## 扩展与维护

### 潜在扩展
1. **内容管理**:
   - 添加课程管理界面
   - 实现教师批注功能
   - 添加学习进度跟踪
   - 集成测验和练习

2. **社交功能**:
   - 添加学习小组
   - 实现共享书签
   - 添加讨论功能
   - 支持教师反馈

3. **技术升级**:
   - 迁移到数据库存储
   - 添加全文搜索
   - 实现实时协作
   - 添加语音识别和评估

### 维护指南
1. **代码结构**:
   - 遵循组件化设计
   - 保持关注点分离
   - 使用清晰的命名约定
   - 维护完整文档

2. **性能监控**:
   - 跟踪前端加载性能
   - 监控API响应时间
   - 检测内存使用
   - 分析用户体验指标

## 问题排查

### 常见问题

#### 音频无法播放
- 检查网络连接
- 验证用户权限
- 检查音频文件存在性
- 确认浏览器兼容性

#### 上传失败
- 验证文件大小和类型
- 检查存储目录权限
- 确认令牌有效性
- 检查服务器磁盘空间

#### WebAssembly不可用
- 确认浏览器支持
- 检查模块加载错误
- 验证编译配置
- 确认降级策略工作正常