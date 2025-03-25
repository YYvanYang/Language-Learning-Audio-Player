"use client";

import { useRef, useEffect, useState } from 'react';
import { compressorPresets } from '../../lib/audio/compressor';

/**
 * 压缩器可视化组件 - 显示压缩器参数和效果
 * @param {Object} props - 组件属性
 * @param {string} props.className - 额外的CSS类名
 * @param {Object} props.compressor - 压缩器对象引用
 * @param {Object} props.options - 配置选项
 * @param {boolean} props.options.showParams - 是否显示参数 (默认: true)
 * @param {boolean} props.options.showReduction - 是否显示增益减少量 (默认: true)
 * @param {boolean} props.options.showPresets - 是否显示预设选择 (默认: true)
 * @param {string} props.options.meterType - 计量表类型 ('vu', 'peak', 'rms') (默认: 'vu')
 * @param {number} props.options.updateInterval - 更新间隔 (ms) (默认: 30)
 */
export default function CompressionMeter({
  className = '',
  compressor,
  options = {}
}) {
  // 默认选项
  const defaultOptions = {
    showParams: true,
    showReduction: true,
    showPresets: true,
    meterType: 'vu',
    updateInterval: 30
  };
  
  // 合并选项
  const mergedOptions = { ...defaultOptions, ...options };
  
  // 创建引用
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const multiband = useRef(compressor && compressor.compressors);
  
  // 状态
  const [reductionValue, setReductionValue] = useState(0);
  const [peakReduction, setPeakReduction] = useState(0);
  const [selectedPreset, setSelectedPreset] = useState('speech');
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentSettings, setCurrentSettings] = useState(null);
  
  // 监听压缩器变化
  useEffect(() => {
    multiband.current = compressor && compressor.compressors;
    
    if (compressor && compressor.getCurrentSettings) {
      setCurrentSettings(compressor.getCurrentSettings());
    }
  }, [compressor]);
  
  // 绘制压缩器仪表
  useEffect(() => {
    if (!canvasRef.current || !compressor) return;
    
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
    
    // 获取压缩量并更新状态
    const updateReduction = () => {
      let reduction = 0;
      
      if (multiband.current) {
        // 多波段压缩器
        const reductions = compressor.getReductions();
        // 使用中频段的压缩量，因为它通常包含大部分语音内容
        reduction = reductions.mid;
      } else if (compressor.getReduction) {
        // 单波段压缩器
        reduction = compressor.getReduction();
      }
      
      // 更新状态
      setReductionValue(reduction);
      
      // 更新峰值
      if (reduction < peakReduction) {
        setPeakReduction(Math.min(0, Math.max(-30, reduction)));
      } else {
        // 缓慢降低峰值
        setPeakReduction(prev => {
          const decay = -0.1; // 每帧衰减0.1dB
          return Math.min(0, prev - decay);
        });
      }
      
      // 绘制仪表
      drawMeter(reduction);
      
      // 继续下一帧
      animationRef.current = requestAnimationFrame(updateReduction);
    };
    
    // 绘制VU风格的压缩计量表
    const drawMeter = (reduction) => {
      // 清除画布
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const width = canvas.width;
      const height = canvas.height;
      
      // 背景
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, width, height);
      
      // 定义仪表的尺寸和位置
      const meterWidth = width * 0.9;
      const meterHeight = height * 0.4;
      const meterX = width * 0.05;
      const meterY = height * 0.3;
      
      // 绘制仪表背景
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(meterX, meterY, meterWidth, meterHeight);
      
      // 绘制仪表刻度
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      
      // 刻度文本
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      
      // 绘制刻度
      for (let i = 0; i <= 30; i += 5) {
        const x = meterX + meterWidth * (1 - i / 30);
        
        // 刻度线
        ctx.beginPath();
        ctx.moveTo(x, meterY + meterHeight);
        ctx.lineTo(x, meterY + meterHeight + 5);
        ctx.stroke();
        
        // 文本
        ctx.fillText(`-${i}dB`, x, meterY + meterHeight + 15);
      }
      
      // 计算减少量对应的位置
      // 压缩器reduction是负值，较小的负值表示更大的压缩
      const reductionAbs = Math.min(30, Math.abs(reduction)); // 限制在0-30dB范围
      const meterPosition = meterWidth * (1 - reductionAbs / 30);
      
      // 绘制当前压缩量条形
      const gradient = ctx.createLinearGradient(meterX, 0, meterX + meterWidth, 0);
      gradient.addColorStop(0, '#ef4444'); // 右侧红色（高压缩）
      gradient.addColorStop(0.6, '#f59e0b'); // 橙色
      gradient.addColorStop(0.8, '#10b981'); // 绿色（低压缩）
      gradient.addColorStop(1.0, '#10b981'); // 绿色
      
      ctx.fillStyle = gradient;
      ctx.fillRect(meterX, meterY, meterPosition, meterHeight);
      
      // 绘制指针
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(meterX + meterPosition, meterY - 5);
      ctx.lineTo(meterX + meterPosition, meterY + meterHeight + 5);
      ctx.stroke();
      
      // 峰值指示器
      const peakPosition = meterWidth * (1 - Math.abs(peakReduction) / 30);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(meterX + peakPosition, meterY);
      ctx.lineTo(meterX + peakPosition, meterY + meterHeight);
      ctx.stroke();
      
      // 当前压缩量文字显示
      ctx.fillStyle = 'white';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${reduction.toFixed(1)} dB`, width / 2, meterY - 10);
      
      // 如果是多波段压缩器，显示各频段的压缩量
      if (multiband.current && mergedOptions.showReduction) {
        const reductions = compressor.getReductions();
        
        // 标题
        ctx.font = '12px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillText('多波段压缩', width / 2, height * 0.75 - 40);
        
        // 低频
        const lowY = height * 0.75 - 20;
        const lowReduction = Math.min(30, Math.abs(reductions.low));
        const lowWidth = meterWidth * (lowReduction / 30);
        
        ctx.fillStyle = '#3b82f6'; // 蓝色
        ctx.fillRect(meterX, lowY, lowWidth, 10);
        ctx.fillStyle = 'white';
        ctx.textAlign = 'left';
        ctx.fillText(`低频: ${reductions.low.toFixed(1)} dB`, meterX + meterWidth + 10, lowY + 8);
        
        // 中频
        const midY = lowY + 15;
        const midReduction = Math.min(30, Math.abs(reductions.mid));
        const midWidth = meterWidth * (midReduction / 30);
        
        ctx.fillStyle = '#10b981'; // 绿色
        ctx.fillRect(meterX, midY, midWidth, 10);
        ctx.fillStyle = 'white';
        ctx.fillText(`中频: ${reductions.mid.toFixed(1)} dB`, meterX + meterWidth + 10, midY + 8);
        
        // 高频
        const highY = midY + 15;
        const highReduction = Math.min(30, Math.abs(reductions.high));
        const highWidth = meterWidth * (highReduction / 30);
        
        ctx.fillStyle = '#f59e0b'; // 橙色
        ctx.fillRect(meterX, highY, highWidth, 10);
        ctx.fillStyle = 'white';
        ctx.fillText(`高频: ${reductions.high.toFixed(1)} dB`, meterX + meterWidth + 10, highY + 8);
      }
    };
    
    // 开始动画
    updateReduction();
    
    // 清理函数
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      resizeObserver.disconnect();
    };
  }, [compressor, peakReduction, mergedOptions]);
  
  // 更新当前压缩器参数
  useEffect(() => {
    if (!compressor || !compressor.getCurrentSettings) return;
    
    const updateSettings = () => {
      setCurrentSettings(compressor.getCurrentSettings());
    };
    
    // 定期更新设置
    const interval = setInterval(updateSettings, 1000);
    
    // 初始更新
    updateSettings();
    
    return () => {
      clearInterval(interval);
    };
  }, [compressor]);
  
  // 切换预设
  const handlePresetChange = (preset) => {
    if (!compressor || !compressor.applyPreset) return;
    
    setSelectedPreset(preset);
    
    if (multiband.current) {
      // 多波段压缩器
      if (preset === 'speech') {
        compressor.applyVoiceEnhancement();
      } else {
        compressor.applyPreset('all', preset);
      }
    } else {
      // 单波段压缩器
      compressor.applyPreset(preset);
    }
  };
  
  // 切换展开/折叠
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };
  
  return (
    <div className={`compression-meter p-3 rounded-lg bg-gray-800 ${className}`}>
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-white text-lg font-medium">压缩器</h3>
        <button 
          className="text-blue-400 text-sm"
          onClick={toggleExpanded}
        >
          {isExpanded ? '收起' : '详情'}
        </button>
      </div>
      
      <canvas 
        ref={canvasRef} 
        className="w-full h-32 bg-gray-900 rounded-lg"
      />
      
      {/* 预设选择器 */}
      {mergedOptions.showPresets && (
        <div className="mt-3">
          <p className="text-gray-300 text-xs mb-1">压缩预设</p>
          <div className="flex flex-wrap gap-1">
            {Object.keys(compressorPresets).map(preset => (
              <button
                key={preset}
                className={`px-2 py-1 text-xs rounded ${
                  selectedPreset === preset 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 text-gray-300'
                }`}
                onClick={() => handlePresetChange(preset)}
              >
                {preset === 'speech' ? '语音' : 
                 preset === 'dialog' ? '对话' :
                 preset === 'gentle' ? '柔和' :
                 preset === 'strong' ? '强力' :
                 preset === 'music' ? '音乐' :
                 preset === 'default' ? '默认' :
                 preset === 'bypass' ? '禁用' : preset}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* 展开的参数详情 */}
      {isExpanded && currentSettings && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <p className="text-gray-300 text-xs mb-2">压缩器参数</p>
          
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-gray-400 text-xs">阈值</p>
              <p className="text-white text-sm">{currentSettings.threshold?.toFixed(1)} dB</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">比率</p>
              <p className="text-white text-sm">{currentSettings.ratio?.toFixed(1)}:1</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">拐点</p>
              <p className="text-white text-sm">{currentSettings.knee?.toFixed(1)} dB</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">增益</p>
              <p className="text-white text-sm">{currentSettings.gain?.toFixed(1)} dB</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">起音</p>
              <p className="text-white text-sm">{(currentSettings.attack * 1000)?.toFixed(1)} ms</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">释放</p>
              <p className="text-white text-sm">{(currentSettings.release * 1000)?.toFixed(1)} ms</p>
            </div>
          </div>
          
          {/* 预设描述 */}
          <div className="mt-3">
            <p className="text-gray-300 text-xs">当前预设：</p>
            <p className="text-white text-sm">{compressorPresets[selectedPreset]?.description || '自定义设置'}</p>
          </div>
        </div>
      )}
    </div>
  );
} 