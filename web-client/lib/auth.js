// lib/auth.js
'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import CryptoJS from 'crypto-js';

// 创建认证上下文
const AuthContext = createContext(null);

// 认证提供者组件
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // 在组件挂载时检查会话状态
  useEffect(() => {
    // 检查会话状态
    async function checkSession() {
      try {
        const response = await fetch('/api/auth/validate', {
          method: 'GET',
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.valid) {
            setUser(data.user);
            
            // 同时保存到本地存储作为备份
            localStorage.setItem('user', JSON.stringify(data.user));
          } else {
            setUser(null);
            localStorage.removeItem('user');
          }
        } else {
          setUser(null);
          localStorage.removeItem('user');
        }
      } catch (err) {
        console.error('Session validation error:', err);
        
        // 如果API请求失败，尝试从本地存储获取
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          try {
            setUser(JSON.parse(storedUser));
          } catch (e) {
            localStorage.removeItem('user');
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } finally {
        setIsLoading(false);
      }
    }
    
    checkSession();
  }, []);
  
  // 登录功能
  const login = async (email, password) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Login failed');
      }
      
      const data = await response.json();
      setUser(data.user);
      
      // 保存到本地存储作为备份
      localStorage.setItem('user', JSON.stringify(data.user));
      
      return { success: true };
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  };
  
  // 退出登录功能
  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      setUser(null);
      localStorage.removeItem('user');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };
  
  // 提供认证上下文
  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated: !!user, 
      isLoading, 
      login, 
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// 认证钩子
export function useAuth() {
  return useContext(AuthContext);
}

/**
 * 生成用于API请求的安全令牌
 * 
 * @param {Object} payload - 包含请求详情的对象
 * @returns {string} 加密后的令牌
 */
export const generateToken = (payload) => {
  // 获取保存在环境变量中的密钥
  const secretKey = process.env.NEXT_PUBLIC_AUTH_CLIENT_KEY || 'default-key-for-development-only';
  
  // 添加随机盐和有效期以增强安全性
  const enhancedPayload = {
    ...payload,
    nonce: Math.random().toString(36).substring(2, 15),
    exp: Date.now() + 300000, // 5分钟有效期
  };

  // 使用AES算法加密
  return CryptoJS.AES.encrypt(
    JSON.stringify(enhancedPayload),
    secretKey
  ).toString();
};

/**
 * 解析API响应中的错误信息
 * 
 * @param {Object} response - Fetch API响应对象
 * @returns {Promise<string>} - 错误信息
 */
export const parseErrorResponse = async (response) => {
  try {
    const data = await response.json();
    return data.message || data.error || '请求失败';
  } catch (e) {
    return `请求失败: ${response.status}`;
  }
};