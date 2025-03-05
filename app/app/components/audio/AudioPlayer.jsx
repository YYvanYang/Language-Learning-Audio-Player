'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Rewind, FastForward, 
         RepeatOne, Volume2, Settings } from 'lucide-react';
import WaveformVisualizer from './WaveformVisualizer';
import BookmarkList from './BookmarkList';
import ABLoopControl from './ABLoopControl';
import { generateToken } from '@/lib/auth';
import { initAudioProcessor } from '@/lib/audio/processing';

const AudioPlayer = ({ 
  courseId, 
  unitId, 
  userId, 
  tracks = [],
  onTrackChange
}) => {
  // 基本状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isReady, setIsReady] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState(null);
  const [volume, setVolume] = useState(1);
  const [repeatMode, setRepeatMode] = useState(false);
  
  // 高级功能状态
  const [waveformData, setWaveformData] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [loopRegion, setLoopRegion] = useState(null);
  const [isLoopActive, setIsLoopActive] = useState(false);
  const [processingEnabled, setProcessingEnabled] = useState(false);
  const [eqSettings, setEqSettings] = useState({ bass: 1.0, mid: 1.0, treble: 1.0 });
  
  // Refs
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const gainNodeRef = useRef(null);
  const processorNodeRef = useRef(null);
  const audioBufferRef = useRef(null);
  const startTimeRef = useRef(0);
  const pausedTimeRef = useRef(0);
  const progressBarRef = useRef(null);
  const wasmProcessorRef = useRef(null);
  
  // 将当前轨道ID传递给父组件
  useEffect(() => {
    if (tracks.length > 0 && tracks[currentTrack]) {
      onTrackChange?.(tracks[currentTrack].id);
    }
  }, [currentTrack, tracks, onTrackChange]);

  // 初始化音频上下文
  useEffect(() => {
    if (typeof window !== 'undefined' && !audioContextRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext();
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.connect(audioContextRef.current.destination);
      
      // 初始化WebAssembly音频处理器
      initAudioProcessor().then(processor => {
        wasmProcessorRef.current = processor;
        console.log('WebAssembly音频处理器已初始化');
      }).catch(err => {
        console.error('WebAssembly处理器初始化失败:', err);
      });
    }
    
    return () => {
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
      }
      
      if (processorNodeRef.current) {
        processorNodeRef.current.disconnect();
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);
  
  // 加载音频函数
  const loadAudio = async (trackIndex) => {
    if (!tracks[trackIndex]) return;
    
    try {
      setIsReady(false);
      setIsBuffering(true);
      setError(null);
      
      // 生成令牌
      const token = generateToken({
        courseId,
        unitId,
        trackId: tracks[trackIndex].id,
        userId,
        action: 'stream_audio',
        timestamp: Date.now()
      });
      
      // 请求音频数据
      const response = await fetch('/api/audio/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load audio: ${response.status}`);
      }
      
      // 获取音频数据并解码
      const arrayBuffer = await response.arrayBuffer();
      
      // 唤醒音频上下文
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      // 解码音频数据
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      audioBufferRef.current = audioBuffer;
      
      // 更新UI状态
      setDuration(audioBuffer.duration);
      setIsReady(true);
      setIsBuffering(false);
      
      // 生成波形数据
      if (wasmProcessorRef.current) {
        try {
          const waveform = await wasmProcessorRef.current.generateWaveformData(
            audioBuffer.getChannelData(0), 
            200
          );
          setWaveformData(Array.from(waveform));
        } catch (err) {
          console.error('波形生成失败:', err);
        }
      }
      
      // 如果加载完成后需要立即播放
      if (isPlaying) {
        playAudioBuffer(pausedTimeRef.current);
      }
      
      // 预加载下一轨道
      if (trackIndex + 1 < tracks.length) {
        setTimeout(() => {
          preloadTrack(trackIndex + 1);
        }, 1000);
      }
    } catch (err) {
      console.error('Error loading audio:', err);
      setIsBuffering(false);
      setError('音频加载失败，请重试');
    }
  };
  
  // 预加载轨道
  const preloadTrack = async (trackIndex) => {
    if (!tracks[trackIndex]) return;
    
    try {
      // 创建访问令牌
      const token = generateToken({
        courseId,
        unitId,
        trackId: tracks[trackIndex].id,
        userId,
        action: 'stream_audio',
        timestamp: Date.now()
      });
      
      // 仅请求但不处理
      fetch('/api/audio/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token })
      });
      
      console.log('预加载轨道:', trackIndex);
    } catch (err) {
      console.warn('预加载失败:', err);
    }
  };
  
  // 播放音频缓冲区
  const playAudioBuffer = (startOffset = 0) => {
    if (!audioContextRef.current || !audioBufferRef.current || !isReady) return;
    
    // 停止当前播放的音频
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current.disconnect();
    }
    
    // 创建新的音源节点
    sourceNodeRef.current = audioContextRef.current.createBufferSource();
    sourceNodeRef.current.buffer = audioBufferRef.current;
    sourceNodeRef.current.playbackRate.value = playbackRate;
    
    // 创建处理链
    let lastNode = sourceNodeRef.current;
    
    // 如果启用了音频处理，添加处理节点
    if (processingEnabled && wasmProcessorRef.current) {
      try {
        // 使用Script Processor Node应用WebAssembly处理
        const processorNode = audioContextRef.current.createScriptProcessor(4096, 2, 2);
        processorNode.onaudioprocess = async (e) => {
          if (!wasmProcessorRef.current) return;
          
          const inputL = e.inputBuffer.getChannelData(0);
          const inputR = e.inputBuffer.getChannelData(1);
          const outputL = e.outputBuffer.getChannelData(0);
          const outputR = e.outputBuffer.getChannelData(1);
          
          // 处理左声道
          const processedL = await wasmProcessorRef.current.applyEqualizer(
            inputL,
            eqSettings.bass,
            eqSettings.mid,
            eqSettings.treble
          );
          
          // 处理右声道
          const processedR = await wasmProcessorRef.current.applyEqualizer(
            inputR,
            eqSettings.bass,
            eqSettings.mid,
            eqSettings.treble
          );
          
          // 复制处理后的数据到输出
          outputL.set(processedL || inputL);
          outputR.set(processedR || inputR);
        };
        
        // 连接处理节点
        lastNode.connect(processorNode);
        processorNode.connect(gainNodeRef.current);
        processorNodeRef.current = processorNode;
        
      } catch (err) {
        console.error('音频处理节点创建失败:', err);
        // 如果处理节点创建失败，直接连接增益节点
        lastNode.connect(gainNodeRef.current);
      }
    } else {
      // 没有启用处理，直接连接增益节点
      lastNode.connect(gainNodeRef.current);
    }
    
    // 计算开始时间（用于进度追踪）
    startTimeRef.current = audioContextRef.current.currentTime - startOffset;
    pausedTimeRef.current = startOffset;
    
    // 从指定位置开始播放
    sourceNodeRef.current.start(0, startOffset);
    
    // 设置播放结束事件
    sourceNodeRef.current.onended = handlePlaybackEnded;
  };
  
  // 处理播放结束事件
  const handlePlaybackEnded = () => {
    // 检查是否在AB循环模式
    if (isLoopActive && loopRegion && audioBufferRef.current) {
      const currentPlayTime = audioContextRef.current.currentTime - startTimeRef.current;
      const loopEndTime = (loopRegion.end / 100) * audioBufferRef.current.duration;
      
      // 如果到达循环结束点
      if (currentPlayTime >= loopEndTime - 0.1) {
        // 跳回循环起点
        const loopStartTime = (loopRegion.start / 100) * audioBufferRef.current.duration;
        playAudioBuffer(loopStartTime);
        return;
      }
    }
    
    // 原有的播放结束逻辑
    const currentAudioTime = audioContextRef.current.currentTime - startTimeRef.current;
    
    if (currentAudioTime >= audioBufferRef.current.duration - 0.1) {
      if (repeatMode) {
        // 重复播放当前音轨
        playAudioBuffer(0);
      } else if (currentTrack < tracks.length - 1) {
        // 播放下一首
        setCurrentTrack(prev => prev + 1);
        setCurrentTime(0);
        pausedTimeRef.current = 0;
      } else {
        // 播放列表结束
        setIsPlaying(false);
        setCurrentTime(0);
        pausedTimeRef.current = 0;
      }
    } else {
      // 被手动停止的情况
      setIsPlaying(false);
    }
  };
  
  // 更新播放时间
  useEffect(() => {
    let animationFrame;
    
    const updateTime = () => {
      if (isPlaying && audioContextRef.current && audioBufferRef.current) {
        const elapsedTime = audioContextRef.current.currentTime - startTimeRef.current;
        
        // 确保不超过音频实际长度
        if (elapsedTime <= audioBufferRef.current.duration) {
          setCurrentTime(elapsedTime);
          pausedTimeRef.current = elapsedTime;
          
          // 检查是否到达AB循环结束点
          if (isLoopActive && loopRegion) {
            const loopEndTime = (loopRegion.end / 100) * audioBufferRef.current.duration;
            if (elapsedTime >= loopEndTime) {
              const loopStartTime = (loopRegion.start / 100) * audioBufferRef.current.duration;
              playAudioBuffer(loopStartTime);
              return;
            }
          }
          
          animationFrame = requestAnimationFrame(updateTime);
        } else {
          handlePlaybackEnded();
        }
      }
    };
    
    if (isPlaying) {
      animationFrame = requestAnimationFrame(updateTime);
    }
    
    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isPlaying, isLoopActive, loopRegion]);
  
  // 加载当前轨道
  useEffect(() => {
    if (tracks.length > 0 && tracks[currentTrack]) {
      loadAudio(currentTrack);
      setCurrentTime(0);
      pausedTimeRef.current = 0;
      // 重置书签为空
      setBookmarks([]);
    }
  }, [currentTrack, tracks]);
  
  // 音量控制效果
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.setValueAtTime(volume, audioContextRef.current.currentTime);
    }
  }, [volume]);
  
  // 播放/暂停控制
  const togglePlay = () => {
    if (!isReady && !isBuffering && tracks.length > 0) {
      // 如果音频还未加载，先加载
      loadAudio(currentTrack);
      setIsPlaying(true);
      return;
    }
    
    if (isPlaying) {
      // 暂停
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
        pausedTimeRef.current = currentTime;
      }
      setIsPlaying(false);
    } else {
      // 播放
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      playAudioBuffer(pausedTimeRef.current);
      setIsPlaying(true);
    }
  };
  
  // 处理进度条变化
  const handleProgressChange = (e) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    pausedTimeRef.current = newTime;
    
    if (isPlaying) {
      // 如果正在播放，从新位置继续播放
      playAudioBuffer(newTime);
    }
  };
  
  // 切换音轨
  const changeTrack = (index) => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
    }
    setCurrentTrack(index);
    setCurrentTime(0);
    pausedTimeRef.current = 0;
    setIsPlaying(false);
  };
  
  // 更改播放速度
  const changePlaybackRate = () => {
    const rates = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const currentIndex = rates.indexOf(playbackRate);
    const newIndex = (currentIndex + 1) % rates.length;
    const newRate = rates[newIndex];
    setPlaybackRate(newRate);
    
    // 更新当前播放的速率
    if (sourceNodeRef.current && isPlaying) {
      sourceNodeRef.current.playbackRate.value = newRate;
    }
  };
  
  // 快进功能 (前进15秒)
  const fastForward = () => {
    if (!audioBufferRef.current) return;
    
    const newTime = Math.min(currentTime + 15, audioBufferRef.current.duration);
    setCurrentTime(newTime);
    pausedTimeRef.current = newTime;
    
    if (isPlaying) {
      playAudioBuffer(newTime);
    }
  };
  
  // 快退功能 (后退15秒)
  const rewind = () => {
    const newTime = Math.max(currentTime - 15, 0);
    setCurrentTime(newTime);
    pausedTimeRef.current = newTime;
    
    if (isPlaying) {
      playAudioBuffer(newTime);
    }
  };
  
  // 格式化时间显示
  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // 书签功能
  const addBookmark = (time) => {
    const newBookmark = {
      id: Date.now().toString(),
      time,
      text: `书签 ${formatTime(time)}`
    };
    setBookmarks(prev => [...prev, newBookmark]);
  };
  
  const editBookmark = (id, text) => {
    setBookmarks(prev => prev.map(bookmark => 
      bookmark.id === id ? { ...bookmark, text } : bookmark
    ));
  };
  
  const deleteBookmark = (id) => {
    setBookmarks(prev => prev.filter(bookmark => bookmark.id !== id));
  };
  
  const playBookmark = (id) => {
    const bookmark = bookmarks.find(b => b.id === id);
    if (bookmark) {
      setCurrentTime(bookmark.time);
      pausedTimeRef.current = bookmark.time;
      
      if (isPlaying) {
        playAudioBuffer(bookmark.time);
      }
    }
  };
  
  // AB循环功能
  const handleLoopRegionUpdate = (region) => {
    setLoopRegion(region);
    setIsLoopActive(true);
  };
  
  const clearLoopRegion = () => {
    setLoopRegion(null);
    setIsLoopActive(false);
  };
  
  const toggleLoopActive = () => {
    setIsLoopActive(!isLoopActive);
  };
  
  // 切换音频处理
  const toggleProcessing = () => {
    const newState = !processingEnabled;
    setProcessingEnabled(newState);
    
    // 如果正在播放，重新创建处理链
    if (isPlaying) {
      const currentPosition = pausedTimeRef.current;
      sourceNodeRef.current.stop();
      playAudioBuffer(currentPosition);
    }
  };
  
  // 更新均衡器设置
  const updateEqualizer = (bass, mid, treble) => {
    setEqSettings({ bass, mid, treble });
  };
  
  return (
    <div className="flex flex-col bg-blue-50 rounded-lg overflow-hidden">
      {/* 课程信息和标题 */}
      <div className="bg-white p-4 rounded-t-lg shadow-sm">
        <div className="flex items-start space-x-4">
          <img 
            src={`/api/course/${courseId}/cover`}
            alt="Course cover" 
            className="w-24 h-32 object-cover rounded-md border-2 border-yellow-400"
            onError={(e) => {
              e.target.src = '/images/default-cover.jpg';
              e.target.onerror = null;
            }}
          />
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold">英语（PEP）</h1>
            <h2 className="text-xl mt-1">二年级 下册</h2>
            <h3 className="text-lg text-gray-600 mt-1">（浙江专用）</h3>
          </div>
        </div>
        
        <div className="mt-6 border-t-2 border-gray-100 pt-4">
          <h2 className="text-2xl font-bold">Unit 1 Put on my coat!</h2>
        </div>
      </div>

      {/* 音轨列表 */}
      <div className="flex flex-col p-4 bg-blue-50">
        {tracks.length === 0 && !error ? (
          <div className="flex justify-center items-center h-32">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-2 text-blue-500">正在加载课程内容...</span>
          </div>
        ) : error ? (
          <div className="flex justify-center items-center h-32 text-red-500">
            {error}
          </div>
        ) : (
          tracks.map((track, index) => (
            <div 
              key={track.id}
              className={`border rounded-lg mb-4 ${currentTrack === index ? 'bg-blue-100 border-blue-300' : 'bg-white'} 
                         transition-all duration-200 hover:bg-blue-50 cursor-pointer`}
              onClick={() => changeTrack(index)}
            >
              <div className="flex justify-between items-center p-4">
                <div className="flex-1">
                  <p className="text-lg font-medium">{track.title}</p>
                  {track.chineseName && <p className="text-gray-600">{track.chineseName}</p>}
                  {track.custom && (
                    <span className="inline-block text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                      自定义
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <div className="text-yellow-500 flex items-center">
                    <span className="mr-1">⏱</span>
                    <span>{formatTime(track.duration)}</span>
                  </div>
                  <button 
                    className={`w-12 h-12 ${currentTrack === index && isPlaying ? 'bg-teal-500' : 'bg-yellow-500'} 
                              rounded-full flex items-center justify-center text-white transition-colors duration-200
                              hover:opacity-90 active:opacity-75`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (currentTrack === index) {
                        togglePlay();
                      } else {
                        changeTrack(index);
                        setTimeout(() => setIsPlaying(true), 100);
                      }
                    }}
                  >
                    {currentTrack === index && isPlaying ? (
                      isBuffering ? (
                        <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Pause size={24} />
                      )
                    ) : (
                      <Play size={24} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 波形可视化 */}
      <div className="px-4 mt-4">
        <WaveformVisualizer 
          waveformData={waveformData}
          currentTime={currentTime}
          duration={duration}
          bookmarks={bookmarks}
          loopRegion={loopRegion}
          onSeek={(time) => {
            setCurrentTime(time);
            pausedTimeRef.current = time;
            if (isPlaying) {
              playAudioBuffer(time);
            }
          }}
          onBookmarkAdd={addBookmark}
          onLoopRegionUpdate={handleLoopRegionUpdate}
        />
        
        {loopRegion && (
          <ABLoopControl 
            loopRegion={loopRegion}
            duration={duration}
            onLoopClear={clearLoopRegion}
            onLoopAdjust={setLoopRegion}
            isLoopActive={isLoopActive}
            onToggleLoop={toggleLoopActive}
          />
        )}
        
        {bookmarks.length > 0 && (
          <div className="mt-4 border rounded-lg overflow-hidden">
            <div className="bg-gray-100 px-3 py-2 font-medium border-b flex justify-between items-center">
              <span>书签列表</span>
              <button 
                className="text-xs text-gray-500 hover:text-red-500"
                onClick={() => setBookmarks([])}
              >
                清空
              </button>
            </div>
            <BookmarkList
              bookmarks={bookmarks}
              onPlayBookmark={playBookmark}
              onEditBookmark={editBookmark}
              onDeleteBookmark={deleteBookmark}
            />
          </div>
        )}
      </div>

      {/* 播放器控制 */}
      <div className="mt-auto bg-white py-4 border-t sticky bottom-0">
        {/* 播放模式和速度控制 */}
        <div className="flex justify-between px-6 mb-2">
          <div className="flex items-center">
            <button
              className={`flex items-center ${processingEnabled ? 'text-green-600' : 'text-gray-600'} mr-4`}
              onClick={toggleProcessing}
            >
              <Settings size={18} className="mr-1" />
              <span className="text-sm">处理</span>
            </button>
          
            <button 
              className={`flex items-center ${repeatMode ? 'text-yellow-500' : 'text-gray-600'}`} 
              onClick={() => setRepeatMode(!repeatMode)}
            >
              <RepeatOne size={18} className="mr-1" />
              <span className="text-sm">复读</span>
            </button>
          </div>
          
          <div 
            className="flex items-center text-gray-600 cursor-pointer" 
            onClick={changePlaybackRate}
          >
            <span className="text-gray-800 font-medium">{playbackRate}X</span>
            <span className="ml-1 text-sm">倍速</span>
          </div>
          
          <div className="flex items-center text-gray-600 relative group">
            <Volume2 size={18} />
            <span className="ml-1 text-sm">音量</span>
            <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block bg-white p-2 rounded-md shadow-lg w-32">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full accent-yellow-500"
              />
            </div>
          </div>
        </div>

        {/* 进度条 */}
        <div className="px-4 my-2">
          <input
            ref={progressBarRef}
            type="range"
            min="0"
            max={duration || 1}
            step="0.01"
            value={currentTime}
            onChange={handleProgressChange}
            className="w-full accent-yellow-500 h-2 bg-gray-200 rounded-full"
          />
        </div>

        {/* 时间显示 */}
        <div className="flex justify-between px-6 mt-1 text-sm text-gray-600">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>

        {/* 播放控制按钮 */}
        <div className="flex justify-between items-center px-8 mt-4">
          <button 
            className="text-gray-600 p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
            onClick={rewind}
            aria-label="后退15秒"
          >
            <Rewind size={32} />
          </button>
          
          <button 
            className="text-yellow-500 p-2 rounded-full hover:bg-yellow-50 active:bg-yellow-100 transition-colors"
            onClick={() => {
              if (currentTrack > 0) {
                changeTrack(currentTrack - 1);
                setTimeout(() => setIsPlaying(true), 100);
              }
            }}
            disabled={currentTrack === 0}
            aria-label="上一曲"
          >
            <SkipBack size={36} />
          </button>
          
          <button 
            className={`${isPlaying ? 'bg-teal-500' : 'bg-yellow-500'} 
                      w-16 h-16 rounded-full flex items-center justify-center text-white shadow-md
                      hover:opacity-90 active:opacity-75 transition-all`}
            onClick={togglePlay}
            disabled={isBuffering || tracks.length === 0}
            aria-label={isPlaying ? "暂停" : "播放"}
          >
            {isBuffering ? (
              <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : isPlaying ? (
              <Pause size={32} />
            ) : (
              <Play size={32} />
            )}
          </button>
          
          <button 
            className="text-yellow-500 p-2 rounded-full hover:bg-yellow-50 active:bg-yellow-100 transition-colors"
            onClick={() => {
              if (currentTrack < tracks.length - 1) {
                changeTrack(currentTrack + 1);
                setTimeout(() => setIsPlaying(true), 100);
              }
            }}
            disabled={currentTrack === tracks.length - 1}
            aria-label="下一曲"
          >
            <SkipForward size={36} />
          </button>
          
          <button 
            className="text-gray-600 p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
            onClick={fastForward}
            aria-label="快进15秒"
          >
            <FastForward size={32} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;