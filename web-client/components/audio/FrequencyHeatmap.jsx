"use client";

import { useRef, useEffect, useState } from 'react';
import { useAudioEngine } from '../../lib/audio/engine';

/**
 * 频率分布热图组件 - 显示频率随时间的变化
 * @param {Object} props - 组件属性
 * @param {string} props.className - 额外的CSS类名
 * @param {HTMLAudioElement} props.audioElement - 音频元素
 * @param {Object} props.options - 配置选项
 * @param {boolean} props.options.log - 是否使用对数刻度 (默认: true)
 * @param {string} props.options.colorMap - 颜色映射 (默认: 'magma')
 * @param {number} props.options.historyLength - 历史记录长度 (默认: 200)
 * @param {number} props.options.refreshRate - 刷新率 (ms) (默认: 50)
 */
export default function FrequencyHeatmap({
  className = '',
  audioElement,
  options = {}
}) {
  // 默认选项
  const defaultOptions = {
    log: true,
    colorMap: 'magma',
    historyLength: 200,
    refreshRate: 50
  };
  
  // 合并选项
  const mergedOptions = { ...defaultOptions, ...options };
  
  // 创建引用
  const canvasRef = useRef(null);
  const historyRef = useRef([]);
  const animationIntervalRef = useRef(null);
  
  // 使用音频引擎获取频谱数据
  const {
    initialize,
    isInitialized,
    connectSource,
    getFrequencyData
  } = useAudioEngine();
  
  // 热图状态
  const [isPaused, setIsPaused] = useState(false);
  const [colorMapOption, setColorMapOption] = useState(mergedOptions.colorMap);
  const [frequencyRange, setFrequencyRange] = useState({ min: 20, max: 20000 });
  
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
      // 清理定时器
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
      }
    };
  }, [audioElement, initialize, connectSource]);
  
  // 颜色映射函数
  const getColorByValue = (value, colorMap = 'magma') => {
    // 将值限制在0-1范围内
    value = Math.max(0, Math.min(1, value));
    
    // 不同的颜色映射
    if (colorMap === 'magma') {
      // Magma颜色映射（从黑色到黄色）
      const r = Math.min(255, Math.round(value * 255 * 1.5));
      const g = Math.round(value * 140 + (value > 0.7 ? (value - 0.7) * 300 : 0));
      const b = Math.round(value * 255 * (value < 0.5 ? 0.5 : 0.1));
      return `rgb(${r}, ${g}, ${b})`;
    } else if (colorMap === 'viridis') {
      // Viridis颜色映射（从深蓝色到黄色）
      const r = Math.round(value < 0.5 ? value * 100 : 50 + value * 205);
      const g = Math.round(value * 255);
      const b = Math.round(value < 0.7 ? 150 - value * 50 : 120 - value * 120);
      return `rgb(${r}, ${g}, ${b})`;
    } else if (colorMap === 'inferno') {
      // Inferno颜色映射（从黑色到黄色）
      const r = Math.round(value < 0.5 ? value * 150 : 75 + value * 180);
      const g = Math.round(value < 0.5 ? value * 30 : value * 180);
      const b = Math.round(value < 0.7 ? value * 100 : value * 60);
      return `rgb(${r}, ${g}, ${b})`;
    } else if (colorMap === 'plasma') {
      // Plasma颜色映射（从紫色到黄色）
      const r = Math.round(value * 255);
      const g = Math.round(value < 0.5 ? value * 100 : value * 255);
      const b = Math.round(value < 0.5 ? 200 - value * 200 : 100 - value * 100);
      return `rgb(${r}, ${g}, ${b})`;
    } else if (colorMap === 'hot') {
      // 热力图（黑到红到黄到白）
      const r = Math.min(255, Math.round(value * 255 * 3));
      const g = value > 0.33 ? Math.min(255, Math.round((value - 0.33) * 255 * 3)) : 0;
      const b = value > 0.67 ? Math.min(255, Math.round((value - 0.67) * 255 * 3)) : 0;
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      // 默认灰度
      const grey = Math.round(value * 255);
      return `rgb(${grey}, ${grey}, ${grey})`;
    }
  };
  
  // 更新热图
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
      // 重绘整个历史记录
      drawHeatmap();
    });
    
    resizeObserver.observe(canvas);
    
    // 缩减频谱数据以适合画布高度
    const processFrequencyData = (frequencyData) => {
      if (!frequencyData || frequencyData.length === 0) return new Uint8Array(0);
      
      const binCount = frequencyData.length;
      const targetBins = canvas.height;
      const processedData = new Uint8Array(targetBins);
      
      const nyquist = 24000; // 人类听觉极限
      const minFreq = frequencyRange.min;
      const maxFreq = frequencyRange.max;
      const useLogScale = mergedOptions.log;
      
      // 填充处理后的数据
      for (let i = 0; i < targetBins; i++) {
        // 确定此bin对应的频率
        let frequency;
        if (useLogScale) {
          // 对数刻度
          const minLog = Math.log(minFreq);
          const maxLog = Math.log(maxFreq);
          const logStep = (maxLog - minLog) / targetBins;
          frequency = Math.exp(minLog + (targetBins - i - 1) * logStep);
        } else {
          // 线性刻度
          const freqStep = (maxFreq - minFreq) / targetBins;
          frequency = minFreq + (targetBins - i - 1) * freqStep;
        }
        
        // 确定原始频谱中对应的索引
        const binIndex = Math.round(frequency * binCount / nyquist);
        
        // 确保索引有效
        if (binIndex >= 0 && binIndex < binCount) {
          processedData[i] = frequencyData[binIndex];
        }
      }
      
      return processedData;
    };
    
    // 绘制热图
    const drawHeatmap = () => {
      if (!ctx) return;
      
      // 清除画布
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const width = canvas.width;
      const height = canvas.height;
      
      // 每条历史记录的宽度
      const columnWidth = Math.max(1, width / mergedOptions.historyLength);
      
      // 绘制历史记录
      for (let col = 0; col < historyRef.current.length; col++) {
        const data = historyRef.current[col];
        const xPos = col * columnWidth;
        
        for (let row = 0; row < data.length; row++) {
          // 归一化频率值
          const normalizedValue = data[row] / 255;
          const color = getColorByValue(normalizedValue, colorMapOption);
          
          ctx.fillStyle = color;
          ctx.fillRect(xPos, row, columnWidth, 1);
        }
      }
      
      // 绘制频率标签
      drawFrequencyLabels();
    };
    
    // 绘制频率标签
    const drawFrequencyLabels = () => {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '10px Arial';
      ctx.textAlign = 'left';
      
      const height = canvas.height;
      const minFreq = frequencyRange.min;
      const maxFreq = frequencyRange.max;
      const useLogScale = mergedOptions.log;
      
      // 定义要显示的频率标签
      const freqLabels = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
      
      for (const freq of freqLabels) {
        if (freq < minFreq || freq > maxFreq) continue;
        
        // 计算y位置
        let yPos;
        if (useLogScale) {
          // 对数刻度
          const logFreq = Math.log(freq);
          const logMin = Math.log(minFreq);
          const logMax = Math.log(maxFreq);
          const normalizedPos = (logFreq - logMin) / (logMax - logMin);
          yPos = height - normalizedPos * height;
        } else {
          // 线性刻度
          const normalizedPos = (freq - minFreq) / (maxFreq - minFreq);
          yPos = height - normalizedPos * height;
        }
        
        // 绘制频率标签
        const label = freq >= 1000 ? `${freq/1000}k` : `${freq}`;
        ctx.fillText(label, 5, yPos + 3);
        
        // 绘制水平线
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.moveTo(0, yPos);
        ctx.lineTo(canvas.width, yPos);
        ctx.stroke();
      }
    };
    
    // 更新频谱数据处理函数
    const updateHeatmap = () => {
      if (!isInitialized) return;
      
      // 获取频谱数据
      const frequencyData = getFrequencyData();
      if (!frequencyData || frequencyData.length === 0) return;
      
      // 处理频谱数据
      const processedData = processFrequencyData(frequencyData);
      
      // 将新数据添加到历史记录
      historyRef.current.push(processedData);
      
      // 限制历史记录长度
      if (historyRef.current.length > mergedOptions.historyLength) {
        historyRef.current.shift();
      }
      
      // 绘制热图
      drawHeatmap();
    };
    
    // 定期更新热图
    animationIntervalRef.current = setInterval(updateHeatmap, mergedOptions.refreshRate);
    
    // 清理函数
    return () => {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
      }
      resizeObserver.disconnect();
    };
  }, [isInitialized, getFrequencyData, isPaused, colorMapOption, frequencyRange, mergedOptions]);
  
  // 暂停/继续热图显示
  const togglePause = () => {
    setIsPaused(!isPaused);
  };
  
  // 清除历史记录
  const clearHistory = () => {
    historyRef.current = [];
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };
  
  // 更改颜色映射
  const changeColorMap = (map) => {
    setColorMapOption(map);
  };
  
  // 调整可见频率范围
  const setFrequencyRangeHandler = (min, max) => {
    setFrequencyRange({ min, max });
    // 清除历史记录以便重新开始
    clearHistory();
  };
  
  return (
    <div className={`frequency-heatmap ${className}`}>
      <canvas 
        ref={canvasRef} 
        className="w-full h-full bg-gray-900 rounded-lg"
        onClick={togglePause}
      />
      
      {/* 控制面板 */}
      <div className="controls mt-2 flex flex-wrap justify-between">
        <div className="flex space-x-1">
          <button 
            className="px-2 py-1 bg-blue-600 text-white text-xs rounded"
            onClick={togglePause}
          >
            {isPaused ? '继续' : '暂停'}
          </button>
          <button 
            className="px-2 py-1 bg-red-600 text-white text-xs rounded"
            onClick={clearHistory}
          >
            清除
          </button>
        </div>
        
        <div className="flex space-x-1">
          <button 
            className={`px-2 py-1 text-xs rounded ${colorMapOption === 'magma' ? 'bg-blue-700 text-white' : 'bg-gray-600 text-white'}`}
            onClick={() => changeColorMap('magma')}
          >
            Magma
          </button>
          <button 
            className={`px-2 py-1 text-xs rounded ${colorMapOption === 'viridis' ? 'bg-blue-700 text-white' : 'bg-gray-600 text-white'}`}
            onClick={() => changeColorMap('viridis')}
          >
            Viridis
          </button>
          <button 
            className={`px-2 py-1 text-xs rounded ${colorMapOption === 'hot' ? 'bg-blue-700 text-white' : 'bg-gray-600 text-white'}`}
            onClick={() => changeColorMap('hot')}
          >
            热力
          </button>
        </div>
        
        <div className="flex space-x-1 mt-1 w-full justify-between">
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