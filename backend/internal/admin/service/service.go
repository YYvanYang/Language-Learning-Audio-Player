package service

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"language-learning/internal/config"
	"language-learning/internal/domain"
	"language-learning/internal/utils/logger"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

// AdminService 管理员服务实现
type AdminService struct {
	cfg             *config.Config
	userRepo        domain.UserRepository
	courseRepo      domain.CourseRepository
	trackRepo       domain.TrackRepository
	customTrackRepo domain.CustomTrackRepository
	startTime       time.Time // 系统启动时间
	db              *gorm.DB  // 用于原始查询
}

// NewAdminService 创建管理员服务实例
func NewAdminService(
	cfg *config.Config,
	userRepo domain.UserRepository,
	courseRepo domain.CourseRepository,
	trackRepo domain.TrackRepository,
	customTrackRepo domain.CustomTrackRepository,
	db *gorm.DB,
) *AdminService {
	return &AdminService{
		cfg:             cfg,
		userRepo:        userRepo,
		courseRepo:      courseRepo,
		trackRepo:       trackRepo,
		customTrackRepo: customTrackRepo,
		startTime:       time.Now(),
		db:              db,
	}
}

// GetStats 获取系统统计信息
func (s *AdminService) GetStats() (*domain.AdminStats, error) {
	logger.Debug("获取系统统计信息")

	stats := &domain.AdminStats{
		SystemStartTime: s.startTime,
	}

	// 获取用户统计
	var err error
	stats.TotalUsers, err = s.userRepo.Count()
	if err != nil {
		logger.Error("获取用户总数失败", zap.Error(err))
		return nil, fmt.Errorf("获取用户总数失败: %w", err)
	}

	// 获取活跃用户数
	lastMonth := time.Now().AddDate(0, -1, 0)
	stats.ActiveUsers, err = s.userRepo.CountActive(lastMonth)
	if err != nil {
		logger.Error("获取活跃用户数失败", zap.Error(err))
		return nil, fmt.Errorf("获取活跃用户数失败: %w", err)
	}

	// 获取课程统计
	stats.TotalCourses, err = s.courseRepo.Count()
	if err != nil {
		logger.Error("获取课程总数失败", zap.Error(err))
		return nil, fmt.Errorf("获取课程总数失败: %w", err)
	}

	// 获取音轨统计
	stats.TotalTracks, err = s.trackRepo.Count()
	if err != nil {
		logger.Error("获取音轨总数失败", zap.Error(err))
		return nil, fmt.Errorf("获取音轨总数失败: %w", err)
	}

	// 获取自定义音轨统计
	stats.TotalCustomTracks, err = s.customTrackRepo.Count()
	if err != nil {
		logger.Error("获取自定义音轨总数失败", zap.Error(err))
		return nil, fmt.Errorf("获取自定义音轨总数失败: %w", err)
	}

	// 存储使用情况
	stats.StorageUsed, err = s.calculateStorageUsage()
	if err != nil {
		logger.Error("计算存储使用量失败", zap.Error(err))
		// 这里不返回错误，继续获取其他统计
	}

	// 最近一周新增用户
	lastWeek := time.Now().AddDate(0, 0, -7)
	stats.NewUsersLastWeek, err = s.userRepo.CountCreatedAfter(lastWeek)
	if err != nil {
		logger.Error("获取上周新增用户数失败", zap.Error(err))
		return nil, fmt.Errorf("获取上周新增用户数失败: %w", err)
	}

	// 最近一月新增用户
	stats.NewUsersLastMonth, err = s.userRepo.CountCreatedAfter(lastMonth)
	if err != nil {
		logger.Error("获取上月新增用户数失败", zap.Error(err))
		return nil, fmt.Errorf("获取上月新增用户数失败: %w", err)
	}

	// 活跃课程数量 (有用户最近一个月学习过的课程)
	stats.ActiveCoursesCount, err = s.courseRepo.CountActive(lastMonth)
	if err != nil {
		logger.Error("获取活跃课程数失败", zap.Error(err))
		return nil, fmt.Errorf("获取活跃课程数失败: %w", err)
	}

	logger.Debug("系统统计信息获取成功")
	return stats, nil
}

// GetAllUsers 获取所有用户
func (s *AdminService) GetAllUsers(page, pageSize int) ([]*domain.User, int64, error) {
	logger.Debug("获取所有用户", zap.Int("page", page), zap.Int("pageSize", pageSize))

	users, total, err := s.userRepo.FindAll(page, pageSize)
	if err != nil {
		logger.Error("获取所有用户失败", zap.Error(err))
		return nil, 0, fmt.Errorf("获取所有用户失败: %w", err)
	}

	return users, total, nil
}

// GetUserByID 获取用户详情
func (s *AdminService) GetUserByID(id string) (*domain.User, error) {
	logger.Debug("获取用户详情", zap.String("id", id))

	user, err := s.userRepo.FindByID(id)
	if err != nil {
		logger.Error("获取用户详情失败", zap.String("id", id), zap.Error(err))
		return nil, fmt.Errorf("获取用户详情失败: %w", err)
	}

	return user, nil
}

// UpdateUser 更新用户信息
func (s *AdminService) UpdateUser(user *domain.User) error {
	logger.Debug("更新用户信息", zap.String("id", user.ID))

	// 检查用户是否存在
	existingUser, err := s.userRepo.FindByID(user.ID)
	if err != nil {
		logger.Error("查找用户失败", zap.String("id", user.ID), zap.Error(err))
		return fmt.Errorf("查找用户失败: %w", err)
	}

	if existingUser == nil {
		logger.Error("用户不存在", zap.String("id", user.ID))
		return errors.New("用户不存在")
	}

	// 更新用户信息
	err = s.userRepo.Update(user)
	if err != nil {
		logger.Error("更新用户失败", zap.String("id", user.ID), zap.Error(err))
		return fmt.Errorf("更新用户失败: %w", err)
	}

	logger.Info("用户信息更新成功", zap.String("id", user.ID))
	return nil
}

// DeleteUser 删除用户
func (s *AdminService) DeleteUser(id string) error {
	logger.Debug("删除用户", zap.String("id", id))

	// 检查用户是否存在
	existingUser, err := s.userRepo.FindByID(id)
	if err != nil {
		logger.Error("查找用户失败", zap.String("id", id), zap.Error(err))
		return fmt.Errorf("查找用户失败: %w", err)
	}

	if existingUser == nil {
		logger.Error("用户不存在", zap.String("id", id))
		return errors.New("用户不存在")
	}

	// 删除用户自定义音轨
	err = s.cleanupUserData(id)
	if err != nil {
		logger.Error("清理用户数据失败", zap.String("id", id), zap.Error(err))
		// 继续删除用户，不终止流程
	}

	// 删除用户
	err = s.userRepo.Delete(id)
	if err != nil {
		logger.Error("删除用户失败", zap.String("id", id), zap.Error(err))
		return fmt.Errorf("删除用户失败: %w", err)
	}

	logger.Info("用户删除成功", zap.String("id", id))
	return nil
}

// GetSystemLogs 获取系统日志
func (s *AdminService) GetSystemLogs(level string, startDate, endDate time.Time, page, pageSize int) ([]*domain.SystemLogEntry, int64, error) {
	logger.Debug("获取系统日志",
		zap.String("level", level),
		zap.Time("startDate", startDate),
		zap.Time("endDate", endDate),
		zap.Int("page", page),
		zap.Int("pageSize", pageSize))

	// 这里简单实现，从日志文件读取
	// 实际实现可能需要使用专门的日志存储系统
	logs, err := s.readLogFiles(level, startDate, endDate, page, pageSize)
	if err != nil {
		logger.Error("读取日志文件失败", zap.Error(err))
		return nil, 0, fmt.Errorf("读取日志文件失败: %w", err)
	}

	// 简化处理，返回固定总数
	// TODO: 实际环境需要实现准确计数
	total := int64(len(logs))
	if total >= int64(pageSize) {
		total = int64(page+1) * int64(pageSize)
	}

	return logs, total, nil
}

// 计算存储使用量
func (s *AdminService) calculateStorageUsage() (int64, error) {
	// 获取音频存储路径
	audioPath := s.cfg.Audio.StoragePath
	if audioPath == "" {
		audioPath = "./data/audio"
	}

	// 检查路径是否存在
	if _, err := os.Stat(audioPath); os.IsNotExist(err) {
		return 0, fmt.Errorf("音频存储路径不存在: %s", audioPath)
	}

	var totalSize int64
	err := filepath.Walk(audioPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			totalSize += info.Size()
		}
		return nil
	})

	if err != nil {
		return 0, err
	}

	return totalSize, nil
}

// 清理用户数据
func (s *AdminService) cleanupUserData(userID string) error {
	// 1. 查找用户自定义音轨
	customTracks, _, err := s.customTrackRepo.FindByUserID(userID, 1, 1000) // 假设用户最多有1000个自定义音轨
	if err != nil {
		return fmt.Errorf("查找用户自定义音轨失败: %w", err)
	}

	// 2. 删除每个自定义音轨
	for _, track := range customTracks {
		err = s.customTrackRepo.Delete(track.ID)
		if err != nil {
			logger.Error("删除自定义音轨失败",
				zap.String("userID", userID),
				zap.String("trackID", track.ID),
				zap.Error(err))
			// 继续删除其他音轨
		}

		// 删除音频文件
		audioPath := filepath.Join(s.cfg.Audio.StoragePath, track.FilePath)
		if _, err := os.Stat(audioPath); err == nil {
			if err := os.Remove(audioPath); err != nil {
				logger.Error("删除音频文件失败",
					zap.String("path", audioPath),
					zap.Error(err))
			}
		}
	}

	return nil
}

// 读取日志文件
func (s *AdminService) readLogFiles(level string, startDate, endDate time.Time, page, pageSize int) ([]*domain.SystemLogEntry, error) {
	// 演示实现，实际应该从日志系统或数据库读取
	// 这里返回一些示例数据
	logs := make([]*domain.SystemLogEntry, 0, pageSize)

	// 生成一些演示数据
	offset := (page - 1) * pageSize
	for i := 0; i < pageSize; i++ {
		entryID := fmt.Sprintf("log-%d", offset+i)
		entry := &domain.SystemLogEntry{
			ID:        entryID,
			Level:     level,
			Message:   fmt.Sprintf("示例日志消息 #%d", offset+i),
			Timestamp: time.Now().Add(-time.Duration(i) * time.Hour),
			Metadata:  fmt.Sprintf("{\"source\":\"admin\",\"category\":\"system\",\"index\":%d}", i),
		}
		logs = append(logs, entry)
	}

	return logs, nil
}
