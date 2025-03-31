// audio_import_handler.go
package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// 最大音频文件大小 (100MB)
const maxAudioFileSize int64 = 100 * 1024 * 1024

// 允许的音频MIME类型
var allowedAudioMimeTypes = map[string]bool{
	"audio/mpeg": true,
	"audio/mp3":  true,
	"audio/wav":  true,
	"audio/ogg":  true,
	"audio/flac": true,
	"audio/aac":  true,
	"audio/mp4":  true,
}

// 音频信息结构
type AudioInfo struct {
	TrackID      string    `json:"trackId"`
	Title        string    `json:"title"`
	Description  string    `json:"description,omitempty"`
	FileName     string    `json:"fileName"`
	FileSize     int64     `json:"fileSize"`
	Duration     float64   `json:"duration"`
	FileType     string    `json:"fileType"`
	UploadedBy   string    `json:"uploadedBy"`
	CreatedAt    time.Time `json:"createdAt"`
	CourseID     string    `json:"courseId"`
	UnitID       string    `json:"unitId"`
	FileChecksum string    `json:"fileChecksum"`
	SortOrder    int       `json:"sortOrder"`
}

// 音频导入处理
func importAudioHandler(c *gin.Context) {
	// 检查文件大小限制
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxAudioFileSize+1024) // 额外空间给表单字段

	// 解析multipart表单
	if err := c.Request.ParseMultipartForm(32 << 20); err != nil {
		if strings.Contains(err.Error(), "request body too large") {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "文件过大，最大支持100MB"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": "解析表单失败: " + err.Error()})
		return
	}

	// 获取令牌
	token := c.PostForm("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少授权令牌"})
		return
	}

	// 解析和验证令牌
	tokenData, err := ParseAccessToken(token, getAudioSecretKey())
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "无效的访问令牌"})
		return
	}

	// 验证令牌操作类型和有效期
	if err := tokenData.Validate("import_audio"); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	// 获取当前已验证的用户ID
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权的访问"})
		return
	}

	// 验证用户身份
	if tokenData.UserID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "访问被拒绝"})
		return
	}

	// 获取表单字段
	title := c.PostForm("title")
	description := c.PostForm("description")

	if title == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "音频标题不能为空"})
		return
	}

	// 获取上传的文件
	file, header, err := c.Request.FormFile("audioFile")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "获取上传文件失败: " + err.Error()})
		return
	}
	defer file.Close()

	// 检查文件大小
	if header.Size > maxAudioFileSize {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "文件过大，最大支持100MB"})
		return
	}

	// 检查文件类型
	fileType := header.Header.Get("Content-Type")
	if !allowedAudioMimeTypes[fileType] {
		// 如果Content-Type不匹配，尝试通过文件扩展名判断
		ext := strings.ToLower(filepath.Ext(header.Filename))
		valid := false
		for mime := range allowedAudioMimeTypes {
			if strings.HasSuffix(mime, ext[1:]) {
				valid = true
				fileType = mime
				break
			}
		}

		if !valid {
			c.JSON(http.StatusBadRequest, gin.H{"error": "不支持的文件类型"})
			return
		}
	}

	// 计算文件SHA-256校验和
	hasher := sha256.New()
	tempFile, err := os.CreateTemp("", "audio-upload-*"+filepath.Ext(header.Filename))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建临时文件失败"})
		return
	}
	tempFilePath := tempFile.Name()
	defer os.Remove(tempFilePath) // 清理临时文件

	// 复制文件到临时位置
	if _, err = io.Copy(io.MultiWriter(tempFile, hasher), file); err != nil {
		tempFile.Close()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "处理上传文件失败"})
		return
	}
	tempFile.Close()

	checksum := hex.EncodeToString(hasher.Sum(nil))

	// 生成唯一的音频ID
	trackID := generateTrackID()

	// 构建存储路径
	courseID := tokenData.CourseID
	unitID := tokenData.UnitID
	fileExt := filepath.Ext(header.Filename)
	if fileExt == "" {
		// 根据MIME类型分配默认扩展名
		fileExt = getDefaultExtension(fileType)
	}

	// 确保存储目录存在
	storagePath := filepath.Join(getEnv("AUDIO_FILES_PATH", "./storage/audio"), courseID, unitID, "custom")
	if err := os.MkdirAll(storagePath, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建存储目录失败"})
		return
	}

	// 构建文件名和完整路径
	fileName := trackID + fileExt
	filePath := filepath.Join(storagePath, fileName)

	// 复制临时文件到目标位置
	srcFile, err := os.Open(tempFilePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "读取临时文件失败"})
		return
	}
	defer srcFile.Close()

	dstFile, err := os.Create(filePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建目标文件失败"})
		return
	}
	defer dstFile.Close()

	if _, err = io.Copy(dstFile, srcFile); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存文件失败"})
		return
	}

	// 获取音频时长 (使用FFmpeg)
	duration, err := getAudioDuration(filePath)
	if err != nil {
		// 无法获取时长时，设置默认值为0
		duration = 0
	}

	// 计算新音轨的排序位置
	newSortOrder, err := getNextSortOrder(courseID, unitID, userID.(string))
	if err != nil {
		// 如果出错，使用一个较大值
		newSortOrder = 1000
	}

	// 创建音频信息
	audioInfo := AudioInfo{
		TrackID:      trackID,
		Title:        title,
		Description:  description,
		FileName:     header.Filename,
		FileSize:     header.Size,
		Duration:     duration,
		FileType:     fileType,
		UploadedBy:   userID.(string),
		CreatedAt:    time.Now(),
		CourseID:     courseID,
		UnitID:       unitID,
		FileChecksum: checksum,
		SortOrder:    newSortOrder,
	}

	// 保存音频信息到数据库或文件
	if err := saveAudioInfo(audioInfo); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存音频信息失败"})
		return
	}

	// 返回成功响应
	c.JSON(http.StatusOK, gin.H{
		"message":  "音频上传成功",
		"trackId":  trackID,
		"title":    title,
		"duration": duration,
		"fileSize": header.Size,
	})
}

// 生成唯一的音频ID
func generateTrackID() string {
	return "trk_" + strings.ReplaceAll(uuid.New().String(), "-", "")[:16]
}

// 根据MIME类型获取默认扩展名
func getDefaultExtension(mimeType string) string {
	switch mimeType {
	case "audio/mpeg", "audio/mp3":
		return ".mp3"
	case "audio/wav":
		return ".wav"
	case "audio/ogg":
		return ".ogg"
	case "audio/flac":
		return ".flac"
	case "audio/aac":
		return ".aac"
	case "audio/mp4":
		return ".m4a"
	default:
		return ".mp3" // 默认为.mp3
	}
}

// 获取音频时长（使用FFmpeg）
func getAudioDuration(filePath string) (float64, error) {
	// 使用FFmpeg获取音频元数据
	cmd := exec.Command("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath)
	output, err := cmd.Output()
	if err != nil {
		return 0, fmt.Errorf("运行FFmpeg失败: %w", err)
	}

	// 解析输出为浮点数（秒）
	durationStr := strings.TrimSpace(string(output))
	duration, err := strconv.ParseFloat(durationStr, 64)
	if err != nil {
		return 0, fmt.Errorf("解析时长失败: %w", err)
	}

	return duration, nil
}

// 获取下一个排序位置
func getNextSortOrder(courseID, unitID, userID string) (int, error) {
	// 获取用户的自定义音轨
	tracks, err := getUserCustomTracks(userID, courseID, unitID)
	if err != nil {
		return 0, err
	}

	// 找出最大排序值
	maxSort := 0
	for _, track := range tracks {
		if track.SortOrder > maxSort {
			maxSort = track.SortOrder
		}
	}

	// 获取系统轨道
	systemTracks, err := getSystemTracks(courseID, unitID)
	if err != nil {
		return maxSort + 1, nil // 如果获取系统轨道失败，返回已知的最大值+1
	}

	// 查找系统轨道中的最大排序值
	for _, track := range systemTracks {
		if track.SortOrder > maxSort {
			maxSort = track.SortOrder
		}
	}

	// 返回最大值+1
	return maxSort + 1, nil
}

// 保存音频信息（示例实现，实际应存入数据库）
func saveAudioInfo(info AudioInfo) error {
	// 在实际应用中，这里应该将信息保存到数据库
	// 这是一个简化的示例，将信息保存为JSON文件

	// 创建元数据目录
	metadataDir := filepath.Join(getEnv("AUDIO_METADATA_PATH", "./storage/metadata"), info.CourseID, info.UnitID)
	if err := os.MkdirAll(metadataDir, 0755); err != nil {
		return fmt.Errorf("创建元数据目录失败: %w", err)
	}

	// 将音频信息序列化为JSON
	data, err := json.Marshal(info)
	if err != nil {
		return fmt.Errorf("序列化音频信息失败: %w", err)
	}

	// 写入元数据文件
	metadataPath := filepath.Join(metadataDir, info.TrackID+".json")
	if err := os.WriteFile(metadataPath, data, 0644); err != nil {
		return fmt.Errorf("保存元数据文件失败: %w", err)
	}

	return nil
}
