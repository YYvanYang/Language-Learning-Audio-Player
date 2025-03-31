package repository

import (
	"errors"
	"fmt"
	"strings"

	"gorm.io/gorm"

	"github.com/YYvanYang/Language-Learning-Audio-Player/backend/internal/domain"
	"github.com/YYvanYang/Language-Learning-Audio-Player/backend/internal/models"
)

// CourseRepository 课程仓储实现
type CourseRepository struct {
	db *gorm.DB
}

// NewCourseRepository 创建课程仓储实例
func NewCourseRepository(db *gorm.DB) *CourseRepository {
	return &CourseRepository{db: db}
}

// FindByID 根据ID查找课程
func (r *CourseRepository) FindByID(id string) (*domain.Course, error) {
	var course models.Course
	if err := r.db.First(&course, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("课程不存在: %w", err)
		}
		return nil, fmt.Errorf("查询课程错误: %w", err)
	}

	return r.toDomainWithUnits(&course)
}

// FindAll 获取所有课程，支持分页
func (r *CourseRepository) FindAll(page, limit int) ([]*domain.Course, int64, error) {
	var courses []models.Course
	var count int64

	// 计算偏移量
	offset := (page - 1) * limit

	// 统计总记录数
	if err := r.db.Model(&models.Course{}).Count(&count).Error; err != nil {
		return nil, 0, fmt.Errorf("统计课程数量错误: %w", err)
	}

	// 查询课程列表
	if err := r.db.Offset(offset).Limit(limit).Order("created_at desc").Find(&courses).Error; err != nil {
		return nil, 0, fmt.Errorf("查询课程列表错误: %w", err)
	}

	// 转换为领域模型
	domainCourses := make([]*domain.Course, len(courses))
	for i, course := range courses {
		domainCourse, err := r.toDomain(&course)
		if err != nil {
			return nil, 0, err
		}
		domainCourses[i] = domainCourse
	}

	return domainCourses, count, nil
}

// FindPublic 获取所有公开课程，支持分页
func (r *CourseRepository) FindPublic(page, limit int) ([]*domain.Course, int64, error) {
	var courses []models.Course
	var count int64

	// 计算偏移量
	offset := (page - 1) * limit

	// 统计公开课程总数
	if err := r.db.Model(&models.Course{}).Where("is_public = ?", true).Count(&count).Error; err != nil {
		return nil, 0, fmt.Errorf("统计公开课程数量错误: %w", err)
	}

	// 查询公开课程列表
	if err := r.db.Where("is_public = ?", true).Offset(offset).Limit(limit).Order("created_at desc").Find(&courses).Error; err != nil {
		return nil, 0, fmt.Errorf("查询公开课程列表错误: %w", err)
	}

	// 转换为领域模型
	domainCourses := make([]*domain.Course, len(courses))
	for i, course := range courses {
		domainCourse, err := r.toDomain(&course)
		if err != nil {
			return nil, 0, err
		}
		domainCourses[i] = domainCourse
	}

	return domainCourses, count, nil
}

// FindByUser 获取用户有权访问的课程，支持分页
func (r *CourseRepository) FindByUser(userID string, page, limit int) ([]*domain.Course, int64, error) {
	var courses []models.Course
	var count int64

	// 计算偏移量
	offset := (page - 1) * limit

	// 查询用户角色
	var user models.User
	if err := r.db.First(&user, "id = ?", userID).Error; err != nil {
		return nil, 0, fmt.Errorf("查询用户错误: %w", err)
	}

	// 如果是管理员，返回所有课程
	if user.Role == "admin" {
		return r.FindAll(page, limit)
	}

	// 查询用户可访问课程 (公开课程 + 用户特别授权的课程)
	// 此处简化为仅查询公开课程，实际可能需要通过关联表查询用户特别授权的课程
	query := r.db.Where("is_public = ?", true)

	// 统计总记录数
	if err := query.Model(&models.Course{}).Count(&count).Error; err != nil {
		return nil, 0, fmt.Errorf("统计用户可访问课程数量错误: %w", err)
	}

	// 查询课程列表
	if err := query.Offset(offset).Limit(limit).Order("created_at desc").Find(&courses).Error; err != nil {
		return nil, 0, fmt.Errorf("查询用户可访问课程列表错误: %w", err)
	}

	// 转换为领域模型
	domainCourses := make([]*domain.Course, len(courses))
	for i, course := range courses {
		domainCourse, err := r.toDomain(&course)
		if err != nil {
			return nil, 0, err
		}
		domainCourses[i] = domainCourse
	}

	return domainCourses, count, nil
}

// Create 创建新课程
func (r *CourseRepository) Create(course *domain.Course) error {
	// 转换为数据库模型
	dbCourse := r.toModel(course)

	// 创建课程
	if err := r.db.Create(dbCourse).Error; err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			return fmt.Errorf("课程标题已存在: %w", err)
		}
		return fmt.Errorf("创建课程失败: %w", err)
	}

	// 更新领域模型
	course.ID = dbCourse.ID
	course.CreatedAt = dbCourse.CreatedAt
	course.UpdatedAt = dbCourse.UpdatedAt

	return nil
}

// Update 更新课程信息
func (r *CourseRepository) Update(course *domain.Course) error {
	// 检查课程是否存在
	var existingCourse models.Course
	if err := r.db.First(&existingCourse, "id = ?", course.ID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("课程不存在: %w", err)
		}
		return fmt.Errorf("查询课程错误: %w", err)
	}

	// 更新课程信息
	dbCourse := r.toModel(course)
	if err := r.db.Model(&models.Course{}).Where("id = ?", course.ID).Updates(dbCourse).Error; err != nil {
		return fmt.Errorf("更新课程失败: %w", err)
	}

	// 获取更新后的课程
	if err := r.db.First(&existingCourse, "id = ?", course.ID).Error; err != nil {
		return fmt.Errorf("获取更新后的课程失败: %w", err)
	}

	// 更新领域模型的时间戳
	course.UpdatedAt = existingCourse.UpdatedAt

	return nil
}

// Delete 删除课程
func (r *CourseRepository) Delete(id string) error {
	// 删除课程
	if err := r.db.Delete(&models.Course{}, "id = ?", id).Error; err != nil {
		return fmt.Errorf("删除课程失败: %w", err)
	}

	return nil
}

// GetUnits 获取课程的所有单元
func (r *CourseRepository) GetUnits(courseID string) ([]*domain.Unit, error) {
	var units []models.Unit
	if err := r.db.Where("course_id = ?", courseID).Order("order_index").Find(&units).Error; err != nil {
		return nil, fmt.Errorf("查询课程单元错误: %w", err)
	}

	// 转换为领域模型
	domainUnits := make([]*domain.Unit, len(units))
	for i, unit := range units {
		domainUnit, err := r.unitToDomain(&unit)
		if err != nil {
			return nil, err
		}
		domainUnits[i] = domainUnit
	}

	return domainUnits, nil
}

// CreateUnit 创建单元
func (r *CourseRepository) CreateUnit(unit *domain.Unit) error {
	// 检查课程是否存在
	var course models.Course
	if err := r.db.First(&course, "id = ?", unit.CourseID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("课程不存在: %w", err)
		}
		return fmt.Errorf("查询课程错误: %w", err)
	}

	// 如果未指定顺序索引，则设置为当前最大索引+1
	if unit.OrderIndex <= 0 {
		var maxIndex struct {
			MaxIndex int
		}
		r.db.Model(&models.Unit{}).Select("COALESCE(MAX(order_index), 0) as max_index").Where("course_id = ?", unit.CourseID).Scan(&maxIndex)
		unit.OrderIndex = maxIndex.MaxIndex + 1
	}

	// 转换为数据库模型
	dbUnit := r.unitToModel(unit)

	// 创建单元
	if err := r.db.Create(dbUnit).Error; err != nil {
		return fmt.Errorf("创建单元失败: %w", err)
	}

	// 更新领域模型
	unit.ID = dbUnit.ID
	unit.CreatedAt = dbUnit.CreatedAt
	unit.UpdatedAt = dbUnit.UpdatedAt

	return nil
}

// UpdateUnit 更新单元
func (r *CourseRepository) UpdateUnit(unit *domain.Unit) error {
	// 检查单元是否存在
	var existingUnit models.Unit
	if err := r.db.First(&existingUnit, "id = ?", unit.ID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("单元不存在: %w", err)
		}
		return fmt.Errorf("查询单元错误: %w", err)
	}

	// 更新单元信息
	dbUnit := r.unitToModel(unit)
	if err := r.db.Model(&models.Unit{}).Where("id = ?", unit.ID).Updates(dbUnit).Error; err != nil {
		return fmt.Errorf("更新单元失败: %w", err)
	}

	// 获取更新后的单元
	if err := r.db.First(&existingUnit, "id = ?", unit.ID).Error; err != nil {
		return fmt.Errorf("获取更新后的单元失败: %w", err)
	}

	// 更新领域模型的时间戳
	unit.UpdatedAt = existingUnit.UpdatedAt

	return nil
}

// DeleteUnit 删除单元
func (r *CourseRepository) DeleteUnit(id string) error {
	// 删除单元
	if err := r.db.Delete(&models.Unit{}, "id = ?", id).Error; err != nil {
		return fmt.Errorf("删除单元失败: %w", err)
	}

	return nil
}

// ReorderUnits 重新排序单元
func (r *CourseRepository) ReorderUnits(courseID string, unitIDs []string) error {
	// 开启事务
	return r.db.Transaction(func(tx *gorm.DB) error {
		// 验证所有单元ID是否属于该课程
		var count int64
		if err := tx.Model(&models.Unit{}).Where("id IN ? AND course_id = ?", unitIDs, courseID).Count(&count).Error; err != nil {
			return fmt.Errorf("验证单元错误: %w", err)
		}

		if int(count) != len(unitIDs) {
			return fmt.Errorf("部分单元不属于该课程")
		}

		// 更新每个单元的顺序
		for i, unitID := range unitIDs {
			if err := tx.Model(&models.Unit{}).Where("id = ?", unitID).Update("order_index", i+1).Error; err != nil {
				return fmt.Errorf("更新单元顺序失败: %w", err)
			}
		}

		return nil
	})
}

// 辅助方法: 将数据库模型转换为领域模型
func (r *CourseRepository) toDomain(model *models.Course) (*domain.Course, error) {
	return &domain.Course{
		ID:          model.ID,
		Title:       model.Title,
		Description: model.Description,
		Level:       model.Level,
		Language:    model.Language,
		ImageURL:    model.ImageURL,
		IsPublic:    model.IsPublic,
		CreatedAt:   model.CreatedAt,
		UpdatedAt:   model.UpdatedAt,
	}, nil
}

// 辅助方法: 将数据库模型转换为领域模型，并加载单元
func (r *CourseRepository) toDomainWithUnits(model *models.Course) (*domain.Course, error) {
	course, err := r.toDomain(model)
	if err != nil {
		return nil, err
	}

	// 加载单元
	var units []models.Unit
	if err := r.db.Where("course_id = ?", model.ID).Order("order_index").Find(&units).Error; err != nil {
		return nil, fmt.Errorf("加载课程单元错误: %w", err)
	}

	// 转换单元
	course.Units = make([]*domain.Unit, len(units))
	for i, unit := range units {
		course.Units[i], err = r.unitToDomain(&unit)
		if err != nil {
			return nil, err
		}
	}

	return course, nil
}

// 辅助方法: 将单元数据库模型转换为领域模型
func (r *CourseRepository) unitToDomain(model *models.Unit) (*domain.Unit, error) {
	unit := &domain.Unit{
		ID:          model.ID,
		CourseID:    model.CourseID,
		Title:       model.Title,
		Description: model.Description,
		OrderIndex:  model.OrderIndex,
		CreatedAt:   model.CreatedAt,
		UpdatedAt:   model.UpdatedAt,
	}

	// 加载音轨数量，但不加载详细信息
	var count int64
	if err := r.db.Model(&models.Track{}).Where("unit_id = ?", model.ID).Count(&count).Error; err != nil {
		return nil, fmt.Errorf("统计单元音轨数量错误: %w", err)
	}

	// 如果有音轨，初始化空数组以便正确计算数量
	if count > 0 {
		unit.Tracks = make([]*domain.Track, 0)
	}

	return unit, nil
}

// 辅助方法: 将领域模型转换为数据库模型
func (r *CourseRepository) toModel(domain *domain.Course) *models.Course {
	return &models.Course{
		ID:          domain.ID,
		Title:       domain.Title,
		Description: domain.Description,
		Level:       domain.Level,
		Language:    domain.Language,
		ImageURL:    domain.ImageURL,
		IsPublic:    domain.IsPublic,
		CreatedAt:   domain.CreatedAt,
		UpdatedAt:   domain.UpdatedAt,
	}
}

// 辅助方法: 将单元领域模型转换为数据库模型
func (r *CourseRepository) unitToModel(domain *domain.Unit) *models.Unit {
	return &models.Unit{
		ID:          domain.ID,
		CourseID:    domain.CourseID,
		Title:       domain.Title,
		Description: domain.Description,
		OrderIndex:  domain.OrderIndex,
		CreatedAt:   domain.CreatedAt,
		UpdatedAt:   domain.UpdatedAt,
	}
}
