// custom_tracks_handler.go
package main

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/gin-gonic/gin"
)

// 自定义音轨数据响应
type CustomTracksResponse struct {
	Tracks []TrackInfo `json:"tracks"`
}

// 获取用户自定义音轨列表
func getCustomTracksHandler(c *gin.Context) {
	// 获取URL参数
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

	// 获取用户自定义音轨列表
	tracks, err := getUserCustomTracks(userID.(string), courseID, unitID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取自定义音轨失败"})
		return
	}

	// 返回响应
	c.JSON(http.StatusOK, CustomTracksResponse{
		Tracks: tracks,
	})
}

// 获取用户自定义音轨列表
func getUserCustomTracks(userID, courseID, unitID string) ([]TrackInfo, error) {
	// 创建结果列表
	var tracks []TrackInfo

	// 构建元数据目录路径
	metadataDir := filepath.Join(getEnv("AUDIO_METADATA_PATH", "./storage/metadata"), courseID, unitID)

	// 检查目录是否存在
	if _, err := os.Stat(metadataDir); os.IsNotExist(err) {
		// 目录不存在，返回空列表
		return tracks, nil
	}

	// 遍历元数据目录
	err := filepath.WalkDir(metadataDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		// 只处理JSON文件
		if !d.IsDir() && strings.HasSuffix(d.Name(), ".json") {
			// 读取元数据文件
			data, err := os.ReadFile(path)
			if err != nil {
				return fmt.Errorf("读取元数据文件失败: %w", err)
			}

			// 解析音轨信息
			var audioInfo AudioInfo
			if err := json.Unmarshal(data, &audioInfo); err != nil {
				return fmt.Errorf("解析音轨信息失败: %w", err)
			}

			// 只包含当前用户上传的音轨
			if audioInfo.UploadedBy == userID {
				// 转换为轨道信息
				trackInfo := TrackInfo{
					ID:          audioInfo.TrackID,
					Title:       audioInfo.Title,
					ChineseName: "自定义音频",
					Duration:    audioInfo.Duration,
					Custom:      true,
					SortOrder:   audioInfo.SortOrder,
				}

				tracks = append(tracks, trackInfo)
			}
		}

		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("遍历元数据目录失败: %w", err)
	}

	// 按SortOrder排序
	sort.Slice(tracks, func(i, j int) bool {
		return tracks[i].SortOrder < tracks[j].SortOrder
	})

	return tracks, nil
}
