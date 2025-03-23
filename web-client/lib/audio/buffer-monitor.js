/**
 * Web Audio API缓冲监控工具
 * 使用Web Audio API原生方法监控缓冲状态
 */

// 缓冲状态
export const BufferState = {
  GOOD: 'good',         // 缓冲状态良好
  WARNING: 'warning',   // 缓冲略有不足
  CRITICAL: 'critical'  // 缓冲严重不足
};

// 缓冲控制器类型
export const BufferControllerType = {
  AUDIO_BUFFER: 'audio-buffer',    // 使用AudioBuffer（适用于短音频）
  MEDIA_ELEMENT: 'media-element',  // 使用MediaElement（适用于长音频或流）
  MEDIA_SOURCE: 'media-source'     // 使用MediaSource API（适用于自适应流）
};

/**
 * 创建缓冲监控器
 * @param {AudioContext} audioContext - Web Audio API上下文
 * @param {Object} options - 配置选项
 * @returns {Object} 缓冲监控器
 */
export function createBufferMonitor(audioContext, options = {}) {
  // 默认配置
  const config = {
    type: BufferControllerType.AUDIO_BUFFER,  // 控制器类型
    warningThreshold: 5,   // 警告阈值（秒）
    criticalThreshold: 2,  // 严重阈值（秒）
    checkInterval: 1000,   // 检查间隔（毫秒）
    recoveryDelay: 3000,   // 恢复延迟（毫秒）
    ...options
  };
  
  // 内部状态
  let currentState = BufferState.GOOD;
  let isBuffering = false;
  let bufferingStartTime = 0;
  let checkIntervalId = null;
  let sourceNode = null;
  let mediaElement = null;
  let bufferSize = 0;
  let lastPlaybackTime = 0;
  let stuckCounter = 0;
  
  // 回调函数
  const callbacks = {
    onStateChange: [],
    onBufferingStart: [],
    onBufferingEnd: []
  };
  
  /**
   * 启动监控
   * @param {AudioNode|HTMLMediaElement} source - 音频源（AudioBufferSourceNode或HTMLMediaElement）
   */
  function start(source) {
    if (checkIntervalId) {
      stop(); // 如果已经在运行，先停止
    }
    
    if (!source) {
      console.error('Buffer monitor requires a valid source');
      return;
    }
    
    // 根据源类型设置监控方式
    if (source instanceof AudioBufferSourceNode) {
      // 使用AudioBufferSourceNode
      sourceNode = source;
      
      if (sourceNode.buffer) {
        bufferSize = sourceNode.buffer.duration;
      } else {
        console.warn('AudioBufferSourceNode without buffer');
        bufferSize = 0;
      }
      
      // 对于AudioBuffer，我们监控audioContext.currentTime与开始时间的差值
      lastPlaybackTime = audioContext.currentTime;
    } else if (source instanceof HTMLMediaElement || 
              (source.mediaElement instanceof HTMLMediaElement)) {
      // 使用MediaElement
      mediaElement = source instanceof HTMLMediaElement ? source : source.mediaElement;
      
      // 设置媒体事件监听器
      mediaElement.addEventListener('waiting', handleWaiting);
      mediaElement.addEventListener('playing', handlePlaying);
      mediaElement.addEventListener('progress', handleProgress);
      
      // 初始化缓冲区大小
      updateBufferSize();
    } else {
      console.error('Unsupported source type');
      return;
    }
    
    // 开始定期检查
    checkIntervalId = setInterval(checkBufferHealth, config.checkInterval);
    
    return api;
  }
  
  /**
   * 停止监控
   */
  function stop() {
    if (checkIntervalId) {
      clearInterval(checkIntervalId);
      checkIntervalId = null;
    }
    
    // 清理事件监听器
    if (mediaElement) {
      mediaElement.removeEventListener('waiting', handleWaiting);
      mediaElement.removeEventListener('playing', handlePlaying);
      mediaElement.removeEventListener('progress', handleProgress);
      mediaElement = null;
    }
    
    sourceNode = null;
    
    return api;
  }
  
  /**
   * 检查缓冲健康状态
   */
  function checkBufferHealth() {
    try {
      // 根据源类型进行不同的检查
      if (sourceNode) {
        // AudioBufferSourceNode模式
        const currentPlaybackTime = audioContext.currentTime;
        const elapsed = currentPlaybackTime - lastPlaybackTime;
        
        // 检测是否卡顿（如果时间没有推进）
        if (elapsed < 0.01 && !isBuffering) {
          stuckCounter++;
          if (stuckCounter >= 3) {
            // 连续多次检测到卡顿，判定为缓冲
            handleBufferingStart();
            stuckCounter = 0;
          }
        } else {
          stuckCounter = 0;
          if (isBuffering) {
            handleBufferingEnd();
          }
        }
        
        lastPlaybackTime = currentPlaybackTime;
      } else if (mediaElement) {
        // HTMLMediaElement模式
        updateBufferSize();
        
        // 如果当前暂停，不做任何判断
        if (mediaElement.paused) return;
        
        // 计算当前可用缓冲区长度
        const availableBuffer = getAvailableBuffer();
        
        // 判断缓冲状态
        let newState;
        if (availableBuffer < config.criticalThreshold) {
          newState = BufferState.CRITICAL;
        } else if (availableBuffer < config.warningThreshold) {
          newState = BufferState.WARNING;
        } else {
          newState = BufferState.GOOD;
        }
        
        // 如果状态发生变化，触发回调
        if (newState !== currentState) {
          const oldState = currentState;
          currentState = newState;
          
          // 调用所有状态变化回调
          callbacks.onStateChange.forEach(callback => {
            try {
              callback(currentState, oldState, availableBuffer);
            } catch (error) {
              console.error('Buffer monitor callback error:', error);
            }
          });
        }
        
        // 检测缓冲状态 - 如果缓冲严重不足且播放器卡住了
        if (currentState === BufferState.CRITICAL && 
            mediaElement.readyState <= HTMLMediaElement.HAVE_CURRENT_DATA && 
            !isBuffering) {
          handleBufferingStart();
        } else if (currentState === BufferState.GOOD && 
                 mediaElement.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA && 
                 isBuffering) {
          handleBufferingEnd();
        }
      }
    } catch (error) {
      console.error('Error checking buffer health:', error);
    }
  }
  
  /**
   * 更新缓冲区大小
   */
  function updateBufferSize() {
    if (!mediaElement) return;
    
    const buffered = mediaElement.buffered;
    if (buffered.length > 0) {
      bufferSize = buffered.end(buffered.length - 1);
    }
  }
  
  /**
   * 获取当前可用的缓冲区长度（秒）
   * @returns {number} 当前位置开始的缓冲时间长度
   */
  function getAvailableBuffer() {
    if (!mediaElement) return 0;
    
    const buffered = mediaElement.buffered;
    const currentTime = mediaElement.currentTime;
    
    // 查找包含当前播放位置的缓冲区域
    for (let i = 0; i < buffered.length; i++) {
      if (currentTime >= buffered.start(i) && currentTime <= buffered.end(i)) {
        return buffered.end(i) - currentTime;
      }
    }
    
    return 0;
  }
  
  /**
   * 处理缓冲开始事件
   */
  function handleBufferingStart() {
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
  
  /**
   * 处理缓冲结束事件
   */
  function handleBufferingEnd() {
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
  
  /**
   * 处理媒体元素的waiting事件
   */
  function handleWaiting() {
    handleBufferingStart();
  }
  
  /**
   * 处理媒体元素的playing事件
   */
  function handlePlaying() {
    if (isBuffering) {
      handleBufferingEnd();
    }
  }
  
  /**
   * 处理媒体元素的progress事件
   */
  function handleProgress() {
    updateBufferSize();
  }
  
  // API对象
  const api = {
    start,
    stop,
    
    // 获取当前状态
    getState() {
      return {
        state: currentState,
        isBuffering,
        bufferingTime: isBuffering ? Date.now() - bufferingStartTime : 0,
        bufferSize
      };
    },
    
    // 获取可用缓冲区长度
    getAvailableBuffer,
    
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
    }
  };
  
  return api;
}

/**
 * 创建自适应流媒体加载器
 * @param {string} url - 音频URL
 * @param {AudioContext} audioContext - 音频上下文
 * @param {Object} options - 配置选项
 * @returns {Object} 流媒体加载器
 */
export function createStreamLoader(url, audioContext, options = {}) {
  // 默认配置
  const config = {
    initialSegmentSize: 1024 * 1024, // 初始段大小（1MB）
    chunkSize: 256 * 1024,          // 块大小（256KB）
    ...options
  };
  
  // 状态
  let isLoading = false;
  let loadedRanges = [];
  let currentRequest = null;
  let audioBuffer = null;
  let mediaSource = null;
  let sourceBuffer = null;
  let mediaElement = null;
  
  // 回调函数
  const callbacks = {
    onProgress: [],
    onComplete: [],
    onError: []
  };
  
  /**
   * 开始加载音频
   * @param {HTMLMediaElement} [element] - 可选的媒体元素（如果使用MediaSource API）
   */
  async function load(element) {
    if (isLoading) return;
    isLoading = true;
    
    try {
      if (element) {
        // 使用MediaSource API和媒体元素
        mediaElement = element;
        await loadWithMediaSource();
      } else {
        // 使用AudioBuffer API
        await loadWithAudioBuffer();
      }
    } catch (error) {
      isLoading = false;
      console.error('Stream load error:', error);
      
      // 调用错误回调
      callbacks.onError.forEach(callback => {
        try {
          callback(error);
        } catch (e) {
          console.error('Callback error:', e);
        }
      });
    }
  }
  
  /**
   * 使用AudioBuffer API加载音频
   */
  async function loadWithAudioBuffer() {
    try {
      // 请求音频数据
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error, status: ${response.status}`);
      }
      
      // 获取arraybuffer
      const arrayBuffer = await response.arrayBuffer();
      
      // 解码音频数据
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      isLoading = false;
      loadedRanges = [{start: 0, end: audioBuffer.duration}];
      
      // 调用完成回调
      callbacks.onComplete.forEach(callback => {
        try {
          callback(audioBuffer);
        } catch (e) {
          console.error('Callback error:', e);
        }
      });
      
      return audioBuffer;
    } catch (error) {
      isLoading = false;
      console.error('AudioBuffer load error:', error);
      throw error;
    }
  }
  
  /**
   * 使用MediaSource API加载音频
   */
  async function loadWithMediaSource() {
    try {
      if (!mediaElement) {
        throw new Error('No media element provided for MediaSource loading');
      }
      
      if (!window.MediaSource) {
        throw new Error('MediaSource API not supported');
      }
      
      // 创建MediaSource
      mediaSource = new MediaSource();
      mediaElement.src = URL.createObjectURL(mediaSource);
      
      // 等待MediaSource打开
      await new Promise(resolve => {
        mediaSource.addEventListener('sourceopen', resolve, {once: true});
      });
      
      // 创建SourceBuffer
      const mimeType = getMimeType(url);
      if (!MediaSource.isTypeSupported(mimeType)) {
        throw new Error(`MIME type not supported: ${mimeType}`);
      }
      
      sourceBuffer = mediaSource.addSourceBuffer(mimeType);
      
      // 加载初始段
      await loadInitialSegment();
      
      // 设置缓冲更新事件监听器
      sourceBuffer.addEventListener('updateend', handleSourceBufferUpdateEnd);
      
      // 设置媒体元素事件监听器
      mediaElement.addEventListener('timeupdate', handleTimeUpdate);
      mediaElement.addEventListener('seeking', handleSeeking);
      
      return mediaSource;
    } catch (error) {
      isLoading = false;
      console.error('MediaSource load error:', error);
      throw error;
    }
  }
  
  /**
   * 加载初始段
   */
  async function loadInitialSegment() {
    try {
      // 请求初始数据
      const response = await fetch(url, {
        headers: {
          Range: `bytes=0-${config.initialSegmentSize - 1}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error, status: ${response.status}`);
      }
      
      // 读取内容范围头
      const contentRange = response.headers.get('Content-Range');
      const totalSize = contentRange ? 
        parseInt(contentRange.split('/')[1], 10) : 
        parseInt(response.headers.get('Content-Length') || '0', 10);
      
      // 获取arraybuffer
      const arrayBuffer = await response.arrayBuffer();
      
      // 追加到sourceBuffer
      if (sourceBuffer && !sourceBuffer.updating) {
        sourceBuffer.appendBuffer(arrayBuffer);
      }
      
      // 更新加载范围
      loadedRanges = [{start: 0, end: config.initialSegmentSize}];
      
      // 调用进度回调
      callbacks.onProgress.forEach(callback => {
        try {
          callback({
            loaded: arrayBuffer.byteLength,
            total: totalSize,
            ranges: loadedRanges
          });
        } catch (e) {
          console.error('Callback error:', e);
        }
      });
      
      // 如果已加载完整文件，触发完成回调
      if (arrayBuffer.byteLength >= totalSize) {
        isLoading = false;
        
        callbacks.onComplete.forEach(callback => {
          try {
            callback(null); // 没有AudioBuffer，但加载已完成
          } catch (e) {
            console.error('Callback error:', e);
          }
        });
      }
    } catch (error) {
      console.error('Initial segment load error:', error);
      throw error;
    }
  }
  
  /**
   * 处理sourceBuffer更新结束事件
   */
  function handleSourceBufferUpdateEnd() {
    // 可以在这里触发进度更新
  }
  
  /**
   * 处理媒体元素timeupdate事件
   */
  function handleTimeUpdate() {
    if (!mediaElement || !sourceBuffer) return;
    
    // 检查是否需要加载更多数据
    const currentTime = mediaElement.currentTime;
    const buffered = mediaElement.buffered;
    
    // 如果当前位置接近缓冲末尾，加载更多数据
    if (buffered.length > 0) {
      const endTime = buffered.end(buffered.length - 1);
      if (endTime - currentTime < 10 && !isLoading) {
        // 加载更多数据
        // loadMoreData();
      }
    }
  }
  
  /**
   * 处理媒体元素seeking事件
   */
  function handleSeeking() {
    if (!mediaElement || !sourceBuffer) return;
    
    // 检查seek的位置是否已缓冲
    const seekTime = mediaElement.currentTime;
    const buffered = mediaElement.buffered;
    
    // 检查seek的位置是否在已缓冲的范围内
    let isBuffered = false;
    for (let i = 0; i < buffered.length; i++) {
      if (seekTime >= buffered.start(i) && seekTime <= buffered.end(i)) {
        isBuffered = true;
        break;
      }
    }
    
    // 如果没有缓冲，加载该位置的数据
    if (!isBuffered) {
      // loadDataAt(seekTime);
    }
  }
  
  /**
   * 获取MIME类型
   * @param {string} url - 音频URL
   * @returns {string} MIME类型
   */
  function getMimeType(url) {
    const ext = url.split('.').pop().toLowerCase();
    switch (ext) {
      case 'mp3':
        return 'audio/mpeg';
      case 'ogg':
        return 'audio/ogg; codecs="vorbis"';
      case 'wav':
        return 'audio/wav; codecs="1"';
      case 'aac':
        return 'audio/aac';
      case 'm4a':
        return 'audio/mp4; codecs="mp4a.40.2"';
      default:
        return 'audio/mpeg'; // 默认假设为MP3
    }
  }
  
  /**
   * 释放资源
   */
  function dispose() {
    // 取消当前请求
    if (currentRequest && currentRequest.abort) {
      currentRequest.abort();
    }
    
    // 移除事件监听器
    if (mediaElement) {
      mediaElement.removeEventListener('timeupdate', handleTimeUpdate);
      mediaElement.removeEventListener('seeking', handleSeeking);
    }
    
    if (sourceBuffer) {
      sourceBuffer.removeEventListener('updateend', handleSourceBufferUpdateEnd);
    }
    
    // 释放MediaSource
    if (mediaSource && mediaSource.readyState === 'open') {
      try {
        mediaSource.endOfStream();
      } catch (e) {
        console.error('Error ending media source stream:', e);
      }
    }
    
    // 清除引用
    isLoading = false;
    audioBuffer = null;
    mediaSource = null;
    sourceBuffer = null;
    mediaElement = null;
    loadedRanges = [];
  }
  
  // API对象
  return {
    load,
    
    // 获取加载状态
    getState() {
      return {
        isLoading,
        loadedRanges,
        buffer: audioBuffer
      };
    },
    
    // 注册进度回调
    onProgress(callback) {
      callbacks.onProgress.push(callback);
      return this;
    },
    
    // 注册完成回调
    onComplete(callback) {
      callbacks.onComplete.push(callback);
      return this;
    },
    
    // 注册错误回调
    onError(callback) {
      callbacks.onError.push(callback);
      return this;
    },
    
    // 释放资源
    dispose
  };
} 