# 环境变量说明文档

本文档详细说明语言学习音频播放器后端服务的环境变量配置项。系统使用 `.env` 文件或系统环境变量进行配置，优先读取 `.env` 文件中的配置。

## 基本使用

1. 复制 `.env.example` 文件并重命名为 `.env`
2. 根据实际环境修改配置值
3. 启动服务时会自动加载配置

**注意**: `.env` 文件包含敏感信息，不应提交到版本控制系统。

## 服务器配置

| 变量名 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| `PORT` | 服务器监听端口 | `8080` | `8080` |
| `GIN_MODE` | Gin框架运行模式 | `debug` | `debug` 或 `release` |

- `PORT`: 应用监听的端口号。在生产环境中，通常应设置为80或通过反向代理进行管理。
- `GIN_MODE`: 设置为 `release` 可禁用调试功能并提升性能，适用于生产环境。

## 安全配置

| 变量名 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| `JWT_SECRET` | JWT令牌加密密钥 | - | `your-jwt-secret-key-replace-in-production` |
| `AUDIO_SECRET_KEY` | 音频访问令牌加密密钥 | - | `your-audio-secret-key-replace-in-production` |
| `ALLOWED_DOMAINS` | 允许访问音频的域名列表 | `localhost:3000,localhost:8080` | `your-domain.com,admin.your-domain.com` |

- `JWT_SECRET`: 用于签名和验证 JWT 令牌的密钥，**必须在生产环境中更改**。
- `AUDIO_SECRET_KEY`: 用于加密音频访问令牌的密钥，**必须在生产环境中更改**。
- `ALLOWED_DOMAINS`: 防盗链设置，只允许列表中的域名访问音频资源，多个域名用逗号分隔。

## 存储路径配置

| 变量名 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| `AUDIO_FILES_PATH` | 音频文件存储路径 | `./storage/audio` | `/var/data/audio` |
| `COURSE_COVERS_PATH` | 课程封面图片存储路径 | `./storage/covers` | `/var/data/covers` |

- `AUDIO_FILES_PATH`: 存储音频文件的目录，可以使用相对路径或绝对路径。
- `COURSE_COVERS_PATH`: 存储课程封面图片的目录，可以使用相对路径或绝对路径。

## 音频处理配置

| 变量名 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| `MAX_AUDIO_SIZE` | 上传音频的最大大小（字节） | `104857600` (100MB) | `52428800` (50MB) |
| `ALLOW_TRANSCODING` | 是否允许音频转码 | `true` | `true` 或 `false` |
| `DEFAULT_AUDIO_FORMAT` | 默认音频格式 | `mp3` | `mp3`, `ogg`, `aac` |

- `MAX_AUDIO_SIZE`: 允许上传的最大音频文件大小，超过此大小的文件将被拒绝。
- `ALLOW_TRANSCODING`: 控制是否启用音频转码功能，禁用可节省服务器资源。
- `DEFAULT_AUDIO_FORMAT`: 当客户端未指定格式时使用的默认音频格式。

## 自适应流配置

| 变量名 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| `ADAPTIVE_QUALITY_ENABLED` | 是否启用自适应音质 | `true` | `true` 或 `false` |
| `ADAPTIVE_FORMATS` | 支持的自适应格式列表 | `mp3,ogg,aac` | `mp3,ogg` |
| `DEFAULT_QUALITY` | 默认音频质量 | `medium` | `high`, `medium`, `low` |

- `ADAPTIVE_QUALITY_ENABLED`: 控制是否启用根据网络带宽自动调整音频质量的功能。
- `ADAPTIVE_FORMATS`: 系统支持的自适应流格式列表，多个格式用逗号分隔。
- `DEFAULT_QUALITY`: 当自适应质量禁用或客户端未指定质量时使用的默认质量级别。

## 数据库配置

| 变量名 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| `DB_HOST` | 数据库主机地址 | `localhost` | `db.example.com` |
| `DB_PORT` | 数据库端口 | `5432` | `5432` |
| `DB_USER` | 数据库用户名 | `postgres` | `audio_user` |
| `DB_PASSWORD` | 数据库密码 | - | `secure_password` |
| `DB_NAME` | 数据库名称 | `audio_player` | `language_learning` |
| `DB_SSL_MODE` | 数据库SSL连接模式 | `disable` | `disable`, `require`, `verify-ca`, `verify-full` |

- 这些设置用于配置PostgreSQL数据库连接（尚未实现）。
- 在生产环境中，**强烈建议**使用强密码并启用SSL。

## 缓存配置

| 变量名 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| `CACHE_ENABLED` | 是否启用缓存 | `true` | `true` 或 `false` |
| `CACHE_TTL` | 缓存有效期（秒） | `3600` | `7200` |
| `WAVEFORM_CACHE_ENABLED` | 是否启用波形数据缓存 | `true` | `true` 或 `false` |

- `CACHE_ENABLED`: 控制是否启用系统缓存，可提高性能但会增加内存使用。
- `CACHE_TTL`: 缓存项目的生存时间，单位为秒，超过此时间缓存项被视为过期。
- `WAVEFORM_CACHE_ENABLED`: 特定控制波形数据缓存，因为波形数据可能较大。

## 环境变量的优先级

1. `.env` 文件中的设置
2. 系统环境变量
3. 默认值

如果同一变量在多个位置定义，将按上述优先级使用。 