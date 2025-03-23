# 语言学习音频播放器

专为语言学习场景设计的高级音频播放系统，支持系统预设内容和用户自定义音频，提供多种语言学习辅助功能。

## 功能特性

- 🔊 高保真音频播放
- 📊 波形可视化
- 🔄 AB循环（精确重复）
- 🏷️ 标记和书签系统
- 🎛️ 均衡器和音频处理
- ⏱️ 变速播放（不改变音调）
- 🔒 防下载的安全播放
- 📚 课程和单元组织结构
- 📱 响应式设计

## 技术栈

- **前端**: Next.js 15（App Router）
- **UI库**: React 19
- **样式**: Tailwind CSS 4.0
- **高性能音频处理**: Rust + WebAssembly
- **后端**: Golang + Gin
- **音频引擎**: Web Audio API
- **状态管理**: React Context API + Hooks

## 项目状态

👉 查看 [项目状态文档](./PROJECT_STATUS.md) 了解当前完成进度和待实现功能。

## 开发指南

### 前端

```bash
cd web-client
npm install
npm run dev
```

### 后端

```bash
cd backend
go mod download
go run .
```

### WebAssembly

```bash
cd RustWebAssembly
wasm-pack build --target web --out-dir ../web-client/public/wasm
```

## 项目结构

```
├── web-client/          # 前端项目代码 (Next.js)
│   ├── app/             # 页面和路由
│   ├── components/      # React组件
│   ├── lib/             # 工具和钩子
│   └── public/          # 静态资源
├── backend/             # 后端服务代码 (Golang)
│   ├── handlers/        # API处理函数
│   ├── middleware/      # 中间件
│   ├── models/          # 数据模型
│   └── storage/         # 存储管理
└── RustWebAssembly/     # WebAssembly音频处理模块
    └── src/             # Rust源代码
```

## 贡献指南

欢迎提交Issues和Pull Requests。请确保遵循以下规范：

- 代码风格符合项目规范
- 添加适当的测试
- 提交消息遵循约定式提交规范

## 许可证

本项目采用 MIT 许可证 