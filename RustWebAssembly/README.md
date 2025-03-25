# 语言学习音频播放器 - WebAssembly 模块

本目录包含语言学习音频播放器项目的 WebAssembly 音频处理模块，使用 Rust 语言编写，提供高性能的音频处理功能。

## 项目结构

```
RustWebAssembly/
├── audio_processor/       # 主要 Rust 音频处理库
│   ├── src/               # 源代码目录
│   │   └── lib.rs         # 库主入口点
│   └── Cargo.toml         # Rust 项目配置
├── dist/                  # 构建输出目录 (自动生成)
├── wasm-build.ps1         # PowerShell 构建脚本
└── README.md              # 本文档
```

## 功能特性

本模块提供以下音频处理功能：

1. **音频分析**
   - 波形生成
   - 音高检测
   - 频谱分析
   - 音频特征提取 (RMS, 峰值, 过零率等)

2. **音频处理**
   - 三段均衡器 (低/中/高频调节)
   - 动态压缩
   - 噪声抑制
   - 立体声处理

3. **工具函数**
   - AudioBuffer处理
   - 音频通道合并/分离

## 环境要求

- [Rust](https://www.rust-lang.org/tools/install) 1.60.0 或更高版本
- [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/) 工具链
- Windows PowerShell 或 [PowerShell Core](https://github.com/PowerShell/PowerShell)

## 构建说明

使用提供的 PowerShell 脚本可以快速构建 WebAssembly 模块：

```powershell
# 构建生产版本
./wasm-build.ps1 -Target release

# 构建开发版本
./wasm-build.ps1 -Target debug

# 首先清理旧文件再构建
./wasm-build.ps1 -Clean

# 显示帮助
./wasm-build.ps1 -Help
```

构建生成的文件会自动复制到：
- `RustWebAssembly/dist/` 目录（用于部署）
- `web-client/public/wasm/` 目录（用于前端集成）

## 在前端中使用

在JavaScript中导入生成的模块：

```javascript
import init, { AudioProcessor, extract_mono_from_buffer } from './wasm/audio_processor.js';

async function initWasm() {
  // 初始化 WebAssembly 模块
  await init();
  
  // 创建音频处理器实例
  const processor = new AudioProcessor();
  processor.set_sample_rate(44100);
  
  // 使用处理器
  const audioData = new Float32Array(/* 你的音频数据 */);
  const waveform = processor.generate_waveform(audioData, 1000);
  
  // 应用均衡器
  const eqSettings = { bass: 1.2, mid: 1.0, treble: 0.8 };
  processor.apply_equalizer(audioData, eqSettings);
  
  // 应用压缩
  const compSettings = { 
    threshold: -24.0, 
    ratio: 4.0, 
    attack: 0.005, 
    release: 0.050, 
    makeup_gain: 6.0 
  };
  processor.apply_compression(audioData, compSettings);
  
  // 分析音频
  const features = await processor.analyze_audio(audioData);
  console.log('音频特征:', features);
}
```

## 性能考虑

- 对于长音频文件，建议分段处理以避免阻塞主线程
- 考虑使用 Web Worker 在后台线程调用 WebAssembly 函数
- 对于实时处理，参数应使用合理的默认值以减少计算开销

## 自定义构建

如需添加新功能或修改现有功能，可以编辑 `audio_processor/src/lib.rs` 文件，然后运行构建脚本。

要添加新的 Rust 依赖项，请编辑 `audio_processor/Cargo.toml` 文件。 