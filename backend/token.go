// token.go
package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v4"
)

// 音频访问令牌结构
type AudioAccessToken struct {
	CourseID   string `json:"courseId"`
	UnitID     string `json:"unitId"`
	TrackID    string `json:"trackId"`
	UserID     string `json:"userId"`
	Action     string `json:"action"`
	Timestamp  int64  `json:"timestamp"`
	Nonce      string `json:"nonce"`
	Expiration int64  `json:"exp"`
}

// 验证令牌过期时间
func (t *AudioAccessToken) IsExpired() bool {
	// 令牌有效期为5分钟
	return time.Now().Unix() > t.Expiration
}

// 验证令牌内容
func (t *AudioAccessToken) Validate(requiredAction string) error {
	// 验证操作类型
	if t.Action != requiredAction {
		return errors.New("无效的操作类型")
	}

	// 验证令牌是否过期
	if t.IsExpired() {
		return errors.New("令牌已过期")
	}

	// 验证时间戳是否合理（防止重放攻击，允许5分钟的时钟偏差）
	currentTime := time.Now().Unix()
	if t.Timestamp > currentTime+300 || t.Timestamp < currentTime-300 {
		return errors.New("无效的时间戳")
	}

	return nil
}

// 解析加密的访问令牌
func ParseAccessToken(encryptedToken string, secretKey string) (*AudioAccessToken, error) {
	// 解码Base64
	ciphertext, err := base64.StdEncoding.DecodeString(encryptedToken)
	if err != nil {
		return nil, err
	}

	// 创建密码块
	block, err := aes.NewCipher([]byte(secretKey))
	if err != nil {
		return nil, err
	}

	// 确认密文长度
	if len(ciphertext) < aes.BlockSize {
		return nil, errors.New("密文块太短")
	}

	// 提取IV
	iv := ciphertext[:aes.BlockSize]
	ciphertext = ciphertext[aes.BlockSize:]

	// 创建AES-CBC解密器
	mode := cipher.NewCBCDecrypter(block, iv)

	// 解密
	plaintext := make([]byte, len(ciphertext))
	mode.CryptBlocks(plaintext, ciphertext)

	// 移除PKCS#7填充
	padding := int(plaintext[len(plaintext)-1])
	if padding > aes.BlockSize || padding == 0 {
		return nil, errors.New("无效的填充")
	}

	// 检查填充是否有效
	for i := len(plaintext) - padding; i < len(plaintext); i++ {
		if plaintext[i] != byte(padding) {
			return nil, errors.New("无效的填充")
		}
	}

	// 移除填充
	plaintext = plaintext[:len(plaintext)-padding]

	// 解析JSON
	var token AudioAccessToken
	if err := json.Unmarshal(plaintext, &token); err != nil {
		return nil, err
	}

	return &token, nil
}

// 创建加密访问令牌（给前端用的工具函数）
func CreateAccessToken(data AudioAccessToken, secretKey string) (string, error) {
	// 序列化为JSON
	plaintext, err := json.Marshal(data)
	if err != nil {
		return "", err
	}

	// 创建密码块
	block, err := aes.NewCipher([]byte(secretKey))
	if err != nil {
		return "", err
	}

	// 添加PKCS#7填充
	blockSize := block.BlockSize()
	padding := blockSize - (len(plaintext) % blockSize)
	padtext := make([]byte, len(plaintext)+padding)
	copy(padtext, plaintext)
	for i := len(plaintext); i < len(padtext); i++ {
		padtext[i] = byte(padding)
	}

	// 加密后的数据
	ciphertext := make([]byte, blockSize+len(padtext))

	// 创建随机IV
	iv := ciphertext[:blockSize]
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return "", err
	}

	// 加密
	mode := cipher.NewCBCEncrypter(block, iv)
	mode.CryptBlocks(ciphertext[blockSize:], padtext)

	// 编码为Base64
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// 用户会话结构
type UserSession struct {
	UserID    string    `json:"userId"`
	Email     string    `json:"email"`
	ExpiresAt time.Time `json:"expiresAt"`
}

// JWT声明结构
type Claims struct {
	UserID string `json:"userId"`
	Email  string `json:"email"`
	jwt.RegisteredClaims
}

// 身份验证中间件
func TokenAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从请求中获取会话Cookie
		sessionCookie, err := c.Cookie("session")
		if err != nil {
			// 检查Authorization头
			authHeader := c.GetHeader("Authorization")
			if authHeader == "" {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
					"error": "请登录后再访问",
				})
				return
			}

			// 从Authorization头中提取令牌
			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || parts[0] != "Bearer" {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
					"error": "授权格式无效",
				})
				return
			}
			sessionCookie = parts[1]
		}

		// 验证JWT令牌
		claims := &Claims{}
		token, err := jwt.ParseWithClaims(sessionCookie, claims, func(token *jwt.Token) (interface{}, error) {
			// 验证签名算法
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.NewValidationError("无效的签名算法", jwt.ValidationErrorSignatureInvalid)
			}
			return []byte(getSecretKey()), nil
		})

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "会话已过期，请重新登录",
			})
			return
		}

		// 将用户信息添加到上下文
		c.Set("userId", claims.UserID)
		c.Set("email", claims.Email)

		c.Next()
	}
}

// 从环境变量获取JWT密钥
func getSecretKey() string {
	// 在实际应用中，这应该是一个环境变量
	return getEnv("JWT_SECRET", "your-default-secret-key-replace-in-production")
}
