// track_management_handlers.go
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/YYvanYang/Language-Learning-Audio-Player/backend/database"
	"github.com/gin-gonic/gin"
)

// 更新音轨请求
type UpdateTrackRequest struct {
	Token string `json:"token" binding:"required"`
	Title string `json:"title" binding:"required"`
}

// 重排序音轨请求
type ReorderTrackRequest struct {
	Token       string `json:"token" binding:"required"`
	NewPosition int    `json:"newPosition" binding:"required"`
}

// 删除音轨请求
type DeleteTrackRequest struct {
	Token string `json:"token" binding:"required"`
}

// 将TrackProgressRequest重命名为UserTrackProgressRequest
type UserTrackProgressRequest struct {
	TrackID        string  `json:"trackId" binding:"required"`
	Position       float64 `json:"position" binding:"required,gte=0"`
	CompletionRate float64 `json:"completionRate" binding:"required,gte=0,lte=100"`
}

// 更新音轨处理函数
func updateTrackHandler(c *gin.Context) {
	var req UpdateTrackRequest
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
	if err := token.Validate("update_track"); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	// 验证用户身份
	if token.UserID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "访问被拒绝"})
		return
	}

	// 获取音轨信息
	audioInfo, err := getAudioInfo(token.CourseID, token.UnitID, token.TrackID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "音轨不存在"})
		return
	}

	// 验证是否是自己上传的音轨
	if audioInfo.UploadedBy != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "只能修改自己上传的音轨"})
		return
	}

	// 更新标题
	audioInfo.Title = req.Title

	// 保存更新后的音轨信息
	if err := saveAudioInfo(*audioInfo); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存音轨信息失败"})
		return
	}

	// 返回成功响应
	c.JSON(http.StatusOK, gin.H{
		"message": "音轨更新成功",
		"trackId": token.TrackID,
		"title":   req.Title,
	})
}

// 重排序音轨处理函数
func reorderTrackHandler(c *gin.Context) {
	var req ReorderTrackRequest
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
	if err := token.Validate("reorder_track"); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	// 验证用户身份
	if token.UserID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "访问被拒绝"})
		return
	}

	// 获取音轨信息
	audioInfo, err := getAudioInfo(token.CourseID, token.UnitID, token.TrackID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "音轨不存在"})
		return
	}

	// 验证是否是自己上传的音轨
	if audioInfo.UploadedBy != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "只能修改自己上传的音轨"})
		return
	}

	// 更新排序位置
	audioInfo.SortOrder = req.NewPosition

	// 保存更新后的音轨信息
	if err := saveAudioInfo(*audioInfo); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存音轨信息失败"})
		return
	}

	// 返回成功响应
	c.JSON(http.StatusOK, gin.H{
		"message": "音轨排序更新成功",
		"trackId": token.TrackID,
	})
}

// 删除音轨处理函数
func deleteTrackHandler(c *gin.Context) {
	var req DeleteTrackRequest
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
	if err := token.Validate("delete_track"); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	// 验证用户身份
	if token.UserID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "访问被拒绝"})
		return
	}

	// 获取音轨信息
	audioInfo, err := getAudioInfo(token.CourseID, token.UnitID, token.TrackID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "音轨不存在"})
		return
	}

	// 验证是否是自己上传的音轨
	if audioInfo.UploadedBy != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "只能删除自己上传的音轨"})
		return
	}

	// 删除音频文件
	customFolder := filepath.Join(getEnv("AUDIO_FILES_PATH", "./storage/audio"), token.CourseID, token.UnitID, "custom")
	for _, ext := range []string{".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a"} {
		audioFilePath := filepath.Join(customFolder, token.TrackID+ext)
		if _, err := os.Stat(audioFilePath); err == nil {
			if err := os.Remove(audioFilePath); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "删除音频文件失败"})
				return
			}
			break
		}
	}

	// 删除元数据文件
	metadataPath := filepath.Join(getEnv("AUDIO_METADATA_PATH", "./storage/metadata"), token.CourseID, token.UnitID, token.TrackID+".json")
	if err := os.Remove(metadataPath); err != nil {
		if !os.IsNotExist(err) {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "删除元数据文件失败"})
			return
		}
	}

	// 返回成功响应
	c.JSON(http.StatusOK, gin.H{
		"message": "音轨删除成功",
		"trackId": token.TrackID,
	})
}

// 获取音轨信息
func getAudioInfo(courseID, unitID, trackID string) (*AudioInfo, error) {
	// 构建元数据文件路径
	metadataPath := filepath.Join(getEnv("AUDIO_METADATA_PATH", "./storage/metadata"), courseID, unitID, trackID+".json")

	// 读取元数据文件
	data, err := os.ReadFile(metadataPath)
	if err != nil {
		return nil, fmt.Errorf("读取元数据文件失败: %w", err)
	}

	// 解析JSON
	var audioInfo AudioInfo
	if err := json.Unmarshal(data, &audioInfo); err != nil {
		return nil, fmt.Errorf("解析音轨信息失败: %w", err)
	}

	return &audioInfo, nil
}

// 将updateTrackProgressHandler重命名为updateUserTrackProgressHandler
func updateUserTrackProgressHandler(c *gin.Context) {
	// 获取当前用户ID
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	// 解析请求体
	var req UserTrackProgressRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的请求数据"})
		return
	}

	// 记录播放进度
	err := saveTrackProgress(userID.(string), req.TrackID, req.Position, req.CompletionRate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存进度失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// 保存用户音轨播放进度
func saveTrackProgress(userID string, trackID string, position float64, completionRate float64) error {
	// 获取当前时间
	now := time.Now()

	// 更新或插入进度记录
	query := `
		INSERT INTO user_track_progress 
		(user_id, track_id, position, completion_rate, last_updated) 
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (user_id, track_id) 
		DO UPDATE SET 
			position = $3, 
			completion_rate = $4, 
			last_updated = $5
	`

	_, err := database.DB.Exec(query, userID, trackID, position, completionRate, now)
	if err != nil {
		log.Printf("保存进度失败: %v", err)
		return err
	}

	// 更新最近播放记录
	err = updateRecentlyPlayed(userID, trackID, position)
	if err != nil {
		log.Printf("更新最近播放失败: %v", err)
		// 不影响主要功能，继续执行
	}

	return nil
}

// 更新最近播放记录
func updateRecentlyPlayed(userID string, trackID string, position float64) error {
	// 获取当前时间
	now := time.Now()

	// 更新或插入最近播放记录
	query := `
		INSERT INTO recently_played_tracks 
		(user_id, track_id, position, accessed_at) 
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (user_id, track_id) 
		DO UPDATE SET 
			position = $3, 
			accessed_at = $4
	`

	_, err := database.DB.Exec(query, userID, trackID, position, now)
	if err != nil {
		return err
	}

	// 可选：保持最近播放列表不超过一定大小（例如30个）
	cleanupQuery := `
		DELETE FROM recently_played_tracks
		WHERE user_id = $1 AND (user_id, track_id) NOT IN (
			SELECT user_id, track_id
			FROM recently_played_tracks
			WHERE user_id = $1
			ORDER BY accessed_at DESC
			LIMIT 30
		)
	`

	_, err = database.DB.Exec(cleanupQuery, userID)
	return err
}

// 获取最近播放音轨
// @Summary 获取最近播放记录
// @Description 获取用户最近播放过的音轨列表
// @Tags tracks
// @Accept json
// @Produce json
// @Success 200 {array} RecentTrackInfo "最近播放列表"
// @Failure 401 {object} ErrorResponse "未授权访问"
// @Router /api/recent-tracks [get]
// @Security BearerAuth
func getRecentTracksHandler(c *gin.Context) {
	// 获取当前用户ID
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权"})
		return
	}

	// 查询最近播放记录
	recentTracks, err := getRecentlyPlayedTracks(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取最近播放记录失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"tracks": recentTracks})
}

// 最近播放音轨信息
type RecentTrackInfo struct {
	ID             string    `json:"id"`
	Title          string    `json:"title"`
	CourseID       string    `json:"courseId"`
	UnitID         string    `json:"unitId"`
	CourseName     string    `json:"courseName"`
	LastPosition   float64   `json:"lastPosition"`
	LastAccessed   time.Time `json:"lastAccessed"`
	CompletionRate float64   `json:"completionRate,omitempty"`
}

// 获取用户最近播放的音轨
func getRecentlyPlayedTracks(userID string) ([]RecentTrackInfo, error) {
	// 查询最近播放记录，并关联课程和单元信息
	query := `
		SELECT 
			t.id, t.title, c.id AS course_id, u.id AS unit_id, 
			c.title AS course_name, r.position, r.accessed_at,
			COALESCE(p.completion_rate, 0) AS completion_rate
		FROM recently_played_tracks r
		JOIN tracks t ON r.track_id = t.id
		JOIN units u ON t.unit_id = u.id
		JOIN courses c ON u.course_id = c.id
		LEFT JOIN user_track_progress p ON r.user_id = p.user_id AND r.track_id = p.track_id
		WHERE r.user_id = $1
		ORDER BY r.accessed_at DESC
		LIMIT 10
	`

	rows, err := database.DB.Query(query, userID)
	if err != nil {
		log.Printf("查询最近播放记录失败: %v", err)
		return nil, err
	}
	defer rows.Close()

	var tracks []RecentTrackInfo
	for rows.Next() {
		var track RecentTrackInfo
		var lastAccessed time.Time

		err := rows.Scan(
			&track.ID, &track.Title, &track.CourseID, &track.UnitID,
			&track.CourseName, &track.LastPosition, &lastAccessed,
			&track.CompletionRate,
		)
		if err != nil {
			log.Printf("扫描最近播放记录行失败: %v", err)
			continue
		}

		track.LastAccessed = lastAccessed
		tracks = append(tracks, track)
	}

	return tracks, nil
}
