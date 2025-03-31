package domain

import "time"

// AudioMetadata 音频元数据
type AudioMetadata struct {
	TrackID     string  `json:"trackId"`
	Duration    float64 `json:"duration"`
	Format      string  `json:"format"`
	SampleRate  int     `json:"sampleRate"`
	Channels    int     `json:"channels"`
	BitRate     int     `json:"bitRate"`
	FileSize    int64   `json:"fileSize"`
	WaveformURL string  `json:"waveformUrl,omitempty"`
}

// AudioToken 音频访问令牌
type AudioToken struct {
	UserID      string    `json:"userId"`
	TrackID     string    `json:"trackId"`
	Timestamp   time.Time `json:"timestamp"`
	ExpiresAt   time.Time `json:"expiresAt"`
	TokenString string    `json:"token"`
}

// AudioService 音频服务接口
type AudioService interface {
	// GenerateToken 生成音频访问令牌
	GenerateToken(userID, trackID string) (*AudioToken, error)

	// ValidateToken 验证音频访问令牌
	ValidateToken(token, trackID string) (bool, error)

	// GetAudioFilePath 获取音频文件路径
	GetAudioFilePath(trackID string) (string, error)

	// GetAudioMetadata 获取音频元数据
	GetAudioMetadata(trackID string) (*AudioMetadata, error)

	// GenerateWaveform 生成音频波形数据
	GenerateWaveform(trackID string) (string, error)
}

// GenerateTokenResponse 生成令牌响应
type GenerateTokenResponse struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expiresAt"`
}

// AudioMetadataResponse 音频元数据响应
type AudioMetadataResponse struct {
	TrackID     string  `json:"trackId"`
	Duration    float64 `json:"duration"`
	Format      string  `json:"format"`
	SampleRate  int     `json:"sampleRate"`
	Channels    int     `json:"channels"`
	BitRate     int     `json:"bitRate"`
	FileSize    int64   `json:"fileSize"`
	WaveformURL string  `json:"waveformUrl,omitempty"`
}
