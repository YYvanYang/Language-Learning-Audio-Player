package domain

import "time"

// User 用户领域模型
type User struct {
	ID           string
	Username     string
	Email        string
	PasswordHash string
	Role         string
	FirstName    string
	LastName     string
	Active       bool
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// UserRepository 用户仓储接口
type UserRepository interface {
	// FindByID 根据ID查找用户
	FindByID(id string) (*User, error)

	// FindByEmail 根据邮箱查找用户
	FindByEmail(email string) (*User, error)

	// FindByUsername 根据用户名查找用户
	FindByUsername(username string) (*User, error)

	// Create 创建新用户
	Create(user *User) error

	// Update 更新用户信息
	Update(user *User) error

	// Delete 删除用户
	Delete(id string) error

	// List 列出所有用户
	List(page, limit int) ([]*User, int64, error)

	// Count 统计用户数量
	Count() (int64, error)

	// HasCourseAccess 检查用户是否有权访问课程
	HasCourseAccess(userID, courseID string) (bool, error)
}

// RegisterRequest 用户注册请求
type RegisterRequest struct {
	Username  string `json:"username" binding:"required,min=3,max=50"`
	Email     string `json:"email" binding:"required,email"`
	Password  string `json:"password" binding:"required,min=8"`
	FirstName string `json:"firstName" binding:"required"`
	LastName  string `json:"lastName" binding:"required"`
}

// LoginRequest 用户登录请求
type LoginRequest struct {
	Username string `json:"username" binding:"required_without=Email"`
	Email    string `json:"email" binding:"required_without=Username,omitempty,email"`
	Password string `json:"password" binding:"required"`
}

// UserResponse 用户响应
type UserResponse struct {
	ID        string    `json:"id"`
	Username  string    `json:"username"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	FirstName string    `json:"firstName"`
	LastName  string    `json:"lastName"`
	Active    bool      `json:"active"`
	CreatedAt time.Time `json:"createdAt"`
}

// NewUserResponse 创建用户响应
func NewUserResponse(user *User) *UserResponse {
	return &UserResponse{
		ID:        user.ID,
		Username:  user.Username,
		Email:     user.Email,
		Role:      user.Role,
		FirstName: user.FirstName,
		LastName:  user.LastName,
		Active:    user.Active,
		CreatedAt: user.CreatedAt,
	}
}

// IsAdmin 检查用户是否为管理员
func (u *User) IsAdmin() bool {
	return u.Role == "admin"
}

// FullName 获取用户全名
func (u *User) FullName() string {
	return u.FirstName + " " + u.LastName
}
