package service

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"language-learning/internal/config"
	"language-learning/internal/domain"
	"language-learning/internal/utils/logger"

	"go.uber.org/zap"
)

// AudioService 音频服务实现
type AudioService struct {
	cfg              *config.Config
	tokenSecret      []byte
	audioStoragePath string
	waveformPath     string
}

// NewAudioService 创建音频服务实例
func NewAudioService(cfg *config.Config) *AudioService {
	// 计算令牌密钥
	secret := cfg.AudioToken.Secret
	if secret == "" {
		secret = "default_audio_token_secret_key_must_change_in_production"
		logger.Warn("使用默认音频令牌密钥，建议在生产环境中更改")
	}

	// 使用 SHA-256 哈希密钥，确保长度为 32 字节 (256 位)
	hasher := sha256.New()
	hasher.Write([]byte(secret))
	tokenSecret := hasher.Sum(nil)

	// 构建存储路径
	audioStoragePath := cfg.Audio.StoragePath
	if audioStoragePath == "" {
		audioStoragePath = "./data/audio"
		logger.Warn("使用默认音频存储路径", zap.String("path", audioStoragePath))
	}

	// 波形图存储路径
	waveformPath := cfg.Audio.WaveformPath
	if waveformPath == "" {
		waveformPath = "./data/waveforms"
		logger.Warn("使用默认波形图存储路径", zap.String("path", waveformPath))
	}

	// 确保目录存在
	os.MkdirAll(audioStoragePath, 0755)
	os.MkdirAll(waveformPath, 0755)

	return &AudioService{
		cfg:              cfg,
		tokenSecret:      tokenSecret,
		audioStoragePath: audioStoragePath,
		waveformPath:     waveformPath,
	}
}

// GenerateToken 生成音频访问令牌
func (s *AudioService) GenerateToken(userID, trackID string) (*domain.AudioToken, error) {
	logger.Debug("生成音频访问令牌", zap.String("userID", userID), zap.String("trackID", trackID))

	// 创建令牌
	now := time.Now()
	expiresAt := now.Add(time.Duration(s.cfg.AudioToken.ExpiryMinutes) * time.Minute)

	// 令牌数据
	tokenData := domain.AudioToken{
		UserID:    userID,
		TrackID:   trackID,
		Timestamp: now,
		ExpiresAt: expiresAt,
	}

	// 转换为JSON
	tokenJSON, err := json.Marshal(tokenData)
	if err != nil {
		logger.Error("令牌序列化失败", zap.Error(err))
		return nil, fmt.Errorf("令牌序列化失败: %w", err)
	}

	// 加密令牌
	encryptedToken, err := s.encryptData(tokenJSON)
	if err != nil {
		logger.Error("令牌加密失败", zap.Error(err))
		return nil, fmt.Errorf("令牌加密失败: %w", err)
	}

	// Base64编码
	tokenString := base64.URLEncoding.EncodeToString(encryptedToken)
	tokenData.TokenString = tokenString

	logger.Debug("令牌生成成功", zap.String("trackID", trackID), zap.Time("expiresAt", expiresAt))
	return &tokenData, nil
}

// ValidateToken 验证音频访问令牌
func (s *AudioService) ValidateToken(tokenString, trackID string) (bool, error) {
	logger.Debug("验证音频访问令牌", zap.String("trackID", trackID))

	// Base64解码
	encryptedToken, err := base64.URLEncoding.DecodeString(tokenString)
	if err != nil {
		logger.Warn("令牌Base64解码失败", zap.Error(err))
		return false, fmt.Errorf("无效的令牌格式: %w", err)
	}

	// 解密令牌
	tokenJSON, err := s.decryptData(encryptedToken)
	if err != nil {
		logger.Warn("令牌解密失败", zap.Error(err))
		return false, fmt.Errorf("令牌解密失败: %w", err)
	}

	// 解析令牌
	var token domain.AudioToken
	if err := json.Unmarshal(tokenJSON, &token); err != nil {
		logger.Warn("令牌解析失败", zap.Error(err))
		return false, fmt.Errorf("令牌解析失败: %w", err)
	}

	// 验证令牌是否过期
	if time.Now().After(token.ExpiresAt) {
		logger.Warn("令牌已过期", zap.Time("expiresAt", token.ExpiresAt))
		return false, fmt.Errorf("令牌已过期")
	}

	// 验证音轨ID
	if token.TrackID != trackID {
		logger.Warn("令牌与音轨不匹配",
			zap.String("tokenTrackID", token.TrackID),
			zap.String("requestTrackID", trackID))
		return false, fmt.Errorf("令牌与音轨不匹配")
	}

	logger.Debug("令牌验证成功", zap.String("trackID", trackID))
	return true, nil
}

// GetAudioFilePath 获取音频文件路径
func (s *AudioService) GetAudioFilePath(trackID string) (string, error) {
	logger.Debug("获取音频文件路径", zap.String("trackID", trackID))

	// 通过trackID查找文件
	// 通常这里需要从数据库查询音轨信息获取真实路径
	// 这里为了简化，直接构建路径
	basePath := s.audioStoragePath
	potentialPaths := []string{
		filepath.Join(basePath, trackID+".mp3"),
		filepath.Join(basePath, trackID+".wav"),
		filepath.Join(basePath, trackID+".ogg"),
		filepath.Join(basePath, trackID+".flac"),
		filepath.Join(basePath, trackID+".m4a"),
	}

	// 检查文件是否存在
	for _, path := range potentialPaths {
		if _, err := os.Stat(path); err == nil {
			logger.Debug("找到音频文件", zap.String("path", path))
			return path, nil
		}
	}

	// 子目录中查找
	files, err := filepath.Glob(filepath.Join(basePath, "*", trackID+".*"))
	if err == nil && len(files) > 0 {
		logger.Debug("在子目录中找到音频文件", zap.String("path", files[0]))
		return files[0], nil
	}

	logger.Warn("未找到音频文件", zap.String("trackID", trackID))
	return "", fmt.Errorf("未找到音频文件: %s", trackID)
}

// GetAudioMetadata 获取音频元数据
func (s *AudioService) GetAudioMetadata(trackID string) (*domain.AudioMetadata, error) {
	logger.Debug("获取音频元数据", zap.String("trackID", trackID))

	// 获取文件路径
	filePath, err := s.GetAudioFilePath(trackID)
	if err != nil {
		return nil, err
	}

	// 获取文件信息
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		logger.Error("获取文件信息失败", zap.String("path", filePath), zap.Error(err))
		return nil, fmt.Errorf("获取文件信息失败: %w", err)
	}

	// 获取文件扩展名
	ext := strings.ToLower(filepath.Ext(filePath))
	if ext != "" && ext[0] == '.' {
		ext = ext[1:]
	}

	// 构建基本元数据
	// 注意：完整实现应该使用ffmpeg或类似工具分析音频文件
	metadata := &domain.AudioMetadata{
		TrackID:  trackID,
		Format:   ext,
		FileSize: fileInfo.Size(),
		// 获取波形图URL
		WaveformURL: s.getWaveformURL(trackID),
	}

	// TODO: 使用音频处理库（如ffmpeg）获取更详细的音频元数据
	// 这里简化处理，使用预设值
	metadata.Duration = 0
	metadata.SampleRate = 0
	metadata.Channels = 0
	metadata.BitRate = 0

	logger.Debug("获取音频元数据成功", zap.String("trackID", trackID))
	return metadata, nil
}

// GenerateWaveform 生成音频波形数据
func (s *AudioService) GenerateWaveform(trackID string) (string, error) {
	logger.Debug("生成音频波形数据", zap.String("trackID", trackID))

	// 获取波形图路径
	waveformPath := filepath.Join(s.waveformPath, trackID+".json")

	// 检查是否已存在
	if _, err := os.Stat(waveformPath); err == nil {
		logger.Debug("波形图已存在", zap.String("path", waveformPath))
		return s.getWaveformURL(trackID), nil
	}

	// 获取音频文件路径
	audioPath, err := s.GetAudioFilePath(trackID)
	if err != nil {
		return "", err
	}

	// TODO: 使用音频处理库生成波形数据
	// 这里简化处理，生成空波形数据
	waveformData := []float64{0, 0, 0, 0, 0, 0, 0, 0, 0, 0}
	waveformJSON, err := json.Marshal(waveformData)
	if err != nil {
		logger.Error("波形数据序列化失败", zap.Error(err))
		return "", fmt.Errorf("波形数据序列化失败: %w", err)
	}

	// 保存波形数据
	if err := os.WriteFile(waveformPath, waveformJSON, 0644); err != nil {
		logger.Error("保存波形数据失败", zap.String("path", waveformPath), zap.Error(err))
		return "", fmt.Errorf("保存波形数据失败: %w", err)
	}

	logger.Info("波形图生成成功", zap.String("trackID", trackID), zap.String("audioPath", audioPath))
	return s.getWaveformURL(trackID), nil
}

// 辅助方法: 加密数据
func (s *AudioService) encryptData(data []byte) ([]byte, error) {
	// 创建加密块
	block, err := aes.NewCipher(s.tokenSecret)
	if err != nil {
		return nil, err
	}

	// 创建GCM
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	// 随机数
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}

	// 加密
	ciphertext := gcm.Seal(nonce, nonce, data, nil)
	return ciphertext, nil
}

// 辅助方法: 解密数据
func (s *AudioService) decryptData(data []byte) ([]byte, error) {
	// 创建加密块
	block, err := aes.NewCipher(s.tokenSecret)
	if err != nil {
		return nil, err
	}

	// 创建GCM
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	// 检查数据长度
	if len(data) < gcm.NonceSize() {
		return nil, fmt.Errorf("密文太短")
	}

	// 提取随机数
	nonce, ciphertext := data[:gcm.NonceSize()], data[gcm.NonceSize():]

	// 解密
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, err
	}

	return plaintext, nil
}

// 辅助方法: 获取波形图URL
func (s *AudioService) getWaveformURL(trackID string) string {
	return fmt.Sprintf("/api/v1/audio/waveform/%s", trackID)
}
