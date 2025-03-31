package service

import (
	"errors"
	"fmt"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/YYvanYang/Language-Learning-Audio-Player/backend/internal/domain"
)

// UserService 用户服务
type UserService struct {
	userRepo domain.UserRepository
}

// NewUserService 创建用户服务实例
func NewUserService(userRepo domain.UserRepository) *UserService {
	return &UserService{
		userRepo: userRepo,
	}
}

// Register 用户注册
func (s *UserService) Register(req domain.RegisterRequest) (*domain.User, error) {
	// 检查用户名是否已存在
	existingUser, err := s.userRepo.FindByUsername(req.Username)
	if err == nil && existingUser != nil {
		return nil, errors.New("用户名已存在")
	}

	// 检查邮箱是否已存在
	existingUser, err = s.userRepo.FindByEmail(req.Email)
	if err == nil && existingUser != nil {
		return nil, errors.New("邮箱已存在")
	}

	// 对密码进行哈希处理
	hashedPassword, err := hashPassword(req.Password)
	if err != nil {
		return nil, fmt.Errorf("密码哈希处理失败: %w", err)
	}

	// 创建用户对象
	user := &domain.User{
		Username:     req.Username,
		Email:        req.Email,
		PasswordHash: hashedPassword,
		FirstName:    req.FirstName,
		LastName:     req.LastName,
		Role:         "user", // 默认角色为普通用户
		Active:       true,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	// 保存用户
	if err := s.userRepo.Create(user); err != nil {
		return nil, fmt.Errorf("用户创建失败: %w", err)
	}

	return user, nil
}

// Login 用户登录
func (s *UserService) Login(req domain.LoginRequest) (*domain.User, error) {
	var user *domain.User
	var err error

	// 根据用户名或邮箱查找用户
	if req.Username != "" {
		user, err = s.userRepo.FindByUsername(req.Username)
	} else if req.Email != "" {
		user, err = s.userRepo.FindByEmail(req.Email)
	} else {
		return nil, errors.New("必须提供用户名或邮箱")
	}

	if err != nil {
		return nil, errors.New("用户不存在")
	}

	// 验证密码
	if !verifyPassword(user.PasswordHash, req.Password) {
		return nil, errors.New("密码错误")
	}

	// 检查用户是否活跃
	if !user.Active {
		return nil, errors.New("账户已禁用")
	}

	return user, nil
}

// GetUserByID 通过ID获取用户信息
func (s *UserService) GetUserByID(id string) (*domain.User, error) {
	return s.userRepo.FindByID(id)
}

// ListUsers 获取用户列表
func (s *UserService) ListUsers(page, limit int) ([]*domain.User, int64, error) {
	// 参数校验
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 10
	}

	return s.userRepo.List(page, limit)
}

// UpdateUser 更新用户信息
func (s *UserService) UpdateUser(user *domain.User) error {
	// 查找用户是否存在
	existingUser, err := s.userRepo.FindByID(user.ID)
	if err != nil {
		return fmt.Errorf("用户不存在: %w", err)
	}

	// 更新可修改的字段
	existingUser.FirstName = user.FirstName
	existingUser.LastName = user.LastName
	existingUser.Email = user.Email
	existingUser.Active = user.Active
	existingUser.UpdatedAt = time.Now()

	// 如果要更新角色，确保当前用户有权限
	if user.Role != "" {
		existingUser.Role = user.Role
	}

	return s.userRepo.Update(existingUser)
}

// DeleteUser 删除用户
func (s *UserService) DeleteUser(id string) error {
	// 检查用户是否存在
	_, err := s.userRepo.FindByID(id)
	if err != nil {
		return fmt.Errorf("用户不存在: %w", err)
	}

	return s.userRepo.Delete(id)
}

// ChangePassword 修改密码
func (s *UserService) ChangePassword(userID, currentPassword, newPassword string) error {
	// 获取用户
	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return fmt.Errorf("用户不存在: %w", err)
	}

	// 验证当前密码
	if !verifyPassword(user.PasswordHash, currentPassword) {
		return errors.New("当前密码错误")
	}

	// 哈希新密码
	hashedPassword, err := hashPassword(newPassword)
	if err != nil {
		return fmt.Errorf("密码哈希处理失败: %w", err)
	}

	// 更新密码
	user.PasswordHash = hashedPassword
	user.UpdatedAt = time.Now()

	return s.userRepo.Update(user)
}

// CheckCourseAccess 检查用户是否有权访问课程
func (s *UserService) CheckCourseAccess(userID, courseID string) (bool, error) {
	return s.userRepo.HasCourseAccess(userID, courseID)
}

// hashPassword 哈希密码
func hashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

// verifyPassword 验证密码
func verifyPassword(hashedPassword, password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(password))
	return err == nil
}
