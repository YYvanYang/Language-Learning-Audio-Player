package middleware

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v4"

	"github.com/your-project/backend/internal/config"
)

// JWTClaims 定义JWT令牌中的声明
type JWTClaims struct {
	UserID string `json:"userId"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

// AuthMiddleware 认证中间件，验证JWT令牌
func AuthMiddleware(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从请求头或Cookie中获取令牌
		tokenString, err := extractToken(c)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "未认证",
			})
			return
		}

		// 验证令牌
		claims, err := validateToken(tokenString, cfg.JWT.Secret)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "无效令牌",
			})
			return
		}

		// 将用户信息存储到上下文中
		c.Set("userID", claims.UserID)
		c.Set("role", claims.Role)

		c.Next()
	}
}

// RoleMiddleware 角色验证中间件
func RoleMiddleware(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从上下文获取用户角色
		role, exists := c.Get("role")
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "未认证",
			})
			return
		}

		// 检查用户角色是否在允许的角色列表中
		roleStr := role.(string)
		allowed := false
		for _, r := range roles {
			if r == roleStr {
				allowed = true
				break
			}
		}

		if !allowed {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "权限不足",
			})
			return
		}

		c.Next()
	}
}

// 从请求中提取令牌
func extractToken(c *gin.Context) (string, error) {
	// 先尝试从Authorization头提取
	authHeader := c.GetHeader("Authorization")
	if authHeader != "" {
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) == 2 && parts[0] == "Bearer" {
			return parts[1], nil
		}
	}

	// 然后尝试从Cookie提取
	tokenCookie, err := c.Cookie("auth_token")
	if err == nil && tokenCookie != "" {
		return tokenCookie, nil
	}

	// 最后尝试从查询参数提取
	token := c.Query("token")
	if token != "" {
		return token, nil
	}

	return "", errors.New("找不到认证令牌")
}

// 验证JWT令牌
func validateToken(tokenString, secretKey string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(
		tokenString,
		&JWTClaims{},
		func(token *jwt.Token) (interface{}, error) {
			// 验证签名算法
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, errors.New("无效的签名方法")
			}
			return []byte(secretKey), nil
		},
	)

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*JWTClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("无效令牌")
}
