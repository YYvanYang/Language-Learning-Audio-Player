# 配置指南

本文档详细说明语言学习音频播放器后端服务的配置选项。系统使用 .env 文件、环境变量以及 configs/app.yaml 配置文件进行配置，优先顺序为:

1. 环境变量
2. .env 文件
3. 配置文件
4. 默认值

## 基本使用

- 复制 .env.example 文件并重命名为 .env
- 根据实际环境修改配置值
- 启动服务时会自动加载配置

**注意**: .env 文件包含敏感信息，不应提交到版本控制系统。

## 核心配置

| 变量名 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| ENV / ENVIRONMENT | 运行环境 | development | development, production |
| SERVER_ADDRESS | 服务器监听地址 | 0.0.0.0 | 127.0.0.1 |
| PORT | 服务器监听端口 | 8080 | 8080 |

## 数据库配置

| 变量名 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| DB_HOST | 数据库主机地址 | localhost | db.example.com |
| DB_PORT | 数据库端口 | 5432 | 5432 |
| DB_USER | 数据库用户名 | - | audio_user |
| DB_PASSWORD | 数据库密码 | - | secure_password |
| DB_NAME | 数据库名称 | - | language_learning |
| DB_SSLMODE | 数据库SSL连接模式 | disable | disable, require, verify-ca |

在生产环境中，强烈建议使用强密码并启用SSL。

## 身份验证配置

| 变量名 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| JWT_SECRET | JWT令牌加密密钥 | - | your-jwt-secret-key-replace-in-production |
| JWT_EXPIRES_IN | JWT令牌有效期（小时） | 24 | 48 |

**JWT_SECRET**: 用于签名和验证 JWT 令牌的密钥，必须在生产环境中设置为强密钥。

## CORS配置

| 变量名 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| CORS_ALLOW_ORIGINS | 允许的源域名列表 | - | https://app.example.com,https://admin.example.com |

多个域名用逗号分隔，用于配置跨域资源共享策略。

## 存储配置

| 变量名 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| STORAGE_PATH | 主存储目录路径 | ./storage | /var/data/storage |
| AUDIO_STORAGE_PATH | 音频文件存储路径 | ./data/audio | /var/data/audio |
| AUDIO_WAVEFORM_PATH | 波形数据存储路径 | ./data/waveforms | /var/data/waveforms |

可以使用相对路径或绝对路径，相对路径基于应用程序运行目录。

## 音频处理配置

| 变量名 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| AUDIO_ALLOW_FORMATS | 支持的音频格式列表 | mp3,wav,ogg,flac,m4a | mp3,wav,ogg |
| AUDIO_MAX_FILE_SIZE | 上传音频的最大大小（字节） | 104857600 (100MB) | 52428800 (50MB) |
| AUDIO_TOKEN_SECRET | 音频访问令牌加密密钥 | - | your-audio-token-secret-key |
| AUDIO_TOKEN_EXPIRY | 音频令牌有效期（分钟） | 10 | 30 |

**AUDIO_TOKEN_SECRET**: 用于加密和验证音频访问令牌的密钥，必须在生产环境中更改。

**AUDIO_ALLOW_FORMATS**: 系统支持的音频格式列表，多个格式用逗号分隔。

## 配置文件示例

除了环境变量，系统还支持通过 configs/app.yaml 文件进行配置：

```yaml
# configs/app.yaml 示例

# 服务器设置
server:
  env: development
  address: 0.0.0.0
  port: 8080

# 数据库设置
database:
  host: localhost
  port: 5432
  user: audio_user
  password: secure_password
  dbname: language_learning
  sslmode: disable

# 认证设置
auth:
  jwt_secret: your-jwt-secret-key-replace-in-production
  jwt_expires_in: 24

# CORS设置
cors:
  allow_origins:
    - https://app.example.com
    - https://admin.example.com

# 存储设置
storage:
  main_path: ./storage
  audio_path: ./data/audio
  waveform_path: ./data/waveforms

# 音频处理设置
audio:
  allowed_formats:
    - mp3
    - wav
    - ogg
    - flac
    - m4a
  max_file_size: 104857600  # 100MB
  token_secret: your-audio-token-secret-key
  token_expiry: 10
```

配置文件使用YAML格式，结构清晰易读，适合存储复杂配置。配置加载优先级仍遵循前面提到的顺序，环境变量会覆盖配置文件中的值。 