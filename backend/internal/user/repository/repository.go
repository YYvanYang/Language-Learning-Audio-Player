package repository

import (
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"

	"language-learning/internal/domain"
	"language-learning/internal/models"
)

// UserRepository 用户仓储实现
type UserRepository struct {
	db *gorm.DB
}

// NewUserRepository 创建用户仓储实例
func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

// FindByID 根据ID查找用户
func (r *UserRepository) FindByID(id string) (*domain.User, error) {
	var user models.User
	if err := r.db.First(&user, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("用户不存在: %w", err)
		}
		return nil, fmt.Errorf("查询用户错误: %w", err)
	}
	return mapToDomain(&user), nil
}

// FindByEmail 根据邮箱查找用户
func (r *UserRepository) FindByEmail(email string) (*domain.User, error) {
	var user models.User
	if err := r.db.First(&user, "email = ?", email).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("用户不存在: %w", err)
		}
		return nil, fmt.Errorf("查询用户错误: %w", err)
	}
	return mapToDomain(&user), nil
}

// FindByUsername 根据用户名查找用户
func (r *UserRepository) FindByUsername(username string) (*domain.User, error) {
	var user models.User
	if err := r.db.First(&user, "username = ?", username).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("用户不存在: %w", err)
		}
		return nil, fmt.Errorf("查询用户错误: %w", err)
	}
	return mapToDomain(&user), nil
}

// Create 创建新用户
func (r *UserRepository) Create(user *domain.User) error {
	// 将领域模型转换为数据库模型
	dbUser := mapToModel(user)

	// 创建用户
	if err := r.db.Create(dbUser).Error; err != nil {
		return fmt.Errorf("创建用户失败: %w", err)
	}

	// 更新领域模型中的ID和时间戳
	user.ID = dbUser.ID
	user.CreatedAt = dbUser.CreatedAt
	user.UpdatedAt = dbUser.UpdatedAt

	return nil
}

// Update 更新用户信息
func (r *UserRepository) Update(user *domain.User) error {
	// 将领域模型转换为数据库模型
	dbUser := mapToModel(user)

	// 更新用户
	if err := r.db.Save(dbUser).Error; err != nil {
		return fmt.Errorf("更新用户失败: %w", err)
	}

	// 更新领域模型中的时间戳
	user.UpdatedAt = dbUser.UpdatedAt

	return nil
}

// Delete 删除用户
func (r *UserRepository) Delete(id string) error {
	if err := r.db.Delete(&models.User{}, "id = ?", id).Error; err != nil {
		return fmt.Errorf("删除用户失败: %w", err)
	}
	return nil
}

// List 列出所有用户
func (r *UserRepository) List(page, limit int) ([]*domain.User, int64, error) {
	var users []models.User
	var count int64

	// 计算偏移量
	offset := (page - 1) * limit

	// 查询总数
	if err := r.db.Model(&models.User{}).Count(&count).Error; err != nil {
		return nil, 0, fmt.Errorf("统计用户数量失败: %w", err)
	}

	// 查询用户列表
	if err := r.db.Offset(offset).Limit(limit).Order("created_at desc").Find(&users).Error; err != nil {
		return nil, 0, fmt.Errorf("查询用户列表失败: %w", err)
	}

	// 将数据库模型转换为领域模型
	domainUsers := make([]*domain.User, len(users))
	for i, user := range users {
		domainUsers[i] = mapToDomain(&user)
	}

	return domainUsers, count, nil
}

// Count 统计用户数量
func (r *UserRepository) Count() (int64, error) {
	var count int64
	if err := r.db.Model(&models.User{}).Count(&count).Error; err != nil {
		return 0, fmt.Errorf("统计用户数量失败: %w", err)
	}
	return count, nil
}

// HasCourseAccess 检查用户是否有权访问课程
func (r *UserRepository) HasCourseAccess(userID, courseID string) (bool, error) {
	// 先查询课程是否为公开课程
	var course models.Course
	if err := r.db.First(&course, "id = ?", courseID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, fmt.Errorf("课程不存在: %w", err)
		}
		return false, fmt.Errorf("查询课程错误: %w", err)
	}

	// 如果课程是公开的，所有用户都有权访问
	if course.IsPublic {
		return true, nil
	}

	// 如果课程不是公开的，检查用户是否有特定访问权限
	// 这里可以根据实际需求实现更复杂的访问控制逻辑
	// 例如通过用户-课程关联表检查权限

	// 目前简单实现：如果课程不是公开的，只有管理员有权访问
	var user models.User
	if err := r.db.First(&user, "id = ?", userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, fmt.Errorf("用户不存在: %w", err)
		}
		return false, fmt.Errorf("查询用户错误: %w", err)
	}

	return user.Role == "admin", nil
}

// CountActive 统计活跃用户数量
func (r *UserRepository) CountActive(since time.Time) (int64, error) {
	var count int64
	if err := r.db.Model(&models.User{}).Where("last_login_at >= ? AND active = true", since).Count(&count).Error; err != nil {
		return 0, fmt.Errorf("统计活跃用户数量失败: %w", err)
	}
	return count, nil
}

// CountCreatedAfter 统计指定日期之后创建的用户数量
func (r *UserRepository) CountCreatedAfter(date time.Time) (int64, error) {
	var count int64
	if err := r.db.Model(&models.User{}).Where("created_at >= ?", date).Count(&count).Error; err != nil {
		return 0, fmt.Errorf("统计新增用户数量失败: %w", err)
	}
	return count, nil
}

// FindAll 找到所有用户（用于管理员）
func (r *UserRepository) FindAll(page, pageSize int) ([]*domain.User, int64, error) {
	// 复用List方法，功能相同
	return r.List(page, pageSize)
}

// mapToDomain 将数据库模型转换为领域模型
func mapToDomain(model *models.User) *domain.User {
	return &domain.User{
		ID:           model.ID,
		Username:     model.Username,
		Email:        model.Email,
		PasswordHash: model.PasswordHash,
		Role:         model.Role,
		FirstName:    model.FirstName,
		LastName:     model.LastName,
		Active:       model.Active,
		CreatedAt:    model.CreatedAt,
		UpdatedAt:    model.UpdatedAt,
	}
}

// mapToModel 将领域模型转换为数据库模型
func mapToModel(domain *domain.User) *models.User {
	return &models.User{
		ID:           domain.ID,
		Username:     domain.Username,
		Email:        domain.Email,
		PasswordHash: domain.PasswordHash,
		Role:         domain.Role,
		FirstName:    domain.FirstName,
		LastName:     domain.LastName,
		Active:       domain.Active,
		CreatedAt:    domain.CreatedAt,
		UpdatedAt:    domain.UpdatedAt,
	}
}
