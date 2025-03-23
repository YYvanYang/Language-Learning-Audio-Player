/**
 * 实用工具函数库
 */

/**
 * 安全相关工具
 */
export const SecurityUtils = {
  // 防止XSS攻击的HTML转义
  escapeHTML: (html) => {
    if (!html) return '';
    
    return html
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },
  
  // 安全地渲染用户输入的内容
  safeInnerHTML: (element, html) => {
    if (!element) return;
    // 首先转义HTML
    const safeHTML = SecurityUtils.escapeHTML(html);
    element.innerHTML = safeHTML;
  },
  
  // 防止CSRF的安全fetch包装
  safeFetch: async (url, options = {}) => {
    // 确保包含credentials
    const secureOptions = {
      ...options,
      credentials: 'include',
      headers: {
        ...options.headers,
        'X-Requested-With': 'XMLHttpRequest'
      }
    };
    
    return fetch(url, secureOptions);
  },
  
  // 安全地存储敏感数据
  secureStorage: {
    // 使用会话存储（浏览器关闭时清除）
    setSessionItem: (key, value) => {
      try {
        sessionStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        console.error('Failed to store data:', error);
      }
    },
    
    // 获取会话存储数据
    getSessionItem: (key) => {
      try {
        const item = sessionStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      } catch (error) {
        console.error('Failed to retrieve data:', error);
        return null;
      }
    },
    
    // 清除会话存储数据
    clearSessionItem: (key) => {
      try {
        sessionStorage.removeItem(key);
      } catch (error) {
        console.error('Failed to clear data:', error);
      }
    }
  }
};

/**
 * 时间相关工具函数
 */
export const TimeUtils = {
  // 将秒数格式化为MM:SS格式
  formatTime: (seconds) => {
    if (typeof seconds !== 'number' || isNaN(seconds)) {
      return '00:00';
    }
    
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  },
  
  // 将秒数格式化为HH:MM:SS格式（当超过60分钟时）
  formatDuration: (seconds) => {
    if (typeof seconds !== 'number' || isNaN(seconds)) {
      return '00:00:00';
    }
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  },
  
  // 将HH:MM:SS格式或MM:SS格式转换为秒数
  parseTimeToSeconds: (timeString) => {
    if (!timeString) return 0;
    
    const parts = timeString.split(':').map(part => parseInt(part, 10));
    
    if (parts.length === 3) {
      // HH:MM:SS
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      // MM:SS
      return parts[0] * 60 + parts[1];
    }
    
    return 0;
  }
};

/**
 * 文件相关工具函数
 */
export const FileUtils = {
  // 从文件名获取扩展名
  getFileExtension: (filename) => {
    if (!filename) return '';
    return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
  },
  
  // 检查文件是否是支持的音频格式
  isAudioFile: (filename) => {
    const extension = FileUtils.getFileExtension(filename).toLowerCase();
    return ['mp3', 'wav', 'ogg', 'aac', 'm4a'].includes(extension);
  },
  
  // 根据扩展名获取MIME类型
  getMimeType: (filename) => {
    const extension = FileUtils.getFileExtension(filename).toLowerCase();
    const mimeTypes = {
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
      'aac': 'audio/aac',
      'm4a': 'audio/mp4',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'pdf': 'application/pdf',
      'txt': 'text/plain'
    };
    
    return mimeTypes[extension] || 'application/octet-stream';
  },
  
  // 格式化文件大小
  formatFileSize: (bytes) => {
    if (bytes === 0) return '0 Bytes';
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${sizes[i]}`;
  }
};

/**
 * 字符串工具函数
 */
export const StringUtils = {
  // 截断文本
  truncate: (text, maxLength) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  },
  
  // 生成随机字符串
  generateRandomString: (length = 16) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  },
  
  // 检查字符串是否为有效URL
  isValidUrl: (url) => {
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  }
};

/**
 * 数组工具函数
 */
export const ArrayUtils = {
  // 对数组进行洗牌（随机排序）
  shuffle: (array) => {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  },
  
  // 从数组中删除特定元素
  removeItem: (array, item) => {
    return array.filter(i => i !== item);
  },
  
  // 从数组中删除特定索引的元素
  removeAtIndex: (array, index) => {
    if (index < 0 || index >= array.length) return [...array];
    return [...array.slice(0, index), ...array.slice(index + 1)];
  },
  
  // 检查两个数组是否相等
  areEqual: (array1, array2) => {
    if (!array1 || !array2) return false;
    if (array1.length !== array2.length) return false;
    
    for (let i = 0; i < array1.length; i++) {
      if (array1[i] !== array2[i]) return false;
    }
    
    return true;
  }
}; 