"use client";

import { useRef, useEffect, useState } from 'react';
import { useAudioEngine } from '../../lib/audio/engine';

/**
 * 频谱分析器组件 - 显示音频的频率分布
 * @param {Object} props - 组件属性
 * @param {string} props.className - 额外的CSS类名
 * @param {HTMLAudioElement} props.audioElement - 音频元素
 * @param {Object} props.options - 配置选项
 * @param {number} props.options.fftSize - FFT大小 (默认: 2048, 必须是2的幂)
 * @param {string} props.options.gradient - 颜色渐变 (默认: 'rainbow')
 * @param {boolean} props.options.showPeaks - 是否显示峰值 (默认: true)
 * @param {boolean} props.options.showFrequencyLabels - 是否显示频率标签 (默认: true)
 * @param {boolean} props.options.log - 是否使用对数刻度 (默认: true)
 * @param {number} props.options.refreshRate - 刷新率 (默认: 30)
 */
export default function SpectrumAnalyzer({
  className = '',
  audioElement,
  options = {}
}) {
  // 默认选项
  const defaultOptions = {
    fftSize: 2048,
    gradient: 'rainbow',
    showPeaks: true,
    showFrequencyLabels: true,
    log: true,
    refreshRate: 30
  };
  
  // 合并选项
  const mergedOptions = { ...defaultOptions, ...options };
  
  // 创建引用
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  
  // 使用音频引擎获取频谱数据
  const {
    initialize,
    isInitialized,
    connectSource,
    getFrequencyData
  } = useAudioEngine();
  
  // 频谱状态
  const [isPaused, setIsPaused] = useState(false);
  const [peakData, setPeakData] = useState([]); // 峰值数据
  const [frequencyRange, setFrequencyRange] = useState({ min: 20, max: 20000 }); // 可见频率范围
  
  // 初始化音频引擎并连接音频源
  useEffect(() => {
    if (!audioElement) return;
    
    const initAudio = async () => {
      const success = await initialize();
      if (success) {
        connectSource(audioElement);
      }
    };
    
    initAudio();
    
    return () => {
      // 清理动画帧
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [audioElement, initialize, connectSource]);
  
  // 绘制频谱
  useEffect(() => {
    if (!canvasRef.current || !isInitialized || isPaused) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // 确保画布尺寸与元素尺寸匹配
    const updateCanvasSize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    
    // 初始设置画布大小
    updateCanvasSize();
    
    // 处理窗口大小变化
    const resizeObserver = new ResizeObserver(() => {
      updateCanvasSize();
    });
    
    resizeObserver.observe(canvas);
    
    // 创建渐变色
    const createGradient = () => {
      const height = canvas.height;
      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      
      if (mergedOptions.gradient === 'rainbow') {
        gradient.addColorStop(0.0, '#0000ff'); // 蓝色
        gradient.addColorStop(0.15, '#00ffff'); // 青色
        gradient.addColorStop(0.3, '#00ff00'); // 绿色
        gradient.addColorStop(0.5, '#ffff00'); // 黄色
        gradient.addColorStop(0.75, '#ff7f00'); // 橙色
        gradient.addColorStop(1.0, '#ff0000'); // 红色
      } else if (mergedOptions.gradient === 'simple') {
        gradient.addColorStop(0.0, '#4080ff'); // 蓝色
        gradient.addColorStop(1.0, '#ff4040'); // 红色
      } else {
        // 默认蓝色渐变
        gradient.addColorStop(0.0, '#0a4db3');
        gradient.addColorStop(1.0, '#3b82f6');
      }
      
      return gradient;
    };
    
    // 将线性频率转换为对数频率
    const linToLog = (value, min, max) => {
      const minLog = Math.log(min);
      const maxLog = Math.log(max);
      return Math.exp(minLog + (value * (maxLog - minLog)));
    };
    
    // 绘制频谱函数
    const drawSpectrum = () => {
      if (!isInitialized) return;
      
      // 获取频谱数据
      const frequencyData = getFrequencyData();
      if (!frequencyData || frequencyData.length === 0) return;
      
      // 清除画布
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const width = canvas.width;
      const height = canvas.height;
      
      // 设置绘制样式
      ctx.fillStyle = createGradient();
      
      // 计算绘制属性
      const binCount = frequencyData.length;
      const barWidth = width / binCount * 2.5; // 增加条形宽度以便观察
      const peakValues = [];
      
      // 根据选项决定是否使用对数刻度
      const useLogScale = mergedOptions.log;
      const minFreq = frequencyRange.min;
      const maxFreq = frequencyRange.max;
      
      // 绘制频谱条
      for (let i = 0; i < binCount; i++) {
        // 通过索引计算频率
        const nyquist = 24000; // 人类听觉极限
        let frequency = i * nyquist / binCount;
        
        // 跳过不在可见范围内的频率
        if (frequency < minFreq || frequency > maxFreq) continue;
        
        // 计算x位置
        let xPos;
        if (useLogScale) {
          // 对数刻度
          const logIndex = Math.log(frequency / minFreq) / Math.log(maxFreq / minFreq);
          xPos = logIndex * width;
        } else {
          // 线性刻度
          xPos = (frequency - minFreq) / (maxFreq - minFreq) * width;
        }
        
        // 频谱幅度值（0-255）
        const value = frequencyData[i];
        
        // 归一化为0-1
        const normalizedValue = value / 255;
        
        // 计算条形高度，添加一点非线性缩放以增强视觉效果
        const barHeight = height * Math.pow(normalizedValue, 1.2);
        
        // 存储峰值
        peakValues.push({ x: xPos, value: normalizedValue });
        
        // 绘制频谱条
        ctx.fillRect(xPos, height - barHeight, barWidth, barHeight);
      }
      
      // 如果显示峰值
      if (mergedOptions.showPeaks) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        
        // 绘制峰值线
        for (let i = 0; i < peakValues.length; i++) {
          const peak = peakValues[i];
          if (i === 0) {
            ctx.moveTo(peak.x, height - (peak.value * height));
          } else {
            ctx.lineTo(peak.x, height - (peak.value * height));
          }
        }
        
        ctx.stroke();
      }
      
      // 如果显示频率标签
      if (mergedOptions.showFrequencyLabels) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        
        // 定义要显示的频率标签
        const freqLabels = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
        
        for (const freq of freqLabels) {
          if (freq < minFreq || freq > maxFreq) continue;
          
          // 计算x位置
          let xPos;
          if (useLogScale) {
            const logIndex = Math.log(freq / minFreq) / Math.log(maxFreq / minFreq);
            xPos = logIndex * width;
          } else {
            xPos = (freq - minFreq) / (maxFreq - minFreq) * width;
          }
          
          // 绘制频率标签
          const label = freq >= 1000 ? `${freq/1000}k` : `${freq}`;
          ctx.fillText(label, xPos, height - 5);
          
          // 绘制网格线
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.beginPath();
          ctx.moveTo(xPos, height - 15);
          ctx.lineTo(xPos, 0);
          ctx.stroke();
        }
      }
      
      // 存储峰值数据以便外部访问
      setPeakData(peakValues);
      
      // 请求下一帧动画
      animationRef.current = requestAnimationFrame(drawSpectrum);
    };
    
    // 开始动画
    drawSpectrum();
    
    // 清理函数
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      resizeObserver.disconnect();
    };
  }, [isInitialized, getFrequencyData, isPaused, mergedOptions, frequencyRange]);
  
  // 暂停/继续频谱显示
  const togglePause = () => {
    setIsPaused(!isPaused);
  };
  
  // 调整可见频率范围
  const setFrequencyRangeHandler = (min, max) => {
    setFrequencyRange({ min, max });
  };
  
  return (
    <div className={`spectrum-analyzer ${className}`}>
      <canvas 
        ref={canvasRef} 
        className="w-full h-full bg-gray-900 rounded-lg"
        onClick={togglePause}
      />
      
      {/* 控制面板 - 可以根据需求添加更多控制 */}
      <div className="controls mt-2 flex justify-between">
        <button 
          className="px-2 py-1 bg-blue-600 text-white text-xs rounded"
          onClick={togglePause}
        >
          {isPaused ? '继续' : '暂停'}
        </button>
        
        <div className="flex space-x-2">
          <button 
            className="px-2 py-1 bg-gray-600 text-white text-xs rounded"
            onClick={() => setFrequencyRangeHandler(20, 20000)}
          >
            全频
          </button>
          <button 
            className="px-2 py-1 bg-gray-600 text-white text-xs rounded"
            onClick={() => setFrequencyRangeHandler(20, 1000)}
          >
            低频
          </button>
          <button 
            className="px-2 py-1 bg-gray-600 text-white text-xs rounded"
            onClick={() => setFrequencyRangeHandler(1000, 8000)}
          >
            中频
          </button>
          <button 
            className="px-2 py-1 bg-gray-600 text-white text-xs rounded"
            onClick={() => setFrequencyRangeHandler(8000, 20000)}
          >
            高频
          </button>
        </div>
      </div>
    </div>
  );
} 