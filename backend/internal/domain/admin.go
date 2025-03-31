package domain

import "time"

// AdminStats 管理统计信息
type AdminStats struct {
	TotalUsers         int64     `json:"totalUsers"`
	ActiveUsers        int64     `json:"activeUsers"`
	TotalCourses       int64     `json:"totalCourses"`
	TotalTracks        int64     `json:"totalTracks"`
	TotalCustomTracks  int64     `json:"totalCustomTracks"`
	StorageUsed        int64     `json:"storageUsed"` // 单位：字节
	NewUsersLastWeek   int64     `json:"newUsersLastWeek"`
	NewUsersLastMonth  int64     `json:"newUsersLastMonth"`
	ActiveCoursesCount int64     `json:"activeCoursesCount"`
	SystemStartTime    time.Time `json:"systemStartTime"`
}

// SystemLogEntry 系统日志条目
type SystemLogEntry struct {
	ID        string    `json:"id"`
	Level     string    `json:"level"`
	Message   string    `json:"message"`
	Timestamp time.Time `json:"timestamp"`
	Metadata  string    `json:"metadata,omitempty"`
}

// AdminService 管理员服务接口
type AdminService interface {
	// GetStats 获取系统统计信息
	GetStats() (*AdminStats, error)

	// GetAllUsers 获取所有用户
	GetAllUsers(page, pageSize int) ([]*User, int64, error)

	// GetUserByID 获取用户详情
	GetUserByID(id string) (*User, error)

	// UpdateUser 更新用户信息
	UpdateUser(user *User) error

	// DeleteUser 删除用户
	DeleteUser(id string) error

	// GetSystemLogs 获取系统日志
	GetSystemLogs(level string, startDate, endDate time.Time, page, pageSize int) ([]*SystemLogEntry, int64, error)
}
