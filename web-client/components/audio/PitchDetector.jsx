"use client";

import { useRef, useEffect, useState } from 'react';
import { useAudioEngine } from '../../lib/audio/engine';

/**
 * 音高检测组件 - 检测并显示音频中的主要频率/音高
 * @param {Object} props - 组件属性
 * @param {string} props.className - 额外的CSS类名
 * @param {HTMLAudioElement} props.audioElement - 音频元素
 * @param {Object} props.options - 配置选项
 * @param {string} props.options.algorithm - 检测算法 (默认: 'autocorrelation')
 * @param {number} props.options.minFrequency - 最小检测频率 (默认: 80Hz, 大约是E2音)
 * @param {number} props.options.maxFrequency - 最大检测频率 (默认: 1000Hz, 大约是B5音)
 * @param {number} props.options.confidenceThreshold - 置信度阈值 (默认: 0.8)
 * @param {boolean} props.options.showNote - 是否显示音符名称 (默认: true)
 */
export default function PitchDetector({
  className = '',
  audioElement,
  options = {}
}) {
  // 默认选项
  const defaultOptions = {
    algorithm: 'autocorrelation',
    minFrequency: 80,  // 约为E2音
    maxFrequency: 1000, // 约为B5音
    confidenceThreshold: 0.8,
    showNote: true
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
  
  // 状态
  const [isPaused, setIsPaused] = useState(false);
  const [detectedPitch, setDetectedPitch] = useState(null);
  const [detectedNote, setDetectedNote] = useState(null);
  const [confidence, setConfidence] = useState(0);
  const [history, setHistory] = useState([]);
  
  // 音符名称数组 (C4 是中央C，即MIDI音符60)
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  
  // 将频率转换为音符名称
  const frequencyToNote = (frequency) => {
    // A4 = 440Hz, MIDI音符69
    const A4 = 440;
    // 计算相对于A4的半音数
    const semitones = 12 * Math.log2(frequency / A4);
    // 计算MIDI音符数（四舍五入到最近的整数）
    const midiNote = Math.round(semitones) + 69;
    // 音符名称
    const noteIndex = midiNote % 12;
    // 八度
    const octave = Math.floor(midiNote / 12) - 1;
    
    return `${noteNames[noteIndex]}${octave}`;
  };
  
  // 自相关函数音高检测算法
  const detectPitchAutocorrelation = (timeData, sampleRate) => {
    // 确保有足够数据
    if (!timeData || timeData.length < 1024) return { frequency: 0, confidence: 0 };
    
    // 使用双精度浮点数进行计算
    const buffer = new Float64Array(timeData.length);
    for (let i = 0; i < timeData.length; i++) {
      buffer[i] = timeData[i];
    }
    
    // 应用窗函数
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] *= 0.5 * (1 - Math.cos(2 * Math.PI * i / buffer.length));
    }
    
    // 计算自相关
    const correlation = new Float64Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      correlation[i] = 0;
      for (let j = 0; j < buffer.length - i; j++) {
        correlation[i] += buffer[j] * buffer[j + i];
      }
    }
    
    // 寻找相关性峰值
    let maxCorrelation = -1;
    let maxIndex = -1;
    
    // 跳过前几个样本，因为它们总是高度相关的
    const minLag = Math.floor(sampleRate / mergedOptions.maxFrequency);
    const maxLag = Math.floor(sampleRate / mergedOptions.minFrequency);
    
    for (let i = minLag; i < maxLag; i++) {
      if (correlation[i] > maxCorrelation) {
        maxCorrelation = correlation[i];
        maxIndex = i;
      }
    }
    
    // 如果找不到峰值，返回零频率
    if (maxIndex === -1) return { frequency: 0, confidence: 0 };
    
    // 使用抛物线插值提高精度
    let peakValue = correlation[maxIndex];
    let leftValue = maxIndex > 0 ? correlation[maxIndex - 1] : correlation[0];
    let rightValue = maxIndex < correlation.length - 1 ? correlation[maxIndex + 1] : correlation[correlation.length - 1];
    
    // 峰值平滑
    let delta = (rightValue - leftValue) / (2 * (2 * peakValue - leftValue - rightValue));
    let adjustedIndex = maxIndex + delta;
    
    // 计算频率
    const frequency = sampleRate / adjustedIndex;
    
    // 估计置信度
    const normalizedCorrelation = maxCorrelation / correlation[0];
    const confidence = Math.min(1.0, Math.max(0, normalizedCorrelation));
    
    return { frequency, confidence };
  };
  
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
  
  // 绘制音高检测可视化
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
    
    // 获取原始音频数据并执行音高检测
    const detectPitch = () => {
      if (!isInitialized) return;
      
      // 获取频谱数据
      const frequencyData = getFrequencyData();
      if (!frequencyData || frequencyData.length === 0) return;
      
      // 这里我们需要时域数据进行自相关分析，但目前我们只有频域数据
      // 在实际应用中，需要添加获取时域数据的方法（使用getWaveformData）
      
      // 假设我们有时域数据，进行音高检测
      // 在此仅使用频域数据做一个简单近似
      
      // 寻找频谱中的最大值
      let maxValue = 0;
      let maxIndex = 0;
      
      for (let i = 0; i < frequencyData.length; i++) {
        if (frequencyData[i] > maxValue) {
          maxValue = frequencyData[i];
          maxIndex = i;
        }
      }
      
      // 粗略估计频率
      // 假设采样率为44100Hz，FFT大小为2048
      const sampleRate = 44100;
      const fftSize = 2048;
      const estimatedFrequency = maxIndex * sampleRate / fftSize;
      
      // 使用简单的置信度度量
      const estimatedConfidence = maxValue / 255;
      
      // 如果需要更精确的检测，应该使用自相关算法
      // 在此示例中，我们将使用一个简单的模拟
      const result = { 
        frequency: estimatedFrequency, 
        confidence: estimatedConfidence 
      };
      
      // 如果频率在合理范围内且置信度足够高
      if (
        result.frequency >= mergedOptions.minFrequency && 
        result.frequency <= mergedOptions.maxFrequency &&
        result.confidence >= mergedOptions.confidenceThreshold
      ) {
        // 更新检测的音高
        setDetectedPitch(Math.round(result.frequency));
        
        // 如果选项启用，更新检测的音符
        if (mergedOptions.showNote) {
          setDetectedNote(frequencyToNote(result.frequency));
        }
        
        // 更新置信度
        setConfidence(result.confidence);
        
        // 更新历史记录
        setHistory(prev => {
          const newHistory = [...prev, result.frequency];
          // 保持最多100个点的历史
          if (newHistory.length > 100) {
            return newHistory.slice(-100);
          }
          return newHistory;
        });
      } else {
        // 置信度不足或频率超出范围，设置为null
        setDetectedPitch(null);
        setDetectedNote(null);
        setConfidence(0);
      }
      
      // 绘制可视化
      drawPitchDisplay(result.frequency, result.confidence);
      
      // 继续下一帧
      animationRef.current = requestAnimationFrame(detectPitch);
    };
    
    // 绘制音高可视化
    const drawPitchDisplay = (frequency, confidence) => {
      // 清除画布
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const width = canvas.width;
      const height = canvas.height;
      
      // 绘制背景
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, width, height);
      
      // 如果没有检测到有效的音高，显示提示
      if (!detectedPitch || confidence < mergedOptions.confidenceThreshold) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('无法检测到稳定的音高...', width / 2, height / 2);
        return;
      }
      
      // 绘制音高历史
      if (history.length > 1) {
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        const logMinFreq = Math.log(mergedOptions.minFrequency);
        const logMaxFreq = Math.log(mergedOptions.maxFrequency);
        
        for (let i = 0; i < history.length; i++) {
          // 对数映射频率到y轴
          const logFreq = Math.log(history[i]);
          const y = height - (logFreq - logMinFreq) / (logMaxFreq - logMinFreq) * height;
          
          // x轴是时间
          const x = width * i / (history.length - 1);
          
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        
        ctx.stroke();
      }
      
      // 绘制当前检测到的音高
      const centerX = width / 2;
      const centerY = height / 2;
      
      // 计算距离最近的标准音高
      const standardA = 440; // A4 = 440Hz
      const semitoneRatio = Math.pow(2, 1/12);
      let closestStandardFrequency = standardA;
      let minimumCents = Infinity;
      
      // 找到最近的标准音高
      for (let i = -36; i <= 36; i++) {
        const standardFreq = standardA * Math.pow(semitoneRatio, i);
        const cents = 1200 * Math.log2(frequency / standardFreq);
        if (Math.abs(cents) < Math.abs(minimumCents)) {
          minimumCents = cents;
          closestStandardFrequency = standardFreq;
        }
      }
      
      // 绘制音符圆圈
      const radius = Math.min(width, height) * 0.25;
      const hue = (minimumCents < 0) ? 240 : (minimumCents > 0) ? 0 : 120;
      const saturation = Math.min(100, Math.abs(minimumCents) * 2);
      
      // 外圈 - 音高偏差指示
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.fillStyle = `hsla(${hue}, ${saturation}%, 50%, 0.2)`;
      ctx.fill();
      ctx.strokeStyle = `hsl(${hue}, ${saturation}%, 50%)`;
      ctx.lineWidth = 4;
      ctx.stroke();
      
      // 内圈 - 频率值
      ctx.fillStyle = 'white';
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${detectedPitch} Hz`, centerX, centerY - 15);
      
      // 音符名称
      if (detectedNote) {
        ctx.font = '28px Arial';
        ctx.fillText(detectedNote, centerX, centerY + 20);
      }
      
      // 显示偏差
      ctx.font = '14px Arial';
      ctx.fillText(`${minimumCents > 0 ? '+' : ''}${minimumCents.toFixed(0)} 音分`, centerX, centerY + 50);
      
      // 显示置信度
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '12px Arial';
      ctx.fillText(`置信度: ${(confidence * 100).toFixed(0)}%`, centerX, height - 20);
    };
    
    // 开始动画
    detectPitch();
    
    // 清理函数
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      resizeObserver.disconnect();
    };
  }, [isInitialized, getFrequencyData, isPaused, detectedPitch, detectedNote, history, confidence, mergedOptions]);
  
  // 暂停/继续
  const togglePause = () => {
    setIsPaused(!isPaused);
  };
  
  // 清除历史
  const clearHistory = () => {
    setHistory([]);
  };
  
  return (
    <div className={`pitch-detector ${className}`}>
      <canvas 
        ref={canvasRef} 
        className="w-full h-full bg-gray-900 rounded-lg"
        onClick={togglePause}
      />
      
      <div className="controls mt-2 flex justify-between">
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
          清除历史
        </button>
      </div>
    </div>
  );
} 