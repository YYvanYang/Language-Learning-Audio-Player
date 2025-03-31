package service

import (
	"errors"
	"fmt"
	"time"

	"language-learning/internal/config"
	"language-learning/internal/domain"
	"language-learning/internal/utils/logger"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
)

// JWTClaims JWT载荷结构
type JWTClaims struct {
	UserID string `json:"userId"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

// AuthService 认证服务实现
type AuthService struct {
	cfg      *config.Config
	userRepo domain.UserRepository
}

// NewAuthService 创建认证服务实例
func NewAuthService(cfg *config.Config, userRepo domain.UserRepository) *AuthService {
	return &AuthService{
		cfg:      cfg,
		userRepo: userRepo,
	}
}

// Login 用户登录，返回JWT令牌
func (s *AuthService) Login(req domain.LoginRequest) (*domain.TokenResponse, error) {
	logger.Debug("用户登录", zap.String("username", req.Username))

	// 查找用户
	user, err := s.userRepo.FindByUsername(req.Username)
	if err != nil {
		logger.Error("查找用户失败", zap.String("username", req.Username), zap.Error(err))
		return nil, fmt.Errorf("查找用户失败: %w", err)
	}

	if user == nil {
		logger.Warn("用户不存在", zap.String("username", req.Username))
		return nil, errors.New("用户名或密码不正确")
	}

	// 验证密码
	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password))
	if err != nil {
		logger.Warn("密码不正确", zap.String("username", req.Username))
		return nil, errors.New("用户名或密码不正确")
	}

	// 生成JWT令牌
	token, expiresAt, err := s.GenerateJWTToken(user.ID, user.Role)
	if err != nil {
		logger.Error("生成JWT令牌失败", zap.String("userID", user.ID), zap.Error(err))
		return nil, fmt.Errorf("生成令牌失败: %w", err)
	}

	// 更新用户最后登录时间
	user.LastLoginAt = time.Now()
	err = s.userRepo.Update(user)
	if err != nil {
		logger.Error("更新用户最后登录时间失败", zap.String("userID", user.ID), zap.Error(err))
		// 不返回错误，继续登录流程
	}

	logger.Info("用户登录成功", zap.String("userID", user.ID), zap.String("username", user.Username))
	return &domain.TokenResponse{
		Token:     token,
		ExpiresAt: expiresAt,
		UserID:    user.ID,
	}, nil
}

// Register 用户注册
func (s *AuthService) Register(req domain.RegisterRequest) (*domain.User, error) {
	logger.Debug("用户注册", zap.String("username", req.Username), zap.String("email", req.Email))

	// 检查用户名和邮箱是否已存在
	existingUser, err := s.userRepo.FindByUsername(req.Username)
	if err != nil {
		logger.Error("检查用户名失败", zap.Error(err))
		return nil, fmt.Errorf("检查用户名失败: %w", err)
	}

	if existingUser != nil {
		logger.Warn("用户名已存在", zap.String("username", req.Username))
		return nil, errors.New("用户名已存在")
	}

	existingUser, err = s.userRepo.FindByEmail(req.Email)
	if err != nil {
		logger.Error("检查邮箱失败", zap.Error(err))
		return nil, fmt.Errorf("检查邮箱失败: %w", err)
	}

	if existingUser != nil {
		logger.Warn("邮箱已存在", zap.String("email", req.Email))
		return nil, errors.New("邮箱已存在")
	}

	// 生成密码哈希
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		logger.Error("生成密码哈希失败", zap.Error(err))
		return nil, fmt.Errorf("处理密码失败: %w", err)
	}

	// 创建用户
	now := time.Now()
	user := &domain.User{
		ID:           uuid.New().String(),
		Username:     req.Username,
		Email:        req.Email,
		FirstName:    req.FirstName,
		LastName:     req.LastName,
		PasswordHash: string(passwordHash),
		Role:         "user", // 默认角色
		Active:       true,   // 默认激活
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	// 保存用户
	err = s.userRepo.Create(user)
	if err != nil {
		logger.Error("创建用户失败", zap.Error(err))
		return nil, fmt.Errorf("创建用户失败: %w", err)
	}

	logger.Info("用户注册成功", zap.String("userID", user.ID), zap.String("username", user.Username))
	return user, nil
}

// ValidateToken 验证令牌
func (s *AuthService) ValidateToken(tokenString string) (*domain.ValidationResponse, error) {
	logger.Debug("验证令牌")

	if tokenString == "" {
		return &domain.ValidationResponse{Valid: false}, nil
	}

	// 解析JWT令牌
	claims := &JWTClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		// 验证签名算法
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.cfg.JWT.Secret), nil
	})

	if err != nil {
		logger.Warn("令牌解析失败", zap.Error(err))
		return &domain.ValidationResponse{Valid: false}, nil
	}

	if !token.Valid {
		logger.Warn("令牌无效")
		return &domain.ValidationResponse{Valid: false}, nil
	}

	// 提取用户信息
	userID := claims.UserID
	role := claims.Role

	// 检查用户是否存在
	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		logger.Error("查找用户失败", zap.String("userID", userID), zap.Error(err))
		return &domain.ValidationResponse{Valid: false}, nil
	}

	if user == nil {
		logger.Warn("用户不存在", zap.String("userID", userID))
		return &domain.ValidationResponse{Valid: false}, nil
	}

	if !user.Active {
		logger.Warn("用户已禁用", zap.String("userID", userID))
		return &domain.ValidationResponse{Valid: false}, nil
	}

	logger.Info("令牌验证成功", zap.String("userID", userID))
	return &domain.ValidationResponse{
		Valid:  true,
		UserID: userID,
		Role:   role,
	}, nil
}

// RefreshToken 刷新令牌
func (s *AuthService) RefreshToken(tokenString string) (*domain.TokenResponse, error) {
	logger.Debug("刷新令牌")

	// 验证当前令牌
	validationResp, err := s.ValidateToken(tokenString)
	if err != nil {
		return nil, err
	}

	if !validationResp.Valid {
		return nil, errors.New("令牌无效，无法刷新")
	}

	// 生成新令牌
	token, expiresAt, err := s.GenerateJWTToken(validationResp.UserID, validationResp.Role)
	if err != nil {
		logger.Error("生成JWT令牌失败", zap.String("userID", validationResp.UserID), zap.Error(err))
		return nil, fmt.Errorf("生成令牌失败: %w", err)
	}

	logger.Info("令牌刷新成功", zap.String("userID", validationResp.UserID))
	return &domain.TokenResponse{
		Token:     token,
		ExpiresAt: expiresAt,
		UserID:    validationResp.UserID,
	}, nil
}

// Logout 用户登出（撤销令牌）
func (s *AuthService) Logout(token string) error {
	// 实际实现可能需要将令牌添加到黑名单
	// 这里简化处理，直接返回成功
	logger.Debug("用户登出")
	return nil
}

// 生成JWT令牌
func (s *AuthService) GenerateJWTToken(userID, role string) (string, time.Time, error) {
	// 计算过期时间
	expiresIn := time.Duration(s.cfg.JWT.ExpiresIn) * time.Hour
	expiresAt := time.Now().Add(expiresIn)

	// 创建JWT声明
	claims := JWTClaims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ID:        uuid.New().String(),
		},
	}

	// 创建JWT令牌
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(s.cfg.JWT.Secret))
	if err != nil {
		return "", time.Time{}, err
	}

	return tokenString, expiresAt, nil
}
