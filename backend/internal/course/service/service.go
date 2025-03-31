package service

import (
	"errors"
	"fmt"
	"time"

	"github.com/YYvanYang/Language-Learning-Audio-Player/backend/internal/domain"
	"github.com/YYvanYang/Language-Learning-Audio-Player/backend/internal/utils/logger"

	"go.uber.org/zap"
)

// CourseService 课程服务
type CourseService struct {
	courseRepo domain.CourseRepository
}

// NewCourseService 创建课程服务实例
func NewCourseService(courseRepo domain.CourseRepository) *CourseService {
	return &CourseService{
		courseRepo: courseRepo,
	}
}

// GetCourseByID 通过ID获取课程信息
func (s *CourseService) GetCourseByID(id string) (*domain.Course, error) {
	logger.Debug("获取课程", zap.String("id", id))
	course, err := s.courseRepo.FindByID(id)
	if err != nil {
		logger.Error("获取课程失败", zap.String("id", id), zap.Error(err))
		return nil, err
	}
	return course, nil
}

// GetAllCourses 获取所有课程
func (s *CourseService) GetAllCourses(page, limit int) ([]*domain.Course, int64, error) {
	// 参数校验
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 10
	}

	logger.Debug("获取所有课程", zap.Int("page", page), zap.Int("limit", limit))
	courses, total, err := s.courseRepo.FindAll(page, limit)
	if err != nil {
		logger.Error("获取所有课程失败", zap.Error(err))
		return nil, 0, err
	}
	return courses, total, nil
}

// GetPublicCourses 获取所有公开课程
func (s *CourseService) GetPublicCourses(page, limit int) ([]*domain.Course, int64, error) {
	// 参数校验
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 10
	}

	logger.Debug("获取公开课程", zap.Int("page", page), zap.Int("limit", limit))
	courses, total, err := s.courseRepo.FindPublic(page, limit)
	if err != nil {
		logger.Error("获取公开课程失败", zap.Error(err))
		return nil, 0, err
	}
	return courses, total, nil
}

// GetUserCourses 获取用户有权访问的课程
func (s *CourseService) GetUserCourses(userID string, page, limit int) ([]*domain.Course, int64, error) {
	// 参数校验
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 10
	}

	logger.Debug("获取用户课程", zap.String("userID", userID), zap.Int("page", page), zap.Int("limit", limit))
	courses, total, err := s.courseRepo.FindByUser(userID, page, limit)
	if err != nil {
		logger.Error("获取用户课程失败", zap.String("userID", userID), zap.Error(err))
		return nil, 0, err
	}
	return courses, total, nil
}

// CreateCourse 创建新课程
func (s *CourseService) CreateCourse(req domain.CreateCourseRequest) (*domain.Course, error) {
	logger.Info("创建新课程", zap.String("title", req.Title), zap.String("language", req.Language))

	// 创建课程对象
	course := &domain.Course{
		Title:       req.Title,
		Description: req.Description,
		Level:       req.Level,
		Language:    req.Language,
		ImageURL:    req.ImageURL,
		IsPublic:    req.IsPublic,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	// 保存课程
	err := s.courseRepo.Create(course)
	if err != nil {
		logger.Error("创建课程失败", zap.String("title", req.Title), zap.Error(err))
		return nil, err
	}

	logger.Info("课程创建成功", zap.String("id", course.ID), zap.String("title", course.Title))
	return course, nil
}

// UpdateCourse 更新课程信息
func (s *CourseService) UpdateCourse(id string, req domain.UpdateCourseRequest) (*domain.Course, error) {
	logger.Info("更新课程", zap.String("id", id))

	// 获取现有课程
	course, err := s.courseRepo.FindByID(id)
	if err != nil {
		logger.Error("更新课程失败：课程不存在", zap.String("id", id), zap.Error(err))
		return nil, err
	}

	// 更新字段
	if req.Title != "" {
		course.Title = req.Title
	}
	if req.Description != "" {
		course.Description = req.Description
	}
	if req.Level != "" {
		course.Level = req.Level
	}
	if req.Language != "" {
		course.Language = req.Language
	}
	if req.ImageURL != "" {
		course.ImageURL = req.ImageURL
	}
	if req.IsPublic != nil {
		course.IsPublic = *req.IsPublic
	}

	course.UpdatedAt = time.Now()

	// 保存更新
	err = s.courseRepo.Update(course)
	if err != nil {
		logger.Error("更新课程失败", zap.String("id", id), zap.Error(err))
		return nil, err
	}

	logger.Info("课程更新成功", zap.String("id", course.ID))
	return course, nil
}

// DeleteCourse 删除课程
func (s *CourseService) DeleteCourse(id string) error {
	logger.Info("删除课程", zap.String("id", id))

	// 检查课程是否存在
	_, err := s.courseRepo.FindByID(id)
	if err != nil {
		logger.Error("删除课程失败：课程不存在", zap.String("id", id), zap.Error(err))
		return err
	}

	// 删除课程
	err = s.courseRepo.Delete(id)
	if err != nil {
		logger.Error("删除课程失败", zap.String("id", id), zap.Error(err))
		return err
	}

	logger.Info("课程删除成功", zap.String("id", id))
	return nil
}

// GetCourseUnits 获取课程的所有单元
func (s *CourseService) GetCourseUnits(courseID string) ([]*domain.Unit, error) {
	logger.Debug("获取课程单元", zap.String("courseID", courseID))

	// 先检查课程是否存在
	_, err := s.courseRepo.FindByID(courseID)
	if err != nil {
		logger.Error("获取课程单元失败：课程不存在", zap.String("courseID", courseID), zap.Error(err))
		return nil, err
	}

	// 获取单元列表
	units, err := s.courseRepo.GetUnits(courseID)
	if err != nil {
		logger.Error("获取课程单元失败", zap.String("courseID", courseID), zap.Error(err))
		return nil, err
	}

	return units, nil
}

// CreateUnit 创建课程单元
func (s *CourseService) CreateUnit(req domain.CreateUnitRequest) (*domain.Unit, error) {
	logger.Info("创建课程单元", zap.String("courseID", req.CourseID), zap.String("title", req.Title))

	// 检查课程是否存在
	_, err := s.courseRepo.FindByID(req.CourseID)
	if err != nil {
		logger.Error("创建单元失败：课程不存在", zap.String("courseID", req.CourseID), zap.Error(err))
		return nil, fmt.Errorf("课程不存在: %w", err)
	}

	// 创建单元对象
	unit := &domain.Unit{
		CourseID:    req.CourseID,
		Title:       req.Title,
		Description: req.Description,
		OrderIndex:  req.OrderIndex,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	// 保存单元
	err = s.courseRepo.CreateUnit(unit)
	if err != nil {
		logger.Error("创建单元失败", zap.String("courseID", req.CourseID), zap.String("title", req.Title), zap.Error(err))
		return nil, err
	}

	logger.Info("单元创建成功", zap.String("id", unit.ID), zap.String("title", unit.Title))
	return unit, nil
}

// UpdateUnit 更新单元信息
func (s *CourseService) UpdateUnit(id string, req domain.UpdateUnitRequest) (*domain.Unit, error) {
	logger.Info("更新单元", zap.String("id", id))

	// 获取现有单元
	units, err := s.courseRepo.GetUnits("") // 这里简化处理，实际应该根据单元ID获取单元
	if err != nil {
		logger.Error("更新单元失败", zap.String("id", id), zap.Error(err))
		return nil, err
	}

	var unit *domain.Unit
	for _, u := range units {
		if u.ID == id {
			unit = u
			break
		}
	}

	if unit == nil {
		err = errors.New("单元不存在")
		logger.Error("更新单元失败：单元不存在", zap.String("id", id))
		return nil, err
	}

	// 更新字段
	if req.Title != "" {
		unit.Title = req.Title
	}
	if req.Description != "" {
		unit.Description = req.Description
	}
	if req.OrderIndex > 0 {
		unit.OrderIndex = req.OrderIndex
	}

	unit.UpdatedAt = time.Now()

	// 保存更新
	err = s.courseRepo.UpdateUnit(unit)
	if err != nil {
		logger.Error("更新单元失败", zap.String("id", id), zap.Error(err))
		return nil, err
	}

	logger.Info("单元更新成功", zap.String("id", unit.ID))
	return unit, nil
}

// DeleteUnit 删除单元
func (s *CourseService) DeleteUnit(id string) error {
	logger.Info("删除单元", zap.String("id", id))

	// 这里简化了检查单元是否存在的逻辑，实际应该有单独的查询方法
	// 删除单元
	err := s.courseRepo.DeleteUnit(id)
	if err != nil {
		logger.Error("删除单元失败", zap.String("id", id), zap.Error(err))
		return err
	}

	logger.Info("单元删除成功", zap.String("id", id))
	return nil
}

// ReorderCourseUnits 重新排序课程单元
func (s *CourseService) ReorderCourseUnits(courseID string, req domain.ReorderUnitsRequest) error {
	logger.Info("重新排序课程单元", zap.String("courseID", courseID), zap.Strings("unitIDs", req.UnitIDs))

	// 检查课程是否存在
	_, err := s.courseRepo.FindByID(courseID)
	if err != nil {
		logger.Error("重新排序单元失败：课程不存在", zap.String("courseID", courseID), zap.Error(err))
		return fmt.Errorf("课程不存在: %w", err)
	}

	// 重新排序单元
	err = s.courseRepo.ReorderUnits(courseID, req.UnitIDs)
	if err != nil {
		logger.Error("重新排序单元失败", zap.String("courseID", courseID), zap.Error(err))
		return err
	}

	logger.Info("单元重新排序成功", zap.String("courseID", courseID))
	return nil
}
