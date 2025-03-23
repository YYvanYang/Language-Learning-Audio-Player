// components/audio/WaveformVisualizer.jsx
'use client';

import React, { useRef, useEffect, useState } from 'react';

const WaveformVisualizer = ({ 
  waveformData, 
  currentTime, 
  duration, 
  onSeek,
  bookmarks = [],
  loopRegion = null,
  onBookmarkAdd,
  onLoopRegionUpdate
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSettingLoop, setIsSettingLoop] = useState(false);
  const [loopStart, setLoopStart] = useState(null);
  
  // 绘制波形
  useEffect(() => {
    if (!canvasRef.current || !waveformData?.length) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    
    // 设置canvas尺寸
    canvas.width = containerWidth;
    canvas.height = containerHeight;
    
    // 清除画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 计算当前播放位置的x坐标
    const playheadX = (currentTime / duration) * canvas.width;
    
    // 绘制已播放和未播放部分的波形背景
    ctx.fillStyle = '#e5e7eb'; // 未播放部分背景
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#dbeafe'; // 已播放部分背景
    ctx.fillRect(0, 0, playheadX, canvas.height);
    
    // 如果有AB循环区域，绘制循环区域背景
    if (loopRegion) {
      const loopStartX = (loopRegion.start / 100) * canvas.width;
      const loopEndX = (loopRegion.end / 100) * canvas.width;
      
      ctx.fillStyle = 'rgba(254, 240, 138, 0.5)'; // 循环区域背景
      ctx.fillRect(loopStartX, 0, loopEndX - loopStartX, canvas.height);
      
      // 绘制循环区域边界线
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(loopStartX, 0);
      ctx.lineTo(loopStartX, canvas.height);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(loopEndX, 0);
      ctx.lineTo(loopEndX, canvas.height);
      ctx.stroke();
    }
    
    // 绘制波形
    const barWidth = canvas.width / waveformData.length;
    const middle = canvas.height / 2;
    
    // 绘制波形线
    ctx.beginPath();
    waveformData.forEach((value, index) => {
      const x = index * barWidth;
      const amplitude = value * (canvas.height * 0.8);
      
      if (index === 0) {
        ctx.moveTo(x, middle - amplitude / 2);
      } else {
        ctx.lineTo(x, middle - amplitude / 2);
      }
    });
    
    // 画底部波形线
    for (let i = waveformData.length - 1; i >= 0; i--) {
      const x = i * barWidth;
      const amplitude = waveformData[i] * (canvas.height * 0.8);
      ctx.lineTo(x, middle + amplitude / 2);
    }
    
    ctx.closePath();
    ctx.strokeStyle = '#3b82f6'; // 蓝色
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // 填充已播放部分的波形
    if (playheadX > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, playheadX, canvas.height);
      ctx.clip();
      
      ctx.beginPath();
      waveformData.forEach((value, index) => {
        const x = index * barWidth;
        const amplitude = value * (canvas.height * 0.8);
        
        if (index === 0) {
          ctx.moveTo(x, middle - amplitude / 2);
        } else {
          ctx.lineTo(x, middle - amplitude / 2);
        }
      });
      
      // 画底部波形线
      for (let i = waveformData.length - 1; i >= 0; i--) {
        const x = i * barWidth;
        const amplitude = waveformData[i] * (canvas.height * 0.8);
        ctx.lineTo(x, middle + amplitude / 2);
      }
      
      ctx.closePath();
      ctx.fillStyle = '#1d4ed8'; // 深蓝色填充
      ctx.fill();
      ctx.restore();
    }
    
    // 绘制播放位置指示器
    ctx.fillStyle = '#ef4444'; // 红色
    ctx.beginPath();
    ctx.arc(playheadX, middle, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // 绘制书签
    bookmarks.forEach(bookmark => {
      const bookmarkX = (bookmark.time / duration) * canvas.width;
      
      // 绘制书签标记
      ctx.fillStyle = '#10b981'; // 绿色
      ctx.beginPath();
      ctx.moveTo(bookmarkX, 0);
      ctx.lineTo(bookmarkX - 8, 0);
      ctx.lineTo(bookmarkX, 10);
      ctx.lineTo(bookmarkX + 8, 0);
      ctx.closePath();
      ctx.fill();
      
      // 绘制书签线
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(bookmarkX, 0);
      ctx.lineTo(bookmarkX, canvas.height);
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }, [waveformData, currentTime, duration, bookmarks, loopRegion]);
  
  // 处理鼠标事件 - 用于跳转播放位置和设置AB循环
  const handleMouseDown = (e) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = (x / rect.width) * 100;
    
    // 如果按下Alt键，开始设置AB循环
    if (e.altKey) {
      setIsSettingLoop(true);
      setLoopStart(percent);
    } else {
      // 否则，跳转到点击位置
      setIsDragging(true);
      onSeek((percent / 100) * duration);
    }
  };
  
  const handleMouseMove = (e) => {
    if (!containerRef.current || (!isDragging && !isSettingLoop)) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = (x / rect.width) * 100;
    
    if (isDragging) {
      // 拖动模式 - 更新播放位置
      onSeek((percent / 100) * duration);
    } else if (isSettingLoop && loopStart !== null) {
      // AB循环设置模式 - 实时更新循环区域
      const start = Math.min(loopStart, percent);
      const end = Math.max(loopStart, percent);
      onLoopRegionUpdate({ start, end });
    }
  };
  
  const handleMouseUp = (e) => {
    if (!containerRef.current) return;
    
    if (isSettingLoop && loopStart !== null) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = (x / rect.width) * 100;
      
      // 完成AB循环设置
      const start = Math.min(loopStart, percent);
      const end = Math.max(loopStart, percent);
      onLoopRegionUpdate({ start, end });
      
      // 重置状态
      setIsSettingLoop(false);
      setLoopStart(null);
    }
    
    setIsDragging(false);
  };
  
  // 双击添加书签
  const handleDoubleClick = (e) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / rect.width) * duration;
    
    onBookmarkAdd(time);
  };
  
  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-24 bg-gray-100 rounded-lg cursor-pointer select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      <canvas ref={canvasRef} className="w-full h-full" />
      
      {/* 辅助提示 */}
      <div className="absolute bottom-1 right-1 text-xs text-gray-500">
        双击添加书签 | Alt+拖动设置AB循环
      </div>
    </div>
  );
};

export default WaveformVisualizer;