package logger

import (
	"os"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var (
	// Log 全局日志实例
	Log *zap.Logger
)

// Init 初始化日志
func Init(env string) {
	// 配置编码器
	var config zap.Config

	if env == "production" {
		// 生产环境 - 使用JSON格式，只记录Info级别以上
		config = zap.NewProductionConfig()
		config.EncoderConfig.TimeKey = "timestamp"
		config.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
	} else {
		// 开发环境 - 使用控制台格式，记录Debug级别以上
		config = zap.NewDevelopmentConfig()
		config.EncoderConfig.TimeKey = "timestamp"
		config.EncoderConfig.EncodeTime = zapcore.TimeEncoderOfLayout(time.RFC3339)
		config.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
	}

	// 创建日志实例
	var err error
	Log, err = config.Build(zap.AddCaller(), zap.AddCallerSkip(1))
	if err != nil {
		panic(err)
	}

	Info("日志初始化成功", zap.String("env", env))
}

// 便捷的日志记录函数

// Debug 记录调试信息
func Debug(msg string, fields ...zap.Field) {
	if Log == nil {
		defaultLogger()
	}
	Log.Debug(msg, fields...)
}

// Info 记录信息
func Info(msg string, fields ...zap.Field) {
	if Log == nil {
		defaultLogger()
	}
	Log.Info(msg, fields...)
}

// Warn 记录警告
func Warn(msg string, fields ...zap.Field) {
	if Log == nil {
		defaultLogger()
	}
	Log.Warn(msg, fields...)
}

// Error 记录错误
func Error(msg string, fields ...zap.Field) {
	if Log == nil {
		defaultLogger()
	}
	Log.Error(msg, fields...)
}

// Fatal 记录致命错误并退出程序
func Fatal(msg string, fields ...zap.Field) {
	if Log == nil {
		defaultLogger()
	}
	Log.Fatal(msg, fields...)
}

// WithField 添加字段
func WithField(key string, value interface{}) *zap.Logger {
	if Log == nil {
		defaultLogger()
	}
	return Log.With(zap.Any(key, value))
}

// Sync 同步日志
func Sync() {
	if Log != nil {
		_ = Log.Sync()
	}
}

// defaultLogger 创建默认的开发环境日志记录器
func defaultLogger() {
	config := zap.NewDevelopmentConfig()
	config.EncoderConfig.TimeKey = "timestamp"
	config.EncoderConfig.EncodeTime = zapcore.TimeEncoderOfLayout(time.RFC3339)
	config.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder

	logger, err := config.Build(zap.AddCaller(), zap.AddCallerSkip(1))
	if err != nil {
		// 如果连日志都无法初始化，则直接输出到标准错误并退出
		os.Stderr.WriteString("无法创建默认日志记录器: " + err.Error() + "\n")
		os.Exit(1)
	}

	Log = logger
	Warn("使用默认日志记录器，请先调用 logger.Init()")
}
