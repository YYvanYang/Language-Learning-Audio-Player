// lib/audio/hooks.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { ensureAudioContext, setupAudioProcessingChain, getWaveformData, getFrequencyData } from './processing';

/**
 * 音频上下文状态管理与自动恢复钩子
 * 处理音频上下文的创建、状态监控和自动恢复
 * @returns {Object} 包含音频上下文状态和控制函数的对象
 */
export function useAudioContextState() {
  const [context, setContext] = useState(null);
  const [state, setState] = useState('suspended');
  const [isAutoResumeEnabled, setIsAutoResumeEnabled] = useState(true);
  const userInteractionRef = useRef(false);

  // 创建音频上下文
  const createContext = useCallback(() => {
    try {
      const ctx = ensureAudioContext();
      setContext(ctx);
      setState(ctx.state);
      return ctx;
    } catch (error) {
      console.error('Failed to create AudioContext:', error);
      return null;
    }
  }, []);

  // 恢复音频上下文
  const resumeContext = useCallback(async () => {
    if (!context) return false;
    
    try {
      if (context.state === 'suspended') {
        await context.resume();
        setState(context.state);
        return context.state === 'running';
      }
      return context.state === 'running';
    } catch (error) {
      console.error('Failed to resume AudioContext:', error);
      return false;
    }
  }, [context]);

  // 暂停音频上下文
  const suspendContext = useCallback(async () => {
    if (!context) return false;
    
    try {
      if (context.state === 'running') {
        await context.suspend();
        setState(context.state);
        return context.state === 'suspended';
      }
      return context.state === 'suspended';
    } catch (error) {
      console.error('Failed to suspend AudioContext:', error);
      return false;
    }
  }, [context]);

  // 关闭音频上下文
  const closeContext = useCallback(async () => {
    if (!context) return false;
    
    try {
      if (context.state !== 'closed') {
        await context.close();
        setState('closed');
        setContext(null);
        return true;
      }
      return true;
    } catch (error) {
      console.error('Failed to close AudioContext:', error);
      return false;
    }
  }, [context]);

  // 监听上下文状态变化
  useEffect(() => {
    if (!context) return;
    
    const handleStateChange = () => {
      setState(context.state);
    };
    
    // 添加状态变化事件监听器
    context.addEventListener('statechange', handleStateChange);
    
    return () => {
      context.removeEventListener('statechange', handleStateChange);
    };
  }, [context]);

  // 设置用户交互监听器来自动恢复上下文
  useEffect(() => {
    if (!context || !isAutoResumeEnabled) return;
    
    const userInteractionEvents = [
      'click', 'touchstart', 'keydown', 'touchend',
      'pointerdown', 'mousedown'
    ];
    
    const handleUserInteraction = () => {
      // 记录用户交互
      userInteractionRef.current = true;
      
      // 尝试恢复音频上下文
      if (context.state === 'suspended') {
        resumeContext().catch(error => {
          console.warn('Failed to automatically resume AudioContext:', error);
        });
      }
      
      // 只需处理一次用户交互
      if (userInteractionRef.current) {
        userInteractionEvents.forEach(eventType => {
          window.removeEventListener(eventType, handleUserInteraction);
        });
      }
    };
    
    // 添加多种用户交互事件监听器
    userInteractionEvents.forEach(eventType => {
      window.addEventListener(eventType, handleUserInteraction, { once: false });
    });
    
    return () => {
      // 清理事件监听器
      userInteractionEvents.forEach(eventType => {
        window.removeEventListener(eventType, handleUserInteraction);
      });
    };
  }, [context, isAutoResumeEnabled, resumeContext]);

  // 处理页面可见性变化
  useEffect(() => {
    if (!context || !isAutoResumeEnabled) return;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && userInteractionRef.current) {
        // 页面变为可见时恢复上下文
        if (context.state === 'suspended') {
          resumeContext().catch(error => {
            console.warn('Failed to resume AudioContext on visibility change:', error);
          });
        }
      } else if (document.visibilityState === 'hidden') {
        // 可选：当页面不可见时暂停上下文以节省资源
        // 取消注释下面的代码以启用此功能
        // suspendContext().catch(error => {
        //   console.warn('Failed to suspend AudioContext on visibility change:', error);
        // });
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [context, isAutoResumeEnabled, resumeContext, suspendContext]);

  // 监控页面卸载以适当清理资源
  useEffect(() => {
    if (!context) return;
    
    const handleBeforeUnload = () => {
      // 尝试关闭上下文以防止内存泄漏
      try {
        context.close();
      } catch (error) {
        // 忽略可能的错误
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // 组件卸载时关闭上下文
      if (context && context.state !== 'closed') {
        context.close().catch(error => {
          console.warn('Failed to close AudioContext on cleanup:', error);
        });
      }
    };
  }, [context]);

  return {
    context,
    state,
    isAutoResumeEnabled,
    setIsAutoResumeEnabled,
    createContext,
    resumeContext,
    suspendContext,
    closeContext,
    hasUserInteraction: userInteractionRef.current
  };
}

/**
 * 使用音频处理器钩子
 * @returns {Object} 包含音频处理器函数和状态的对象
 */
export function useAudioProcessor() {
  const [audioContext, setAudioContext] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);
  
  // 节点引用
  const nodesRef = useRef({
    source: null,
    analyser: null,
    gainNode: null,
    equalizer: null,
    compressor: null
  });
  
  // 初始化音频上下文
  const initialize = useCallback(() => {
    if (audioContext) return;
    
    try {
      const ctx = ensureAudioContext();
      setAudioContext(ctx);
      setIsReady(true);
      return ctx;
    } catch (err) {
      console.error('Failed to initialize audio context:', err);
      setError('无法初始化音频系统');
      setIsReady(false);
    }
  }, [audioContext]);
  
  // 连接音频源
  const connectSource = useCallback((source) => {
    if (!audioContext) return;
    
    // 清理现有连接
    if (nodesRef.current.source) {
      disconnectAll();
    }
    
    let sourceNode;
    
    try {
      if (source instanceof HTMLAudioElement) {
        sourceNode = audioContext.createMediaElementSource(source);
      } else if (source instanceof AudioBuffer) {
        sourceNode = audioContext.createBufferSource();
        sourceNode.buffer = source;
      } else {
        throw new Error('不支持的音频源类型');
      }
      
      // 创建处理链
      const processingNodes = setupAudioProcessingChain(sourceNode);
      
      // 保存节点引用
      nodesRef.current = {
        source: sourceNode,
        ...processingNodes
      };
      
      // 如果是缓冲源，开始播放
      if (sourceNode instanceof AudioBufferSourceNode) {
        sourceNode.start();
      }
      
      return sourceNode;
    } catch (err) {
      console.error('Failed to connect audio source:', err);
      setError('连接音频源失败');
      return null;
    }
  }, [audioContext, disconnectAll]);
  
  // 断开所有连接
  const disconnectAll = useCallback(() => {
    if (!nodesRef.current.source) return;
    
    try {
      // 断开所有节点
      if (nodesRef.current.source) {
        try {
          nodesRef.current.source.disconnect();
        } catch (e) {
          // 忽略已断开的节点错误
        }
      }
      
      if (nodesRef.current.analyser) {
        try {
          nodesRef.current.analyser.disconnect();
        } catch (e) {
          // 忽略已断开的节点错误
        }
      }
      
      if (nodesRef.current.equalizer) {
        try {
          nodesRef.current.equalizer.bass.disconnect();
          nodesRef.current.equalizer.mid.disconnect();
          nodesRef.current.equalizer.treble.disconnect();
        } catch (e) {
          // 忽略已断开的节点错误
        }
      }
      
      if (nodesRef.current.gainNode) {
        try {
          nodesRef.current.gainNode.disconnect();
        } catch (e) {
          // 忽略已断开的节点错误
        }
      }
      
      if (nodesRef.current.compressor) {
        try {
          nodesRef.current.compressor.disconnect();
        } catch (e) {
          // 忽略已断开的节点错误
        }
      }
      
      // 重置节点引用
      nodesRef.current = {
        source: null,
        analyser: null,
        gainNode: null,
        equalizer: null,
        compressor: null
      };
    } catch (err) {
      console.error('Error disconnecting nodes:', err);
    }
  }, []);
  
  // 设置音量
  const setVolume = useCallback((volume) => {
    if (!nodesRef.current.gainNode) return;
    
    // 音量取值范围 0-1
    const safeVolume = Math.max(0, Math.min(1, volume));
    nodesRef.current.gainNode.gain.value = safeVolume;
  }, []);
  
  // 设置均衡器
  const setEqualizer = useCallback((bass, mid, treble) => {
    if (!nodesRef.current.equalizer) return;
    
    const eq = nodesRef.current.equalizer;
    
    // 均衡器增益范围通常为 -40dB 到 +40dB
    // Web Audio API 使用线性刻度，所以我们将输入范围 0-2 映射到适当的dB范围
    eq.bass.gain.value = (bass - 1) * 40;
    eq.mid.gain.value = (mid - 1) * 40;
    eq.treble.gain.value = (treble - 1) * 40;
  }, []);
  
  // 获取波形数据
  const getWaveform = useCallback(() => {
    if (!nodesRef.current.analyser) return new Uint8Array(0);
    return getWaveformData(nodesRef.current.analyser);
  }, []);
  
  // 获取频谱数据
  const getSpectrum = useCallback(() => {
    if (!nodesRef.current.analyser) return new Uint8Array(0);
    return getFrequencyData(nodesRef.current.analyser);
  }, []);
  
  // 清理资源
  useEffect(() => {
    return () => {
      disconnectAll();
      
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
      }
    };
  }, [audioContext, disconnectAll]);
  
  return {
    initialize,
    connectSource,
    disconnectAll,
    setVolume,
    setEqualizer,
    getWaveform,
    getSpectrum,
    isReady,
    error,
    audioContext,
    nodes: nodesRef.current
  };
}

/**
 * 使用播放速度控制钩子
 * @param {HTMLAudioElement} audioElement - 音频元素
 * @returns {Object} 包含播放速度相关函数和状态的对象
 */
export function usePlaybackRate(audioElement) {
  const [rate, setRate] = useState(1.0);
  
  // 设置播放速度
  const setPlaybackRate = useCallback((newRate) => {
    if (!audioElement) return;
    
    // 限制速度范围在 0.5-2.0 之间
    const safeRate = Math.max(0.5, Math.min(2.0, newRate));
    
    try {
      audioElement.playbackRate = safeRate;
      setRate(safeRate);
    } catch (err) {
      console.error('Failed to set playback rate:', err);
    }
  }, [audioElement]);
  
  // 监听音频元素变化
  useEffect(() => {
    if (!audioElement) return;
    
    // 设置初始播放速度
    audioElement.playbackRate = rate;
    
    // 清理函数
    return () => {
      // 重置为默认值
      try {
        audioElement.playbackRate = 1.0;
      } catch (e) {
        // 忽略可能的错误
      }
    };
  }, [audioElement, rate]);
  
  return {
    playbackRate: rate,
    setPlaybackRate
  };
}

/**
 * 使用AB循环控制钩子
 * @param {HTMLAudioElement} audioElement - 音频元素
 * @returns {Object} 包含AB循环相关函数和状态的对象
 */
export function useABLoop(audioElement) {
  const [loopRegion, setLoopRegion] = useState(null);
  const [isActive, setIsActive] = useState(false);
  
  // 更新处理函数引用
  const handlerRef = useRef(null);
  
  // 设置循环区域
  const setLoop = useCallback((start, end) => {
    if (!audioElement) return;
    
    // 验证输入
    if (typeof start !== 'number' || typeof end !== 'number') {
      console.error('Invalid loop region');
      return;
    }
    
    // 确保开始时间小于结束时间
    if (start >= end) {
      console.error('Loop start must be less than end');
      return;
    }
    
    // 设置循环区域
    setLoopRegion({ start, end });
    setIsActive(true);
  }, [audioElement]);
  
  // 清除循环区域
  const clearLoop = useCallback(() => {
    setLoopRegion(null);
    setIsActive(false);
  }, []);
  
  // 处理时间更新
  useEffect(() => {
    if (!audioElement || !loopRegion || !isActive) return;
    
    // 定义时间更新处理函数
    const handleTimeUpdate = () => {
      if (audioElement.currentTime >= loopRegion.end) {
        audioElement.currentTime = loopRegion.start;
      }
    };
    
    // 保存处理函数引用
    handlerRef.current = handleTimeUpdate;
    
    // 添加事件监听器
    audioElement.addEventListener('timeupdate', handleTimeUpdate);
    
    // 清理函数
    return () => {
      audioElement.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [audioElement, loopRegion, isActive]);
  
  return {
    loopRegion,
    isActive,
    setLoop,
    clearLoop,
    toggleActive: () => setIsActive(!isActive)
  };
}

/**
 * 使用书签管理钩子
 * @param {string} trackId - 音轨ID，用于存储和恢复书签
 * @returns {Object} 包含书签相关函数和状态的对象
 */
export function useBookmarks(trackId) {
  const [bookmarks, setBookmarks] = useState([]);
  
  // 加载书签
  useEffect(() => {
    if (!trackId) return;
    
    // 尝试从本地存储加载书签
    try {
      const storedBookmarks = localStorage.getItem(`bookmarks_${trackId}`);
      if (storedBookmarks) {
        setBookmarks(JSON.parse(storedBookmarks));
      } else {
        setBookmarks([]);
      }
    } catch (err) {
      console.error('Failed to load bookmarks:', err);
      setBookmarks([]);
    }
  }, [trackId]);
  
  // 保存书签到本地存储
  const saveBookmarks = useCallback((newBookmarks) => {
    if (!trackId) return;
    
    try {
      localStorage.setItem(`bookmarks_${trackId}`, JSON.stringify(newBookmarks));
    } catch (err) {
      console.error('Failed to save bookmarks:', err);
    }
  }, [trackId]);
  
  // 添加书签
  const addBookmark = useCallback((time, label) => {
    const newBookmark = {
      id: `bookmark_${Date.now()}`,
      time,
      label: label || `书签 ${formatTime(time)}`
    };
    
    const newBookmarks = [...bookmarks, newBookmark];
    setBookmarks(newBookmarks);
    saveBookmarks(newBookmarks);
    
    return newBookmark;
  }, [bookmarks, saveBookmarks]);
  
  // 移除书签
  const removeBookmark = useCallback((bookmarkId) => {
    const newBookmarks = bookmarks.filter(b => b.id !== bookmarkId);
    setBookmarks(newBookmarks);
    saveBookmarks(newBookmarks);
  }, [bookmarks, saveBookmarks]);
  
  // 编辑书签
  const editBookmark = useCallback((bookmarkId, updatedData) => {
    const newBookmarks = bookmarks.map(b => {
      if (b.id === bookmarkId) {
        return { ...b, ...updatedData };
      }
      return b;
    });
    
    setBookmarks(newBookmarks);
    saveBookmarks(newBookmarks);
  }, [bookmarks, saveBookmarks]);
  
  return {
    bookmarks,
    addBookmark,
    removeBookmark,
    editBookmark
  };
}

// 辅助函数：格式化时间
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
} 