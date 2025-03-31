package domain

import "time"

// CustomTrack 自定义音轨领域模型
type CustomTrack struct {
	ID          string
	UserID      string
	Title       string
	Description string
	FilePath    string
	Duration    float64
	Tags        string
	IsPublic    bool
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// CustomTrackRepository 自定义音轨仓储接口
type CustomTrackRepository interface {
	// FindByID 根据ID查找自定义音轨
	FindByID(id string) (*CustomTrack, error)

	// FindByUserID 查找用户的所有自定义音轨
	FindByUserID(userID string, page, pageSize int) ([]*CustomTrack, int64, error)

	// FindPublic 查找公开的自定义音轨
	FindPublic(page, pageSize int) ([]*CustomTrack, int64, error)

	// Create 创建自定义音轨
	Create(track *CustomTrack) error

	// Update 更新自定义音轨
	Update(track *CustomTrack) error

	// Delete 删除自定义音轨
	Delete(id string) error

	// Search 搜索自定义音轨
	Search(query string, userID string, page, pageSize int) ([]*CustomTrack, int64, error)
}

// CustomTrackResponse 自定义音轨响应
type CustomTrackResponse struct {
	ID          string    `json:"id"`
	UserID      string    `json:"userId"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	FilePath    string    `json:"filePath"`
	Duration    float64   `json:"duration"`
	Tags        string    `json:"tags"`
	IsPublic    bool      `json:"isPublic"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// CreateCustomTrackRequest 创建自定义音轨请求
type CreateCustomTrackRequest struct {
	Title       string  `json:"title" binding:"required"`
	Description string  `json:"description"`
	FilePath    string  `json:"filePath" binding:"required"`
	Duration    float64 `json:"duration" binding:"required"`
	Tags        string  `json:"tags"`
	IsPublic    bool    `json:"isPublic"`
}

// UpdateCustomTrackRequest 更新自定义音轨请求
type UpdateCustomTrackRequest struct {
	Title       string  `json:"title"`
	Description string  `json:"description"`
	FilePath    string  `json:"filePath"`
	Duration    float64 `json:"duration"`
	Tags        string  `json:"tags"`
	IsPublic    bool    `json:"isPublic"`
}

// SearchCustomTrackRequest 搜索自定义音轨请求
type SearchCustomTrackRequest struct {
	Query    string `json:"query"`
	Page     int    `json:"page"`
	PageSize int    `json:"pageSize"`
}

// NewCustomTrackResponse 创建自定义音轨响应
func NewCustomTrackResponse(track *CustomTrack) *CustomTrackResponse {
	return &CustomTrackResponse{
		ID:          track.ID,
		UserID:      track.UserID,
		Title:       track.Title,
		Description: track.Description,
		FilePath:    track.FilePath,
		Duration:    track.Duration,
		Tags:        track.Tags,
		IsPublic:    track.IsPublic,
		CreatedAt:   track.CreatedAt,
		UpdatedAt:   track.UpdatedAt,
	}
}
