// track.go
package models

import (
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"
)

// Track 音轨模型
type Track struct {
	ID              string    `db:"id" json:"id"`
	UnitID          string    `db:"unit_id" json:"unitId"`
	Title           string    `db:"title" json:"title"`
	Description     string    `db:"description" json:"description"`
	FileName        string    `db:"file_name" json:"fileName"`
	FilePath        string    `db:"file_path" json:"filePath"`
	FileSize        int64     `db:"file_size" json:"fileSize"`
	Duration        float64   `db:"duration" json:"duration"`
	Format          string    `db:"format" json:"format"`
	SampleRate      int       `db:"sample_rate" json:"sampleRate"`
	Channels        int       `db:"channels" json:"channels"`
	BitRate         int       `db:"bit_rate" json:"bitRate"`
	WaveformPath    string    `db:"waveform_path" json:"waveformPath"`
	TranscriptPath  string    `db:"transcript_path" json:"transcriptPath"`
	HasTranscript   bool      `db:"has_transcript" json:"hasTranscript"`
	Sequence        int       `db:"sequence" json:"sequence"`
	IsSystem        bool      `db:"is_system" json:"isSystem"`
	CreatedBy       string    `db:"created_by" json:"createdBy"`
	CreatedAt       time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt       time.Time `db:"updated_at" json:"updatedAt"`
	Bookmarks       []Bookmark `json:"bookmarks,omitempty" db:"-"`
}

// Bookmark 书签模型
type Bookmark struct {
	ID        string    `db:"id" json:"id"`
	UserID    string    `db:"user_id" json:"userId"`
	TrackID   string    `db:"track_id" json:"trackId"`
	TimePoint float64   `db:"time_point" json:"timePoint"`
	Label     string    `db:"label" json:"label"`
	Color     string    `db:"color" json:"color"`
	Notes     string    `db:"notes" json:"notes"`
	CreatedAt time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt time.Time `db:"updated_at" json:"updatedAt"`
}

// UserTrack 用户上传的音轨
type UserTrack struct {
	ID               string    `db:"id" json:"id"`
	UserID           string    `db:"user_id" json:"userId"`
	CourseID         string    `db:"course_id" json:"courseId"`
	UnitID           string    `db:"unit_id" json:"unitId"`
	Title            string    `db:"title" json:"title"`
	Description      string    `db:"description" json:"description"`
	FileName         string    `db:"file_name" json:"fileName"`
	FilePath         string    `db:"file_path" json:"filePath"`
	OriginalFileName string    `db:"original_file_name" json:"originalFileName"`
	FileSize         int64     `db:"file_size" json:"fileSize"`
	Duration         float64   `db:"duration" json:"duration"`
	Format           string    `db:"format" json:"format"`
	UploadTime       time.Time `db:"upload_time" json:"uploadTime"`
	LastAccessTime   time.Time `db:"last_access_time" json:"lastAccessTime"`
	TrackID          string    `db:"track_id" json:"trackId"`
}

// UserProgress 用户学习进度
type UserProgress struct {
	ID             string    `db:"id" json:"id"`
	UserID         string    `db:"user_id" json:"userId"`
	TrackID        string    `db:"track_id" json:"trackId"`
	LastPosition   float64   `db:"last_position" json:"lastPosition"`
	PlayCount      int       `db:"play_count" json:"playCount"`
	CompletionRate float64   `db:"completion_rate" json:"completionRate"`
	LastAccessed   time.Time `db:"last_accessed" json:"lastAccessed"`
	CreatedAt      time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt      time.Time `db:"updated_at" json:"updatedAt"`
}

// TrackRepository 音轨数据访问层
type TrackRepository struct {
	DB *sqlx.DB
}

// NewTrackRepository 创建音轨仓库
func NewTrackRepository(db *sqlx.DB) *TrackRepository {
	return &TrackRepository{
		DB: db,
	}
}

// Create 创建音轨
func (r *TrackRepository) Create(track *Track) error {
	query := `
	INSERT INTO tracks (
		id, unit_id, title, description, file_name, file_path, file_size, 
		duration, format, sample_rate, channels, bit_rate, waveform_path, 
		transcript_path, has_transcript, sequence, is_system, created_by, 
		created_at, updated_at
	) VALUES (
		$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 
		$16, $17, $18, $19, $20
	) RETURNING id`

	if track.ID == "" {
		track.ID = fmt.Sprintf("track_%d", time.Now().UnixNano())
	}
	track.CreatedAt = time.Now()
	track.UpdatedAt = time.Now()

	_, err := r.DB.Exec(
		query,
		track.ID,
		track.UnitID,
		track.Title,
		track.Description,
		track.FileName,
		track.FilePath,
		track.FileSize,
		track.Duration,
		track.Format,
		track.SampleRate,
		track.Channels,
		track.BitRate,
		track.WaveformPath,
		track.TranscriptPath,
		track.HasTranscript,
		track.Sequence,
		track.IsSystem,
		track.CreatedBy,
		track.CreatedAt,
		track.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("创建音轨失败: %w", err)
	}

	return nil
}

// GetByID 通过ID获取音轨
func (r *TrackRepository) GetByID(id string) (*Track, error) {
	var track Track
	err := r.DB.Get(&track, "SELECT * FROM tracks WHERE id = $1", id)
	if err != nil {
		return nil, fmt.Errorf("根据ID获取音轨失败: %w", err)
	}
	return &track, nil
}

// Update 更新音轨信息
func (r *TrackRepository) Update(track *Track) error {
	query := `
	UPDATE tracks SET 
		title = $1,
		description = $2,
		sequence = $3,
		has_transcript = $4,
		updated_at = $5
	WHERE id = $6`

	track.UpdatedAt = time.Now()

	_, err := r.DB.Exec(
		query,
		track.Title,
		track.Description,
		track.Sequence,
		track.HasTranscript,
		track.UpdatedAt,
		track.ID,
	)

	if err != nil {
		return fmt.Errorf("更新音轨失败: %w", err)
	}

	return nil
}

// Delete 删除音轨
func (r *TrackRepository) Delete(id string) error {
	tx, err := r.DB.Beginx()
	if err != nil {
		return fmt.Errorf("开始事务失败: %w", err)
	}

	// 删除书签
	_, err = tx.Exec("DELETE FROM bookmarks WHERE track_id = $1", id)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("删除音轨书签失败: %w", err)
	}

	// 删除用户进度
	_, err = tx.Exec("DELETE FROM user_progress WHERE track_id = $1", id)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("删除用户进度失败: %w", err)
	}

	// 删除用户上传的音轨
	_, err = tx.Exec("DELETE FROM user_tracks WHERE track_id = $1", id)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("删除用户音轨记录失败: %w", err)
	}

	// 删除音轨
	_, err = tx.Exec("DELETE FROM tracks WHERE id = $1", id)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("删除音轨失败: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("提交事务失败: %w", err)
	}

	return nil
}

// ListByUnit 获取单元内的音轨列表
func (r *TrackRepository) ListByUnit(unitID string) ([]Track, error) {
	var tracks []Track
	query := "SELECT * FROM tracks WHERE unit_id = $1 ORDER BY sequence"

	err := r.DB.Select(&tracks, query, unitID)
	if err != nil {
		return nil, fmt.Errorf("获取单元音轨列表失败: %w", err)
	}

	return tracks, nil
}

// BookmarkRepository 书签数据访问层
type BookmarkRepository struct {
	DB *sqlx.DB
}

// NewBookmarkRepository 创建书签仓库
func NewBookmarkRepository(db *sqlx.DB) *BookmarkRepository {
	return &BookmarkRepository{
		DB: db,
	}
}

// Create 创建书签
func (r *BookmarkRepository) Create(bookmark *Bookmark) error {
	query := `
	INSERT INTO bookmarks (
		id, user_id, track_id, time_point, label, color, notes, created_at, updated_at
	) VALUES (
		$1, $2, $3, $4, $5, $6, $7, $8, $9
	) RETURNING id`

	if bookmark.ID == "" {
		bookmark.ID = fmt.Sprintf("bookmark_%d", time.Now().UnixNano())
	}
	bookmark.CreatedAt = time.Now()
	bookmark.UpdatedAt = time.Now()

	_, err := r.DB.Exec(
		query,
		bookmark.ID,
		bookmark.UserID,
		bookmark.TrackID,
		bookmark.TimePoint,
		bookmark.Label,
		bookmark.Color,
		bookmark.Notes,
		bookmark.CreatedAt,
		bookmark.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("创建书签失败: %w", err)
	}

	return nil
}

// GetByID 通过ID获取书签
func (r *BookmarkRepository) GetByID(id string) (*Bookmark, error) {
	var bookmark Bookmark
	err := r.DB.Get(&bookmark, "SELECT * FROM bookmarks WHERE id = $1", id)
	if err != nil {
		return nil, fmt.Errorf("根据ID获取书签失败: %w", err)
	}
	return &bookmark, nil
}

// Update 更新书签信息
func (r *BookmarkRepository) Update(bookmark *Bookmark) error {
	query := `
	UPDATE bookmarks SET 
		time_point = $1,
		label = $2,
		color = $3,
		notes = $4,
		updated_at = $5
	WHERE id = $6`

	bookmark.UpdatedAt = time.Now()

	_, err := r.DB.Exec(
		query,
		bookmark.TimePoint,
		bookmark.Label,
		bookmark.Color,
		bookmark.Notes,
		bookmark.UpdatedAt,
		bookmark.ID,
	)

	if err != nil {
		return fmt.Errorf("更新书签失败: %w", err)
	}

	return nil
}

// Delete 删除书签
func (r *BookmarkRepository) Delete(id string) error {
	_, err := r.DB.Exec("DELETE FROM bookmarks WHERE id = $1", id)
	if err != nil {
		return fmt.Errorf("删除书签失败: %w", err)
	}
	return nil
}

// ListByTrack 获取音轨的书签列表
func (r *BookmarkRepository) ListByTrack(userID, trackID string) ([]Bookmark, error) {
	var bookmarks []Bookmark
	query := "SELECT * FROM bookmarks WHERE user_id = $1 AND track_id = $2 ORDER BY time_point"

	err := r.DB.Select(&bookmarks, query, userID, trackID)
	if err != nil {
		return nil, fmt.Errorf("获取音轨书签列表失败: %w", err)
	}

	return bookmarks, nil
}

// UserProgressRepository 用户进度数据访问层
type UserProgressRepository struct {
	DB *sqlx.DB
}

// NewUserProgressRepository 创建用户进度仓库
func NewUserProgressRepository(db *sqlx.DB) *UserProgressRepository {
	return &UserProgressRepository{
		DB: db,
	}
}

// GetOrCreate 获取或创建用户进度
func (r *UserProgressRepository) GetOrCreate(userID, trackID string) (*UserProgress, error) {
	var progress UserProgress

	// 尝试获取现有进度
	err := r.DB.Get(&progress, "SELECT * FROM user_progress WHERE user_id = $1 AND track_id = $2", userID, trackID)
	if err == nil {
		return &progress, nil
	}

	// 创建新进度记录
	progress = UserProgress{
		ID:             fmt.Sprintf("progress_%d", time.Now().UnixNano()),
		UserID:         userID,
		TrackID:        trackID,
		LastPosition:   0,
		PlayCount:      0,
		CompletionRate: 0,
		LastAccessed:   time.Now(),
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	query := `
	INSERT INTO user_progress (
		id, user_id, track_id, last_position, play_count, completion_rate, 
		last_accessed, created_at, updated_at
	) VALUES (
		$1, $2, $3, $4, $5, $6, $7, $8, $9
	) RETURNING id`

	_, err = r.DB.Exec(
		query,
		progress.ID,
		progress.UserID,
		progress.TrackID,
		progress.LastPosition,
		progress.PlayCount,
		progress.CompletionRate,
		progress.LastAccessed,
		progress.CreatedAt,
		progress.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("创建用户进度失败: %w", err)
	}

	return &progress, nil
}

// Update 更新用户进度
func (r *UserProgressRepository) Update(progress *UserProgress) error {
	query := `
	UPDATE user_progress SET 
		last_position = $1,
		play_count = $2,
		completion_rate = $3,
		last_accessed = $4,
		updated_at = $5
	WHERE id = $6`

	progress.LastAccessed = time.Now()
	progress.UpdatedAt = time.Now()

	_, err := r.DB.Exec(
		query,
		progress.LastPosition,
		progress.PlayCount,
		progress.CompletionRate,
		progress.LastAccessed,
		progress.UpdatedAt,
		progress.ID,
	)

	if err != nil {
		return fmt.Errorf("更新用户进度失败: %w", err)
	}

	return nil
}

// UserTrackRepository 用户上传音轨数据访问层
type UserTrackRepository struct {
	DB *sqlx.DB
}

// NewUserTrackRepository 创建用户上传音轨仓库
func NewUserTrackRepository(db *sqlx.DB) *UserTrackRepository {
	return &UserTrackRepository{
		DB: db,
	}
}

// Create 创建用户上传音轨
func (r *UserTrackRepository) Create(userTrack *UserTrack) error {
	query := `
	INSERT INTO user_tracks (
		id, user_id, course_id, unit_id, title, description, file_name, 
		file_path, original_file_name, file_size, duration, format, 
		upload_time, last_access_time, track_id
	) VALUES (
		$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
	) RETURNING id`

	if userTrack.ID == "" {
		userTrack.ID = fmt.Sprintf("user_track_%d", time.Now().UnixNano())
	}
	userTrack.UploadTime = time.Now()
	userTrack.LastAccessTime = time.Now()

	_, err := r.DB.Exec(
		query,
		userTrack.ID,
		userTrack.UserID,
		userTrack.CourseID,
		userTrack.UnitID,
		userTrack.Title,
		userTrack.Description,
		userTrack.FileName,
		userTrack.FilePath,
		userTrack.OriginalFileName,
		userTrack.FileSize,
		userTrack.Duration,
		userTrack.Format,
		userTrack.UploadTime,
		userTrack.LastAccessTime,
		userTrack.TrackID,
	)

	if err != nil {
		return fmt.Errorf("创建用户上传音轨失败: %w", err)
	}

	return nil
}

// GetByID 通过ID获取用户上传音轨
func (r *UserTrackRepository) GetByID(id string) (*UserTrack, error) {
	var userTrack UserTrack
	err := r.DB.Get(&userTrack, "SELECT * FROM user_tracks WHERE id = $1", id)
	if err != nil {
		return nil, fmt.Errorf("根据ID获取用户上传音轨失败: %w", err)
	}
	return &userTrack, nil
}

// Update 更新用户上传音轨信息
func (r *UserTrackRepository) Update(userTrack *UserTrack) error {
	query := `
	UPDATE user_tracks SET 
		title = $1,
		description = $2,
		last_access_time = $3
	WHERE id = $4`

	userTrack.LastAccessTime = time.Now()

	_, err := r.DB.Exec(
		query,
		userTrack.Title,
		userTrack.Description,
		userTrack.LastAccessTime,
		userTrack.ID,
	)

	if err != nil {
		return fmt.Errorf("更新用户上传音轨失败: %w", err)
	}

	return nil
}

// Delete 删除用户上传音轨
func (r *UserTrackRepository) Delete(id string) error {
	_, err := r.DB.Exec("DELETE FROM user_tracks WHERE id = $1", id)
	if err != nil {
		return fmt.Errorf("删除用户上传音轨失败: %w", err)
	}
	return nil
}

// ListByUser 获取用户上传的音轨列表
func (r *UserTrackRepository) ListByUser(userID string, limit, offset int) ([]UserTrack, error) {
	var userTracks []UserTrack
	query := "SELECT * FROM user_tracks WHERE user_id = $1 ORDER BY upload_time DESC LIMIT $2 OFFSET $3"

	err := r.DB.Select(&userTracks, query, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("获取用户上传音轨列表失败: %w", err)
	}

	return userTracks, nil
}

// CountByUser 获取用户上传的音轨数量
func (r *UserTrackRepository) CountByUser(userID string) (int, error) {
	var count int
	err := r.DB.Get(&count, "SELECT COUNT(*) FROM user_tracks WHERE user_id = $1", userID)
	if err != nil {
		return 0, fmt.Errorf("获取用户上传音轨数量失败: %w", err)
	}
	return count, nil
} 