package handler

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"language-learning/internal/domain"
	"language-learning/internal/utils/logger"

	"go.uber.org/zap"
)

// AudioHandler 音频请求处理器
type AudioHandler struct {
	audioService domain.AudioService
}

// NewAudioHandler 创建音频处理器实例
func NewAudioHandler(audioService domain.AudioService) *AudioHandler {
	return &AudioHandler{
		audioService: audioService,
	}
}

// GetAudioToken 获取音频访问令牌
func (h *AudioHandler) GetAudioToken(c *gin.Context) {
	trackID := c.Param("trackId")
	if trackID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "缺少音轨ID",
		})
		return
	}

	// 获取当前用户ID
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "未认证",
		})
		return
	}

	// 生成令牌
	token, err := h.audioService.GenerateToken(userID.(string), trackID)
	if err != nil {
		logger.Error("生成音频令牌失败", zap.String("trackID", trackID), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "生成音频令牌失败",
		})
		return
	}

	// 返回令牌
	c.JSON(http.StatusOK, domain.GenerateTokenResponse{
		Token:     token.TokenString,
		ExpiresAt: token.ExpiresAt,
	})
}

// StreamAudio 流式传输音频
func (h *AudioHandler) StreamAudio(c *gin.Context) {
	trackID := c.Param("trackId")
	token := c.Query("token")

	// 检查参数
	if trackID == "" || token == "" {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
			"error": "缺少必要参数",
		})
		return
	}

	// 验证令牌
	valid, err := h.audioService.ValidateToken(token, trackID)
	if !valid || err != nil {
		logger.Warn("音频访问令牌验证失败", zap.String("trackID", trackID), zap.Error(err))
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	// 获取音频文件路径
	filePath, err := h.audioService.GetAudioFilePath(trackID)
	if err != nil {
		logger.Error("获取音频文件路径失败", zap.String("trackID", trackID), zap.Error(err))
		c.AbortWithStatus(http.StatusNotFound)
		return
	}

	// 获取文件信息
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		logger.Error("获取文件信息失败", zap.String("path", filePath), zap.Error(err))
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}

	// 处理文件类型
	ext := strings.ToLower(filepath.Ext(filePath))
	var contentType string
	switch ext {
	case ".mp3":
		contentType = "audio/mpeg"
	case ".wav":
		contentType = "audio/wav"
	case ".ogg":
		contentType = "audio/ogg"
	case ".flac":
		contentType = "audio/flac"
	case ".m4a":
		contentType = "audio/mp4"
	default:
		contentType = "application/octet-stream"
	}

	// 打开文件
	file, err := os.Open(filePath)
	if err != nil {
		logger.Error("打开音频文件失败", zap.String("path", filePath), zap.Error(err))
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	defer file.Close()

	// 设置响应头
	c.Header("Content-Type", contentType)
	c.Header("Accept-Ranges", "bytes")
	c.Header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
	c.Header("Pragma", "no-cache")
	c.Header("Content-Disposition", "inline")

	// 检查是否为范围请求
	rangeHeader := c.Request.Header.Get("Range")
	if rangeHeader != "" {
		// 解析范围请求
		ranges, err := parseRange(rangeHeader, fileInfo.Size())
		if err != nil {
			logger.Error("解析范围请求失败", zap.String("range", rangeHeader), zap.Error(err))
			c.AbortWithStatus(http.StatusRequestedRangeNotSatisfiable)
			return
		}

		// 单一范围请求处理
		if len(ranges) == 1 {
			r := ranges[0]

			// 检查范围是否有效
			if r.Start >= fileInfo.Size() || r.End >= fileInfo.Size() {
				c.Header("Content-Range", fmt.Sprintf("bytes */%d", fileInfo.Size()))
				c.AbortWithStatus(http.StatusRequestedRangeNotSatisfiable)
				return
			}

			// 设置响应状态和头
			c.Status(http.StatusPartialContent)
			c.Header("Content-Range", fmt.Sprintf("bytes %d-%d/%d", r.Start, r.End, fileInfo.Size()))
			c.Header("Content-Length", fmt.Sprintf("%d", r.End-r.Start+1))

			// 设置文件偏移
			_, err = file.Seek(r.Start, 0)
			if err != nil {
				logger.Error("设置文件偏移失败", zap.Error(err))
				c.AbortWithStatus(http.StatusInternalServerError)
				return
			}

			// 流式传输指定范围
			_, err = io.CopyN(c.Writer, file, r.End-r.Start+1)
			if err != nil && err != io.EOF {
				logger.Error("流式传输范围内容失败", zap.Error(err))
			}
			return
		}

		// 多范围请求暂不支持
		logger.Warn("不支持多范围请求", zap.String("trackID", trackID))
	}

	// 非范围请求，流式传输整个文件
	c.Header("Content-Length", fmt.Sprintf("%d", fileInfo.Size()))
	_, err = io.Copy(c.Writer, file)
	if err != nil {
		logger.Error("流式传输音频文件失败", zap.String("trackID", trackID), zap.Error(err))
	}
}

// GetAudioMetadata 获取音频元数据
func (h *AudioHandler) GetAudioMetadata(c *gin.Context) {
	trackID := c.Param("trackId")
	if trackID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "缺少音轨ID",
		})
		return
	}

	// 获取元数据
	metadata, err := h.audioService.GetAudioMetadata(trackID)
	if err != nil {
		logger.Error("获取音频元数据失败", zap.String("trackID", trackID), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "获取音频元数据失败",
		})
		return
	}

	// 返回元数据
	c.JSON(http.StatusOK, domain.AudioMetadataResponse{
		TrackID:     metadata.TrackID,
		Duration:    metadata.Duration,
		Format:      metadata.Format,
		SampleRate:  metadata.SampleRate,
		Channels:    metadata.Channels,
		BitRate:     metadata.BitRate,
		FileSize:    metadata.FileSize,
		WaveformURL: metadata.WaveformURL,
	})
}

// GetWaveform 获取音频波形数据
func (h *AudioHandler) GetWaveform(c *gin.Context) {
	trackID := c.Param("trackId")
	if trackID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "缺少音轨ID",
		})
		return
	}

	// 获取波形数据URL
	waveformURL, err := h.audioService.GenerateWaveform(trackID)
	if err != nil {
		logger.Error("生成波形数据失败", zap.String("trackID", trackID), zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "生成波形数据失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"waveformUrl": waveformURL,
	})
}

// RegisterRoutes 注册路由
func (h *AudioHandler) RegisterRoutes(router *gin.Engine, apiGroup *gin.RouterGroup, authMiddleware gin.HandlerFunc) {
	// 获取令牌路由 - 需要认证
	audioTokenGroup := apiGroup.Group("/audio/token")
	audioTokenGroup.Use(authMiddleware)
	audioTokenGroup.GET("/:trackId", h.GetAudioToken)

	// 音频元数据路由 - 需要认证
	audioMetadataGroup := apiGroup.Group("/audio/metadata")
	audioMetadataGroup.Use(authMiddleware)
	audioMetadataGroup.GET("/:trackId", h.GetAudioMetadata)

	// 波形数据路由 - 不需要认证但需要限制访问
	router.GET("/api/v1/audio/waveform/:trackId", h.GetWaveform)

	// 音频流路由 - 使用令牌验证
	// 注意这里使用根路由器以避免认证中间件
	router.GET("/api/v1/audio/stream/:trackId", h.StreamAudio)
}

// 定义范围类型
type httpRange struct {
	Start, End int64
}

// 解析HTTP Range头
func parseRange(rangeHeader string, size int64) ([]httpRange, error) {
	if !strings.HasPrefix(rangeHeader, "bytes=") {
		return nil, fmt.Errorf("无效的Range格式: %s", rangeHeader)
	}

	// 去除前缀并分割
	rangesStr := strings.TrimPrefix(rangeHeader, "bytes=")
	ranges := strings.Split(rangesStr, ",")
	parsedRanges := make([]httpRange, 0, len(ranges))

	for _, r := range ranges {
		r = strings.TrimSpace(r)
		if r == "" {
			continue
		}

		i := strings.IndexByte(r, '-')
		if i < 0 {
			return nil, fmt.Errorf("无效的Range格式: %s", r)
		}

		start, end := strings.TrimSpace(r[:i]), strings.TrimSpace(r[i+1:])
		var startByte, endByte int64

		if start == "" {
			// -N 表示最后N个字节
			endByteVal, err := strconv.ParseInt(end, 10, 64)
			if err != nil {
				return nil, fmt.Errorf("无效的Range格式: %s", r)
			}
			if endByteVal > size {
				endByteVal = size
			}
			startByte = size - endByteVal
			endByte = size - 1
		} else {
			startByteVal, err := strconv.ParseInt(start, 10, 64)
			if err != nil {
				return nil, fmt.Errorf("无效的Range格式: %s", r)
			}
			startByte = startByteVal

			if end == "" {
				// N- 表示从第N个字节到结束
				endByte = size - 1
			} else {
				// N-M 表示从第N个字节到第M个字节
				endByteVal, err := strconv.ParseInt(end, 10, 64)
				if err != nil {
					return nil, fmt.Errorf("无效的Range格式: %s", r)
				}
				endByte = endByteVal
			}
		}

		// 验证范围
		if startByte > endByte || startByte < 0 || endByte >= size {
			// 调整范围到有效值
			if startByte < 0 {
				startByte = 0
			}
			if endByte >= size {
				endByte = size - 1
			}
			if startByte > endByte {
				continue
			}
		}

		parsedRanges = append(parsedRanges, httpRange{Start: startByte, End: endByte})
	}

	if len(parsedRanges) == 0 {
		return nil, fmt.Errorf("无效的Range格式: %s", rangeHeader)
	}

	return parsedRanges, nil
}
