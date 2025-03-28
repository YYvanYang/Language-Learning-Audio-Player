// lib/auth.js
'use client';

import { createContext, useContext, useState, useEffect } from 'react';

// 创建认证上下文
const AuthContext = createContext({});

// 认证提供者组件
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // 在组件挂载时检查会话状态
  useEffect(() => {
    // 检查会话状态
    async function checkSession() {
      try {
        console.log('开始验证会话状态...');
        
        const response = await fetch('/api/auth/validate', {
          method: 'GET',
          credentials: 'include', // 确保发送 cookies
          headers: {
            'Accept': 'application/json'
          }
        });
        
        console.log(`会话验证响应状态: ${response.status}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log('会话验证成功:', data);
          
          if (data.valid) {
            setUser(data.user);
            
            // 同时保存到本地存储作为备份
            localStorage.setItem('user', JSON.stringify(data.user));
          } else {
            console.log('会话无效，清除用户状态');
            setUser(null);
            localStorage.removeItem('user');
          }
        } else {
          console.log('会话验证失败，响应状态:', response.status);
          // 尝试读取响应内容以获取更多错误信息
          try {
            const errorText = await response.text();
            console.error('验证失败响应体:', errorText);
          } catch (e) {
            console.error('无法读取验证失败响应:', e);
          }
          
          setUser(null);
          localStorage.removeItem('user');
        }
      } catch (err) {
        console.error('会话验证请求失败:', err);
        
        // 如果API请求失败，尝试从本地存储获取
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          try {
            console.log('尝试从本地存储恢复用户信息');
            setUser(JSON.parse(storedUser));
          } catch (parseError) {
            console.error('解析本地存储的用户数据失败:', parseError);
            localStorage.removeItem('user');
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    }
    
    checkSession();
  }, []);
  
  // 登录功能
  const login = async (email, password) => {
    setError(null);
    setLoading(true);
    try {
      console.log(`尝试登录: ${email}`);

      // 构建请求体
      const requestBody = { email, password };
      console.log('请求体:', requestBody);
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        credentials: 'include'
      });
      
      console.log(`登录响应状态: ${response.status}`);
      
      if (!response.ok) {
        // 尝试获取后端返回的详细错误信息
        const errorText = await response.text();
        console.error('登录失败响应:', errorText);
        
        let errorData = {};
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          console.error('解析错误响应失败:', e);
        }
        
        throw new Error(errorData.error || `登录失败(${response.status})`);
      }
      
      const data = await response.json();
      console.log('登录成功:', data);
      setUser(data.user);
      
      // 保存到本地存储作为备份
      localStorage.setItem('user', JSON.stringify(data.user));
      
      return { success: true, data };
    } catch (err) {
      console.error('登录错误详情:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };
  
  // 注册功能
  const register = async (userData) => {
    setError(null);
    setLoading(true);
    try {
      console.log('发送注册请求:', userData);
      
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData),
      });

      // 记录响应状态和内容
      console.log('注册API响应状态:', response.status);
      const data = await response.json();
      console.log('注册API响应数据:', data);

      if (!response.ok) {
        throw new Error(data.error || '注册失败');
      }

      setUser(data.user);
      return { success: true, data };
    } catch (error) {
      console.error('注册过程发生错误:', error);
      setError(error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
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
      return { success: true };
    } catch (err) {
      console.error('Logout error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    }
  };
  
  // 提供认证上下文
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        register,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// 认证钩子
export function useAuth() {
  return useContext(AuthContext);
}

/**
 * 字符串转ArrayBuffer
 */
const str2ab = (str) => {
  const encoder = new TextEncoder();
  return encoder.encode(str);
};

/**
 * ArrayBuffer转Base64
 */
const ab2base64 = (buffer) => {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
};

/**
 * 从密钥字符串生成加密密钥
 */
const getKeyFromString = async (keyString) => {
  const keyData = str2ab(keyString);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', keyData);
  
  return window.crypto.subtle.importKey(
    'raw', 
    hashBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
};

/**
 * 生成用于API请求的安全令牌
 * 
 * @param {Object} payload - 包含请求详情的对象
 * @returns {Promise<string>} 加密后的令牌
 */
export const generateToken = async (payload) => {
  // 确保仅在浏览器环境中运行
  if (typeof window === 'undefined') {
    throw new Error('generateToken只能在客户端使用');
  }

  // 获取保存在环境变量中的密钥
  const secretKey = process.env.NEXT_PUBLIC_AUTH_CLIENT_KEY || 'default-key-for-development-only';
  
  // 添加随机盐和有效期以增强安全性
  const enhancedPayload = {
    ...payload,
    nonce: Array.from(window.crypto.getRandomValues(new Uint8Array(8))).map(b => b.toString(16).padStart(2, '0')).join(''),
    exp: Date.now() + 300000, // 5分钟有效期
  };

  // 生成加密密钥
  const cryptoKey = await getKeyFromString(secretKey);
  
  // 生成IV (初始化向量)
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  // 使用AES-GCM加密
  const encoder = new TextEncoder();
  const encodedData = encoder.encode(JSON.stringify(enhancedPayload));
  
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encodedData
  );
  
  // 将IV和加密数据合并，并转为Base64
  const resultBuffer = new Uint8Array(iv.length + new Uint8Array(encryptedBuffer).length);
  resultBuffer.set(iv, 0);
  resultBuffer.set(new Uint8Array(encryptedBuffer), iv.length);
  
  return ab2base64(resultBuffer);
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
  } catch (jsonError) {
    return `请求失败: ${response.status}`;
  }
};