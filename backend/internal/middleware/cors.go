package middleware

import (
	"github.com/gin-gonic/gin"
	"language-learning/internal/config"
)

// CORS 返回CORS中间件
func CORS(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 获取Origin头
		origin := c.Request.Header.Get("Origin")

		// 设置默认的CORS响应头
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, Accept, Origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")

		// 如果配置了允许的来源，验证当前来源是否在允许列表
		if len(cfg.CORS.AllowOrigins) > 0 {
			// 检查当前Origin是否在允许列表中
			allowed := false
			for _, allowedOrigin := range cfg.CORS.AllowOrigins {
				if allowedOrigin == "*" || allowedOrigin == origin {
					allowed = true
					break
				}
			}

			// 如果在允许列表中，设置为具体的Origin
			if allowed {
				if origin != "" {
					c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
				} else {
					// 如果没有Origin头但允许所有来源
					for _, allowedOrigin := range cfg.CORS.AllowOrigins {
						if allowedOrigin == "*" {
							c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
							break
						}
					}
				}
			}
		} else {
			// 如果没有配置允许的来源，默认允许所有来源
			c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		}

		// 处理OPTIONS预检请求
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

// SecurityHeaders 设置安全相关的HTTP头
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 设置安全相关头部
		c.Writer.Header().Set("X-Content-Type-Options", "nosniff")
		c.Writer.Header().Set("X-Frame-Options", "DENY")
		c.Writer.Header().Set("X-XSS-Protection", "1; mode=block")
		c.Writer.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

		// 内容安全策略
		c.Writer.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline';")

		c.Next()
	}
}
