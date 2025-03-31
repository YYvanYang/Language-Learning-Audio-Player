package integration

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"language-learning/internal/auth/handler"
	"language-learning/internal/auth/service"
	"language-learning/internal/config"
	"language-learning/internal/database"
	"language-learning/internal/domain"
	"language-learning/internal/user/repository"
	"language-learning/internal/utils/logger"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"golang.org/x/crypto/bcrypt"
)

// 初始化认证路由
func setupAuthRoutes(rg *gin.RouterGroup, cfg *config.Config, db *database.Connection) {
	// 创建仓储实例
	userRepo := repository.NewUserRepository(db.GetDB())

	// 创建服务实例
	authService := service.NewAuthService(cfg, userRepo)

	// 创建处理器实例
	authHandler := handler.NewAuthHandler(authService)

	// 注册路由
	authHandler.RegisterRoutes(rg)
}

// TestRegister 测试注册功能
func TestRegister(t *testing.T) {
	// 初始化 HTTP 请求
	registerURL := fmt.Sprintf("%s/api/v1/auth/register", testServer.URL)

	registerBody := domain.RegisterRequest{
		Username: "newuser",
		Email:    "newuser@example.com",
		Password: "password123",
		Name:     "New User",
	}

	jsonData, _ := json.Marshal(registerBody)

	// 创建请求
	req, err := http.NewRequest("POST", registerURL, bytes.NewBuffer(jsonData))
	if err != nil {
		t.Fatalf("创建HTTP请求失败: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// 发送请求
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("发送HTTP请求失败: %v", err)
	}
	defer resp.Body.Close()

	// 解析响应
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("解析响应失败: %v", err)
	}

	// 验证响应
	assert.Equal(t, http.StatusCreated, resp.StatusCode, "应该返回201状态码")
	assert.Contains(t, result, "message", "响应应该包含message字段")
	assert.Contains(t, result, "userId", "响应应该包含userId字段")
	assert.Equal(t, "注册成功", result["message"], "message应该是'注册成功'")
}

// TestLogin 测试登录功能
func TestLogin(t *testing.T) {
	// 初始化 HTTP 请求
	loginURL := fmt.Sprintf("%s/api/v1/auth/login", testServer.URL)

	loginBody := domain.LoginRequest{
		Username: "testuser",
		Password: "password123",
	}

	jsonData, _ := json.Marshal(loginBody)

	// 创建请求
	req, err := http.NewRequest("POST", loginURL, bytes.NewBuffer(jsonData))
	if err != nil {
		t.Fatalf("创建HTTP请求失败: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// 发送请求
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("发送HTTP请求失败: %v", err)
	}
	defer resp.Body.Close()

	// 解析响应
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("解析响应失败: %v", err)
	}

	// 验证响应
	assert.Equal(t, http.StatusOK, resp.StatusCode, "应该返回200状态码")
	assert.Contains(t, result, "message", "响应应该包含message字段")
	assert.Contains(t, result, "userId", "响应应该包含userId字段")
	assert.Equal(t, "登录成功", result["message"], "message应该是'登录成功'")

	// 验证Cookie
	cookies := resp.Cookies()
	var authCookie *http.Cookie
	for _, cookie := range cookies {
		if cookie.Name == "auth_token" {
			authCookie = cookie
			break
		}
	}

	assert.NotNil(t, authCookie, "应该返回auth_token cookie")
	assert.True(t, authCookie.HttpOnly, "cookie应该是HttpOnly")
}

// TestValidate 测试令牌验证功能
func TestValidate(t *testing.T) {
	// 首先登录以获取有效令牌
	loginURL := fmt.Sprintf("%s/api/v1/auth/login", testServer.URL)

	loginBody := domain.LoginRequest{
		Username: "testuser",
		Password: "password123",
	}

	jsonData, _ := json.Marshal(loginBody)

	// 创建登录请求
	req, err := http.NewRequest("POST", loginURL, bytes.NewBuffer(jsonData))
	if err != nil {
		t.Fatalf("创建HTTP请求失败: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// 发送登录请求
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("发送HTTP请求失败: %v", err)
	}

	// 获取Cookie
	cookies := resp.Cookies()
	var authCookie *http.Cookie
	for _, cookie := range cookies {
		if cookie.Name == "auth_token" {
			authCookie = cookie
			break
		}
	}

	if authCookie == nil {
		t.Fatalf("未获取到auth_token cookie")
	}

	// 创建验证请求
	validateURL := fmt.Sprintf("%s/api/v1/auth/validate", testServer.URL)
	validateReq, err := http.NewRequest("GET", validateURL, nil)
	if err != nil {
		t.Fatalf("创建HTTP请求失败: %v", err)
	}

	// 添加Cookie
	validateReq.AddCookie(authCookie)

	// 发送验证请求
	validateResp, err := client.Do(validateReq)
	if err != nil {
		t.Fatalf("发送HTTP请求失败: %v", err)
	}
	defer validateResp.Body.Close()

	// 解析响应
	var validateResult map[string]interface{}
	if err := json.NewDecoder(validateResp.Body).Decode(&validateResult); err != nil {
		t.Fatalf("解析响应失败: %v", err)
	}

	// 验证响应
	assert.Equal(t, http.StatusOK, validateResp.StatusCode, "应该返回200状态码")
	assert.Contains(t, validateResult, "valid", "响应应该包含valid字段")
	assert.True(t, validateResult["valid"].(bool), "valid应该是true")
	assert.Contains(t, validateResult, "userId", "响应应该包含userId字段")
}

// TestInvalidLogin 测试无效登录尝试
func TestInvalidLogin(t *testing.T) {
	// 初始化 HTTP 请求
	loginURL := fmt.Sprintf("%s/api/v1/auth/login", testServer.URL)

	loginBody := domain.LoginRequest{
		Username: "testuser",
		Password: "wrongpassword",
	}

	jsonData, _ := json.Marshal(loginBody)

	// 创建请求
	req, err := http.NewRequest("POST", loginURL, bytes.NewBuffer(jsonData))
	if err != nil {
		t.Fatalf("创建HTTP请求失败: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// 发送请求
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("发送HTTP请求失败: %v", err)
	}
	defer resp.Body.Close()

	// 验证响应
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode, "应该返回401状态码")
}

// hashPassword 散列密码 - 在测试中实现真实的密码散列
func hashPassword(password string) string {
	hashedBytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		logger.Error("生成密码哈希失败", err)
		return password
	}
	return string(hashedBytes)
}
