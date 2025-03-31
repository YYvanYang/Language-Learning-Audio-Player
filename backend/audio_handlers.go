// audio_handlers.go
package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/YYvanYang/Language-Learning-Audio-Player/backend/database"
	"github.com/gin-gonic/gin"
)

// 简化的令牌请求结构
type StreamTokenRequest struct {
	Token string `json:"token" binding:"required"`
}

// 音频令牌请求结构
type AudioTokenRequest struct {
	CourseID string `json:"courseId" binding:"required"`
	UnitID   string `json:"unitId" binding:"required"`
	TrackID  string `json:"trackId" binding:"required"`
	Action   string `json:"action" binding:"required,oneof=stream_audio get_metadata"`
}

// 音频元数据响应结构
type AudioMetadata struct {
	TrackID        string                 `json:"trackId"`
	Title          string                 `json:"title"`
	Artist         string                 `json:"artist,omitempty"`
	Duration       float64                `json:"duration"`
	Format         string                 `json:"format"`
	BitRate        int                    `json:"bitRate,omitempty"`
	SampleRate     int                    `json:"sampleRate,omitempty"`
	Channels       int                    `json:"channels,omitempty"`
	WaveformData   []float32              `json:"waveformData,omitempty"`
	SpectralData   []float32              `json:"spectralData,omitempty"`
	Bookmarks      []AudioBookmark        `json:"bookmarks,omitempty"`
	TranscriptData *AudioTranscript       `json:"transcriptData,omitempty"`
	CustomData     map[string]interface{} `json:"customData,omitempty"`
}

// 音频书签结构
type AudioBookmark struct {
	ID        string  `json:"id"`
	TimePoint float64 `json:"timePoint"`
	Label     string  `json:"label"`
	Color     string  `json:"color,omitempty"`
	Notes     string  `json:"notes,omitempty"`
}

// 音频字幕/转录结构
type AudioTranscript struct {
	Language string              `json:"language"`
	Segments []TranscriptSegment `json:"segments"`
}

// 字幕片段
type TranscriptSegment struct {
	StartTime float64 `json:"startTime"`
	EndTime   float64 `json:"endTime"`
	Text      string  `json:"text"`
}

// 随机字符串生成
func generateRandomString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, length)
	for i := range b {
		b[i] = charset[rand.Intn(len(charset))]
	}
	return string(b)
}

// 获取音频访问令牌处理函数
// @Summary 获取音频访问令牌
// @Description 生成用于访问音频资源的临时令牌
// @Tags audio
// @Accept json
// @Produce json
// @Param trackId path string true "音轨ID"
// @Param request body AudioTokenRequest true "令牌请求"
// @Success 200 {object} AudioTokenResponse "令牌响应"
// @Failure 400 {object} ErrorResponse "请求无效"
// @Failure 401 {object} ErrorResponse "未授权访问"
// @Failure 403 {object} ErrorResponse "访问被拒绝"
// @Failure 404 {object} ErrorResponse "音频文件不存在"
// @Router /api/audio/token/{trackId} [get]
// @Security BearerAuth
func getAudioTokenHandler(c *gin.Context) {
	// 获取参数
	trackID := c.Param("trackId")
	if trackID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少音轨ID"})
		return
	}

	// 获取请求体参数
	var req AudioTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的请求格式"})
		return
	}

	// 验证参数一致性
	if req.TrackID != trackID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数不一致"})
		return
	}

	// 获取当前已验证的用户ID
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权的访问"})
		return
	}

	// 验证用户是否有权访问此课程
	hasAccess, err := userHasAccessToCourse(userID.(string), req.CourseID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "验证用户权限失败"})
		return
	}

	if !hasAccess {
		c.JSON(http.StatusForbidden, gin.H{"error": "您没有权限访问此课程"})
		return
	}

	// 验证音轨是否存在
	audioPath, err := getAudioFilePath(req.CourseID, req.UnitID, req.TrackID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "音频文件不存在"})
		return
	}

	// 验证文件是否存在并可读
	if _, err := os.Stat(audioPath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "音频文件不存在"})
		return
	}

	// 创建令牌
	currentTime := time.Now()
	expirationTime := currentTime.Add(5 * time.Minute) // 令牌有效期5分钟

	token := AudioAccessToken{
		CourseID:   req.CourseID,
		UnitID:     req.UnitID,
		TrackID:    req.TrackID,
		UserID:     userID.(string),
		Action:     req.Action,
		Timestamp:  currentTime.Unix(),
		Nonce:      generateRandomString(16),
		Expiration: expirationTime.Unix(),
	}

	// 加密令牌
	encryptedToken, err := CreateAccessToken(token, getAudioSecretKey())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "生成令牌失败"})
		return
	}

	// 返回令牌
	c.JSON(http.StatusOK, gin.H{
		"token":     encryptedToken,
		"expiresAt": expirationTime.Unix(),
	})
}

// 简化的音频流处理函数 - 支持单一质量音频文件
// @Summary 获取音频流
// @Description 流式传输音频内容，支持范围请求
// @Tags audio
// @Accept json
// @Produce octet-stream
// @Param trackId path string true "音轨ID"
// @Param token query string true "访问令牌"
// @Param Range header string false "范围请求头"
// @Success 200 {file} binary "音频文件"
// @Success 206 {file} binary "部分内容(范围请求)"
// @Failure 400 {object} ErrorResponse "请求无效"
// @Failure 401 {object} ErrorResponse "未授权访问"
// @Failure 403 {object} ErrorResponse "访问被拒绝"
// @Failure 404 {object} ErrorResponse "音频文件不存在"
// @Router /api/audio/stream/{trackId} [get]
func streamAudioHandler(c *gin.Context) {
	// 获取音轨ID
	trackID := c.Param("trackId")
	if trackID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少音轨ID"})
		return
	}

	// 获取令牌参数
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "缺少访问令牌"})
		return
	}

	// 解析和验证令牌
	accessToken, err := ParseAccessToken(token, getAudioSecretKey())
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "无效的访问令牌"})
		return
	}

	// 验证令牌操作类型和有效期
	if err := accessToken.Validate("stream_audio"); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	// 验证令牌中的音轨ID与请求的音轨ID是否匹配
	if accessToken.TrackID != trackID {
		c.JSON(http.StatusForbidden, gin.H{"error": "令牌与请求不匹配"})
		return
	}

	// 验证来源域名（防盗链）
	referer := c.Request.Header.Get("Referer")
	if referer != "" {
		// 实际环境中应从配置读取允许的域名列表
		allowedDomains := strings.Split(getEnv("ALLOWED_DOMAINS", "localhost:3000,localhost:8080"), ",")
		refererValid := false

		for _, domain := range allowedDomains {
			if strings.Contains(referer, strings.TrimSpace(domain)) {
				refererValid = true
				break
			}
		}

		if !refererValid {
			c.JSON(http.StatusForbidden, gin.H{"error": "非法的资源访问来源"})
			return
		}
	}

	// 构建音频文件路径 - 支持系统音频和用户上传的音频
	audioPath, err := getAudioFilePath(accessToken.CourseID, accessToken.UnitID, accessToken.TrackID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "音频文件不存在"})
		return
	}

	// 打开音频文件
	audioFile, err := os.Open(audioPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法读取音频文件"})
		return
	}
	defer audioFile.Close()

	// 获取文件状态
	fileInfo, err := audioFile.Stat()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法获取文件信息"})
		return
	}

	// 设置内容类型
	contentType := getContentType(audioPath)
	c.Header("Content-Type", contentType)

	// 设置安全相关的响应头
	c.Header("Accept-Ranges", "bytes")
	c.Header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
	c.Header("Pragma", "no-cache")
	c.Header("Expires", "0")
	c.Header("Content-Disposition", "inline")
	c.Header("X-Content-Type-Options", "nosniff")

	// 记录访问日志
	logAudioAccess(accessToken.UserID, accessToken.TrackID, c.ClientIP())

	// 处理范围请求（如果有）
	rangeHeader := c.Request.Header.Get("Range")
	if rangeHeader != "" {
		// 解析范围请求
		ranges, err := parseRange(rangeHeader, fileInfo.Size())
		if err != nil {
			c.Header("Content-Range", fmt.Sprintf("bytes */%d", fileInfo.Size()))
			c.JSON(http.StatusRequestedRangeNotSatisfiable, gin.H{"error": "请求范围无效"})
			return
		}

		// 目前只支持单范围请求
		if len(ranges) > 1 {
			c.Header("Content-Range", fmt.Sprintf("bytes */%d", fileInfo.Size()))
			c.JSON(http.StatusRequestedRangeNotSatisfiable, gin.H{"error": "不支持多范围请求"})
			return
		}

		// 设置内容范围头
		c.Header("Content-Range", fmt.Sprintf("bytes %d-%d/%d", ranges[0].Start, ranges[0].End, fileInfo.Size()))
		c.Header("Content-Length", strconv.FormatInt(ranges[0].Length, 10))
		c.Status(http.StatusPartialContent)

		// 移动到范围起始位置
		_, err = audioFile.Seek(ranges[0].Start, io.SeekStart)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "无法设置文件位置"})
			return
		}

		// 创建一个缓冲区进行高效传输
		buffer := make([]byte, 4096) // 4KB缓冲区
		bytesRemaining := ranges[0].Length

		for bytesRemaining > 0 {
			readSize := int64(len(buffer))
			if bytesRemaining < readSize {
				readSize = bytesRemaining
			}

			n, err := audioFile.Read(buffer[:readSize])
			if err != nil && err != io.EOF {
				// 记录错误但不中断流传输
				log.Printf("读取文件错误: %v", err)
				break
			}

			if n == 0 {
				break // 文件结束
			}

			_, err = c.Writer.Write(buffer[:n])
			if err != nil {
				// 客户端可能断开连接
				log.Printf("写入响应错误: %v", err)
				break
			}

			bytesRemaining -= int64(n)
		}
	} else {
		// 流式传输整个文件
		c.Header("Content-Length", strconv.FormatInt(fileInfo.Size(), 10))

		// 使用自定义的方式流式传输，以便更好的控制和监控
		buffer := make([]byte, 8192) // 8KB缓冲区
		bytesTotal := fileInfo.Size()
		bytesSent := int64(0)

		for bytesSent < bytesTotal {
			n, err := audioFile.Read(buffer)
			if err != nil && err != io.EOF {
				log.Printf("读取文件错误: %v", err)
				break
			}

			if n == 0 {
				break // 文件结束
			}

			_, err = c.Writer.Write(buffer[:n])
			if err != nil {
				log.Printf("写入响应错误: %v", err)
				break
			}

			bytesSent += int64(n)

			// 防止带宽过载，增加一个微小延迟（可选）
			// time.Sleep(time.Microsecond * 100)
		}
	}
}

// 记录音频访问日志
func logAudioAccess(userID, trackID, clientIP string) {
	// 在实际产品中，应将日志写入数据库或日志文件
	// 简化实现，仅打印到控制台
	log.Printf("音频访问: 用户ID=%s, 音轨ID=%s, IP=%s, 时间=%s",
		userID, trackID, clientIP, time.Now().Format(time.RFC3339))
}

// 音轨列表请求
type TracksRequest struct {
	Token string `json:"token" binding:"required"`
}

// 获取课程音轨列表
func getTracksHandler(c *gin.Context) {
	var req TracksRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的请求格式"})
		return
	}

	// 获取当前已验证的用户ID
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权的访问"})
		return
	}

	// 解析和验证令牌
	token, err := ParseAccessToken(req.Token, getAudioSecretKey())
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "无效的访问令牌"})
		return
	}

	// 验证令牌操作类型和有效期
	if err := token.Validate("get_tracks"); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	// 验证用户身份
	if token.UserID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "访问被拒绝"})
		return
	}

	// 获取系统音轨列表
	systemTracks, err := getSystemTracks(token.CourseID, token.UnitID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取系统音轨失败"})
		return
	}

	// 获取自定义音轨列表
	customTracks, err := getUserCustomTracks(userID.(string), token.CourseID, token.UnitID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取自定义音轨失败"})
		return
	}

	// 合并音轨列表
	allTracks := append(systemTracks, customTracks...)

	// 按照排序字段排序
	sortTracks(allTracks)

	c.JSON(http.StatusOK, gin.H{"tracks": allTracks})
}

// 课程单元信息处理程序
func getUnitHandler(c *gin.Context) {
	courseID := c.Param("courseId")
	unitID := c.Param("unitId")

	// 验证参数
	if courseID == "" || unitID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少必要参数"})
		return
	}

	// 获取当前已验证的用户ID
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权的访问"})
		return
	}

	// 验证用户是否有权访问此课程
	hasAccess, err := userHasAccessToCourse(userID.(string), courseID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "验证用户权限失败"})
		return
	}

	if !hasAccess {
		c.JSON(http.StatusForbidden, gin.H{"error": "您没有权限访问此课程"})
		return
	}

	// 获取课程单元信息
	unitInfo, err := getUnitInfo(courseID, unitID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "未找到课程单元"})
		return
	}

	// 获取系统音轨
	systemTracks, err := getSystemTracks(courseID, unitID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取音轨失败"})
		return
	}

	// 添加音轨到响应
	unitInfo.Tracks = systemTracks

	c.JSON(http.StatusOK, unitInfo)
}

// 课程封面图片处理程序
func getCoverImageHandler(c *gin.Context) {
	courseID := c.Param("courseId")

	// 验证参数
	if courseID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少课程ID"})
		return
	}

	// 构建封面图片路径
	coverPath, err := getCourseCoverPath(courseID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "封面图片不存在"})
		return
	}

	// 获取文件扩展名以设置正确的内容类型
	ext := filepath.Ext(coverPath)
	var contentType string
	switch strings.ToLower(ext) {
	case ".jpg", ".jpeg":
		contentType = "image/jpeg"
	case ".png":
		contentType = "image/png"
	case ".gif":
		contentType = "image/gif"
	default:
		contentType = "image/jpeg" // 默认JPEG
	}

	// 设置内容类型和缓存控制
	c.Header("Content-Type", contentType)
	c.Header("Cache-Control", "public, max-age=86400") // 允许缓存24小时
	c.File(coverPath)
}

// 根据文件扩展名获取内容类型
func getContentType(filePath string) string {
	ext := strings.ToLower(filepath.Ext(filePath))
	switch ext {
	case ".mp3":
		return "audio/mpeg"
	case ".wav":
		return "audio/wav"
	case ".ogg":
		return "audio/ogg"
	case ".flac":
		return "audio/flac"
	case ".aac":
		return "audio/aac"
	case ".m4a":
		return "audio/mp4"
	default:
		return "application/octet-stream"
	}
}

// 从环境变量获取音频加密密钥
func getAudioSecretKey() string {
	return getEnv("AUDIO_SECRET_KEY", "your-audio-secret-key-replace-in-production")
}

// HTTP范围结构
type httpRange struct {
	Start  int64
	End    int64
	Length int64
}

// 解析HTTP范围头
func parseRange(rangeHeader string, size int64) ([]httpRange, error) {
	if !strings.HasPrefix(rangeHeader, "bytes=") {
		return nil, fmt.Errorf("无效的范围格式")
	}
	rangeHeader = strings.TrimPrefix(rangeHeader, "bytes=")
	var ranges []httpRange

	for _, r := range strings.Split(rangeHeader, ",") {
		r = strings.TrimSpace(r)
		if r == "" {
			continue
		}

		parts := strings.Split(r, "-")
		if len(parts) != 2 {
			return nil, fmt.Errorf("无效的范围格式")
		}

		var start, end int64
		var err error

		if parts[0] == "" {
			// 格式为 "-N"，表示最后N字节
			end = size - 1
			i, err := strconv.ParseInt(parts[1], 10, 64)
			if err != nil {
				return nil, fmt.Errorf("无效的范围格式")
			}
			if i > size {
				i = size
			}
			start = size - i
		} else {
			// 格式为 "N-" 或 "N-M"
			start, err = strconv.ParseInt(parts[0], 10, 64)
			if err != nil {
				return nil, fmt.Errorf("无效的范围格式")
			}

			if parts[1] == "" {
				// 格式为 "N-"，表示从N到末尾
				end = size - 1
			} else {
				// 格式为 "N-M"
				end, err = strconv.ParseInt(parts[1], 10, 64)
				if err != nil {
					return nil, fmt.Errorf("无效的范围格式")
				}
			}
		}

		// 验证范围
		if start < 0 || end < 0 || start > end || start >= size {
			return nil, fmt.Errorf("无效的范围")
		}
		if end >= size {
			end = size - 1
		}

		ranges = append(ranges, httpRange{
			Start:  start,
			End:    end,
			Length: end - start + 1,
		})
	}

	return ranges, nil
}

// 获取音频文件路径 - 支持系统音频和用户上传的音频
func getAudioFilePath(courseID, unitID, trackID string) (string, error) {
	basePath := getEnv("AUDIO_FILES_PATH", "./storage/audio")

	// 首先尝试查找用户上传的音频
	customPath := filepath.Join(basePath, courseID, unitID, "custom", trackID+".mp3")
	if _, err := os.Stat(customPath); err == nil {
		return customPath, nil
	}

	// 检查其他常见格式
	for _, ext := range []string{".wav", ".ogg", ".flac", ".aac", ".m4a"} {
		customPath := filepath.Join(basePath, courseID, unitID, "custom", trackID+ext)
		if _, err := os.Stat(customPath); err == nil {
			return customPath, nil
		}
	}

	// 如果未找到用户上传的音频，查找系统音频
	systemPath := filepath.Join(basePath, courseID, unitID, trackID+".mp3")
	if _, err := os.Stat(systemPath); err == nil {
		return systemPath, nil
	}

	// 检查其他格式的系统音频
	for _, ext := range []string{".wav", ".ogg", ".flac", ".aac", ".m4a"} {
		systemPath := filepath.Join(basePath, courseID, unitID, trackID+ext)
		if _, err := os.Stat(systemPath); err == nil {
			return systemPath, nil
		}
	}

	return "", fmt.Errorf("音频文件不存在")
}

// 获取课程封面图片路径
func getCourseCoverPath(courseID string) (string, error) {
	// 检查不同格式的封面图片
	basePath := getEnv("COURSE_COVERS_PATH", "./storage/covers")

	// 尝试查找不同格式的封面图片
	extensions := []string{".jpg", ".jpeg", ".png"}
	for _, ext := range extensions {
		filePath := filepath.Join(basePath, courseID+ext)
		if _, err := os.Stat(filePath); err == nil {
			return filePath, nil
		}
	}

	// 如果没有找到，返回默认封面
	defaultCover := filepath.Join(basePath, "default.jpg")
	if _, err := os.Stat(defaultCover); err == nil {
		return defaultCover, nil
	}

	return "", fmt.Errorf("封面图片不存在")
}

// 音轨基本信息
type TrackInfo struct {
	ID          string  `json:"id"`
	Title       string  `json:"title"`
	ChineseName string  `json:"chineseName,omitempty"`
	Duration    float64 `json:"duration"`
	Custom      bool    `json:"custom"`
	SortOrder   int     `json:"sortOrder"`
}

// 获取系统音轨列表
func getSystemTracks(courseID, unitID string) ([]TrackInfo, error) {
	// 在实际应用中，这里应该从数据库查询
	// 现在使用模拟数据作为示例

	// 可以基于课程ID和单元ID返回不同的音频列表
	if courseID == "pep-english" && unitID == "grade2-unit1" {
		return []TrackInfo{
			{
				ID:          "track1",
				Title:       "How do we change for the weather?",
				ChineseName: "",
				Duration:    10.5,
				Custom:      false,
				SortOrder:   1,
			},
			{
				ID:          "track2",
				Title:       "Listen and chant.",
				ChineseName: "",
				Duration:    46.2,
				Custom:      false,
				SortOrder:   2,
			},
			{
				ID:          "track3",
				Title:       "Listen and chant.",
				ChineseName: "伴奏",
				Duration:    40.8,
				Custom:      false,
				SortOrder:   3,
			},
		}, nil
	}

	// 为其他课程返回空列表或者模拟数据
	return []TrackInfo{}, nil
}

// 对轨道进行排序
func sortTracks(tracks []TrackInfo) {
	// 按照SortOrder字段排序
	for i := 0; i < len(tracks); i++ {
		for j := i + 1; j < len(tracks); j++ {
			if tracks[i].SortOrder > tracks[j].SortOrder {
				tracks[i], tracks[j] = tracks[j], tracks[i]
			}
		}
	}
}

// 课程单元信息结构
type UnitInfo struct {
	CourseID    string      `json:"courseId"`
	CourseName  string      `json:"courseName"`
	UnitID      string      `json:"unitId"`
	UnitTitle   string      `json:"unitTitle"`
	Description string      `json:"description,omitempty"`
	Content     string      `json:"content,omitempty"`
	Tracks      []TrackInfo `json:"tracks"`
}

// 获取单元信息（示例实现，实际应存入数据库）
func getUnitInfo(courseID, unitID string) (*UnitInfo, error) {
	// 在实际应用中，这里应该从数据库查询
	// 现在使用模拟数据作为示例

	if courseID == "pep-english" && unitID == "grade2-unit1" {
		return &UnitInfo{
			CourseID:    courseID,
			CourseName:  "英语（PEP）二年级下册",
			UnitID:      unitID,
			UnitTitle:   "Unit 1 Put on my coat!",
			Description: "学习与天气和衣物相关的英语表达",
			Content:     "<h3>教学内容</h3><p>本单元主要学习天气变化和相应的着装表达，包括指令性用语 'Put on' 和 'Take off'。</p>",
			Tracks:      []TrackInfo{}, // 轨道列表将在处理程序中填充
		}, nil
	}

	return nil, fmt.Errorf("未找到课程单元信息")
}

// 检查用户是否有权访问课程（示例实现，实际应查询数据库）
func userHasAccessToCourse(userID, courseID string) (bool, error) {
	// 在实际应用中，这里应该查询用户的课程访问权限
	// 现在简单返回true作为示例
	return true, nil
}

// 获取音频元数据处理程序
// @Summary 获取音频元数据
// @Description 获取音频文件的元数据信息，包括波形数据
// @Tags audio
// @Accept json
// @Produce json
// @Param trackId path string true "音轨ID"
// @Success 200 {object} AudioMetadata "音频元数据"
// @Failure 401 {object} ErrorResponse "未授权访问"
// @Failure 404 {object} ErrorResponse "音频文件不存在"
// @Router /api/audio/metadata/{trackId} [get]
// @Security BearerAuth
func getAudioMetadataHandler(c *gin.Context) {
	// 获取参数
	trackID := c.Param("trackId")
	if trackID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少音轨ID"})
		return
	}

	// 获取当前已验证的用户ID
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权的访问"})
		return
	}

	// 获取查询参数
	courseID := c.Query("courseId")
	unitID := c.Query("unitId")

	if courseID == "" || unitID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少课程ID或单元ID"})
		return
	}

	// 验证用户是否有权访问此课程
	hasAccess, err := userHasAccessToCourse(userID.(string), courseID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "验证用户权限失败"})
		return
	}

	if !hasAccess {
		c.JSON(http.StatusForbidden, gin.H{"error": "您没有权限访问此课程"})
		return
	}

	// 获取音频文件路径
	audioPath, err := getAudioFilePath(courseID, unitID, trackID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "音频文件不存在"})
		return
	}

	// 检查文件是否存在
	if _, err := os.Stat(audioPath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "音频文件不存在"})
		return
	}

	// 获取音频元数据
	metadata, err := extractAudioMetadata(audioPath, trackID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "提取音频元数据失败"})
		return
	}

	// 获取用户为此音轨设置的书签
	bookmarks, err := getUserBookmarks(userID.(string), trackID)
	if err == nil && len(bookmarks) > 0 {
		metadata.Bookmarks = bookmarks
	}

	// 获取音频转录文本（如果有）
	transcript, err := getAudioTranscript(courseID, unitID, trackID)
	if err == nil {
		metadata.TranscriptData = transcript
	}

	// 获取音频波形数据（如果有）
	waveformData, err := getAudioWaveform(courseID, unitID, trackID)
	if err == nil {
		metadata.WaveformData = waveformData
	}

	// 获取用户自定义数据
	customData, err := getUserAudioCustomData(userID.(string), trackID)
	if err == nil {
		metadata.CustomData = customData
	}

	c.JSON(http.StatusOK, metadata)
}

// 提取音频文件元数据
func extractAudioMetadata(audioPath, trackID string) (*AudioMetadata, error) {
	// 在实际产品中，应使用FFmpeg或其他音频处理库提取完整元数据
	// 这里为简化实现，仅从文件名和大小推断基本信息

	fileInfo, err := os.Stat(audioPath)
	if err != nil {
		return nil, err
	}

	// 从文件名获取基本信息
	fileName := filepath.Base(audioPath)
	fileExt := strings.ToLower(filepath.Ext(audioPath))

	// 确定格式
	format := "unknown"
	switch fileExt {
	case ".mp3":
		format = "audio/mpeg"
	case ".wav":
		format = "audio/wav"
	case ".ogg":
		format = "audio/ogg"
	case ".flac":
		format = "audio/flac"
	case ".m4a":
		format = "audio/m4a"
	}

	// 估算时长和比特率（在真实环境中应使用媒体处理库）
	// 这里的估算非常粗略，仅用于演示
	bitRate := 128000 // 默认比特率128kbps
	fileSize := fileInfo.Size()
	duration := float64(fileSize*8) / float64(bitRate)

	// 创建元数据
	metadata := &AudioMetadata{
		TrackID:    trackID,
		Title:      strings.TrimSuffix(fileName, fileExt),
		Format:     format,
		Duration:   duration,
		BitRate:    bitRate,
		SampleRate: 44100, // 假设采样率44.1kHz
		Channels:   2,     // 假设立体声
	}

	return metadata, nil
}

// 获取用户书签（模拟实现）
func getUserBookmarks(userID, trackID string) ([]AudioBookmark, error) {
	// 在实际产品中，应从数据库中获取用户为特定音轨设置的书签
	// 这里为模拟实现，返回一些测试数据

	// 如果不存在书签，返回空数组
	if rand.Intn(2) == 0 {
		return []AudioBookmark{}, nil
	}

	// 模拟一些书签
	bookmarks := []AudioBookmark{
		{
			ID:        generateRandomString(8),
			TimePoint: 15.5,
			Label:     "重要短语",
			Color:     "#ff5722",
		},
		{
			ID:        generateRandomString(8),
			TimePoint: 42.2,
			Label:     "语法点",
			Color:     "#4caf50",
			Notes:     "注意这里的时态变化",
		},
	}

	return bookmarks, nil
}

// 获取音频转录（模拟实现）
func getAudioTranscript(courseID, unitID, trackID string) (*AudioTranscript, error) {
	// 在实际产品中，应从数据库或文件系统中获取相应的转录文件
	// 这里为模拟实现，返回一些测试数据或nil

	// 随机决定是否有转录
	if rand.Intn(2) == 0 {
		return nil, fmt.Errorf("无转录数据")
	}

	// 模拟转录数据
	transcript := &AudioTranscript{
		Language: "zh-CN",
		Segments: []TranscriptSegment{
			{
				StartTime: 0.0,
				EndTime:   5.2,
				Text:      "欢迎使用语言学习音频播放器。",
			},
			{
				StartTime: 5.5,
				EndTime:   12.3,
				Text:      "这是一个示例转录文本，用于测试功能。",
			},
			{
				StartTime: 13.0,
				EndTime:   18.5,
				Text:      "在实际使用中，这些文本将与音频同步显示。",
			},
		},
	}

	return transcript, nil
}

// 获取音频波形数据（模拟实现）
func getAudioWaveform(courseID, unitID, trackID string) ([]float32, error) {
	// 在实际产品中，应预先处理并存储波形数据或实时生成
	// 这里为模拟实现，生成一些随机数据

	// 为简化起见，只生成100个点的波形数据
	waveformData := make([]float32, 100)

	for i := range waveformData {
		// 生成0-1之间的随机值
		waveformData[i] = rand.Float32()
	}

	return waveformData, nil
}

// 获取用户自定义数据（模拟实现）
func getUserAudioCustomData(userID, trackID string) (map[string]interface{}, error) {
	// 在实际产品中，应从数据库中获取用户对特定音轨的自定义数据
	// 这里为模拟实现，返回一些测试数据

	// 如果不存在自定义数据，返回nil
	if rand.Intn(2) == 0 {
		return nil, fmt.Errorf("无自定义数据")
	}

	// 模拟自定义数据
	customData := map[string]interface{}{
		"lastPosition": 25.7,
		"playbackRate": 0.9,
		"volumeLevel":  0.8,
		"notes":        "这个音频讲解得很清楚",
		"difficulty":   "intermediate",
		"tags":         []string{"语法", "听力练习"},
	}

	return customData, nil
}

// 音频上传处理程序
// @Summary 上传自定义音频
// @Description 上传用户自定义音频文件
// @Tags audio
// @Accept multipart/form-data
// @Produce json
// @Param file formData file true "音频文件"
// @Param title formData string true "音频标题"
// @Param courseId formData string true "课程ID"
// @Param unitId formData string true "单元ID"
// @Success 201 {object} map[string]interface{} "上传成功"
// @Failure 400 {object} ErrorResponse "请求无效"
// @Failure 401 {object} ErrorResponse "未授权访问"
// @Failure 413 {object} ErrorResponse "文件过大"
// @Router /api/audio/upload [post]
// @Security BearerAuth
func uploadAudioHandler(c *gin.Context) {
	// 获取当前已验证的用户ID
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权的访问"})
		return
	}

	// 获取课程和单元ID
	courseID := c.PostForm("courseId")
	unitID := c.PostForm("unitId")
	title := c.PostForm("title")
	description := c.PostForm("description")

	// 验证必要参数
	if courseID == "" || unitID == "" || title == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少必要参数"})
		return
	}

	// 验证用户是否有权访问此课程
	hasAccess, err := userHasAccessToCourse(userID.(string), courseID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "验证用户权限失败"})
		return
	}

	if !hasAccess {
		c.JSON(http.StatusForbidden, gin.H{"error": "您没有权限访问此课程"})
		return
	}

	// 获取上传的文件
	file, header, err := c.Request.FormFile("audioFile")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "获取上传文件失败"})
		return
	}
	defer file.Close()

	// 验证文件类型
	fileExt := strings.ToLower(filepath.Ext(header.Filename))
	if !isAllowedAudioFormat(fileExt) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "不支持的音频格式"})
		return
	}

	// 验证文件大小
	if header.Size > getMaxAudioFileSize() {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("文件太大，最大允许大小为 %d MB", getMaxAudioFileSize()/1024/1024),
		})
		return
	}

	// 生成唯一文件名
	trackID := generateUniqueID()
	fileName := trackID + fileExt

	// 创建保存路径
	uploadDir := filepath.Join("storage", "audio", "uploads", userID.(string))
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建上传目录失败"})
		return
	}

	// 保存文件路径
	filePath := filepath.Join(uploadDir, fileName)

	// 创建文件
	out, err := os.Create(filePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建文件失败"})
		return
	}
	defer out.Close()

	// 复制文件内容
	if _, err = io.Copy(out, file); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存文件失败"})
		return
	}

	// 处理音频文件 - 在实际产品中应异步进行
	processedFilePath, duration, err := processAudioFile(filePath, trackID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("处理音频文件失败: %s", err.Error())})
		// 应该删除上传的原始文件
		os.Remove(filePath)
		return
	}

	// 保存音轨信息到数据库
	trackInfo := UserTrackInfo{
		ID:               trackID,
		UserID:           userID.(string),
		CourseID:         courseID,
		UnitID:           unitID,
		Title:            title,
		Description:      description,
		FileName:         fileName,
		FilePath:         processedFilePath,
		OriginalFileName: header.Filename,
		FileSize:         header.Size,
		Duration:         duration,
		Format:           fileExt[1:], // 去掉点号
		UploadTime:       time.Now(),
	}

	// 保存到数据库
	if err := saveUserTrack(trackInfo); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存音轨信息失败"})
		return
	}

	// 返回成功响应
	c.JSON(http.StatusOK, gin.H{
		"message":  "音频上传成功",
		"trackId":  trackID,
		"title":    title,
		"duration": duration,
	})
}

// 用户音轨信息结构
type UserTrackInfo struct {
	ID               string    `json:"id"`
	UserID           string    `json:"userId"`
	CourseID         string    `json:"courseId"`
	UnitID           string    `json:"unitId"`
	Title            string    `json:"title"`
	Description      string    `json:"description,omitempty"`
	FileName         string    `json:"fileName"`
	FilePath         string    `json:"filePath"`
	OriginalFileName string    `json:"originalFileName"`
	FileSize         int64     `json:"fileSize"`
	Duration         float64   `json:"duration"`
	Format           string    `json:"format"`
	UploadTime       time.Time `json:"uploadTime"`
}

// 检查是否为允许的音频格式
func isAllowedAudioFormat(ext string) bool {
	allowedFormats := []string{".mp3", ".wav", ".ogg", ".m4a", ".flac"}
	for _, format := range allowedFormats {
		if ext == format {
			return true
		}
	}
	return false
}

// 最大允许的音频文件大小（100MB）
func getMaxAudioFileSize() int64 {
	// 从环境变量获取，默认100MB
	sizeStr := getEnv("MAX_AUDIO_SIZE", "104857600")
	size, err := strconv.ParseInt(sizeStr, 10, 64)
	if err != nil {
		return 104857600 // 100MB
	}
	return size
}

// 生成唯一ID
func generateUniqueID() string {
	return fmt.Sprintf("track_%d_%s", time.Now().Unix(), generateRandomString(8))
}

// 处理音频文件（在实际产品中应使用FFmpeg或其他专业库）
func processAudioFile(filePath string, trackID string) (string, float64, error) {
	// 创建处理后的文件目录
	processedDir := filepath.Join("storage", "audio", "processed")
	if err := os.MkdirAll(processedDir, 0755); err != nil {
		return "", 0, err
	}

	// 获取文件扩展名
	fileExt := filepath.Ext(filePath)

	// 创建处理后的文件路径
	processedFilePath := filepath.Join(processedDir, trackID+fileExt)

	// 在实际产品中，应该执行：
	// 1. 标准化音频格式
	// 2. 优化音质
	// 3. 生成波形数据
	// 4. 提取元数据

	// 简化实现，仅复制文件
	sourceFile, err := os.Open(filePath)
	if err != nil {
		return "", 0, err
	}
	defer sourceFile.Close()

	destFile, err := os.Create(processedFilePath)
	if err != nil {
		return "", 0, err
	}
	defer destFile.Close()

	if _, err := io.Copy(destFile, sourceFile); err != nil {
		return "", 0, err
	}

	// 获取文件信息以计算大致时长
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		return "", 0, err
	}

	// 假设以128kbps比特率估算时长
	bitRate := 128000.0 // 比特率128kbps
	fileSize := float64(fileInfo.Size())
	duration := (fileSize * 8.0) / bitRate

	return processedFilePath, duration, nil
}

// 保存用户音轨信息到数据库（模拟实现）
func saveUserTrack(track UserTrackInfo) error {
	// 在实际产品中，应将信息保存到数据库
	// 这里为简化实现，仅打印日志
	log.Printf("保存用户音轨: ID=%s, 标题=%s, 用户=%s, 课程=%s, 单元=%s",
		track.ID, track.Title, track.UserID, track.CourseID, track.UnitID)

	// 可以将信息保存到JSON文件中进行模拟
	tracksDir := filepath.Join("storage", "tracks")
	if err := os.MkdirAll(tracksDir, 0755); err != nil {
		return err
	}

	trackData, err := json.Marshal(track)
	if err != nil {
		return err
	}

	trackFile := filepath.Join(tracksDir, track.ID+".json")
	return os.WriteFile(trackFile, trackData, 0644)
}

// 获取用户音轨列表处理程序
// @Summary 获取用户音频列表
// @Description 获取当前用户上传的所有音频文件
// @Tags audio
// @Accept json
// @Produce json
// @Success 200 {array} TrackResponse "音频列表"
// @Failure 401 {object} ErrorResponse "未授权访问"
// @Router /api/audio/user-tracks [get]
// @Security BearerAuth
func getUserTracksHandler(c *gin.Context) {
	// 获取当前已验证的用户ID
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权的访问"})
		return
	}

	// 获取查询参数（可选）
	courseID := c.Query("courseId")
	unitID := c.Query("unitId")

	// 检查是否有权访问课程（如果指定了课程）
	if courseID != "" {
		hasAccess, err := userHasAccessToCourse(userID.(string), courseID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "验证用户权限失败"})
			return
		}

		if !hasAccess {
			c.JSON(http.StatusForbidden, gin.H{"error": "您没有权限访问此课程"})
			return
		}
	}

	// 获取分页参数
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))

	// 验证分页参数
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	// 获取筛选和排序参数
	sortBy := c.DefaultQuery("sortBy", "uploadTime")
	sortOrder := c.DefaultQuery("sortOrder", "desc")
	filter := c.DefaultQuery("filter", "")

	// 获取用户音轨列表
	tracks, total, err := getUserTracks(userID.(string), courseID, unitID, page, pageSize, sortBy, sortOrder, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取音轨列表失败"})
		return
	}

	// 返回结果
	c.JSON(http.StatusOK, gin.H{
		"tracks":     tracks,
		"total":      total,
		"page":       page,
		"pageSize":   pageSize,
		"totalPages": (total + pageSize - 1) / pageSize,
	})
}

// 获取用户音轨列表（模拟实现）
func getUserTracks(userID, courseID, unitID string, page, pageSize int, sortBy, sortOrder, filter string) ([]UserTrackInfo, int, error) {
	// 在实际产品中，应从数据库中获取用户音轨列表
	// 这里为模拟实现，生成一些测试数据

	// 创建模拟数据
	tracks := []UserTrackInfo{
		{
			ID:               generateUniqueID(),
			UserID:           userID,
			CourseID:         "course_1",
			UnitID:           "unit_1",
			Title:            "自定义音频 1",
			Description:      "这是我上传的第一个音频文件",
			FileName:         "audio1.mp3",
			FilePath:         "storage/audio/processed/track_123456_abcdef.mp3",
			OriginalFileName: "my_recording.mp3",
			FileSize:         1024 * 1024 * 3, // 3MB
			Duration:         180.5,           // 3分钟
			Format:           "mp3",
			UploadTime:       time.Now().Add(-24 * time.Hour), // 昨天
		},
		{
			ID:               generateUniqueID(),
			UserID:           userID,
			CourseID:         "course_1",
			UnitID:           "unit_2",
			Title:            "自定义音频 2",
			Description:      "第二单元练习",
			FileName:         "audio2.wav",
			FilePath:         "storage/audio/processed/track_234567_bcdefg.wav",
			OriginalFileName: "practice_unit2.wav",
			FileSize:         1024 * 1024 * 5, // 5MB
			Duration:         240.0,           // 4分钟
			Format:           "wav",
			UploadTime:       time.Now().Add(-2 * 24 * time.Hour), // 前天
		},
		{
			ID:               generateUniqueID(),
			UserID:           userID,
			CourseID:         "course_2",
			UnitID:           "unit_1",
			Title:            "发音练习",
			Description:      "重点词汇发音练习",
			FileName:         "audio3.ogg",
			FilePath:         "storage/audio/processed/track_345678_cdefgh.ogg",
			OriginalFileName: "pronunciation.ogg",
			FileSize:         1024 * 1024 * 2, // 2MB
			Duration:         120.25,          // 2分钟
			Format:           "ogg",
			UploadTime:       time.Now().Add(-3 * 24 * time.Hour), // 3天前
		},
	}

	// 应用课程和单元筛选
	var filteredTracks []UserTrackInfo
	for _, track := range tracks {
		if (courseID == "" || track.CourseID == courseID) &&
			(unitID == "" || track.UnitID == unitID) {
			// 应用标题筛选
			if filter == "" || strings.Contains(strings.ToLower(track.Title), strings.ToLower(filter)) {
				filteredTracks = append(filteredTracks, track)
			}
		}
	}

	// 记录总数量
	total := len(filteredTracks)

	// 排序
	switch sortBy {
	case "title":
		if sortOrder == "asc" {
			sort.Slice(filteredTracks, func(i, j int) bool {
				return filteredTracks[i].Title < filteredTracks[j].Title
			})
		} else {
			sort.Slice(filteredTracks, func(i, j int) bool {
				return filteredTracks[i].Title > filteredTracks[j].Title
			})
		}
	case "duration":
		if sortOrder == "asc" {
			sort.Slice(filteredTracks, func(i, j int) bool {
				return filteredTracks[i].Duration < filteredTracks[j].Duration
			})
		} else {
			sort.Slice(filteredTracks, func(i, j int) bool {
				return filteredTracks[i].Duration > filteredTracks[j].Duration
			})
		}
	case "fileSize":
		if sortOrder == "asc" {
			sort.Slice(filteredTracks, func(i, j int) bool {
				return filteredTracks[i].FileSize < filteredTracks[j].FileSize
			})
		} else {
			sort.Slice(filteredTracks, func(i, j int) bool {
				return filteredTracks[i].FileSize > filteredTracks[j].FileSize
			})
		}
	default: // uploadTime
		if sortOrder == "asc" {
			sort.Slice(filteredTracks, func(i, j int) bool {
				return filteredTracks[i].UploadTime.Before(filteredTracks[j].UploadTime)
			})
		} else {
			sort.Slice(filteredTracks, func(i, j int) bool {
				return filteredTracks[i].UploadTime.After(filteredTracks[j].UploadTime)
			})
		}
	}

	// 应用分页
	startIndex := (page - 1) * pageSize
	if startIndex >= len(filteredTracks) {
		return []UserTrackInfo{}, total, nil
	}

	endIndex := startIndex + pageSize
	if endIndex > len(filteredTracks) {
		endIndex = len(filteredTracks)
	}

	return filteredTracks[startIndex:endIndex], total, nil
}

// 音频质量配置结构
type AudioQualityConfig struct {
	Name       string `json:"name"`
	Bitrate    int    `json:"bitrate"`    // 比特率，单位kbps
	SampleRate int    `json:"sampleRate"` // 采样率，单位Hz
	Channels   int    `json:"channels"`   // 声道数
	Extension  string `json:"extension"`  // 文件扩展名
}

// 音频格式请求参数
type AudioFormatRequest struct {
	Quality  string `form:"quality"`  // 音频质量 (high/medium/low)
	Format   string `form:"format"`   // 音频格式 (mp3/ogg/aac)
	Adaptive bool   `form:"adaptive"` // 是否使用自适应比特率
}

// 获取自适应音频流处理程序
// @Summary 自适应音频流
// @Description 基于网络状况和客户端能力自动选择合适质量的音频流
// @Tags audio
// @Accept json
// @Produce octet-stream
// @Param trackId path string true "音轨ID"
// @Param token query string true "访问令牌"
// @Success 200 {file} binary "音频文件"
// @Failure 400 {object} ErrorResponse "请求无效"
// @Failure 401 {object} ErrorResponse "未授权访问"
// @Failure 404 {object} ErrorResponse "音频文件不存在"
// @Router /api/audio/adaptive/{trackId} [get]
func getAdaptiveStreamHandler(c *gin.Context) {
	// 获取音轨ID
	trackID := c.Param("trackId")
	if trackID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少音轨ID"})
		return
	}

	// 获取令牌参数
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "缺少访问令牌"})
		return
	}

	// 解析和验证令牌
	accessToken, err := ParseAccessToken(token, getAudioSecretKey())
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "无效的访问令牌"})
		return
	}

	// 验证令牌操作类型和有效期
	if err := accessToken.Validate("stream_audio"); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	// 验证令牌中的音轨ID与请求的音轨ID是否匹配
	if accessToken.TrackID != trackID {
		c.JSON(http.StatusForbidden, gin.H{"error": "令牌与请求不匹配"})
		return
	}

	// 获取音频格式请求参数
	var formatReq AudioFormatRequest
	formatReq.Quality = c.DefaultQuery("quality", "medium")
	formatReq.Format = c.DefaultQuery("format", "mp3")
	adaptiveStr := c.DefaultQuery("adaptive", "false")
	formatReq.Adaptive = adaptiveStr == "true" || adaptiveStr == "1"

	// 验证来源域名（防盗链）
	referer := c.Request.Header.Get("Referer")
	if referer != "" {
		// 从配置读取允许的域名列表
		allowedDomains := strings.Split(getEnv("ALLOWED_DOMAINS", "localhost:3000,localhost:8080"), ",")
		refererValid := false

		for _, domain := range allowedDomains {
			if strings.Contains(referer, strings.TrimSpace(domain)) {
				refererValid = true
				break
			}
		}

		if !refererValid {
			c.JSON(http.StatusForbidden, gin.H{"error": "非法的资源访问来源"})
			return
		}
	}

	// 构建音频文件路径
	audioPath, err := getAudioFilePath(accessToken.CourseID, accessToken.UnitID, accessToken.TrackID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "音频文件不存在"})
		return
	}

	// 检查客户端网络条件
	bandwidth := estimateClientBandwidth(c)
	logClientStats(accessToken.UserID, trackID, c.ClientIP(), bandwidth)

	// 根据带宽和请求参数确定最佳音频质量
	qualityConfig := selectBestQuality(bandwidth, formatReq)

	// 获取或生成对应质量的音频文件
	adaptiveAudioPath, err := getAdaptiveAudioFile(audioPath, trackID, qualityConfig)
	if err != nil {
		// 如果转码失败，回退到原始音频
		adaptiveAudioPath = audioPath
		// 记录错误日志
		log.Printf("音频转码失败: %v, 使用原始音频: %s", err, audioPath)
	}

	// 打开音频文件
	audioFile, err := os.Open(adaptiveAudioPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法读取音频文件"})
		return
	}
	defer audioFile.Close()

	// 获取文件状态
	fileInfo, err := audioFile.Stat()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法获取文件信息"})
		return
	}

	// 设置内容类型
	contentType := getContentTypeForFormat(qualityConfig.Extension)
	c.Header("Content-Type", contentType)

	// 设置安全相关的响应头
	c.Header("Accept-Ranges", "bytes")
	c.Header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
	c.Header("Pragma", "no-cache")
	c.Header("Expires", "0")
	c.Header("Content-Disposition", "inline")
	c.Header("X-Content-Type-Options", "nosniff")

	// 对于自适应流，添加音频质量相关的头信息
	c.Header("X-Audio-Quality", qualityConfig.Name)
	c.Header("X-Audio-Bitrate", fmt.Sprintf("%d", qualityConfig.Bitrate))
	c.Header("X-Audio-Format", qualityConfig.Extension)

	// 记录访问日志
	logAdaptiveAudioAccess(accessToken.UserID, accessToken.TrackID, c.ClientIP(), qualityConfig)

	// 处理范围请求（如果有）
	rangeHeader := c.Request.Header.Get("Range")
	if rangeHeader != "" {
		// 解析范围请求
		ranges, err := parseRange(rangeHeader, fileInfo.Size())
		if err != nil {
			c.Header("Content-Range", fmt.Sprintf("bytes */%d", fileInfo.Size()))
			c.JSON(http.StatusRequestedRangeNotSatisfiable, gin.H{"error": "请求范围无效"})
			return
		}

		// 目前只支持单范围请求
		if len(ranges) > 1 {
			c.Header("Content-Range", fmt.Sprintf("bytes */%d", fileInfo.Size()))
			c.JSON(http.StatusRequestedRangeNotSatisfiable, gin.H{"error": "不支持多范围请求"})
			return
		}

		// 优化的范围请求处理
		serveOptimizedRangeRequest(c, audioFile, fileInfo, ranges[0])
	} else {
		// 使用块大小自适应的方式流式传输
		serveAdaptiveStream(c, audioFile, fileInfo, bandwidth)
	}
}

// 根据格式获取内容类型
func getContentTypeForFormat(format string) string {
	switch strings.ToLower(format) {
	case "mp3", ".mp3":
		return "audio/mpeg"
	case "ogg", ".ogg":
		return "audio/ogg"
	case "aac", ".aac":
		return "audio/aac"
	case "wav", ".wav":
		return "audio/wav"
	case "flac", ".flac":
		return "audio/flac"
	case "m4a", ".m4a":
		return "audio/mp4"
	default:
		return "application/octet-stream"
	}
}

// 估计客户端带宽（基于请求头和连接信息）
func estimateClientBandwidth(c *gin.Context) int {
	// 从请求头获取带宽信息（如果有）
	// 注意：这些是非标准头，但一些CDN和浏览器扩展可能提供
	downlinkStr := c.Request.Header.Get("Downlink")
	if downlinkStr != "" {
		if downlink, err := strconv.Atoi(downlinkStr); err == nil && downlink > 0 {
			return downlink // 返回客户端提供的带宽估计（kbps）
		}
	}

	// 检查ECT（有效连接类型）头
	ect := c.Request.Header.Get("ECT")
	switch ect {
	case "4g":
		return 4000 // 假设4G约为4Mbps
	case "3g":
		return 1000 // 假设3G约为1Mbps
	case "2g":
		return 250 // 假设2G约为250kbps
	case "slow-2g":
		return 100 // 假设慢2G约为100kbps
	}

	// 检查保存的客户端统计数据
	// 在实际系统中，应从数据库或缓存获取之前的带宽统计
	clientIP := c.ClientIP()
	bandwidth := getClientBandwidthStats(clientIP)
	if bandwidth > 0 {
		return bandwidth
	}

	// 默认假设值 - 1Mbps
	return 1000
}

// 获取客户端的带宽统计（模拟实现）
func getClientBandwidthStats(clientIP string) int {
	// 在实际产品中，应从数据库或缓存获取
	// 这里简单返回随机值作为示例
	if rand.Intn(2) == 0 {
		return 0 // 表示没有历史数据
	}

	// 返回一个合理的带宽值（250kbps - 10Mbps）
	return 250 + rand.Intn(9750)
}

// 记录客户端统计信息
func logClientStats(userID, trackID, clientIP string, bandwidth int) {
	// 在实际产品中，应将日志写入数据库
	log.Printf("客户端统计: 用户ID=%s, 音轨ID=%s, IP=%s, 带宽=%dkbps, 时间=%s",
		userID, trackID, clientIP, bandwidth, time.Now().Format(time.RFC3339))
}

// 记录自适应音频访问
func logAdaptiveAudioAccess(userID, trackID, clientIP string, config AudioQualityConfig) {
	// 在实际产品中，应将日志写入数据库
	log.Printf("自适应音频访问: 用户ID=%s, 音轨ID=%s, IP=%s, 质量=%s, 比特率=%d, 时间=%s",
		userID, trackID, clientIP, config.Name, config.Bitrate, time.Now().Format(time.RFC3339))
}

// 根据带宽和请求参数选择最佳音频质量
func selectBestQuality(bandwidth int, req AudioFormatRequest) AudioQualityConfig {
	// 定义不同质量级别的配置
	qualityConfigs := map[string][]AudioQualityConfig{
		"mp3": {
			{Name: "high", Bitrate: 320, SampleRate: 44100, Channels: 2, Extension: "mp3"},
			{Name: "medium", Bitrate: 192, SampleRate: 44100, Channels: 2, Extension: "mp3"},
			{Name: "low", Bitrate: 128, SampleRate: 44100, Channels: 2, Extension: "mp3"},
			{Name: "very_low", Bitrate: 64, SampleRate: 22050, Channels: 1, Extension: "mp3"},
		},
		"ogg": {
			{Name: "high", Bitrate: 256, SampleRate: 44100, Channels: 2, Extension: "ogg"},
			{Name: "medium", Bitrate: 160, SampleRate: 44100, Channels: 2, Extension: "ogg"},
			{Name: "low", Bitrate: 96, SampleRate: 44100, Channels: 2, Extension: "ogg"},
			{Name: "very_low", Bitrate: 48, SampleRate: 22050, Channels: 1, Extension: "ogg"},
		},
		"aac": {
			{Name: "high", Bitrate: 256, SampleRate: 44100, Channels: 2, Extension: "aac"},
			{Name: "medium", Bitrate: 160, SampleRate: 44100, Channels: 2, Extension: "aac"},
			{Name: "low", Bitrate: 96, SampleRate: 44100, Channels: 2, Extension: "aac"},
			{Name: "very_low", Bitrate: 48, SampleRate: 22050, Channels: 1, Extension: "aac"},
		},
	}

	// 使用默认格式如果请求的格式不支持
	format := req.Format
	if _, exists := qualityConfigs[format]; !exists {
		format = "mp3" // 默认回退到MP3
	}

	// 如果请求自适应比特率
	if req.Adaptive {
		// 根据带宽自动选择合适的质量
		for _, config := range qualityConfigs[format] {
			// 假设至少需要比特率的1.2倍带宽来流畅播放
			if float64(bandwidth) >= float64(config.Bitrate)*1.2 {
				return config
			}
		}

		// 如果带宽很低，使用最低质量
		return qualityConfigs[format][len(qualityConfigs[format])-1]
	} else {
		// 使用用户指定的质量
		quality := req.Quality

		// 找到指定质量的配置
		for _, config := range qualityConfigs[format] {
			if config.Name == quality {
				return config
			}
		}

		// 默认使用中等质量
		for _, config := range qualityConfigs[format] {
			if config.Name == "medium" {
				return config
			}
		}

		// 如果没有找到指定质量，使用第一个可用配置
		return qualityConfigs[format][0]
	}
}

// 获取或生成适应性音频文件
func getAdaptiveAudioFile(srcPath, trackID string, quality AudioQualityConfig) (string, error) {
	// 生成转码后文件路径
	baseDir := filepath.Join("storage", "audio", "transcoded")
	qualityDir := filepath.Join(baseDir, quality.Name)

	// 确保目录存在
	if err := os.MkdirAll(qualityDir, 0755); err != nil {
		return "", err
	}

	// 生成文件名
	fileName := fmt.Sprintf("%s_%d_%d_%d.%s",
		trackID,
		quality.Bitrate,
		quality.SampleRate,
		quality.Channels,
		quality.Extension)

	destPath := filepath.Join(qualityDir, fileName)

	// 检查转码后的文件是否已存在
	if _, err := os.Stat(destPath); err == nil {
		// 文件已存在，直接返回
		return destPath, nil
	}

	// 需要转码 - 在实际系统中，应使用FFmpeg或其他音频处理库
	// 这里为简化实现，使用模拟转码
	err := transcodeAudio(srcPath, destPath, quality)
	if err != nil {
		return "", err
	}

	return destPath, nil
}

// 模拟音频转码（在实际系统中应使用FFmpeg）
func transcodeAudio(srcPath, destPath string, quality AudioQualityConfig) error {
	// 注意：这是模拟的转码函数，实际产品中应调用FFmpeg

	// 在实际产品中，这里应使用类似以下的FFmpeg调用:
	// ffmpeg -i {srcPath} -c:a libmp3lame -b:a {quality.Bitrate}k -ar {quality.SampleRate} -ac {quality.Channels} {destPath}

	// 简化实现，仅复制文件并模拟转码延迟
	sourceFile, err := os.Open(srcPath)
	if err != nil {
		return err
	}
	defer sourceFile.Close()

	destFile, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer destFile.Close()

	// 复制文件内容
	_, err = io.Copy(destFile, sourceFile)
	if err != nil {
		return err
	}

	// 模拟转码延迟
	time.Sleep(100 * time.Millisecond)

	// 记录转码日志
	log.Printf("音频转码（模拟）: 源=%s, 目标=%s, 比特率=%dkbps, 采样率=%dHz, 声道数=%d",
		srcPath, destPath, quality.Bitrate, quality.SampleRate, quality.Channels)

	return nil
}

// 优化的范围请求处理
func serveOptimizedRangeRequest(c *gin.Context, file *os.File, fileInfo os.FileInfo, r httpRange) {
	// 设置内容范围头
	c.Header("Content-Range", fmt.Sprintf("bytes %d-%d/%d", r.Start, r.End, fileInfo.Size()))
	c.Header("Content-Length", strconv.FormatInt(r.Length, 10))
	c.Status(http.StatusPartialContent)

	// 移动到范围起始位置
	_, err := file.Seek(r.Start, io.SeekStart)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法设置文件位置"})
		return
	}

	// 使用适当的缓冲区大小来优化传输
	// 对于较大的范围，使用更大的缓冲区
	bufferSize := 4096        // 4KB 默认缓冲区
	if r.Length > 1024*1024 { // 如果大于1MB
		bufferSize = 16384 // 16KB 缓冲区
	}

	buffer := make([]byte, bufferSize)
	bytesRemaining := r.Length

	// 使用流式传输避免内存过载
	for bytesRemaining > 0 {
		readSize := int64(len(buffer))
		if bytesRemaining < readSize {
			readSize = bytesRemaining
		}

		n, err := file.Read(buffer[:readSize])
		if err != nil && err != io.EOF {
			log.Printf("读取文件错误: %v", err)
			break
		}

		if n == 0 {
			break // 文件结束
		}

		_, err = c.Writer.Write(buffer[:n])
		if err != nil {
			log.Printf("写入响应错误: %v", err)
			break
		}

		bytesRemaining -= int64(n)
	}
}

// 自适应流式传输
func serveAdaptiveStream(c *gin.Context, file *os.File, fileInfo os.FileInfo, bandwidth int) {
	// 设置内容长度头
	c.Header("Content-Length", strconv.FormatInt(fileInfo.Size(), 10))

	// 根据带宽调整缓冲区大小和流速率
	bufferSize := determineOptimalBufferSize(bandwidth)

	// 确定适当的写入延迟（如果需要限速，防止过度缓冲）
	writeDelay := determineWriteDelay(bandwidth, bufferSize)

	buffer := make([]byte, bufferSize)
	bytesSent := int64(0)
	bytesTotal := fileInfo.Size()

	// 使用流式传输避免内存过载
	for bytesSent < bytesTotal {
		n, err := file.Read(buffer)
		if err != nil && err != io.EOF {
			log.Printf("读取文件错误: %v", err)
			break
		}

		if n == 0 {
			break // 文件结束
		}

		// 写入响应
		_, err = c.Writer.Write(buffer[:n])
		if err != nil {
			log.Printf("写入响应错误: %v", err)
			break
		}

		bytesSent += int64(n)

		// 如果需要限制速率，添加适当延迟
		if writeDelay > 0 {
			time.Sleep(writeDelay)
		}

		// 刷新写入器，确保数据发送给客户端
		c.Writer.Flush()
	}
}

// 根据带宽确定最佳缓冲区大小
func determineOptimalBufferSize(bandwidth int) int {
	// 根据带宽调整缓冲区大小
	if bandwidth < 256 { // 低于256kbps
		return 4096 // 4KB
	} else if bandwidth < 1000 { // 低于1Mbps
		return 8192 // 8KB
	} else if bandwidth < 5000 { // 低于5Mbps
		return 16384 // 16KB
	} else {
		return 32768 // 32KB，高带宽
	}
}

// 确定写入延迟，用于限制传输速率（如果需要）
func determineWriteDelay(bandwidth int, bufferSize int) time.Duration {
	// 计算每个缓冲区需要的发送时间（以毫秒为单位）
	// 公式: (缓冲区大小(bytes) * 8 / 带宽(kbps)) * 1000

	// 注意：在大多数情况下，我们不需要人为限制速度，网络本身会自然限制
	// 这里的延迟主要用于非常高带宽场景，防止服务器过载

	// 如果带宽高于10Mbps，可能需要一些限制来防止服务器过载
	if bandwidth > 10000 {
		// 限制在10Mbps
		bytesPerSecond := 10000 * 1024 / 8 // 转换为每秒字节数
		delayMs := float64(bufferSize) / float64(bytesPerSecond) * 1000
		return time.Duration(delayMs) * time.Millisecond
	}

	// 对于大多数情况，不需要额外延迟
	return 0
}

// TrackProgressRequest 更新音轨进度的请求结构
type TrackProgressRequest struct {
	TrackID        string  `json:"trackId" binding:"required"`
	Position       float64 `json:"position" binding:"required,min=0"`
	CompletionRate float64 `json:"completionRate" binding:"min=0,max=100"`
}

// 更新音轨播放进度
// @Summary 更新音轨播放进度
// @Description 保存用户的音轨播放位置和完成率
// @Tags tracks
// @Accept json
// @Produce json
// @Param progress body TrackProgressRequest true "进度信息"
// @Success 200 {object} map[string]interface{} "更新成功"
// @Failure 400 {object} ErrorResponse "请求无效"
// @Failure 401 {object} ErrorResponse "未授权访问"
// @Router /api/track-progress [post]
// @Security BearerAuth
func updateTrackProgressHandler(c *gin.Context) {
	// 获取当前用户ID
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权访问"})
		return
	}

	// 解析请求体
	var req TrackProgressRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的请求参数", "details": err.Error()})
		return
	}

	// 获取当前时间
	now := time.Now()

	// 转换userID为字符串
	userIDStr, ok := userID.(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无效的用户ID"})
		return
	}

	// 检查是否存在该用户的播放记录
	var count int
	err := database.DB.Get(&count, `SELECT COUNT(*) FROM user_progress WHERE user_id = $1 AND track_id = $2`,
		userIDStr, req.TrackID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "检查播放记录失败"})
		return
	}

	var result sql.Result
	if count > 0 {
		// 更新现有记录
		result, err = database.DB.Exec(`
			UPDATE user_progress 
			SET 
				last_position = $1, 
				completion_rate = $2, 
				last_accessed = $3,
				play_count = play_count + 1,
				updated_at = $3
			WHERE user_id = $4 AND track_id = $5
		`, req.Position, req.CompletionRate, now, userIDStr, req.TrackID)
	} else {
		// 创建新记录
		id := fmt.Sprintf("prog_%d", time.Now().UnixNano())
		result, err = database.DB.Exec(`
			INSERT INTO user_progress (
				id, user_id, track_id, last_position, 
				play_count, completion_rate, last_accessed, 
				created_at, updated_at
			) VALUES (
				$1, $2, $3, $4, 1, $5, $6, $6, $6
			)
		`, id, userIDStr, req.TrackID, req.Position, req.CompletionRate, now)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新播放进度失败"})
		return
	}

	// 检查是否成功更新
	rowsAffected, err := result.RowsAffected()
	if err != nil || rowsAffected == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新播放进度失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "播放进度已更新",
		"trackId":   req.TrackID,
		"position":  req.Position,
		"updatedAt": now,
	})
}
