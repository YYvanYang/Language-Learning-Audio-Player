# WebAssembly 音频处理模块

## 当前状态

此目录包含的是**临时模拟实现**的WebAssembly音频处理模块。这些文件旨在解决构建错误，但并非实际的Rust WebAssembly编译输出。

当前包含的文件：
- `audio_processor.js` - JavaScript模拟实现
- `audio_processor.wasm` - 空文件（占位符）

## 如何构建真正的WebAssembly模块

要构建实际的Rust WebAssembly模块，请按照以下步骤操作：

1. 确保已安装Rust工具链和wasm-pack：
   ```
   # 安装Rust（如果尚未安装）
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   
   # 安装wasm-pack
   cargo install wasm-pack
   ```

2. 从项目根目录运行WebAssembly构建脚本：
   ```
   # Windows PowerShell
   .\RustWebAssembly\wasm-build.ps1 -Clean
   
   # Linux/macOS（可能需要先添加执行权限）
   chmod +x ./RustWebAssembly/wasm-build.ps1
   pwsh ./RustWebAssembly/wasm-build.ps1 -Clean
   ```

3. 构建脚本将：
   - 编译Rust代码为WebAssembly
   - 生成必要的JavaScript包装器
   - 将文件复制到此目录

## 使用注意事项

- 现有的JavaScript模拟实现提供了与实际Rust实现相同的API接口，但性能和功能有限
- 对于开发测试，当前实现可以满足基本需求
- 生产环境请务必使用正确构建的Rust WebAssembly模块以获得最佳性能

## 故障排除

如果遇到与WebAssembly相关的错误：

1. 检查浏览器控制台是否有加载错误
2. 确认`web-client/lib/audio/wasm-loader.js`中的路径配置正确
3. 尝试重新运行构建脚本
4. 确保项目依赖已正确安装

如有问题，请参考项目文档或联系开发团队。 