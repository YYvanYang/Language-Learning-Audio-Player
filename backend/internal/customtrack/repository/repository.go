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

// CustomTrackRepository 自定义音轨仓储实现
type CustomTrackRepository struct {
	db *gorm.DB
}

// NewCustomTrackRepository 创建自定义音轨仓储实例
func NewCustomTrackRepository(db *gorm.DB) *CustomTrackRepository {
	return &CustomTrackRepository{db: db}
}

// FindByID 根据ID查找自定义音轨
func (r *CustomTrackRepository) FindByID(id string) (*domain.CustomTrack, error) {
	var track models.CustomTrack
	if err := r.db.First(&track, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("自定义音轨不存在: %w", err)
		}
		return nil, fmt.Errorf("查询自定义音轨错误: %w", err)
	}

	return r.toDomain(&track), nil
}

// FindByUserID 查找用户的所有自定义音轨
func (r *CustomTrackRepository) FindByUserID(userID string, page, pageSize int) ([]*domain.CustomTrack, int64, error) {
	var tracks []models.CustomTrack
	var total int64

	offset := (page - 1) * pageSize

	// 查询总数
	if err := r.db.Model(&models.CustomTrack{}).Where("user_id = ?", userID).Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("查询自定义音轨数量错误: %w", err)
	}

	// 分页查询
	if err := r.db.Where("user_id = ?", userID).Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&tracks).Error; err != nil {
		return nil, 0, fmt.Errorf("查询用户自定义音轨列表错误: %w", err)
	}

	// 转换为领域模型
	result := make([]*domain.CustomTrack, len(tracks))
	for i, track := range tracks {
		result[i] = r.toDomain(&track)
	}

	return result, total, nil
}

// FindPublic 查找公开的自定义音轨
func (r *CustomTrackRepository) FindPublic(page, pageSize int) ([]*domain.CustomTrack, int64, error) {
	var tracks []models.CustomTrack
	var total int64

	offset := (page - 1) * pageSize

	// 查询总数
	if err := r.db.Model(&models.CustomTrack{}).Where("is_public = ?", true).Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("查询公开自定义音轨数量错误: %w", err)
	}

	// 分页查询
	if err := r.db.Where("is_public = ?", true).Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&tracks).Error; err != nil {
		return nil, 0, fmt.Errorf("查询公开自定义音轨列表错误: %w", err)
	}

	// 转换为领域模型
	result := make([]*domain.CustomTrack, len(tracks))
	for i, track := range tracks {
		result[i] = r.toDomain(&track)
	}

	return result, total, nil
}

// Create 创建自定义音轨
func (r *CustomTrackRepository) Create(track *domain.CustomTrack) error {
	// 转换为数据库模型
	dbTrack := r.toModel(track)
	dbTrack.CreatedAt = time.Now()
	dbTrack.UpdatedAt = time.Now()

	// 创建自定义音轨
	if err := r.db.Create(dbTrack).Error; err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			return fmt.Errorf("自定义音轨已存在: %w", err)
		}
		return fmt.Errorf("创建自定义音轨失败: %w", err)
	}

	// 更新领域模型
	track.ID = dbTrack.ID
	track.CreatedAt = dbTrack.CreatedAt
	track.UpdatedAt = dbTrack.UpdatedAt

	return nil
}

// Update 更新自定义音轨
func (r *CustomTrackRepository) Update(track *domain.CustomTrack) error {
	// 检查音轨是否存在
	var existingTrack models.CustomTrack
	if err := r.db.First(&existingTrack, "id = ?", track.ID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("自定义音轨不存在: %w", err)
		}
		return fmt.Errorf("查询自定义音轨错误: %w", err)
	}

	// 确保只能更新自己的音轨
	if existingTrack.UserID != track.UserID {
		return fmt.Errorf("无权限更新他人的自定义音轨")
	}

	// 更新音轨信息
	dbTrack := r.toModel(track)
	dbTrack.UpdatedAt = time.Now()

	if err := r.db.Model(&models.CustomTrack{}).Where("id = ?", track.ID).Updates(map[string]interface{}{
		"title":       dbTrack.Title,
		"description": dbTrack.Description,
		"file_path":   dbTrack.FilePath,
		"duration":    dbTrack.Duration,
		"tags":        dbTrack.Tags,
		"is_public":   dbTrack.IsPublic,
		"updated_at":  dbTrack.UpdatedAt,
	}).Error; err != nil {
		return fmt.Errorf("更新自定义音轨失败: %w", err)
	}

	// 更新领域模型的时间戳
	track.UpdatedAt = dbTrack.UpdatedAt

	return nil
}

// Delete 删除自定义音轨
func (r *CustomTrackRepository) Delete(id string) error {
	if err := r.db.Delete(&models.CustomTrack{}, "id = ?", id).Error; err != nil {
		return fmt.Errorf("删除自定义音轨失败: %w", err)
	}
	return nil
}

// Search 搜索自定义音轨
func (r *CustomTrackRepository) Search(query string, userID string, page, pageSize int) ([]*domain.CustomTrack, int64, error) {
	var tracks []models.CustomTrack
	var total int64

	offset := (page - 1) * pageSize

	// 构建查询条件
	dbQuery := r.db.Model(&models.CustomTrack{})

	// 添加搜索条件
	searchQuery := "%" + query + "%"

	if userID != "" {
		// 搜索用户自己的音轨
		dbQuery = dbQuery.Where("user_id = ? AND (title ILIKE ? OR description ILIKE ? OR tags ILIKE ?)",
			userID, searchQuery, searchQuery, searchQuery)
	} else {
		// 只搜索公开的音轨
		dbQuery = dbQuery.Where("is_public = ? AND (title ILIKE ? OR description ILIKE ? OR tags ILIKE ?)",
			true, searchQuery, searchQuery, searchQuery)
	}

	// 查询总数
	if err := dbQuery.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("查询自定义音轨数量错误: %w", err)
	}

	// 分页查询
	if err := dbQuery.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&tracks).Error; err != nil {
		return nil, 0, fmt.Errorf("搜索自定义音轨错误: %w", err)
	}

	// 转换为领域模型
	result := make([]*domain.CustomTrack, len(tracks))
	for i, track := range tracks {
		result[i] = r.toDomain(&track)
	}

	return result, total, nil
}

// 辅助方法: 将数据库模型转换为领域模型
func (r *CustomTrackRepository) toDomain(model *models.CustomTrack) *domain.CustomTrack {
	return &domain.CustomTrack{
		ID:          model.ID,
		UserID:      model.UserID,
		Title:       model.Title,
		Description: model.Description,
		FilePath:    model.FilePath,
		Duration:    model.Duration,
		Tags:        model.Tags,
		IsPublic:    model.IsPublic,
		CreatedAt:   model.CreatedAt,
		UpdatedAt:   model.UpdatedAt,
	}
}

// 辅助方法: 将领域模型转换为数据库模型
func (r *CustomTrackRepository) toModel(domain *domain.CustomTrack) *models.CustomTrack {
	return &models.CustomTrack{
		ID:          domain.ID,
		UserID:      domain.UserID,
		Title:       domain.Title,
		Description: domain.Description,
		FilePath:    domain.FilePath,
		Duration:    domain.Duration,
		Tags:        domain.Tags,
		IsPublic:    domain.IsPublic,
		CreatedAt:   domain.CreatedAt,
		UpdatedAt:   domain.UpdatedAt,
	}
}
