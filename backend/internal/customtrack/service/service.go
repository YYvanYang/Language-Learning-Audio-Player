package service

import (
	"fmt"
	"time"

	"github.com/YYvanYang/Language-Learning-Audio-Player/backend/internal/domain"
	"github.com/YYvanYang/Language-Learning-Audio-Player/backend/internal/utils/logger"

	"go.uber.org/zap"
)

// CustomTrackService 自定义音轨服务
type CustomTrackService struct {
	customTrackRepo domain.CustomTrackRepository
}

// NewCustomTrackService 创建自定义音轨服务实例
func NewCustomTrackService(customTrackRepo domain.CustomTrackRepository) *CustomTrackService {
	return &CustomTrackService{
		customTrackRepo: customTrackRepo,
	}
}

// GetCustomTrackByID 通过ID获取自定义音轨
func (s *CustomTrackService) GetCustomTrackByID(id string) (*domain.CustomTrack, error) {
	logger.Debug("获取自定义音轨", zap.String("id", id))
	track, err := s.customTrackRepo.FindByID(id)
	if err != nil {
		logger.Error("获取自定义音轨失败", zap.String("id", id), zap.Error(err))
		return nil, err
	}
	return track, nil
}

// GetUserCustomTracks 获取用户的所有自定义音轨
func (s *CustomTrackService) GetUserCustomTracks(userID string, page, pageSize int) ([]*domain.CustomTrack, int64, error) {
	logger.Debug("获取用户自定义音轨", zap.String("userID", userID), zap.Int("page", page), zap.Int("pageSize", pageSize))
	tracks, total, err := s.customTrackRepo.FindByUserID(userID, page, pageSize)
	if err != nil {
		logger.Error("获取用户自定义音轨失败", zap.String("userID", userID), zap.Error(err))
		return nil, 0, err
	}
	return tracks, total, nil
}

// GetPublicCustomTracks 获取公开的自定义音轨
func (s *CustomTrackService) GetPublicCustomTracks(page, pageSize int) ([]*domain.CustomTrack, int64, error) {
	logger.Debug("获取公开自定义音轨", zap.Int("page", page), zap.Int("pageSize", pageSize))
	tracks, total, err := s.customTrackRepo.FindPublic(page, pageSize)
	if err != nil {
		logger.Error("获取公开自定义音轨失败", zap.Error(err))
		return nil, 0, err
	}
	return tracks, total, nil
}

// CreateCustomTrack 创建自定义音轨
func (s *CustomTrackService) CreateCustomTrack(userID string, req domain.CreateCustomTrackRequest) (*domain.CustomTrack, error) {
	logger.Info("创建自定义音轨", zap.String("userID", userID), zap.String("title", req.Title))

	// 创建自定义音轨对象
	track := &domain.CustomTrack{
		UserID:      userID,
		Title:       req.Title,
		Description: req.Description,
		FilePath:    req.FilePath,
		Duration:    req.Duration,
		Tags:        req.Tags,
		IsPublic:    req.IsPublic,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	// 保存自定义音轨
	err := s.customTrackRepo.Create(track)
	if err != nil {
		logger.Error("创建自定义音轨失败", zap.String("userID", userID), zap.String("title", req.Title), zap.Error(err))
		return nil, err
	}

	logger.Info("自定义音轨创建成功", zap.String("id", track.ID), zap.String("title", track.Title))
	return track, nil
}

// UpdateCustomTrack 更新自定义音轨
func (s *CustomTrackService) UpdateCustomTrack(id string, userID string, req domain.UpdateCustomTrackRequest) (*domain.CustomTrack, error) {
	logger.Info("更新自定义音轨", zap.String("id", id), zap.String("userID", userID))

	// 获取现有自定义音轨
	track, err := s.customTrackRepo.FindByID(id)
	if err != nil {
		logger.Error("更新自定义音轨失败：音轨不存在", zap.String("id", id), zap.Error(err))
		return nil, err
	}

	// 验证权限
	if track.UserID != userID {
		err = fmt.Errorf("无权限更新他人的自定义音轨")
		logger.Error("更新自定义音轨失败：权限不足", zap.String("id", id), zap.String("userID", userID))
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
	if req.Tags != "" {
		track.Tags = req.Tags
	}

	// IsPublic 是布尔字段，直接更新
	track.IsPublic = req.IsPublic

	// 更新时间戳
	track.UpdatedAt = time.Now()

	// 保存更新
	err = s.customTrackRepo.Update(track)
	if err != nil {
		logger.Error("更新自定义音轨失败", zap.String("id", id), zap.Error(err))
		return nil, err
	}

	logger.Info("自定义音轨更新成功", zap.String("id", track.ID))
	return track, nil
}

// DeleteCustomTrack 删除自定义音轨
func (s *CustomTrackService) DeleteCustomTrack(id string, userID string) error {
	logger.Info("删除自定义音轨", zap.String("id", id), zap.String("userID", userID))

	// 获取自定义音轨
	track, err := s.customTrackRepo.FindByID(id)
	if err != nil {
		logger.Error("删除自定义音轨失败：音轨不存在", zap.String("id", id), zap.Error(err))
		return err
	}

	// 验证权限
	if track.UserID != userID {
		err = fmt.Errorf("无权限删除他人的自定义音轨")
		logger.Error("删除自定义音轨失败：权限不足", zap.String("id", id), zap.String("userID", userID))
		return err
	}

	// 删除自定义音轨
	err = s.customTrackRepo.Delete(id)
	if err != nil {
		logger.Error("删除自定义音轨失败", zap.String("id", id), zap.Error(err))
		return err
	}

	logger.Info("自定义音轨删除成功", zap.String("id", id))
	return nil
}

// SearchCustomTracks 搜索自定义音轨
func (s *CustomTrackService) SearchCustomTracks(query string, userID string, page, pageSize int) ([]*domain.CustomTrack, int64, error) {
	logger.Debug("搜索自定义音轨", zap.String("query", query), zap.String("userID", userID), zap.Int("page", page))

	// 执行搜索
	tracks, total, err := s.customTrackRepo.Search(query, userID, page, pageSize)
	if err != nil {
		logger.Error("搜索自定义音轨失败", zap.String("query", query), zap.Error(err))
		return nil, 0, err
	}

	return tracks, total, nil
}
