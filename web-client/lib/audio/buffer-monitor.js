/**
 * 音频缓冲监控器，实时监测并响应音频缓冲状态
 */

// 缓冲状态
export const BufferState = {
  GOOD: 'good',         // 缓冲状态良好
  WARNING: 'warning',   // 缓冲略有不足
  CRITICAL: 'critical'  // 缓冲严重不足
};

// 配置参数
const DEFAULT_CONFIG = {
  warningThreshold: 5,   // 警告阈值（秒）
  criticalThreshold: 2,  // 严重阈值（秒）
  checkInterval: 1000,   // 检查间隔（毫秒）
  recoveryDelay: 3000    // 恢复延迟（毫秒）
};

/**
 * 创建音频缓冲监控器
 * @param {HTMLAudioElement} audioElement - 音频元素
 * @param {Object} options - 配置选项
 * @returns {Object} 缓冲监控器实例
 */
export function createBufferMonitor(audioElement, options = {}) {
  // 合并默认配置和用户配置
  const config = { ...DEFAULT_CONFIG, ...options };
  
  // 状态变量
  let currentState = BufferState.GOOD;
  let checkIntervalId = null;
  let recoveryTimeoutId = null;
  let lastTimeUpdate = 0;
  let bufferingStartTime = 0;
  let isBuffering = false;
  
  // 回调函数
  const callbacks = {
    onStateChange: [],
    onBufferingStart: [],
    onBufferingEnd: []
  };
  
  // 开始监控
  function start() {
    if (checkIntervalId) return; // 避免重复启动
    
    // 绑定事件监听器
    audioElement.addEventListener('timeupdate', handleTimeUpdate);
    audioElement.addEventListener('waiting', handleWaiting);
    audioElement.addEventListener('playing', handlePlaying);
    audioElement.addEventListener('pause', handlePause);
    
    // 开始定期检查
    checkIntervalId = setInterval(checkBufferHealth, config.checkInterval);
    
    // 返回实例以支持链式调用
    return api;
  }
  
  // 停止监控
  function stop() {
    if (!checkIntervalId) return; // 如果未启动则不执行
    
    // 移除事件监听器
    audioElement.removeEventListener('timeupdate', handleTimeUpdate);
    audioElement.removeEventListener('waiting', handleWaiting);
    audioElement.removeEventListener('playing', handlePlaying);
    audioElement.removeEventListener('pause', handlePause);
    
    // 清除定时器
    clearInterval(checkIntervalId);
    checkIntervalId = null;
    
    if (recoveryTimeoutId) {
      clearTimeout(recoveryTimeoutId);
      recoveryTimeoutId = null;
    }
    
    // 返回实例以支持链式调用
    return api;
  }
  
  // 检查缓冲健康状态
  function checkBufferHealth() {
    if (!audioElement || audioElement.paused) return;
    
    // 获取当前缓冲区域
    const buffered = audioElement.buffered;
    if (buffered.length === 0) return;
    
    // 找到包含当前播放位置的缓冲区域
    let currentBufferEnd = 0;
    for (let i = 0; i < buffered.length; i++) {
      if (audioElement.currentTime >= buffered.start(i) && 
          audioElement.currentTime <= buffered.end(i)) {
        currentBufferEnd = buffered.end(i);
        break;
      }
    }
    
    // 计算可播放缓冲时长
    const bufferLength = currentBufferEnd - audioElement.currentTime;
    
    // 根据缓冲长度判断状态
    let newState;
    if (bufferLength < config.criticalThreshold) {
      newState = BufferState.CRITICAL;
    } else if (bufferLength < config.warningThreshold) {
      newState = BufferState.WARNING;
    } else {
      newState = BufferState.GOOD;
    }
    
    // 如果状态变化，触发回调
    if (newState !== currentState) {
      const oldState = currentState;
      currentState = newState;
      
      // 调用所有状态变化回调
      callbacks.onStateChange.forEach(callback => {
        try {
          callback(currentState, oldState, bufferLength);
        } catch (error) {
          console.error('Buffer monitor callback error:', error);
        }
      });
    }
    
    // 检测播放是否卡顿（通过比较当前时间和上次timeupdate事件时间）
    const now = Date.now();
    if (!isBuffering && now - lastTimeUpdate > 1000 && !audioElement.paused) {
      isBuffering = true;
      bufferingStartTime = now;
      
      // 调用所有缓冲开始回调
      callbacks.onBufferingStart.forEach(callback => {
        try {
          callback(bufferLength);
        } catch (error) {
          console.error('Buffer monitor callback error:', error);
        }
      });
    }
  }
  
  // 处理timeupdate事件
  function handleTimeUpdate() {
    lastTimeUpdate = Date.now();
    
    // 如果之前检测到卡顿，现在恢复了，触发缓冲结束事件
    if (isBuffering) {
      // 添加延迟确认，避免误报
      if (recoveryTimeoutId) clearTimeout(recoveryTimeoutId);
      
      recoveryTimeoutId = setTimeout(() => {
        isBuffering = false;
        const bufferingDuration = Date.now() - bufferingStartTime;
        
        // 调用所有缓冲结束回调
        callbacks.onBufferingEnd.forEach(callback => {
          try {
            callback(bufferingDuration);
          } catch (error) {
            console.error('Buffer monitor callback error:', error);
          }
        });
      }, config.recoveryDelay);
    }
  }
  
  // 处理waiting事件 - 浏览器正在等待更多数据
  function handleWaiting() {
    if (!isBuffering) {
      isBuffering = true;
      bufferingStartTime = Date.now();
      
      // 调用所有缓冲开始回调
      callbacks.onBufferingStart.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error('Buffer monitor callback error:', error);
        }
      });
    }
  }
  
  // 处理playing事件 - 缓冲后开始播放
  function handlePlaying() {
    if (isBuffering) {
      const bufferingDuration = Date.now() - bufferingStartTime;
      isBuffering = false;
      
      // 调用所有缓冲结束回调
      callbacks.onBufferingEnd.forEach(callback => {
        try {
          callback(bufferingDuration);
        } catch (error) {
          console.error('Buffer monitor callback error:', error);
        }
      });
    }
  }
  
  // 处理pause事件 - 避免暂停状态被误判为缓冲
  function handlePause() {
    if (isBuffering) {
      isBuffering = false;
      
      // 不调用缓冲结束回调，因为这是用户暂停，不是缓冲结束
    }
  }
  
  // 获取当前状态
  function getState() {
    return {
      state: currentState,
      isBuffering,
      bufferingTime: isBuffering ? Date.now() - bufferingStartTime : 0
    };
  }
  
  // API对象
  const api = {
    start,
    stop,
    getState,
    
    // 注册状态变化监听器
    onStateChange(callback) {
      callbacks.onStateChange.push(callback);
      return api;
    },
    
    // 注册缓冲开始监听器
    onBufferingStart(callback) {
      callbacks.onBufferingStart.push(callback);
      return api;
    },
    
    // 注册缓冲结束监听器
    onBufferingEnd(callback) {
      callbacks.onBufferingEnd.push(callback);
      return api;
    },
    
    // 获取可用缓冲长度
    getBufferLength() {
      if (!audioElement || audioElement.buffered.length === 0) return 0;
      
      for (let i = 0; i < audioElement.buffered.length; i++) {
        if (audioElement.currentTime >= audioElement.buffered.start(i) && 
            audioElement.currentTime <= audioElement.buffered.end(i)) {
          return audioElement.buffered.end(i) - audioElement.currentTime;
        }
      }
      
      return 0;
    }
  };
  
  return api;
}

/**
 * 根据缓冲状态自动调整播放设置
 * @param {HTMLAudioElement} audioElement - 音频元素
 * @param {Object} options - 配置选项
 */
export function setupAdaptivePlayback(audioElement, options = {}) {
  // 默认配置
  const config = {
    enableAutoPlaybackRate: true, // 是否启用播放速率自动调整
    minPlaybackRate: 0.9,        // 最小播放速率
    enableBufferingUI: true,     // 是否显示缓冲UI
    onBufferingStart: null,      // 缓冲开始回调
    onBufferingEnd: null,        // 缓冲结束回调
    onStateChange: null,         // 状态变化回调
    ...options
  };
  
  // 原始播放速率
  let originalPlaybackRate = audioElement.playbackRate || 1.0;
  let consecutiveBufferingEvents = 0;
  
  // 创建缓冲监控器
  const monitor = createBufferMonitor(audioElement)
    .onStateChange((newState, oldState, bufferLength) => {
      // 根据缓冲状态调整播放速率
      if (config.enableAutoPlaybackRate) {
        if (newState === BufferState.CRITICAL) {
          // 严重缓冲不足，降低播放速率
          if (audioElement.playbackRate > config.minPlaybackRate) {
            audioElement.playbackRate = config.minPlaybackRate;
          }
        } else if (newState === BufferState.GOOD && oldState !== BufferState.GOOD) {
          // 恢复良好状态，恢复原始播放速率
          audioElement.playbackRate = originalPlaybackRate;
        }
      }
      
      // 调用用户提供的状态变化回调
      if (config.onStateChange) {
        config.onStateChange(newState, oldState, bufferLength);
      }
    })
    .onBufferingStart(() => {
      // 记录连续缓冲事件
      consecutiveBufferingEvents++;
      
      // 记录当前播放速率
      originalPlaybackRate = audioElement.playbackRate;
      
      // 调用用户提供的缓冲开始回调
      if (config.onBufferingStart) {
        config.onBufferingStart(consecutiveBufferingEvents);
      }
      
      // 如果连续出现缓冲，可以考虑更主动的措施
      if (consecutiveBufferingEvents >= 3) {
        console.warn('连续缓冲事件：', consecutiveBufferingEvents);
        // 可以考虑其他应对措施
      }
    })
    .onBufferingEnd((duration) => {
      // 根据缓冲时长调整策略
      if (duration > 3000) {
        console.warn('缓冲时长过长：', duration);
      }
      
      // 调用用户提供的缓冲结束回调
      if (config.onBufferingEnd) {
        config.onBufferingEnd(duration, consecutiveBufferingEvents);
      }
      
      // 重置连续缓冲计数（如果间隔足够长）
      setTimeout(() => {
        consecutiveBufferingEvents = 0;
      }, 30000); // 30秒无缓冲则重置计数
    });
  
  // 启动监控
  monitor.start();
  
  // 返回API
  return {
    monitor,
    
    // 设置原始播放速率
    setOriginalPlaybackRate(rate) {
      originalPlaybackRate = rate;
      // 如果当前没有缓冲问题，立即应用
      if (monitor.getState().state === BufferState.GOOD) {
        audioElement.playbackRate = rate;
      }
    },
    
    // 清理资源
    dispose() {
      monitor.stop();
    }
  };
} 