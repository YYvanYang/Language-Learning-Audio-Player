"use client";

import React, { useState, useEffect } from 'react';
import { ProgressionMode, ProgressionPresets } from '../../lib/audio/SpeedProgressionController';

/**
 * 语速渐进式调整控制组件
 * 
 * @param {Object} props - 组件属性
 * @param {Object} props.progression - 渐进式调整控制器对象
 * @param {boolean} props.isPlaying - 当前是否正在播放
 * @param {number} props.currentTime - 当前播放时间（秒）
 * @param {Function} props.onFeedback - 学习反馈处理函数
 */
export default function SpeedProgressionControl({ 
  progression, 
  isPlaying = false,
  currentTime = 0,
  onFeedback = null
}) {
  // 状态
  const [progressInfo, setProgressInfo] = useState(() => progression?.getProgressInfo() || {});
  const [selectedPreset, setSelectedPreset] = useState('');
  const [customSettings, setCustomSettings] = useState({
    initialRate: 0.8,
    targetRate: 1.0,
    duration: 300,
    mode: ProgressionMode.LINEAR
  });
  const [showCustomSettings, setShowCustomSettings] = useState(false);

  // 获取格式化的时间
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 获取模式名称的中文显示
  const getModeDisplayName = (mode) => {
    switch(mode) {
      case ProgressionMode.LINEAR: return '线性';
      case ProgressionMode.STEP: return '阶梯式';
      case ProgressionMode.EXPONENTIAL: return '指数式';
      case ProgressionMode.LOGARITHMIC: return '对数式';
      case ProgressionMode.ADAPTIVE: return '自适应';
      default: return '线性';
    }
  };

  // 当前时间变化时更新进度信息
  useEffect(() => {
    if (progression && progressInfo.isActive) {
      progression.setCurrentTime(currentTime);
      updateProgressInfo();
    }
  }, [currentTime]);

  // 定期更新进度信息显示
  useEffect(() => {
    let intervalId;
    
    if (progression && progressInfo.isActive) {
      intervalId = setInterval(() => {
        updateProgressInfo();
      }, 1000);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [progressInfo.isActive]);

  // 更新进度信息
  const updateProgressInfo = () => {
    if (progression) {
      setProgressInfo(progression.getProgressInfo());
    }
  };

  // 处理开始/停止语速渐进
  const handleToggleProgression = () => {
    if (!progression) return;
    
    if (progressInfo.isActive) {
      progression.stop();
    } else {
      progression.start(currentTime);
    }
    
    updateProgressInfo();
  };

  // 处理重置
  const handleReset = () => {
    if (!progression) return;
    progression.reset();
    updateProgressInfo();
  };

  // 应用预设
  const handleApplyPreset = (presetName) => {
    if (!progression) return;
    
    setSelectedPreset(presetName);
    setShowCustomSettings(presetName === 'CUSTOM');
    
    if (presetName !== 'CUSTOM') {
      progression.applyPreset(presetName);
      updateProgressInfo();
    }
  };

  // 应用自定义设置
  const handleApplyCustomSettings = () => {
    if (!progression) return;
    
    progression.setConfig(customSettings);
    updateProgressInfo();
  };

  // 提供学习反馈
  const handleProvideFeedback = (level) => {
    if (!progression) return;
    
    let score;
    switch(level) {
      case 'easy': score = 1.0; break;
      case 'medium': score = 0.7; break;
      case 'hard': score = 0.4; break;
      case 'very-hard': score = 0.1; break;
      default: score = 0.5;
    }
    
    progression.provideFeedback(score);
    
    // 调用外部反馈处理函数
    if (onFeedback) {
      onFeedback(level, score);
    }
    
    updateProgressInfo();
  };

  // 渲染预设选择器
  const renderPresetSelector = () => {
    return (
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">选择语速模式</label>
        <select 
          className="w-full px-3 py-2 border rounded-md"
          value={selectedPreset}
          onChange={(e) => handleApplyPreset(e.target.value)}
        >
          <option value="">选择预设...</option>
          <option value="BEGINNER">初学者 (60%-80%)</option>
          <option value="INTERMEDIATE">中级 (80%-100%)</option>
          <option value="ADVANCED">高级 (100%-120%)</option>
          <option value="EXPERT">专家 (80%-150%, 阶梯式)</option>
          <option value="QUICK_ADAPT">快速适应 (70%-100%, 对数式)</option>
          <option value="INTENSIVE">强化训练 (80%-130%, 自适应)</option>
          <option value="CUSTOM">自定义设置</option>
        </select>
      </div>
    );
  };

  // 渲染自定义设置
  const renderCustomSettings = () => {
    if (!showCustomSettings) return null;
    
    return (
      <div className="bg-gray-50 p-3 rounded-md mb-4">
        <h3 className="text-sm font-medium mb-2">自定义设置</h3>
        
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="block text-xs text-gray-600">初始速度</label>
            <input 
              type="number" 
              min="0.5"
              max="2"
              step="0.1"
              className="w-full px-2 py-1 border rounded-md text-sm"
              value={customSettings.initialRate}
              onChange={(e) => setCustomSettings({
                ...customSettings,
                initialRate: parseFloat(e.target.value)
              })}
            />
          </div>
          
          <div>
            <label className="block text-xs text-gray-600">目标速度</label>
            <input 
              type="number" 
              min="0.5"
              max="2"
              step="0.1"
              className="w-full px-2 py-1 border rounded-md text-sm"
              value={customSettings.targetRate}
              onChange={(e) => setCustomSettings({
                ...customSettings,
                targetRate: parseFloat(e.target.value)
              })}
            />
          </div>
        </div>
        
        <div className="mb-2">
          <label className="block text-xs text-gray-600">持续时间（秒）</label>
          <input 
            type="number" 
            min="10"
            step="10"
            className="w-full px-2 py-1 border rounded-md text-sm"
            value={customSettings.duration}
            onChange={(e) => setCustomSettings({
              ...customSettings,
              duration: parseInt(e.target.value, 10)
            })}
          />
        </div>
        
        <div className="mb-2">
          <label className="block text-xs text-gray-600">调整模式</label>
          <select 
            className="w-full px-2 py-1 border rounded-md text-sm"
            value={customSettings.mode}
            onChange={(e) => setCustomSettings({
              ...customSettings,
              mode: e.target.value
            })}
          >
            <option value={ProgressionMode.LINEAR}>线性</option>
            <option value={ProgressionMode.STEP}>阶梯式</option>
            <option value={ProgressionMode.EXPONENTIAL}>指数式</option>
            <option value={ProgressionMode.LOGARITHMIC}>对数式</option>
            <option value={ProgressionMode.ADAPTIVE}>自适应</option>
          </select>
        </div>
        
        <button 
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded-md text-sm"
          onClick={handleApplyCustomSettings}
        >
          应用设置
        </button>
      </div>
    );
  };

  // 渲染进度信息
  const renderProgressInfo = () => {
    if (!progressInfo) return null;
    
    return (
      <div className="bg-gray-50 p-3 rounded-md mb-4">
        <div className="flex justify-between mb-2">
          <span className="text-sm">当前速度:</span>
          <span className="font-medium text-sm">{progressInfo.currentRate?.toFixed(2)}x</span>
        </div>
        
        <div className="flex justify-between mb-2">
          <span className="text-sm">目标速度:</span>
          <span className="text-sm">{progressInfo.targetRate?.toFixed(2)}x</span>
        </div>
        
        <div className="flex justify-between mb-2">
          <span className="text-sm">已用时间:</span>
          <span className="text-sm">{formatTime(progressInfo.elapsedTime || 0)}</span>
        </div>
        
        <div className="flex justify-between mb-2">
          <span className="text-sm">剩余时间:</span>
          <span className="text-sm">{formatTime(progressInfo.remainingTime || 0)}</span>
        </div>
        
        <div className="flex justify-between mb-2">
          <span className="text-sm">调整模式:</span>
          <span className="text-sm">{getModeDisplayName(progressInfo.mode)}</span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1 mb-1">
          <div 
            className="bg-blue-600 h-2.5 rounded-full" 
            style={{ width: `${(progressInfo.progress || 0) * 100}%` }}
          ></div>
        </div>
      </div>
    );
  };

  // 渲染反馈控制(仅当启用自适应模式时)
  const renderFeedbackControls = () => {
    if (!progressInfo || 
        !progressInfo.isActive || 
        progressInfo.mode !== ProgressionMode.ADAPTIVE) {
      return null;
    }
    
    return (
      <div className="mb-4">
        <p className="text-sm font-medium mb-2">这个速度怎么样？</p>
        <div className="grid grid-cols-4 gap-1">
          <button 
            className="bg-green-500 hover:bg-green-600 text-white py-1 px-1 rounded text-xs"
            onClick={() => handleProvideFeedback('easy')}
          >
            简单
          </button>
          <button 
            className="bg-blue-500 hover:bg-blue-600 text-white py-1 px-1 rounded text-xs"
            onClick={() => handleProvideFeedback('medium')}
          >
            适中
          </button>
          <button 
            className="bg-yellow-500 hover:bg-yellow-600 text-white py-1 px-1 rounded text-xs"
            onClick={() => handleProvideFeedback('hard')}
          >
            困难
          </button>
          <button 
            className="bg-red-500 hover:bg-red-600 text-white py-1 px-1 rounded text-xs"
            onClick={() => handleProvideFeedback('very-hard')}
          >
            很难
          </button>
        </div>
      </div>
    );
  };

  // 渲染主控按钮
  const renderControls = () => {
    return (
      <div className="flex space-x-2">
        <button 
          className={`flex-1 py-2 px-4 rounded-md text-white ${
            progressInfo.isActive 
              ? 'bg-yellow-500 hover:bg-yellow-600' 
              : 'bg-blue-500 hover:bg-blue-600'
          }`}
          onClick={handleToggleProgression}
          disabled={!progression}
        >
          {progressInfo.isActive ? '暂停渐进' : '开始渐进'}
        </button>
        
        <button 
          className="py-2 px-4 rounded-md bg-gray-300 hover:bg-gray-400"
          onClick={handleReset}
          disabled={!progression}
        >
          重置
        </button>
      </div>
    );
  };

  return (
    <div className="bg-white border rounded-lg p-4 shadow-sm">
      <h2 className="text-lg font-medium mb-3">语速渐进式调整</h2>
      
      {renderPresetSelector()}
      {renderCustomSettings()}
      {renderProgressInfo()}
      {renderFeedbackControls()}
      {renderControls()}
    </div>
  );
} 