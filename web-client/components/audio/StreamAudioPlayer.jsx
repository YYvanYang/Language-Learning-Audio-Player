"use client";

import { useRef, useState, useEffect } from 'react';
import { StreamLoader } from '../../lib/audio/stream-loader';
import { ensureAudioContext, resumeAudioContext } from '../../lib/audio/processing';

/**
 * 流式音频播放器组件 - 高效处理大型音频文件
 * @param {Object} props - 组件属性
 * @param {string} props.src - 音频文件URL
 * @param {string} props.className - 额外的CSS类名
 * @param {Object} props.options - 流加载器选项
 * @param {boolean} props.autoPlay - 是否自动播放
 * @param {Function} props.onReady - 准备就绪回调
 * @param {Function} props.onProgress - 加载进度回调
 * @param {Function} props.onError - 错误回调
 */
export default function StreamAudioPlayer({
  src,
  className = '',
  options = {},
  autoPlay = false,
  onReady,
  onProgress,
  onError
}) {
  // 创建引用
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const loaderRef = useRef(null);
  const playingRef = useRef(false);
  const startTimeRef = useRef(0);
  const pausedPositionRef = useRef(0);
  
  // 状态
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [loadProgress, setLoadProgress] = useState(0);
  const [decodeProgress, setDecodeProgress] = useState(0);
  const [error, setError] = useState(null);
  
  // 初始化音频上下文和加载器
  useEffect(() => {
    if (!src) return;
    
    // 创建或获取音频上下文
    audioContextRef.current = ensureAudioContext();
    
    // 创建流加载器
    const loaderOptions = {
      ...options,
      onProgress: (loaded, total, progress) => {
        setLoadProgress(progress);
        if (onProgress) onProgress(loaded, total, progress);
      },
      onDecodeProgress: (decoded, total, progress) => {
        setDecodeProgress(progress);
      },
      onError: (err) => {
        setError(err);
        if (onError) onError(err);
      }
    };
    
    loaderRef.current = new StreamLoader(src, audioContextRef.current, loaderOptions);
    
    // 初始化加载器
    const initLoader = async () => {
      try {
        const metadata = await loaderRef.current.initialize();
        setDuration(metadata.duration || 0);
        setIsReady(true);
        
        if (onReady) onReady(metadata);
        
        // 如果设置了自动播放，开始播放
        if (autoPlay) {
          play();
        } else {
          // 否则开始预加载
          loaderRef.current.startLoading(0);
        }
      } catch (err) {
        setError(err);
        if (onError) onError(err);
      }
    };
    
    initLoader();
    
    // 清理函数
    return () => {
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      }
      
      if (loaderRef.current) {
        loaderRef.current.cancelLoading();
      }
    };
  }, [src, options, autoPlay, onReady, onProgress, onError]);
  
  // 播放指定位置的音频
  const playAt = async (time) => {
    if (!isReady || !loaderRef.current || !audioContextRef.current) return;
    
    try {
      // 确保音频上下文处于运行状态
      await resumeAudioContext(audioContextRef.current);
      
      // 停止之前的播放
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      }
      
      // 获取指定位置的音频数据
      const audioBuffer = await loaderRef.current.getAudioBufferAtTime(time);
      if (!audioBuffer) {
        console.error('无法获取音频数据');
        return;
      }
      
      // 创建新的源节点
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      
      // 计算偏移量（块内的位置）
      const chunkIndex = loaderRef.current._timeToChunkIndex(time);
      const chunkStartTime = (chunkIndex * loaderRef.current.options.chunkSize / loaderRef.current.totalSize) 
                            * loaderRef.current.duration;
      const offset = time - chunkStartTime;
      
      // 开始播放
      source.start(0, Math.max(0, offset));
      sourceNodeRef.current = source;
      
      // 更新状态
      playingRef.current = true;
      startTimeRef.current = audioContextRef.current.currentTime - offset;
      pausedPositionRef.current = time;
      setIsPlaying(true);
      
      // 继续加载剩余部分
      loaderRef.current.startLoading(time);
      
      // 播放结束处理
      source.onended = () => {
        if (sourceNodeRef.current === source) {
          playingRef.current = false;
          setIsPlaying(false);
        }
      };
      
      // 开始更新当前时间
      updateCurrentTime();
    } catch (err) {
      setError(err);
      if (onError) onError(err);
    }
  };
  
  // 继续播放
  const play = () => {
    playAt(pausedPositionRef.current);
  };
  
  // 暂停播放
  const pause = () => {
    if (!isPlaying || !sourceNodeRef.current) return;
    
    // 保存当前位置
    pausedPositionRef.current = currentTime;
    
    // 停止播放
    sourceNodeRef.current.stop();
    sourceNodeRef.current.disconnect();
    sourceNodeRef.current = null;
    
    // 更新状态
    playingRef.current = false;
    setIsPlaying(false);
  };
  
  // 跳转到指定位置
  const seek = (time) => {
    // 限制范围
    const clampedTime = Math.max(0, Math.min(duration, time));
    
    if (isPlaying) {
      playAt(clampedTime);
    } else {
      pausedPositionRef.current = clampedTime;
      setCurrentTime(clampedTime);
      
      // 预加载该位置的数据
      if (loaderRef.current) {
        loaderRef.current.startLoading(clampedTime);
      }
    }
  };
  
  // 更新当前播放时间
  const updateCurrentTime = () => {
    if (!playingRef.current || !audioContextRef.current) return;
    
    const currentPos = audioContextRef.current.currentTime - startTimeRef.current;
    setCurrentTime(pausedPositionRef.current + currentPos);
    
    // 继续更新
    requestAnimationFrame(updateCurrentTime);
  };
  
  // 格式化时间
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className={`stream-audio-player ${className}`}>
      {/* 播放器控件 */}
      <div className="controls bg-gray-800 rounded-lg p-4">
        {/* 播放/暂停按钮 */}
        <div className="flex items-center justify-between mb-4">
          <button 
            className="w-12 h-12 flex items-center justify-center bg-blue-600 rounded-full text-white"
            onClick={isPlaying ? pause : play}
            disabled={!isReady}
          >
            {isPlaying ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
              </svg>
            )}
          </button>
          
          {/* 时间显示 */}
          <div className="text-white">
            <span>{formatTime(currentTime)}</span>
            <span className="mx-1">/</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
        
        {/* 进度条 */}
        <div className="progress-container relative h-8 mb-4">
          {/* 加载进度 */}
          <div 
            className="absolute top-0 left-0 h-2 bg-gray-600 rounded-full"
            style={{ width: `${loadProgress * 100}%` }}
          ></div>
          
          {/* 解码进度 */}
          <div 
            className="absolute top-0 left-0 h-2 bg-blue-600 rounded-full opacity-50"
            style={{ width: `${decodeProgress * 100}%` }}
          ></div>
          
          {/* 播放进度条 */}
          <input 
            type="range"
            className="absolute top-0 left-0 w-full h-2 appearance-none bg-transparent cursor-pointer"
            min="0"
            max={duration}
            step="0.1"
            value={currentTime}
            onChange={(e) => seek(parseFloat(e.target.value))}
          />
          
          {/* 播放头 */}
          <div 
            className="absolute top-0 w-3 h-3 bg-white rounded-full transform -translate-x-1/2"
            style={{ left: `${(currentTime / duration) * 100}%` }}
          ></div>
        </div>
        
        {/* 状态信息 */}
        <div className="flex justify-between text-xs text-gray-400">
          <div>加载: {Math.round(loadProgress * 100)}%</div>
          <div>解码: {Math.round(decodeProgress * 100)}%</div>
        </div>
      </div>
      
      {/* 错误信息 */}
      {error && (
        <div className="mt-4 p-3 bg-red-500 text-white rounded">
          {error.message || '加载音频时出错'}
        </div>
      )}
    </div>
  );
} 