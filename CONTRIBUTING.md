# 贡献指南

感谢您对语言学习音频播放器项目的关注！本指南将帮助您了解如何为项目做出贡献。

## 开发流程

1. Fork 项目仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 项目状态文档更新

在实现新功能或修复问题时，请同时更新项目状态文档，以保持项目进度的透明性：

1. 打开 `PROJECT_STATUS.md` 文件
2. 根据您的贡献，执行以下操作:
   - 如果实现了待完成功能，将对应项目从 ⬜ 更改为 ✅
   - 如果添加了新功能，在相应部分添加新的 ✅ 项目
   - 如果发现需要实现的新功能，在待完成部分添加 ⬜ 项目
3. 在更新日志部分，按日期添加您完成的工作

示例更新:
```markdown
## 🟢 已完成功能
...
- ✅ 新实现的功能 (`相关文件.js`)

## 📅 更新日志

### 2024-XX-XX
- ✅ 完成某某功能
```

## 提交消息规范

我们采用 [Conventional Commits](https://www.conventionalcommits.org/) 规范:

```
<type>(<scope>): <subject>
```

### 类型 (Type)
- `feat`: 新功能
- `fix`: 错误修复
- `docs`: 文档变更
- `style`: 不影响代码含义的变更 (空格、格式化等)
- `refactor`: 既不修复错误也不添加功能的代码重构
- `perf`: 性能优化
- `test`: 添加缺失的测试或更正现有测试
- `chore`: 与构建过程或辅助工具相关的变更

### 范围 (Scope)
可选，表示变更的范围:
- `audio`: 音频处理相关
- `ui`: UI组件
- `api`: 后端API
- `doc`: 文档
- `wasm`: WebAssembly相关

### 主题 (Subject)
- 使用现在时态，如 "change" 而非 "changed" 或 "changes"
- 首字母不大写
- 不以句号结尾

## 代码风格

### JavaScript/TypeScript
- 使用 2 空格缩进
- 使用分号结束语句
- 遵循 ESLint 配置

### Go
- 使用 `gofmt` 格式化代码
- 遵循 Go 标准库风格

### Rust
- 使用 `rustfmt` 格式化代码
- 遵循 Rust 官方风格指南

## 项目结构更新

在添加新文件或目录时，请考虑更新 README.md 中的项目结构部分，以便其他贡献者更好地理解项目组织。

## 问题反馈

如果您发现错误或有功能建议，请创建 Issue 并提供以下信息:

- 清晰的标题和说明
- 重现步骤 (如适用)
- 预期结果与实际结果
- 相关截图或日志

感谢您的贡献！ 