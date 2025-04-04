package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
	"github.com/spf13/viper"
)

// Config 应用配置结构
type Config struct {
	Environment   string
	ServerAddress string
	Port          int
	Database      DatabaseConfig
	JWT           JWTConfig
	Storage       StorageConfig
	CORS          CORSConfig
	Audio         AudioConfig
	AudioToken    AudioTokenConfig
}

// DatabaseConfig 数据库配置
type DatabaseConfig struct {
	Host     string
	Port     int
	Username string
	Password string
	DBName   string
	SSLMode  string
}

// JWTConfig JWT配置
type JWTConfig struct {
	Secret    string
	ExpiresIn int // 小时
}

// StorageConfig 存储配置
type StorageConfig struct {
	Path string
}

// CORSConfig CORS配置
type CORSConfig struct {
	AllowOrigins []string
}

// AudioConfig 音频配置
type AudioConfig struct {
	StoragePath  string
	WaveformPath string
	AllowFormats []string
	MaxFileSize  int64 // 单位：字节
}

// AudioTokenConfig 音频令牌配置
type AudioTokenConfig struct {
	Secret        string
	ExpiryMinutes int // 分钟
}

// Load 加载配置
func Load() (*Config, error) {
	// 首先尝试加载.env文件
	_ = godotenv.Load()

	// 使用Viper加载yaml配置
	viper.SetConfigName("app")
	viper.SetConfigType("yaml")
	viper.AddConfigPath("./configs")
	viper.AutomaticEnv()

	// 设置默认值
	setDefaults()

	// 尝试读取配置文件
	if err := viper.ReadInConfig(); err != nil {
		// 如果配置文件不存在，只使用环境变量
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("读取配置文件错误: %w", err)
		}
	}

	// 从环境变量覆盖配置
	bindEnvVariables()

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("解析配置错误: %w", err)
	}

	// 直接从环境变量读取某些关键配置
	cfg = overrideFromEnv(cfg)

	return &cfg, nil
}

// 设置默认值
func setDefaults() {
	viper.SetDefault("environment", "development")
	viper.SetDefault("serverAddress", "0.0.0.0")
	viper.SetDefault("port", 8080)

	// 数据库默认值
	viper.SetDefault("database.host", "localhost")
	viper.SetDefault("database.port", 5432)
	viper.SetDefault("database.sslmode", "disable")

	// JWT默认值
	viper.SetDefault("jwt.expiresIn", 24)

	// 存储默认值
	viper.SetDefault("storage.path", "./storage")

	// 音频配置默认值
	viper.SetDefault("audio.storagePath", "./data/audio")
	viper.SetDefault("audio.waveformPath", "./data/waveforms")
	viper.SetDefault("audio.allowFormats", []string{"mp3", "wav", "ogg", "flac", "m4a"})
	viper.SetDefault("audio.maxFileSize", 100*1024*1024) // 100MB

	// 音频令牌配置默认值
	viper.SetDefault("audioToken.expiryMinutes", 10) // 10分钟
}

// 绑定环境变量
func bindEnvVariables() {
	viper.BindEnv("environment", "ENV")
	viper.BindEnv("serverAddress", "SERVER_ADDRESS")
	viper.BindEnv("port", "PORT")

	// 数据库环境变量
	viper.BindEnv("database.host", "DB_HOST")
	viper.BindEnv("database.port", "DB_PORT")
	viper.BindEnv("database.username", "DB_USER")
	viper.BindEnv("database.password", "DB_PASSWORD")
	viper.BindEnv("database.dbname", "DB_NAME")
	viper.BindEnv("database.sslmode", "DB_SSLMODE")

	// JWT环境变量
	viper.BindEnv("jwt.secret", "JWT_SECRET")
	viper.BindEnv("jwt.expiresIn", "JWT_EXPIRES_IN")

	// 存储环境变量
	viper.BindEnv("storage.path", "STORAGE_PATH")

	// CORS环境变量
	viper.BindEnv("cors.allowOrigins", "CORS_ALLOW_ORIGINS")

	// 音频配置环境变量
	viper.BindEnv("audio.storagePath", "AUDIO_STORAGE_PATH")
	viper.BindEnv("audio.waveformPath", "AUDIO_WAVEFORM_PATH")
	viper.BindEnv("audio.allowFormats", "AUDIO_ALLOW_FORMATS")
	viper.BindEnv("audio.maxFileSize", "AUDIO_MAX_FILE_SIZE")

	// 音频令牌配置环境变量
	viper.BindEnv("audioToken.secret", "AUDIO_TOKEN_SECRET")
	viper.BindEnv("audioToken.expiryMinutes", "AUDIO_TOKEN_EXPIRY")
}

// 直接从环境变量中覆盖某些配置
func overrideFromEnv(cfg Config) Config {
	// 环境变量可能存在但viper未正确绑定的情况，手动处理
	if port, err := strconv.Atoi(os.Getenv("PORT")); err == nil && port > 0 {
		cfg.Port = port
	}

	if dbPort, err := strconv.Atoi(os.Getenv("DB_PORT")); err == nil && dbPort > 0 {
		cfg.Database.Port = dbPort
	}

	if jwtExpires, err := strconv.Atoi(os.Getenv("JWT_EXPIRES_IN")); err == nil && jwtExpires > 0 {
		cfg.JWT.ExpiresIn = jwtExpires
	}

	// 处理CORS允许的源
	if origins := os.Getenv("CORS_ALLOW_ORIGINS"); origins != "" {
		cfg.CORS.AllowOrigins = strings.Split(origins, ",")
	}

	// JWT密钥是安全关键，确保直接从环境变量读取
	if secret := os.Getenv("JWT_SECRET"); secret != "" {
		cfg.JWT.Secret = secret
	}

	// 音频配置
	if path := os.Getenv("AUDIO_STORAGE_PATH"); path != "" {
		cfg.Audio.StoragePath = path
	}

	if path := os.Getenv("AUDIO_WAVEFORM_PATH"); path != "" {
		cfg.Audio.WaveformPath = path
	}

	if formats := os.Getenv("AUDIO_ALLOW_FORMATS"); formats != "" {
		cfg.Audio.AllowFormats = strings.Split(formats, ",")
	}

	if size := os.Getenv("AUDIO_MAX_FILE_SIZE"); size != "" {
		if maxSize, err := strconv.ParseInt(size, 10, 64); err == nil && maxSize > 0 {
			cfg.Audio.MaxFileSize = maxSize
		}
	}

	// 音频令牌配置
	if secret := os.Getenv("AUDIO_TOKEN_SECRET"); secret != "" {
		cfg.AudioToken.Secret = secret
	}

	if expiry := os.Getenv("AUDIO_TOKEN_EXPIRY"); expiry != "" {
		if minutes, err := strconv.Atoi(expiry); err == nil && minutes > 0 {
			cfg.AudioToken.ExpiryMinutes = minutes
		}
	}

	return cfg
}
