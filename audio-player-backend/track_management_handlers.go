// track_management_handlers.go
package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"

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

// 更新音轨处理函数
func updateTrackHandler(c *gin.Context) {
	var req UpdateTrackRequest
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
