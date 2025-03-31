package repository

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"language-learning/internal/domain"
	"language-learning/internal/models"
)

// TrackRepository 音轨仓储实现
type TrackRepository struct {
	db *gorm.DB
}

// NewTrackRepository 创建音轨仓储实例
func NewTrackRepository(db *gorm.DB) *TrackRepository {
	return &TrackRepository{db: db}
}

// FindByID 根据ID查找音轨
func (r *TrackRepository) FindByID(id string) (*domain.Track, error) {
	var track models.Track
	if err := r.db.First(&track, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("音轨不存在: %w", err)
		}
		return nil, fmt.Errorf("查询音轨错误: %w", err)
	}

	return r.toDomainWithBookmarks(&track)
}

// FindByUnitID 根据单元ID查找音轨列表
func (r *TrackRepository) FindByUnitID(unitID string, includeBookmarks bool) ([]*domain.Track, error) {
	var tracks []models.Track
	if err := r.db.Where("unit_id = ?", unitID).Order("order_index").Find(&tracks).Error; err != nil {
		return nil, fmt.Errorf("查询单元音轨列表错误: %w", err)
	}

	domainTracks := make([]*domain.Track, len(tracks))
	for i, track := range tracks {
		var err error
		if includeBookmarks {
			domainTracks[i], err = r.toDomainWithBookmarks(&track)
		} else {
			domainTracks[i], err = r.toDomain(&track)
		}
		if err != nil {
			return nil, err
		}
	}

	return domainTracks, nil
}

// Create 创建新音轨
func (r *TrackRepository) Create(track *domain.Track) error {
	// 转换为数据库模型
	dbTrack := r.toModel(track)

	// 如果未指定顺序索引，则设置为当前最大索引+1
	if track.OrderIndex <= 0 {
		var maxIndex struct {
			MaxIndex int
		}
		r.db.Model(&models.Track{}).Select("COALESCE(MAX(order_index), 0) as max_index").Where("unit_id = ?", track.UnitID).Scan(&maxIndex)
		dbTrack.OrderIndex = maxIndex.MaxIndex + 1
	}

	// 创建音轨
	if err := r.db.Create(dbTrack).Error; err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			return fmt.Errorf("音轨标题已存在: %w", err)
		}
		return fmt.Errorf("创建音轨失败: %w", err)
	}

	// 更新领域模型
	track.ID = dbTrack.ID
	track.OrderIndex = dbTrack.OrderIndex
	track.CreatedAt = dbTrack.CreatedAt
	track.UpdatedAt = dbTrack.UpdatedAt

	return nil
}

// Update 更新音轨信息
func (r *TrackRepository) Update(track *domain.Track) error {
	// 检查音轨是否存在
	var existingTrack models.Track
	if err := r.db.First(&existingTrack, "id = ?", track.ID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("音轨不存在: %w", err)
		}
		return fmt.Errorf("查询音轨错误: %w", err)
	}

	// 更新音轨信息
	dbTrack := r.toModel(track)
	if err := r.db.Model(&models.Track{}).Where("id = ?", track.ID).Updates(dbTrack).Error; err != nil {
		return fmt.Errorf("更新音轨失败: %w", err)
	}

	// 获取更新后的音轨
	if err := r.db.First(&existingTrack, "id = ?", track.ID).Error; err != nil {
		return fmt.Errorf("获取更新后的音轨失败: %w", err)
	}

	// 更新领域模型的时间戳
	track.UpdatedAt = existingTrack.UpdatedAt

	return nil
}

// Delete 删除音轨
func (r *TrackRepository) Delete(id string) error {
	// 开启事务
	return r.db.Transaction(func(tx *gorm.DB) error {
		// 先删除音轨相关的书签
		if err := tx.Where("track_id = ?", id).Delete(&models.Bookmark{}).Error; err != nil {
			return fmt.Errorf("删除音轨书签失败: %w", err)
		}

		// 删除音轨
		if err := tx.Delete(&models.Track{}, "id = ?", id).Error; err != nil {
			return fmt.Errorf("删除音轨失败: %w", err)
		}

		return nil
	})
}

// ReorderTracks 重新排序单元内的音轨
func (r *TrackRepository) ReorderTracks(unitID string, trackIDs []string) error {
	// 开启事务
	return r.db.Transaction(func(tx *gorm.DB) error {
		// 验证所有音轨ID是否属于该单元
		var count int64
		if err := tx.Model(&models.Track{}).Where("id IN ? AND unit_id = ?", trackIDs, unitID).Count(&count).Error; err != nil {
			return fmt.Errorf("验证音轨错误: %w", err)
		}

		if int(count) != len(trackIDs) {
			return fmt.Errorf("部分音轨不属于该单元")
		}

		// 更新每个音轨的顺序
		for i, trackID := range trackIDs {
			if err := tx.Model(&models.Track{}).Where("id = ?", trackID).Update("order_index", i+1).Error; err != nil {
				return fmt.Errorf("更新音轨顺序失败: %w", err)
			}
		}

		return nil
	})
}

// CreateBookmark 创建书签
func (r *TrackRepository) CreateBookmark(bookmark *domain.Bookmark) error {
	// 检查音轨是否存在
	var track models.Track
	if err := r.db.First(&track, "id = ?", bookmark.TrackID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("音轨不存在: %w", err)
		}
		return fmt.Errorf("查询音轨错误: %w", err)
	}

	// 转换为数据库模型
	dbBookmark := r.bookmarkToModel(bookmark)
	dbBookmark.CreatedAt = time.Now()
	dbBookmark.UpdatedAt = time.Now()

	// 创建书签
	if err := r.db.Create(dbBookmark).Error; err != nil {
		return fmt.Errorf("创建书签失败: %w", err)
	}

	// 更新领域模型
	bookmark.ID = dbBookmark.ID
	bookmark.CreatedAt = dbBookmark.CreatedAt
	bookmark.UpdatedAt = dbBookmark.UpdatedAt

	return nil
}

// UpdateBookmark 更新书签
func (r *TrackRepository) UpdateBookmark(bookmark *domain.Bookmark) error {
	// 检查书签是否存在
	var existingBookmark models.Bookmark
	if err := r.db.First(&existingBookmark, "id = ?", bookmark.ID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("书签不存在: %w", err)
		}
		return fmt.Errorf("查询书签错误: %w", err)
	}

	// 确保用户只能更新自己的书签
	if existingBookmark.UserID != bookmark.UserID {
		return fmt.Errorf("无权限更新此书签")
	}

	// 更新书签信息
	dbBookmark := r.bookmarkToModel(bookmark)
	dbBookmark.UpdatedAt = time.Now()

	if err := r.db.Model(&models.Bookmark{}).Where("id = ?", bookmark.ID).Updates(map[string]interface{}{
		"position":    dbBookmark.Position,
		"label":       dbBookmark.Label,
		"description": dbBookmark.Description,
		"updated_at":  dbBookmark.UpdatedAt,
	}).Error; err != nil {
		return fmt.Errorf("更新书签失败: %w", err)
	}

	// 更新领域模型的时间戳
	bookmark.UpdatedAt = dbBookmark.UpdatedAt

	return nil
}

// DeleteBookmark 删除书签
func (r *TrackRepository) DeleteBookmark(id string) error {
	if err := r.db.Delete(&models.Bookmark{}, "id = ?", id).Error; err != nil {
		return fmt.Errorf("删除书签失败: %w", err)
	}
	return nil
}

// FindBookmarksByTrack 查找音轨的所有书签
func (r *TrackRepository) FindBookmarksByTrack(userID, trackID string) ([]*domain.Bookmark, error) {
	var bookmarks []models.Bookmark
	if err := r.db.Where("user_id = ? AND track_id = ?", userID, trackID).Order("position").Find(&bookmarks).Error; err != nil {
		return nil, fmt.Errorf("查询音轨书签错误: %w", err)
	}

	domainBookmarks := make([]*domain.Bookmark, len(bookmarks))
	for i, bookmark := range bookmarks {
		domainBookmarks[i], _ = r.bookmarkToDomain(&bookmark)
	}

	return domainBookmarks, nil
}

// 辅助方法: 将数据库模型转换为领域模型
func (r *TrackRepository) toDomain(model *models.Track) (*domain.Track, error) {
	return &domain.Track{
		ID:          model.ID,
		UnitID:      model.UnitID,
		Title:       model.Title,
		Description: model.Description,
		FilePath:    model.FilePath,
		Duration:    model.Duration,
		OrderIndex:  model.OrderIndex,
		IsSystem:    model.IsSystem,
		CreatedAt:   model.CreatedAt,
		UpdatedAt:   model.UpdatedAt,
		Bookmarks:   nil,
	}, nil
}

// 辅助方法: 将数据库模型转换为领域模型，并加载书签
func (r *TrackRepository) toDomainWithBookmarks(model *models.Track) (*domain.Track, error) {
	track, err := r.toDomain(model)
	if err != nil {
		return nil, err
	}

	// 我们这里不预加载书签，因为书签是特定用户的，需要在服务层根据特定用户ID加载
	track.Bookmarks = make([]*domain.Bookmark, 0)

	return track, nil
}

// 辅助方法: 将书签数据库模型转换为领域模型
func (r *TrackRepository) bookmarkToDomain(model *models.Bookmark) (*domain.Bookmark, error) {
	return &domain.Bookmark{
		ID:          model.ID,
		UserID:      model.UserID,
		TrackID:     model.TrackID,
		Position:    model.Position,
		Label:       model.Label,
		Description: model.Description,
		CreatedAt:   model.CreatedAt,
		UpdatedAt:   model.UpdatedAt,
	}, nil
}

// 辅助方法: 将领域模型转换为数据库模型
func (r *TrackRepository) toModel(domain *domain.Track) *models.Track {
	return &models.Track{
		ID:          domain.ID,
		UnitID:      domain.UnitID,
		Title:       domain.Title,
		Description: domain.Description,
		FilePath:    domain.FilePath,
		Duration:    domain.Duration,
		OrderIndex:  domain.OrderIndex,
		IsSystem:    domain.IsSystem,
		CreatedAt:   domain.CreatedAt,
		UpdatedAt:   domain.UpdatedAt,
	}
}

// 辅助方法: 将书签领域模型转换为数据库模型
func (r *TrackRepository) bookmarkToModel(domain *domain.Bookmark) *models.Bookmark {
	return &models.Bookmark{
		ID:          domain.ID,
		UserID:      domain.UserID,
		TrackID:     domain.TrackID,
		Position:    domain.Position,
		Label:       domain.Label,
		Description: domain.Description,
		CreatedAt:   domain.CreatedAt,
		UpdatedAt:   domain.UpdatedAt,
	}
}
