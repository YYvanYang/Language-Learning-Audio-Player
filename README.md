# 语言学习音频播放器

一个专为语言学习设计的高级音频播放器，提供丰富的音频处理和语言学习专用功能。

## 主要功能

### 基础音频功能
- 高质量音频播放和控制
- 波形可视化和交互
- AB循环重复功能
- 书签标记和管理
- 流式音频加载（支持大文件）

### 高级音频处理
- 音频时间拉伸（不改变音高）
- 音高调整（不改变速度）
- 动态音频压缩
- 均衡器预设系统
  - 多种语言学习优化均衡器预设
  - 音乐和常用场景预设
  - 自定义均衡器图形界面
- IIR滤波器语音增强
  - 语言特定共振峰优化（中文、英语、日语等）
  - 语音清晰度、理解度提升
  - 各种语音特性增强预设

### 语言学习专用功能
- 语速渐进式调整
  - 支持线性、阶梯式、指数和自适应调整模式
  - 针对不同学习水平的预设配置
  - 基于掌握程度的动态调整
- 间隔重复学习系统
  - 基于SM-2算法的记忆优化
  - 学习进度跟踪和统计
  - 可视化学习数据

### 音频分析功能
- 实时频谱分析
- 频率分布热图
- 音高检测和可视化

### 技术特点
- WebAssembly高性能音频处理
- Web Audio API现代音频引擎
- AudioWorklet实时音频处理
- WebGL加速波形渲染
- IndexedDB音频缓存系统

## 安装与使用

```bash
# 安装依赖
npm install

# 开发模式运行
npm run dev

# 构建生产版本
npm run build

# 运行测试
npm test
```

## 项目结构

```
web-client/          # 前端代码
  ├── components/    # React组件
  ├── lib/           # 工具和函数库
  ├── hooks/         # React钩子
  ├── workers/       # Web Workers
  └── wasm/          # WebAssembly模块

server/              # 后端Go服务
  ├── handlers/      # 请求处理函数
  ├── middleware/    # 中间件
  ├── models/        # 数据模型
  └── utils/         # 工具函数

wasm/                # Rust WebAssembly源码
  ├── src/           # Rust源代码
  └── build/         # 构建脚本
```

## 开发状态

请查看 [PROJECT_STATUS.md](PROJECT_STATUS.md) 了解详细的项目开发进度。

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