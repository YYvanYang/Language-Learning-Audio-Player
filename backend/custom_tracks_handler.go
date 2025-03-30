// custom_tracks_handler.go
package main

import (
	"database/sql"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/YYvanYang/Language-Learning-Audio-Player/backend/database"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// 自定义音轨结构体
type CustomTrack struct {
	ID          string    `json:"id"`
	CourseID    string    `json:"courseId"`
	UnitID      string    `json:"unitId"`
	UserID      string    `json:"userId"`
	Title       string    `json:"title"`
	ChineseName string    `json:"chineseName,omitempty"`
	FilePath    string    `json:"-"`
	FileSize    int64     `json:"fileSize"`
	Duration    float64   `json:"duration"`
	Format      string    `json:"format"`
	SortOrder   int       `json:"sortOrder"`
	Custom      bool      `json:"custom"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// 获取用户自定义音轨列表
func getUserCustomTracksHandler(c *gin.Context) {
	// 获取参数
	courseID := c.Param("courseId")
	unitID := c.Param("unitId")

	if courseID == "" || unitID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "课程ID和单元ID不能为空"})
		return
	}

	// 获取当前用户ID
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	// 查询数据库，获取用户在指定课程和单元下的自定义音轨
	tracks, err := getCustomTracks(userID.(string), courseID, unitID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取自定义音轨失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"tracks": tracks,
	})
}

// 从数据库获取自定义音轨
func getCustomTracks(userID, courseID, unitID string) ([]CustomTrack, error) {
	query := `
		SELECT id, course_id, unit_id, user_id, title, chinese_name, 
		       file_path, file_size, duration, format, sort_order, 
		       created_at, updated_at
		FROM custom_tracks
		WHERE user_id = $1 AND course_id = $2 AND unit_id = $3
		ORDER BY sort_order ASC
	`

	rows, err := database.DB.Query(query, userID, courseID, unitID)
	if err != nil {
		log.Printf("查询自定义音轨失败: %v", err)
		return nil, err
	}
	defer rows.Close()

	var tracks []CustomTrack
	for rows.Next() {
		var track CustomTrack
		var createdAt, updatedAt time.Time

		err := rows.Scan(
			&track.ID, &track.CourseID, &track.UnitID, &track.UserID,
			&track.Title, &track.ChineseName, &track.FilePath, &track.FileSize,
			&track.Duration, &track.Format, &track.SortOrder,
			&createdAt, &updatedAt,
		)
		if err != nil {
			log.Printf("扫描自定义音轨行失败: %v", err)
			continue
		}

		track.CreatedAt = createdAt
		track.UpdatedAt = updatedAt
		track.Custom = true // 标记为自定义音轨

		tracks = append(tracks, track)
	}

	return tracks, nil
}

// 删除自定义音轨
func deleteCustomTrackHandler(c *gin.Context) {
	// 获取参数
	courseID := c.Param("courseId")
	unitID := c.Param("unitId")
	trackID := c.Param("trackId")

	if courseID == "" || unitID == "" || trackID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数不完整"})
		return
	}

	// 获取当前用户ID
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	// 验证用户是否有权限删除这个音轨
	track, err := getCustomTrackByID(trackID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "音轨不存在"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "查询音轨失败"})
		}
		return
	}

	// 检查音轨所有权
	if track.UserID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "无权限删除此音轨"})
		return
	}

	// 删除音轨记录
	err = deleteCustomTrack(trackID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除音轨失败"})
		return
	}

	// 尝试删除文件（如果存在）
	if track.FilePath != "" {
		// 忽略文件删除错误，不影响API响应
		_ = deleteAudioFile(track.FilePath)
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "音轨已成功删除",
	})
}

// 根据ID获取自定义音轨
func getCustomTrackByID(trackID string) (CustomTrack, error) {
	var track CustomTrack
	var createdAt, updatedAt time.Time

	query := `
		SELECT id, course_id, unit_id, user_id, title, chinese_name, 
		       file_path, file_size, duration, format, sort_order, 
		       created_at, updated_at
		FROM custom_tracks
		WHERE id = $1
	`

	err := database.DB.QueryRow(query, trackID).Scan(
		&track.ID, &track.CourseID, &track.UnitID, &track.UserID,
		&track.Title, &track.ChineseName, &track.FilePath, &track.FileSize,
		&track.Duration, &track.Format, &track.SortOrder,
		&createdAt, &updatedAt,
	)

	if err != nil {
		return CustomTrack{}, err
	}

	track.CreatedAt = createdAt
	track.UpdatedAt = updatedAt
	track.Custom = true

	return track, nil
}

// 删除自定义音轨记录
func deleteCustomTrack(trackID string) error {
	query := `DELETE FROM custom_tracks WHERE id = $1`
	_, err := database.DB.Exec(query, trackID)
	return err
}

// 删除音频文件
func deleteAudioFile(filePath string) error {
	// 确保路径安全，防止目录遍历攻击
	fullPath := filepath.Join("storage", filePath)
	// 执行删除
	return removeFile(fullPath)
}

// 更新自定义音轨标题
func updateCustomTrackHandler(c *gin.Context) {
	// 获取参数
	courseID := c.Param("courseId")
	unitID := c.Param("unitId")
	trackID := c.Param("trackId")

	if courseID == "" || unitID == "" || trackID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数不完整"})
		return
	}

	// 获取当前用户ID
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	// 解析请求体
	var updateRequest struct {
		Title       string `json:"title"`
		ChineseName string `json:"chineseName,omitempty"`
	}

	if err := c.ShouldBindJSON(&updateRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的请求数据"})
		return
	}

	if updateRequest.Title == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "标题不能为空"})
		return
	}

	// 验证用户是否有权限更新这个音轨
	track, err := getCustomTrackByID(trackID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "音轨不存在"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "查询音轨失败"})
		}
		return
	}

	// 检查音轨所有权
	if track.UserID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "无权限更新此音轨"})
		return
	}

	// 更新音轨标题
	err = updateCustomTrackTitle(trackID, updateRequest.Title, updateRequest.ChineseName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新音轨失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "音轨已成功更新",
		"track": gin.H{
			"id":          trackID,
			"title":       updateRequest.Title,
			"chineseName": updateRequest.ChineseName,
		},
	})
}

// 更新自定义音轨标题
func updateCustomTrackTitle(trackID, title, chineseName string) error {
	query := `
		UPDATE custom_tracks
		SET title = $1, chinese_name = $2, updated_at = $3
		WHERE id = $4
	`
	_, err := database.DB.Exec(query, title, chineseName, time.Now(), trackID)
	return err
}

// 重排序自定义音轨
func reorderCustomTrackHandler(c *gin.Context) {
	// 获取参数
	courseID := c.Param("courseId")
	unitID := c.Param("unitId")
	trackID := c.Param("trackId")

	if courseID == "" || unitID == "" || trackID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数不完整"})
		return
	}

	// 获取当前用户ID
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	// 解析请求体
	var reorderRequest struct {
		SortOrder int `json:"sortOrder"`
	}

	if err := c.ShouldBindJSON(&reorderRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的请求数据"})
		return
	}

	// 验证用户是否有权限更新这个音轨
	track, err := getCustomTrackByID(trackID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "音轨不存在"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "查询音轨失败"})
		}
		return
	}

	// 检查音轨所有权
	if track.UserID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "无权限更新此音轨"})
		return
	}

	// 更新音轨排序
	err = updateCustomTrackSortOrder(trackID, reorderRequest.SortOrder)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新音轨排序失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "音轨排序已成功更新",
		"track": gin.H{
			"id":        trackID,
			"sortOrder": reorderRequest.SortOrder,
		},
	})
}

// 更新自定义音轨排序
func updateCustomTrackSortOrder(trackID string, sortOrder int) error {
	query := `
		UPDATE custom_tracks
		SET sort_order = $1, updated_at = $2
		WHERE id = $3
	`
	_, err := database.DB.Exec(query, sortOrder, time.Now(), trackID)
	return err
}

// 添加自定义音轨
func addCustomTrackHandler(c *gin.Context) {
	// 获取参数
	courseID := c.PostForm("courseId")
	unitID := c.PostForm("unitId")
	title := c.PostForm("title")
	chineseName := c.PostForm("chineseName")

	if courseID == "" || unitID == "" || title == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "必须提供课程ID、单元ID和标题"})
		return
	}

	// 获取当前用户ID
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	// 获取音频文件
	file, err := c.FormFile("audioFile")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无法获取音频文件"})
		return
	}

	// 生成唯一文件名
	fileName := fmt.Sprintf("%s-%s", uuid.New().String(), filepath.Base(file.Filename))
	filePath := filepath.Join("audio", "custom", fileName)
	fullPath := filepath.Join("storage", filePath)

	// 保存文件
	if err := c.SaveUploadedFile(file, fullPath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存文件失败"})
		return
	}

	// 分析音频文件，获取时长和格式信息
	duration, format, err := analyzeAudioFile(fullPath)
	if err != nil {
		// 如果分析失败，尝试删除文件，但继续处理，使用默认值
		_ = removeFile(fullPath)
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的音频文件"})
		return
	}

	// 创建自定义音轨记录
	trackID := uuid.New().String()
	now := time.Now()

	// 获取最大排序值
	maxSortOrder, err := getMaxSortOrder(userID.(string), courseID, unitID)
	if err != nil {
		log.Printf("获取最大排序值失败: %v", err)
		// 使用默认值
		maxSortOrder = 0
	}

	// 创建新的音轨记录
	track := CustomTrack{
		ID:          trackID,
		CourseID:    courseID,
		UnitID:      unitID,
		UserID:      userID.(string),
		Title:       title,
		ChineseName: chineseName,
		FilePath:    filePath,
		FileSize:    file.Size,
		Duration:    duration,
		Format:      format,
		SortOrder:   maxSortOrder + 1, // 新音轨放在最后
		Custom:      true,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	// 保存到数据库
	err = saveCustomTrack(track)
	if err != nil {
		// 如果保存失败，删除文件
		_ = removeFile(fullPath)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存音轨信息失败"})
		return
	}

	// 返回成功结果
	c.JSON(http.StatusCreated, gin.H{
		"message": "音轨已成功添加",
		"track": gin.H{
			"id":          trackID,
			"title":       title,
			"chineseName": chineseName,
			"duration":    duration,
			"format":      format,
			"fileSize":    file.Size,
			"sortOrder":   track.SortOrder,
			"custom":      true,
		},
	})
}

// 获取最大排序值
func getMaxSortOrder(userID, courseID, unitID string) (int, error) {
	query := `
		SELECT COALESCE(MAX(sort_order), 0)
		FROM custom_tracks
		WHERE user_id = $1 AND course_id = $2 AND unit_id = $3
	`

	var maxOrder int
	err := database.DB.QueryRow(query, userID, courseID, unitID).Scan(&maxOrder)
	if err != nil {
		return 0, err
	}

	return maxOrder, nil
}

// 保存自定义音轨到数据库
func saveCustomTrack(track CustomTrack) error {
	query := `
		INSERT INTO custom_tracks (
			id, course_id, unit_id, user_id, title, chinese_name,
			file_path, file_size, duration, format, sort_order,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`

	_, err := database.DB.Exec(
		query,
		track.ID, track.CourseID, track.UnitID, track.UserID,
		track.Title, track.ChineseName, track.FilePath, track.FileSize,
		track.Duration, track.Format, track.SortOrder,
		track.CreatedAt, track.UpdatedAt,
	)

	return err
}

// 删除文件
func removeFile(path string) error {
	// 在实际实现中应该做路径检查，防止恶意删除
	return os.Remove(path)
}

// 分析音频文件获取时长和格式
func analyzeAudioFile(filePath string) (float64, string, error) {
	// 实际项目中应使用ffprobe或类似工具分析音频文件
	// 为简洁起见，这里使用简化实现

	// 检查文件是否存在
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		return 0, "", fmt.Errorf("无法访问文件: %w", err)
	}

	// 获取文件扩展名作为格式
	ext := strings.ToLower(filepath.Ext(filePath))
	if ext == "" {
		ext = ".mp3" // 默认格式
	} else if ext[0] == '.' {
		ext = ext[1:] // 移除前导点
	}

	// 简单估算时长（仅用于演示）
	// 在实际应用中应使用专业工具获取准确时长
	var estimatedDuration float64

	// 根据文件大小和格式估算时长
	// 这些数值只是粗略估计，不应用于生产环境
	switch ext {
	case "mp3":
		// ~128kbps MP3
		estimatedDuration = float64(fileInfo.Size()) / (128 * 1024 / 8)
	case "wav":
		// ~1411kbps 无压缩WAV (16-bit, 44.1kHz, stereo)
		estimatedDuration = float64(fileInfo.Size()) / (1411 * 1024 / 8)
	case "ogg", "opus":
		// ~96kbps OGG/Opus
		estimatedDuration = float64(fileInfo.Size()) / (96 * 1024 / 8)
	case "m4a", "aac":
		// ~256kbps AAC
		estimatedDuration = float64(fileInfo.Size()) / (256 * 1024 / 8)
	default:
		// 默认128kbps
		estimatedDuration = float64(fileInfo.Size()) / (128 * 1024 / 8)
		ext = "unknown"
	}

	// 确保时长在合理范围内
	if estimatedDuration < 0.1 {
		estimatedDuration = 0.1
	} else if estimatedDuration > 7200 {
		// 限制最大时长为2小时
		estimatedDuration = 7200
	}

	return estimatedDuration, ext, nil
}
