// user.go
package models

import (
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"
	"golang.org/x/crypto/bcrypt"
)

// User 用户模型
type User struct {
	ID              string    `db:"id" json:"id"`
	Email           string    `db:"email" json:"email"`
	PasswordHash    string    `db:"password_hash" json:"-"`
	Name            string    `db:"name" json:"name"`
	Role            string    `db:"role" json:"role"`
	Active          bool      `db:"active" json:"active"`
	ActivationToken string    `db:"activation_token" json:"-"`
	CreatedAt       time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt       time.Time `db:"updated_at" json:"updatedAt"`
	LastLoginAt     *time.Time `db:"last_login_at" json:"lastLoginAt,omitempty"`
}

// UserRepository 用户数据访问层
type UserRepository struct {
	DB *sqlx.DB
}

// NewUserRepository 创建用户仓库
func NewUserRepository(db *sqlx.DB) *UserRepository {
	return &UserRepository{
		DB: db,
	}
}

// Create 创建用户
func (r *UserRepository) Create(user *User) error {
	query := `
	INSERT INTO users (
		id, email, password_hash, name, role, active, activation_token, created_at, updated_at
	) VALUES (
		$1, $2, $3, $4, $5, $6, $7, $8, $9
	) RETURNING id`

	// 生成安全的密码哈希
	if user.ID == "" {
		user.ID = generateUUID()
	}
	user.CreatedAt = time.Now()
	user.UpdatedAt = time.Now()

	_, err := r.DB.Exec(
		query,
		user.ID,
		user.Email,
		user.PasswordHash,
		user.Name,
		user.Role,
		user.Active,
		user.ActivationToken,
		user.CreatedAt,
		user.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("创建用户失败: %w", err)
	}

	return nil
}

// GetByID 通过ID获取用户
func (r *UserRepository) GetByID(id string) (*User, error) {
	var user User
	err := r.DB.Get(&user, "SELECT * FROM users WHERE id = $1", id)
	if err != nil {
		return nil, fmt.Errorf("根据ID获取用户失败: %w", err)
	}
	return &user, nil
}

// GetByEmail 通过邮箱获取用户
func (r *UserRepository) GetByEmail(email string) (*User, error) {
	var user User
	err := r.DB.Get(&user, "SELECT * FROM users WHERE email = $1", email)
	if err != nil {
		return nil, fmt.Errorf("根据邮箱获取用户失败: %w", err)
	}
	return &user, nil
}

// Update 更新用户信息
func (r *UserRepository) Update(user *User) error {
	query := `
	UPDATE users SET 
		email = $1,
		name = $2,
		role = $3,
		active = $4,
		updated_at = $5
	WHERE id = $6`

	user.UpdatedAt = time.Now()

	_, err := r.DB.Exec(
		query,
		user.Email,
		user.Name,
		user.Role,
		user.Active,
		user.UpdatedAt,
		user.ID,
	)

	if err != nil {
		return fmt.Errorf("更新用户失败: %w", err)
	}

	return nil
}

// UpdatePassword 更新用户密码
func (r *UserRepository) UpdatePassword(userID, passwordHash string) error {
	query := `UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3`

	_, err := r.DB.Exec(query, passwordHash, time.Now(), userID)
	if err != nil {
		return fmt.Errorf("更新密码失败: %w", err)
	}

	return nil
}

// Delete 删除用户
func (r *UserRepository) Delete(id string) error {
	_, err := r.DB.Exec("DELETE FROM users WHERE id = $1", id)
	if err != nil {
		return fmt.Errorf("删除用户失败: %w", err)
	}
	return nil
}

// List 获取用户列表
func (r *UserRepository) List(limit, offset int) ([]User, error) {
	var users []User
	err := r.DB.Select(&users, "SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2", limit, offset)
	if err != nil {
		return nil, fmt.Errorf("获取用户列表失败: %w", err)
	}
	return users, nil
}

// CountUsers 获取用户总数
func (r *UserRepository) CountUsers() (int, error) {
	var count int
	err := r.DB.Get(&count, "SELECT COUNT(*) FROM users")
	if err != nil {
		return 0, fmt.Errorf("获取用户总数失败: %w", err)
	}
	return count, nil
}

// UpdateLastLogin 更新用户最后登录时间
func (r *UserRepository) UpdateLastLogin(userID string) error {
	now := time.Now()
	_, err := r.DB.Exec("UPDATE users SET last_login_at = $1 WHERE id = $2", now, userID)
	if err != nil {
		return fmt.Errorf("更新最后登录时间失败: %w", err)
	}
	return nil
}

// VerifyPassword 验证用户密码
func VerifyPassword(passwordHash, password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(password))
	return err == nil
}

// HashPassword 生成密码哈希
func HashPassword(password string) (string, error) {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hashedPassword), nil
}

// generateUUID 生成UUID
func generateUUID() string {
	return fmt.Sprintf("user_%d", time.Now().UnixNano())
}

// CheckEmailExists 检查邮箱是否已存在
func (r *UserRepository) CheckEmailExists(email string) (bool, error) {
	var count int
	err := r.DB.Get(&count, "SELECT COUNT(*) FROM users WHERE email = $1", email)
	if err != nil {
		return false, fmt.Errorf("检查邮箱是否存在失败: %w", err)
	}
	return count > 0, nil
}

// UserHasAccessToCourse 检查用户是否有权访问课程
func (r *UserRepository) UserHasAccessToCourse(userID, courseID string) (bool, error) {
	var count int
	query := `
	SELECT COUNT(*) FROM user_courses
	WHERE user_id = $1 AND course_id = $2`

	err := r.DB.Get(&count, query, userID, courseID)
	if err != nil {
		return false, fmt.Errorf("检查用户课程权限失败: %w", err)
	}

	return count > 0, nil
} 