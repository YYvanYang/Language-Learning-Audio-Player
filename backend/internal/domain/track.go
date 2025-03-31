package domain

import "time"

// Track 音轨领域模型
type Track struct {
	ID          string
	UnitID      string
	Title       string
	Description string
	FilePath    string
	Duration    float64
	OrderIndex  int
	IsSystem    bool
	CreatedAt   time.Time
	UpdatedAt   time.Time
	Bookmarks   []*Bookmark
}

// Bookmark 书签领域模型
type Bookmark struct {
	ID          string
	UserID      string
	TrackID     string
	Position    float64
	Label       string
	Description string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// TrackRepository 音轨仓储接口
type TrackRepository interface {
	// FindByID 根据ID查找音轨
	FindByID(id string) (*Track, error)

	// FindByUnitID 根据单元ID查找音轨列表
	FindByUnitID(unitID string, includeBookmarks bool) ([]*Track, error)

	// Create 创建新音轨
	Create(track *Track) error

	// Update 更新音轨信息
	Update(track *Track) error

	// Delete 删除音轨
	Delete(id string) error

	// Count 统计音轨总数
	Count() (int64, error)

	// ReorderTracks 重新排序单元内的音轨
	ReorderTracks(unitID string, trackIDs []string) error

	// CreateBookmark 创建书签
	CreateBookmark(bookmark *Bookmark) error

	// UpdateBookmark 更新书签
	UpdateBookmark(bookmark *Bookmark) error

	// DeleteBookmark 删除书签
	DeleteBookmark(id string) error

	// FindBookmarksByTrack 查找音轨的所有书签
	FindBookmarksByTrack(userID, trackID string) ([]*Bookmark, error)
}

// TrackResponse 音轨响应
type TrackResponse struct {
	ID          string             `json:"id"`
	UnitID      string             `json:"unitId"`
	Title       string             `json:"title"`
	Description string             `json:"description"`
	FilePath    string             `json:"filePath"`
	Duration    float64            `json:"duration"`
	OrderIndex  int                `json:"orderIndex"`
	IsSystem    bool               `json:"isSystem"`
	Bookmarks   []BookmarkResponse `json:"bookmarks,omitempty"`
	CreatedAt   time.Time          `json:"createdAt"`
	UpdatedAt   time.Time          `json:"updatedAt"`
}

// BookmarkResponse 书签响应
type BookmarkResponse struct {
	ID          string    `json:"id"`
	UserID      string    `json:"userId"`
	TrackID     string    `json:"trackId"`
	Position    float64   `json:"position"`
	Label       string    `json:"label"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// CreateTrackRequest 创建音轨请求
type CreateTrackRequest struct {
	UnitID      string  `json:"unitId" binding:"required"`
	Title       string  `json:"title" binding:"required"`
	Description string  `json:"description"`
	FilePath    string  `json:"filePath" binding:"required"`
	Duration    float64 `json:"duration" binding:"required"`
	OrderIndex  int     `json:"orderIndex"`
	IsSystem    bool    `json:"isSystem"`
}

// UpdateTrackRequest 更新音轨请求
type UpdateTrackRequest struct {
	Title       string  `json:"title"`
	Description string  `json:"description"`
	FilePath    string  `json:"filePath"`
	Duration    float64 `json:"duration"`
	OrderIndex  int     `json:"orderIndex"`
}

// ReorderTracksRequest 重新排序音轨请求
type ReorderTracksRequest struct {
	TrackIDs []string `json:"trackIds" binding:"required"`
}

// CreateBookmarkRequest 创建书签请求
type CreateBookmarkRequest struct {
	TrackID     string  `json:"trackId" binding:"required"`
	Position    float64 `json:"position" binding:"required"`
	Label       string  `json:"label"`
	Description string  `json:"description"`
}

// UpdateBookmarkRequest 更新书签请求
type UpdateBookmarkRequest struct {
	Position    float64 `json:"position"`
	Label       string  `json:"label"`
	Description string  `json:"description"`
}

// NewTrackResponse 创建音轨响应
func NewTrackResponse(track *Track) *TrackResponse {
	resp := &TrackResponse{
		ID:          track.ID,
		UnitID:      track.UnitID,
		Title:       track.Title,
		Description: track.Description,
		FilePath:    track.FilePath,
		Duration:    track.Duration,
		OrderIndex:  track.OrderIndex,
		IsSystem:    track.IsSystem,
		CreatedAt:   track.CreatedAt,
		UpdatedAt:   track.UpdatedAt,
	}

	if track.Bookmarks != nil {
		resp.Bookmarks = make([]BookmarkResponse, len(track.Bookmarks))
		for i, bookmark := range track.Bookmarks {
			resp.Bookmarks[i] = *NewBookmarkResponse(bookmark)
		}
	}

	return resp
}

// NewBookmarkResponse 创建书签响应
func NewBookmarkResponse(bookmark *Bookmark) *BookmarkResponse {
	return &BookmarkResponse{
		ID:          bookmark.ID,
		UserID:      bookmark.UserID,
		TrackID:     bookmark.TrackID,
		Position:    bookmark.Position,
		Label:       bookmark.Label,
		Description: bookmark.Description,
		CreatedAt:   bookmark.CreatedAt,
		UpdatedAt:   bookmark.UpdatedAt,
	}
}
