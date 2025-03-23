// audio_handlers.go
package main

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

// 简化的令牌请求结构
type StreamTokenRequest struct {
	Token string `json:"token" binding:"required"`
}

// 简化的音频流处理函数 - 支持单一质量音频文件
func streamAudioHandler(c *gin.Context) {
	var req StreamTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的请求格式"})
		return
	}

	// 获取当前已验证的用户ID
	userID, exists := c.Get("userId")
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
	if err := token.Validate("stream_audio"); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	// 验证用户身份
	if token.UserID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "访问被拒绝"})
		return
	}

	// 构建音频文件路径 - 支持系统音频和用户上传的音频
	audioPath, err := getAudioFilePath(token.CourseID, token.UnitID, token.TrackID)
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

	// 处理范围请求（如果有）
	rangeHeader := c.Request.Header.Get("Range")
	if rangeHeader != "" {
		// 解析范围请求
		ranges, err := parseRange(rangeHeader, fileInfo.Size())
		if err != nil {
			c.JSON(http.StatusRequestedRangeNotSatisfiable, gin.H{"error": "请求范围无效"})
			return
		}

		// 目前只支持单范围请求
		if len(ranges) > 1 {
			c.JSON(http.StatusRequestedRangeNotSatisfiable, gin.H{"error": "不支持多范围请求"})
			return
		}

		// 设置内容范围头
		c.Header("Content-Range", fmt.Sprintf("bytes %d-%d/%d", ranges[0].Start, ranges[0].End, fileInfo.Size()))
		c.Header("Content-Length", strconv.FormatInt(ranges[0].Length, 10))
		c.Status(http.StatusPartialContent)

		// 移动到范围起始位置
		audioFile.Seek(ranges[0].Start, io.SeekStart)

		// 流式传输部分文件
		written, err := io.CopyN(c.Writer, audioFile, ranges[0].Length)
		if err != nil && err != io.EOF {
			c.Status(http.StatusInternalServerError)
			return
		}

		if written != ranges[0].Length {
			c.Status(http.StatusInternalServerError)
			return
		}
	} else {
		// 流式传输整个文件
		c.Header("Content-Length", strconv.FormatInt(fileInfo.Size(), 10))
		c.Header("Accept-Ranges", "bytes")

		// 设置内容类型
		contentType := getContentType(audioPath)
		c.Header("Content-Type", contentType)

		// 禁止缓存和下载
		c.Header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
		c.Header("Pragma", "no-cache")
		c.Header("Expires", "0")
		c.Header("Content-Disposition", "inline")

		// 流式传输文件
		http.ServeContent(c.Writer, c.Request, "", fileInfo.ModTime(), audioFile)
	}
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
	userID, exists := c.Get("userId")
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
	userID, exists := c.Get("userId")
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
