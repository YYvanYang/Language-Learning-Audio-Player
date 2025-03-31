package service

import (
	"errors"
	"fmt"
	"time"

	"github.com/YYvanYang/Language-Learning-Audio-Player/backend/internal/domain"
	"github.com/YYvanYang/Language-Learning-Audio-Player/backend/internal/utils/logger"

	"go.uber.org/zap"
)

// TrackService 音轨服务
type TrackService struct {
	trackRepo domain.TrackRepository
}

// NewTrackService 创建音轨服务实例
func NewTrackService(trackRepo domain.TrackRepository) *TrackService {
	return &TrackService{
		trackRepo: trackRepo,
	}
}

// GetTrackByID 通过ID获取音轨信息
func (s *TrackService) GetTrackByID(id string) (*domain.Track, error) {
	logger.Debug("获取音轨", zap.String("id", id))
	track, err := s.trackRepo.FindByID(id)
	if err != nil {
		logger.Error("获取音轨失败", zap.String("id", id), zap.Error(err))
		return nil, err
	}
	return track, nil
}

// GetUnitTracks 获取单元内的所有音轨
func (s *TrackService) GetUnitTracks(unitID string) ([]*domain.Track, error) {
	logger.Debug("获取单元音轨", zap.String("unitID", unitID))
	tracks, err := s.trackRepo.FindByUnitID(unitID, false)
	if err != nil {
		logger.Error("获取单元音轨失败", zap.String("unitID", unitID), zap.Error(err))
		return nil, err
	}
	return tracks, nil
}

// CreateTrack 创建新音轨
func (s *TrackService) CreateTrack(req domain.CreateTrackRequest) (*domain.Track, error) {
	logger.Info("创建新音轨", zap.String("title", req.Title), zap.String("unitID", req.UnitID))

	// 创建音轨对象
	track := &domain.Track{
		UnitID:      req.UnitID,
		Title:       req.Title,
		Description: req.Description,
		FilePath:    req.FilePath,
		Duration:    req.Duration,
		OrderIndex:  req.OrderIndex,
		IsSystem:    req.IsSystem,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	// 保存音轨
	err := s.trackRepo.Create(track)
	if err != nil {
		logger.Error("创建音轨失败", zap.String("title", req.Title), zap.Error(err))
		return nil, err
	}

	logger.Info("音轨创建成功", zap.String("id", track.ID), zap.String("title", track.Title))
	return track, nil
}

// UpdateTrack 更新音轨信息
func (s *TrackService) UpdateTrack(id string, req domain.UpdateTrackRequest) (*domain.Track, error) {
	logger.Info("更新音轨", zap.String("id", id))

	// 获取现有音轨
	track, err := s.trackRepo.FindByID(id)
	if err != nil {
		logger.Error("更新音轨失败：音轨不存在", zap.String("id", id), zap.Error(err))
		return nil, err
	}

	// 更新字段
	if req.Title != "" {
		track.Title = req.Title
	}
	if req.Description != "" {
		track.Description = req.Description
	}
	if req.FilePath != "" {
		track.FilePath = req.FilePath
	}
	if req.Duration > 0 {
		track.Duration = req.Duration
	}
	if req.OrderIndex > 0 {
		track.OrderIndex = req.OrderIndex
	}

	track.UpdatedAt = time.Now()

	// 保存更新
	err = s.trackRepo.Update(track)
	if err != nil {
		logger.Error("更新音轨失败", zap.String("id", id), zap.Error(err))
		return nil, err
	}

	logger.Info("音轨更新成功", zap.String("id", track.ID))
	return track, nil
}

// DeleteTrack 删除音轨
func (s *TrackService) DeleteTrack(id string) error {
	logger.Info("删除音轨", zap.String("id", id))

	// 检查音轨是否存在
	_, err := s.trackRepo.FindByID(id)
	if err != nil {
		logger.Error("删除音轨失败：音轨不存在", zap.String("id", id), zap.Error(err))
		return err
	}

	// 删除音轨
	err = s.trackRepo.Delete(id)
	if err != nil {
		logger.Error("删除音轨失败", zap.String("id", id), zap.Error(err))
		return err
	}

	logger.Info("音轨删除成功", zap.String("id", id))
	return nil
}

// ReorderTracks 重新排序单元内的音轨
func (s *TrackService) ReorderTracks(unitID string, req domain.ReorderTracksRequest) error {
	logger.Info("重新排序单元音轨", zap.String("unitID", unitID), zap.Strings("trackIDs", req.TrackIDs))

	// 重新排序
	err := s.trackRepo.ReorderTracks(unitID, req.TrackIDs)
	if err != nil {
		logger.Error("重新排序音轨失败", zap.String("unitID", unitID), zap.Error(err))
		return err
	}

	logger.Info("音轨重新排序成功", zap.String("unitID", unitID))
	return nil
}

// GetTrackBookmarks 获取音轨的书签
func (s *TrackService) GetTrackBookmarks(userID, trackID string) ([]*domain.Bookmark, error) {
	logger.Debug("获取音轨书签", zap.String("userID", userID), zap.String("trackID", trackID))
	bookmarks, err := s.trackRepo.FindBookmarksByTrack(userID, trackID)
	if err != nil {
		logger.Error("获取音轨书签失败", zap.String("trackID", trackID), zap.Error(err))
		return nil, err
	}
	return bookmarks, nil
}

// CreateBookmark 创建书签
func (s *TrackService) CreateBookmark(userID string, req domain.CreateBookmarkRequest) (*domain.Bookmark, error) {
	logger.Info("创建书签", zap.String("userID", userID), zap.String("trackID", req.TrackID))

	// 创建书签对象
	bookmark := &domain.Bookmark{
		UserID:      userID,
		TrackID:     req.TrackID,
		Position:    req.Position,
		Label:       req.Label,
		Description: req.Description,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	// 保存书签
	err := s.trackRepo.CreateBookmark(bookmark)
	if err != nil {
		logger.Error("创建书签失败", zap.String("trackID", req.TrackID), zap.Error(err))
		return nil, err
	}

	logger.Info("书签创建成功", zap.String("id", bookmark.ID))
	return bookmark, nil
}

// UpdateBookmark 更新书签
func (s *TrackService) UpdateBookmark(id string, userID string, req domain.UpdateBookmarkRequest) (*domain.Bookmark, error) {
	logger.Info("更新书签", zap.String("id", id), zap.String("userID", userID))

	// 获取现有书签
	bookmarks, err := s.trackRepo.FindBookmarksByTrack(userID, "")
	if err != nil {
		logger.Error("更新书签失败", zap.String("id", id), zap.Error(err))
		return nil, err
	}

	var bookmark *domain.Bookmark
	for _, b := range bookmarks {
		if b.ID == id {
			bookmark = b
			break
		}
	}

	if bookmark == nil {
		err = errors.New("书签不存在或无权限")
		logger.Error("更新书签失败：书签不存在", zap.String("id", id))
		return nil, err
	}

	// 确保用户只能更新自己的书签
	if bookmark.UserID != userID {
		err = errors.New("无权限更新此书签")
		logger.Error("更新书签失败：无权限", zap.String("id", id), zap.String("userID", userID))
		return nil, err
	}

	// 更新字段
	if req.Position > 0 {
		bookmark.Position = req.Position
	}
	if req.Label != "" {
		bookmark.Label = req.Label
	}
	if req.Description != "" {
		bookmark.Description = req.Description
	}

	bookmark.UpdatedAt = time.Now()

	// 保存更新
	err = s.trackRepo.UpdateBookmark(bookmark)
	if err != nil {
		logger.Error("更新书签失败", zap.String("id", id), zap.Error(err))
		return nil, err
	}

	logger.Info("书签更新成功", zap.String("id", bookmark.ID))
	return bookmark, nil
}

// DeleteBookmark 删除书签
func (s *TrackService) DeleteBookmark(id string, userID string) error {
	logger.Info("删除书签", zap.String("id", id), zap.String("userID", userID))

	// 获取书签列表，查找要删除的书签
	bookmarks, err := s.trackRepo.FindBookmarksByTrack(userID, "")
	if err != nil {
		logger.Error("删除书签失败：查询错误", zap.String("id", id), zap.Error(err))
		return err
	}

	var found bool
	for _, b := range bookmarks {
		if b.ID == id {
			found = true
			// 确保用户只能删除自己的书签
			if b.UserID != userID {
				err = fmt.Errorf("无权限删除此书签")
				logger.Error("删除书签失败：无权限", zap.String("id", id), zap.String("userID", userID))
				return err
			}
			break
		}
	}

	if !found {
		err = fmt.Errorf("书签不存在或无权限")
		logger.Error("删除书签失败：书签不存在", zap.String("id", id))
		return err
	}

	// 删除书签
	err = s.trackRepo.DeleteBookmark(id)
	if err != nil {
		logger.Error("删除书签失败", zap.String("id", id), zap.Error(err))
		return err
	}

	logger.Info("书签删除成功", zap.String("id", id))
	return nil
}
