# 项目启动指南

本指南将帮助你设置和运行语言学习音频播放器项目的开发环境。

## 前置条件

确保你的系统上已安装以下软件：

- Git
- Docker Desktop (确保Docker守护进程正在运行)
- Go 1.20 或更高版本
- Node.js 18 或更高版本
- npm 或 yarn

## 1. 克隆项目

```bash
git clone https://github.com/YYvanYang/Language-Learning-Audio-Player.git
cd Language-Learning-Audio-Player
```

## 2. 启动PostgreSQL数据库

项目使用Docker容器化的PostgreSQL数据库。我们已经准备好了Docker Compose配置文件：

### 启动Docker守护进程

确保Docker Desktop已启动并在运行：

- **Windows/Mac**: 打开Docker Desktop应用程序
- **Linux**: 运行 `sudo systemctl start docker`

### 启动数据库容器

```bash
# 启动PostgreSQL容器
docker compose up -d
```

验证容器是否正常运行：

```bash
# 查看容器状态
docker ps

# 测试数据库连接
docker exec -it audio_player_db psql -U audio_user -d audio_player -c "SELECT 'PostgreSQL连接成功' AS status;"
```

## 3. 后端服务

### 安装依赖

```bash
cd backend
go mod download
```

### 启动后端服务

```bash
# 从项目根目录启动
cd backend
go run .
```

后端服务将在 http://localhost:8080 上运行。

如果你看到以下信息，则说明服务已成功启动：
```
数据库连接成功
数据库迁移完成
Server is running on http://localhost:8080
```

### 常见问题

如果在启动后端时出现以下错误：

1. **数据库连接失败**

   ```
   警告: 数据库初始化失败: 数据库连接失败: dial tcp [::1]:5432: connect: connection refused
   ```

   可能原因及解决方案：
   - Docker容器未运行：确认Docker Desktop已启动，并运行 `docker ps` 检查容器状态
   - 端口冲突：检查是否有其他应用占用5432端口，或修改docker-compose.yaml中的端口映射
   - 网络问题：尝试在.env文件中将DB_HOST从localhost改为127.0.0.1

2. **权限问题**

   ```
   警告: 数据库初始化失败: 数据库连接失败: password authentication failed for user "audio_user"
   ```

   解决方案：
   - 检查.env文件中的数据库凭据是否与docker-compose.yaml中的环境变量匹配
   - 重新创建数据库容器：`docker compose down -v && docker compose up -d`

## 4. 前端服务

### 安装依赖

```bash
cd web-client
npm install
```

### 启动前端开发服务器

```bash
npm run dev
```

前端应用将在 http://localhost:3000 上运行。

## 5. 完整启动流程

为方便开发，可以使用以下命令一次性启动所有服务：

```bash
# 启动数据库
docker compose up -d

# 启动后端（在一个终端窗口）
cd backend && go run .

# 启动前端（在另一个终端窗口）
cd web-client && npm run dev
```

## 测试账号

系统已预置以下测试账号：

- 管理员账号：
  - 邮箱：admin@example.com
  - 密码：password123

- 普通用户账号：
  - 邮箱：user@example.com
  - 密码：password123

## 环境清理

当你不再需要开发环境时，可以通过以下命令清理：

```bash
# 停止并移除容器和卷
docker compose down -v

# 或仅停止容器但保留数据
docker compose stop
``` 