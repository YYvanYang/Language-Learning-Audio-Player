# 存储目录

本目录用于存储系统中的各种文件资源，包括音频文件、封面图片、元数据等。

## 目录结构

```
storage/
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

## 重要提示

1. **不要将这些文件添加到版本控制**
   - 目录中的 `.gitkeep` 文件仅用于保持目录结构
   - 所有实际内容都应当通过配置的存储路径访问，而不是硬编码路径

2. **路径配置**
   - 存储路径通过环境变量设置：`STORAGE_PATH`
   - 音频存储路径通过环境变量设置：`AUDIO_STORAGE_PATH`
   - 默认路径为项目根目录下的 `./storage` 和 `./data/audio`

3. **目录用途**
   - `audio/`: 存储音频文件，包括原始上传、处理后和转码后的文件
   - `covers/`: 存储课程和音轨的封面图片
   - `metadata/`: 存储音频文件的元数据信息，如波形数据、字幕等
   - `temp/`: 临时文件目录，用于处理过程中的中间文件
   - `tracks/`: 系统音轨文件存储

## 访问方法

系统通过配置对象访问这些存储路径：

```go
// 获取存储路径
storagePath := cfg.Storage.StoragePath

// 获取音频存储路径
audioPath := cfg.Audio.StoragePath

// 确保目录存在
os.MkdirAll(filepath.Join(storagePath, "temp"), 0755)
```

请确保服务器上的这些目录有适当的读写权限，以便应用程序能正常访问。 