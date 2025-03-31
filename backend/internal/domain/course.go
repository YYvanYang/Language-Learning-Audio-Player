package domain

import "time"

// Course 课程领域模型
type Course struct {
	ID          string
	Title       string
	Description string
	Level       string
	Language    string
	ImageURL    string
	IsPublic    bool
	CreatedAt   time.Time
	UpdatedAt   time.Time
	Units       []*Unit
}

// Unit 单元领域模型
type Unit struct {
	ID          string
	CourseID    string
	Title       string
	Description string
	OrderIndex  int
	CreatedAt   time.Time
	UpdatedAt   time.Time
	Tracks      []*Track
}

// CourseRepository 课程仓储接口
type CourseRepository interface {
	// FindByID 根据ID查找课程
	FindByID(id string) (*Course, error)

	// FindAll 获取所有课程
	FindAll(page, limit int) ([]*Course, int64, error)

	// FindPublic 获取所有公开课程
	FindPublic(page, limit int) ([]*Course, int64, error)

	// FindByUser 获取用户有权访问的课程
	FindByUser(userID string, page, limit int) ([]*Course, int64, error)

	// Create 创建新课程
	Create(course *Course) error

	// Update 更新课程信息
	Update(course *Course) error

	// Delete 删除课程
	Delete(id string) error

	// GetUnits 获取课程的所有单元
	GetUnits(courseID string) ([]*Unit, error)

	// CreateUnit 创建单元
	CreateUnit(unit *Unit) error

	// UpdateUnit 更新单元
	UpdateUnit(unit *Unit) error

	// DeleteUnit 删除单元
	DeleteUnit(id string) error

	// ReorderUnits 重新排序单元
	ReorderUnits(courseID string, unitIDs []string) error
}

// CourseResponse 课程响应
type CourseResponse struct {
	ID          string         `json:"id"`
	Title       string         `json:"title"`
	Description string         `json:"description"`
	Level       string         `json:"level"`
	Language    string         `json:"language"`
	ImageURL    string         `json:"imageUrl"`
	IsPublic    bool           `json:"isPublic"`
	UnitCount   int            `json:"unitCount,omitempty"`
	Units       []UnitResponse `json:"units,omitempty"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
}

// UnitResponse 单元响应
type UnitResponse struct {
	ID          string    `json:"id"`
	CourseID    string    `json:"courseId"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	OrderIndex  int       `json:"orderIndex"`
	TrackCount  int       `json:"trackCount,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// CreateCourseRequest 创建课程请求
type CreateCourseRequest struct {
	Title       string `json:"title" binding:"required"`
	Description string `json:"description"`
	Level       string `json:"level"`
	Language    string `json:"language" binding:"required"`
	ImageURL    string `json:"imageUrl"`
	IsPublic    bool   `json:"isPublic"`
}

// UpdateCourseRequest 更新课程请求
type UpdateCourseRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Level       string `json:"level"`
	Language    string `json:"language"`
	ImageURL    string `json:"imageUrl"`
	IsPublic    *bool  `json:"isPublic"`
}

// CreateUnitRequest 创建单元请求
type CreateUnitRequest struct {
	CourseID    string `json:"courseId" binding:"required"`
	Title       string `json:"title" binding:"required"`
	Description string `json:"description"`
	OrderIndex  int    `json:"orderIndex"`
}

// UpdateUnitRequest 更新单元请求
type UpdateUnitRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	OrderIndex  int    `json:"orderIndex"`
}

// ReorderUnitsRequest 重新排序单元请求
type ReorderUnitsRequest struct {
	UnitIDs []string `json:"unitIds" binding:"required"`
}

// NewCourseResponse 创建课程响应
func NewCourseResponse(course *Course) *CourseResponse {
	resp := &CourseResponse{
		ID:          course.ID,
		Title:       course.Title,
		Description: course.Description,
		Level:       course.Level,
		Language:    course.Language,
		ImageURL:    course.ImageURL,
		IsPublic:    course.IsPublic,
		UnitCount:   len(course.Units),
		CreatedAt:   course.CreatedAt,
		UpdatedAt:   course.UpdatedAt,
	}

	if course.Units != nil {
		resp.Units = make([]UnitResponse, len(course.Units))
		for i, unit := range course.Units {
			resp.Units[i] = *NewUnitResponse(unit)
		}
	}

	return resp
}

// NewUnitResponse 创建单元响应
func NewUnitResponse(unit *Unit) *UnitResponse {
	return &UnitResponse{
		ID:          unit.ID,
		CourseID:    unit.CourseID,
		Title:       unit.Title,
		Description: unit.Description,
		OrderIndex:  unit.OrderIndex,
		TrackCount:  len(unit.Tracks),
		CreatedAt:   unit.CreatedAt,
		UpdatedAt:   unit.UpdatedAt,
	}
}
