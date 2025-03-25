// course.go
package models

import (
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"
)

// Course 课程模型
type Course struct {
	ID          string    `db:"id" json:"id"`
	Title       string    `db:"title" json:"title"`
	Description string    `db:"description" json:"description"`
	Level       string    `db:"level" json:"level"`
	Language    string    `db:"language" json:"language"`
	CoverImage  string    `db:"cover_image" json:"coverImage"`
	Published   bool      `db:"published" json:"published"`
	CreatedAt   time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt   time.Time `db:"updated_at" json:"updatedAt"`
	CreatedBy   string    `db:"created_by" json:"createdBy"`
	Units       []Unit    `json:"units,omitempty" db:"-"`
}

// Unit 单元模型
type Unit struct {
	ID          string    `db:"id" json:"id"`
	CourseID    string    `db:"course_id" json:"courseId"`
	Title       string    `db:"title" json:"title"`
	Description string    `db:"description" json:"description"`
	Sequence    int       `db:"sequence" json:"sequence"`
	Published   bool      `db:"published" json:"published"`
	CreatedAt   time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt   time.Time `db:"updated_at" json:"updatedAt"`
	Tracks      []Track   `json:"tracks,omitempty" db:"-"`
}

// CourseRepository 课程数据访问层
type CourseRepository struct {
	DB *sqlx.DB
}

// NewCourseRepository 创建课程仓库
func NewCourseRepository(db *sqlx.DB) *CourseRepository {
	return &CourseRepository{
		DB: db,
	}
}

// Create 创建课程
func (r *CourseRepository) Create(course *Course) error {
	query := `
	INSERT INTO courses (
		id, title, description, level, language, cover_image, published, created_at, updated_at, created_by
	) VALUES (
		$1, $2, $3, $4, $5, $6, $7, $8, $9, $10
	) RETURNING id`

	if course.ID == "" {
		course.ID = fmt.Sprintf("course_%d", time.Now().UnixNano())
	}
	course.CreatedAt = time.Now()
	course.UpdatedAt = time.Now()

	_, err := r.DB.Exec(
		query,
		course.ID,
		course.Title,
		course.Description,
		course.Level,
		course.Language,
		course.CoverImage,
		course.Published,
		course.CreatedAt,
		course.UpdatedAt,
		course.CreatedBy,
	)

	if err != nil {
		return fmt.Errorf("创建课程失败: %w", err)
	}

	return nil
}

// GetByID 通过ID获取课程
func (r *CourseRepository) GetByID(id string) (*Course, error) {
	var course Course
	err := r.DB.Get(&course, "SELECT * FROM courses WHERE id = $1", id)
	if err != nil {
		return nil, fmt.Errorf("根据ID获取课程失败: %w", err)
	}

	// 获取课程单元
	units, err := r.GetCourseUnits(id)
	if err != nil {
		return nil, fmt.Errorf("获取课程单元失败: %w", err)
	}
	course.Units = units

	return &course, nil
}

// Update 更新课程信息
func (r *CourseRepository) Update(course *Course) error {
	query := `
	UPDATE courses SET 
		title = $1,
		description = $2,
		level = $3,
		language = $4,
		cover_image = $5,
		published = $6,
		updated_at = $7
	WHERE id = $8`

	course.UpdatedAt = time.Now()

	_, err := r.DB.Exec(
		query,
		course.Title,
		course.Description,
		course.Level,
		course.Language,
		course.CoverImage,
		course.Published,
		course.UpdatedAt,
		course.ID,
	)

	if err != nil {
		return fmt.Errorf("更新课程失败: %w", err)
	}

	return nil
}

// Delete 删除课程
func (r *CourseRepository) Delete(id string) error {
	tx, err := r.DB.Beginx()
	if err != nil {
		return fmt.Errorf("开始事务失败: %w", err)
	}

	// 删除关联的单元
	_, err = tx.Exec("DELETE FROM units WHERE course_id = $1", id)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("删除课程单元失败: %w", err)
	}

	// 删除用户-课程关联
	_, err = tx.Exec("DELETE FROM user_courses WHERE course_id = $1", id)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("删除用户课程关联失败: %w", err)
	}

	// 删除课程
	_, err = tx.Exec("DELETE FROM courses WHERE id = $1", id)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("删除课程失败: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("提交事务失败: %w", err)
	}

	return nil
}

// List 获取课程列表
func (r *CourseRepository) List(limit, offset int, filters map[string]interface{}) ([]Course, error) {
	var courses []Course

	// 构建查询和参数
	query := "SELECT * FROM courses WHERE 1=1"
	var args []interface{}
	argIndex := 1

	// 应用筛选条件
	if language, ok := filters["language"].(string); ok && language != "" {
		query += fmt.Sprintf(" AND language = $%d", argIndex)
		args = append(args, language)
		argIndex++
	}

	if level, ok := filters["level"].(string); ok && level != "" {
		query += fmt.Sprintf(" AND level = $%d", argIndex)
		args = append(args, level)
		argIndex++
	}

	if published, ok := filters["published"].(bool); ok {
		query += fmt.Sprintf(" AND published = $%d", argIndex)
		args = append(args, published)
		argIndex++
	}

	if createdBy, ok := filters["created_by"].(string); ok && createdBy != "" {
		query += fmt.Sprintf(" AND created_by = $%d", argIndex)
		args = append(args, createdBy)
		argIndex++
	}

	// 添加排序和分页
	query += " ORDER BY created_at DESC LIMIT $" + fmt.Sprintf("%d", argIndex) + 
		" OFFSET $" + fmt.Sprintf("%d", argIndex+1)
	args = append(args, limit, offset)

	err := r.DB.Select(&courses, query, args...)
	if err != nil {
		return nil, fmt.Errorf("获取课程列表失败: %w", err)
	}

	return courses, nil
}

// CountCourses 获取课程总数
func (r *CourseRepository) CountCourses(filters map[string]interface{}) (int, error) {
	var count int

	// 构建查询和参数
	query := "SELECT COUNT(*) FROM courses WHERE 1=1"
	var args []interface{}
	argIndex := 1

	// 应用筛选条件
	if language, ok := filters["language"].(string); ok && language != "" {
		query += fmt.Sprintf(" AND language = $%d", argIndex)
		args = append(args, language)
		argIndex++
	}

	if level, ok := filters["level"].(string); ok && level != "" {
		query += fmt.Sprintf(" AND level = $%d", argIndex)
		args = append(args, level)
		argIndex++
	}

	if published, ok := filters["published"].(bool); ok {
		query += fmt.Sprintf(" AND published = $%d", argIndex)
		args = append(args, published)
		argIndex++
	}

	if createdBy, ok := filters["created_by"].(string); ok && createdBy != "" {
		query += fmt.Sprintf(" AND created_by = $%d", argIndex)
		args = append(args, createdBy)
		argIndex++
	}

	err := r.DB.Get(&count, query, args...)
	if err != nil {
		return 0, fmt.Errorf("获取课程总数失败: %w", err)
	}

	return count, nil
}

// GetUserCourses 获取用户有权访问的课程
func (r *CourseRepository) GetUserCourses(userID string, limit, offset int) ([]Course, error) {
	var courses []Course
	query := `
	SELECT c.* FROM courses c
	JOIN user_courses uc ON c.id = uc.course_id
	WHERE uc.user_id = $1
	ORDER BY c.created_at DESC
	LIMIT $2 OFFSET $3`

	err := r.DB.Select(&courses, query, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("获取用户课程失败: %w", err)
	}

	return courses, nil
}

// CountUserCourses 获取用户课程总数
func (r *CourseRepository) CountUserCourses(userID string) (int, error) {
	var count int
	query := `
	SELECT COUNT(*) FROM courses c
	JOIN user_courses uc ON c.id = uc.course_id
	WHERE uc.user_id = $1`

	err := r.DB.Get(&count, query, userID)
	if err != nil {
		return 0, fmt.Errorf("获取用户课程总数失败: %w", err)
	}

	return count, nil
}

// GrantCourseAccess 授予用户课程访问权限
func (r *CourseRepository) GrantCourseAccess(userID, courseID string) error {
	query := `
	INSERT INTO user_courses (user_id, course_id, granted_at)
	VALUES ($1, $2, $3)
	ON CONFLICT (user_id, course_id) DO NOTHING`

	_, err := r.DB.Exec(query, userID, courseID, time.Now())
	if err != nil {
		return fmt.Errorf("授予课程访问权限失败: %w", err)
	}

	return nil
}

// RevokeCourseAccess 撤销用户课程访问权限
func (r *CourseRepository) RevokeCourseAccess(userID, courseID string) error {
	query := `DELETE FROM user_courses WHERE user_id = $1 AND course_id = $2`

	_, err := r.DB.Exec(query, userID, courseID)
	if err != nil {
		return fmt.Errorf("撤销课程访问权限失败: %w", err)
	}

	return nil
}

// UnitRepository 单元数据访问层
type UnitRepository struct {
	DB *sqlx.DB
}

// NewUnitRepository 创建单元仓库
func NewUnitRepository(db *sqlx.DB) *UnitRepository {
	return &UnitRepository{
		DB: db,
	}
}

// Create 创建单元
func (r *UnitRepository) Create(unit *Unit) error {
	query := `
	INSERT INTO units (
		id, course_id, title, description, sequence, published, created_at, updated_at
	) VALUES (
		$1, $2, $3, $4, $5, $6, $7, $8
	) RETURNING id`

	if unit.ID == "" {
		unit.ID = fmt.Sprintf("unit_%d", time.Now().UnixNano())
	}
	unit.CreatedAt = time.Now()
	unit.UpdatedAt = time.Now()

	_, err := r.DB.Exec(
		query,
		unit.ID,
		unit.CourseID,
		unit.Title,
		unit.Description,
		unit.Sequence,
		unit.Published,
		unit.CreatedAt,
		unit.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("创建单元失败: %w", err)
	}

	return nil
}

// GetByID 通过ID获取单元
func (r *UnitRepository) GetByID(id string) (*Unit, error) {
	var unit Unit
	err := r.DB.Get(&unit, "SELECT * FROM units WHERE id = $1", id)
	if err != nil {
		return nil, fmt.Errorf("根据ID获取单元失败: %w", err)
	}

	// 获取单元音轨
	tracks, err := r.GetUnitTracks(id)
	if err != nil {
		return nil, fmt.Errorf("获取单元音轨失败: %w", err)
	}
	unit.Tracks = tracks

	return &unit, nil
}

// Update 更新单元信息
func (r *UnitRepository) Update(unit *Unit) error {
	query := `
	UPDATE units SET 
		title = $1,
		description = $2,
		sequence = $3,
		published = $4,
		updated_at = $5
	WHERE id = $6`

	unit.UpdatedAt = time.Now()

	_, err := r.DB.Exec(
		query,
		unit.Title,
		unit.Description,
		unit.Sequence,
		unit.Published,
		unit.UpdatedAt,
		unit.ID,
	)

	if err != nil {
		return fmt.Errorf("更新单元失败: %w", err)
	}

	return nil
}

// Delete 删除单元
func (r *UnitRepository) Delete(id string) error {
	tx, err := r.DB.Beginx()
	if err != nil {
		return fmt.Errorf("开始事务失败: %w", err)
	}

	// 删除单元中的音轨
	_, err = tx.Exec("DELETE FROM tracks WHERE unit_id = $1", id)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("删除单元音轨失败: %w", err)
	}

	// 删除单元
	_, err = tx.Exec("DELETE FROM units WHERE id = $1", id)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("删除单元失败: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("提交事务失败: %w", err)
	}

	return nil
}

// GetCourseUnits 获取课程单元
func (r *CourseRepository) GetCourseUnits(courseID string) ([]Unit, error) {
	var units []Unit
	query := `SELECT * FROM units WHERE course_id = $1 ORDER BY sequence`

	err := r.DB.Select(&units, query, courseID)
	if err != nil {
		return nil, fmt.Errorf("获取课程单元失败: %w", err)
	}

	return units, nil
}

// GetUnitTracks 获取单元音轨
func (r *UnitRepository) GetUnitTracks(unitID string) ([]Track, error) {
	var tracks []Track
	query := `SELECT * FROM tracks WHERE unit_id = $1 ORDER BY sequence`

	err := r.DB.Select(&tracks, query, unitID)
	if err != nil {
		return nil, fmt.Errorf("获取单元音轨失败: %w", err)
	}

	return tracks, nil
} 