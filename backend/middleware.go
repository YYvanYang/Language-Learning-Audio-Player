package main

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt"
)

// MiddlewareJWTClaims 定义JWT声明结构
type MiddlewareJWTClaims struct {
	UserID string `json:"user_id"`
	Role   string `json:"role"`
	jwt.StandardClaims
}

// AuthMiddleware JWT认证中间件
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从Cookie获取令牌
		tokenString, err := c.Cookie("auth_token")
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "未授权访问",
			})
			return
		}

		// 验证令牌
		claims, err := ValidateJWTToken(tokenString)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "无效令牌",
			})
			return
		}

		// 存储用户信息到上下文
		c.Set("user_id", claims.UserID)
		c.Set("user_role", claims.Role)

		c.Next()
	}
}

// ValidateJWTToken 验证JWT令牌
func ValidateJWTToken(tokenString string) (*MiddlewareJWTClaims, error) {
	// 解析令牌
	token, err := jwt.ParseWithClaims(tokenString, &MiddlewareJWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		// 使用环境变量或配置文件中的密钥
		jwtSecretKey := getEnv("JWT_SECRET", "your-default-secret-key-replace-in-production")
		return []byte(jwtSecretKey), nil
	})

	if err != nil {
		return nil, err
	}

	// 验证并返回claims
	if claims, ok := token.Claims.(*MiddlewareJWTClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("无效令牌")
}

// CORSMiddleware CORS中间件
func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 获取前端URL
		frontendURL := os.Getenv("FRONTEND_URL")
		if frontendURL == "" {
			frontendURL = "http://localhost:3000" // 开发环境的默认值
		}

		c.Writer.Header().Set("Access-Control-Allow-Origin", frontendURL)
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, Authorization, Accept, Origin, Cache-Control, X-Requested-With")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

// SecurityHeadersMiddleware 安全头部中间件
func SecurityHeadersMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 设置安全头部
		c.Writer.Header().Set("X-Content-Type-Options", "nosniff")
		c.Writer.Header().Set("X-Frame-Options", "DENY")
		c.Writer.Header().Set("X-XSS-Protection", "1; mode=block")
		c.Writer.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

		// 检查是否为Swagger路径，为Swagger页面提供更宽松的CSP
		if strings.HasPrefix(c.Request.URL.Path, "/swagger/") {
			c.Writer.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self';")
		} else {
			c.Writer.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self';")
		}

		c.Next()
	}
}

// ReferrerCheckMiddleware 防盗链中间件
func ReferrerCheckMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 获取Referer头
		referer := c.Request.Header.Get("Referer")

		// 如果Referer不为空，验证来源
		if referer != "" {
			refererURL, err := url.Parse(referer)
			if err != nil {
				c.AbortWithStatus(http.StatusForbidden)
				return
			}

			// 获取允许的主机列表
			allowedHosts := strings.Split(os.Getenv("ALLOWED_REFERERS"), ",")
			if len(allowedHosts) == 0 || (len(allowedHosts) == 1 && allowedHosts[0] == "") {
				// 默认值
				allowedHosts = []string{"localhost:3000"}
			}

			// 验证Referer是否在允许列表中
			hostValid := false
			for _, host := range allowedHosts {
				if strings.TrimSpace(host) == refererURL.Host {
					hostValid = true
					break
				}
			}

			if !hostValid {
				c.AbortWithStatus(http.StatusForbidden)
				return
			}
		} else {
			// 某些路由需要强制Referer存在
			if strings.HasPrefix(c.Request.URL.Path, "/api/audio/stream/") {
				c.AbortWithStatus(http.StatusForbidden)
				return
			}
		}

		c.Next()
	}
}

// SecurityLoggingMiddleware 安全日志中间件
func SecurityLoggingMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 记录请求开始时间
		startTime := time.Now()

		// 处理请求
		c.Next()

		// 收集安全相关信息
		status := c.Writer.Status()
		path := c.Request.URL.Path
		method := c.Request.Method
		ip := c.ClientIP()
		userAgent := c.Request.UserAgent()
		referer := c.Request.Referer()

		// 提取用户ID（如果已认证）
		userID, _ := c.Get("user_id")

		// 计算请求处理时间
		latency := time.Since(startTime)

		// 记录日志
		if status >= 400 {
			// 记录可疑请求
			// 在实际应用中，使用结构化日志记录器
			logMessage := `SECURITY_EVENT: status=%d method=%s path=%s ip=%s user_agent=%s referer=%s user_id=%v latency=%s`
			logData := []interface{}{
				status, method, path, ip, userAgent, referer, userID, latency,
			}

			if status >= 500 {
				// 严重错误级别
				// logger.Errorf(logMessage, logData...)
				// 这里简单使用 Gin 的默认日志
				gin.DefaultWriter.Write([]byte("[ERROR] " + fmt.Sprintf(logMessage, logData...) + "\n"))
			} else {
				// 警告级别
				// logger.Warnf(logMessage, logData...)
				gin.DefaultWriter.Write([]byte("[WARN] " + fmt.Sprintf(logMessage, logData...) + "\n"))
			}
		}

		// 记录敏感操作
		if strings.Contains(path, "/api/auth/") || strings.Contains(path, "/api/admin/") {
			logMessage := `SECURITY_AUDIT: status=%d method=%s path=%s ip=%s user_id=%v`
			logData := []interface{}{
				status, method, path, ip, userID,
			}
			// logger.Infof(logMessage, logData...)
			gin.DefaultWriter.Write([]byte("[INFO] " + fmt.Sprintf(logMessage, logData...) + "\n"))
		}
	}
}

// CourseAccessMiddleware 课程访问权限中间件
func CourseAccessMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 获取课程ID和用户ID
		_ = c.Param("courseId") // 当前未使用但将来会用到
		userID, exists := c.Get("user_id")

		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "未授权访问",
			})
			return
		}

		// 检查访问权限
		// 在实际应用中，这里应该查询数据库
		// hasAccess, err := CheckCourseAccess(userID.(string), courseID)

		// 记录日志以使用userID变量
		fmt.Printf("用户 %v 正在访问课程资源\n", userID)

		// 简化的权限检查 - 开发环境示例
		hasAccess := true
		var err error = nil

		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error": "权限检查失败",
			})
			return
		}

		if !hasAccess {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "访问被拒绝",
			})
			return
		}

		c.Next()
	}
}
