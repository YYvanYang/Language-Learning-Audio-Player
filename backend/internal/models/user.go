package models

import (
	"time"

	"gorm.io/gorm"
)

// User 用户模型
type User struct {
	ID           string         `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Username     string         `gorm:"size:100;uniqueIndex" json:"username"`
	Email        string         `gorm:"size:100;uniqueIndex" json:"email"`
	PasswordHash string         `gorm:"size:255" json:"-"`
	Role         string         `gorm:"size:20;default:'user'" json:"role"`
	FirstName    string         `gorm:"size:100" json:"firstName"`
	LastName     string         `gorm:"size:100" json:"lastName"`
	Active       bool           `gorm:"default:true" json:"active"`
	CreatedAt    time.Time      `json:"createdAt"`
	UpdatedAt    time.Time      `json:"updatedAt"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

// Course 课程模型
type Course struct {
	ID          string         `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Title       string         `gorm:"size:200;not null" json:"title"`
	Description string         `gorm:"type:text" json:"description"`
	Level       string         `gorm:"size:50" json:"level"`
	Language    string         `gorm:"size:50" json:"language"`
	ImageURL    string         `gorm:"size:255" json:"imageUrl"`
	IsPublic    bool           `gorm:"default:true" json:"isPublic"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
	Units       []Unit         `gorm:"foreignKey:CourseID" json:"units,omitempty"`
}

// Unit 单元模型
type Unit struct {
	ID          string         `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	CourseID    string         `gorm:"type:uuid;index" json:"courseId"`
	Title       string         `gorm:"size:200;not null" json:"title"`
	Description string         `gorm:"type:text" json:"description"`
	OrderIndex  int            `gorm:"not null" json:"orderIndex"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
	Tracks      []Track        `gorm:"foreignKey:UnitID" json:"tracks,omitempty"`
}

// Track 音轨模型
type Track struct {
	ID          string         `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UnitID      string         `gorm:"type:uuid;index" json:"unitId"`
	Title       string         `gorm:"size:200;not null" json:"title"`
	Description string         `gorm:"type:text" json:"description"`
	FilePath    string         `gorm:"size:255;not null" json:"filePath"`
	Duration    float64        `gorm:"not null" json:"duration"`
	OrderIndex  int            `gorm:"not null" json:"orderIndex"`
	IsSystem    bool           `gorm:"default:true" json:"isSystem"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// UserProgress 用户进度模型
type UserProgress struct {
	ID        string    `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID    string    `gorm:"type:uuid;index" json:"userId"`
	TrackID   string    `gorm:"type:uuid;index" json:"trackId"`
	Progress  float64   `gorm:"default:0" json:"progress"`
	Completed bool      `gorm:"default:false" json:"completed"`
	LastUsed  time.Time `json:"lastUsed"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// Bookmark 书签模型
type Bookmark struct {
	ID          string    `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID      string    `gorm:"type:uuid;index" json:"userId"`
	TrackID     string    `gorm:"type:uuid;index" json:"trackId"`
	Position    float64   `gorm:"not null" json:"position"`
	Label       string    `gorm:"size:255" json:"label"`
	Description string    `gorm:"type:text" json:"description"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// CustomTrack 用户自定义音轨模型
type CustomTrack struct {
	ID          string         `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID      string         `gorm:"type:uuid;index" json:"userId"`
	Title       string         `gorm:"size:200;not null" json:"title"`
	Description string         `gorm:"type:text" json:"description"`
	FilePath    string         `gorm:"size:255;not null" json:"filePath"`
	Duration    float64        `gorm:"not null" json:"duration"`
	Tags        string         `gorm:"type:text" json:"tags"`
	IsPublic    bool           `gorm:"default:false" json:"isPublic"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}
