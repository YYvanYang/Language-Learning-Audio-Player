"use client";

import React, { useState, useEffect } from 'react';
import { 
  getLanguagesList, 
  getVoiceEnhancementPresetsList,
  VoiceEnhancementPresets,
  LanguageFormants
} from '../../lib/audio/IIRFilterDesigner';

/**
 * 语音增强控制组件
 * 
 * @param {Object} props - 组件属性
 * @param {Function} props.onPresetSelect - 预设选择回调
 * @param {Function} props.onLanguageSelect - 语言选择回调
 * @param {Function} props.onEnableChange - 启用状态变更回调
 * @param {boolean} props.isEnabled - 是否启用
 * @param {string} props.activePreset - 当前激活的预设
 * @param {string} props.activeLanguage - 当前激活的语言
 */
export default function VoiceEnhancementControl({
  onPresetSelect,
  onLanguageSelect,
  onEnableChange,
  isEnabled = true,
  activePreset = '',
  activeLanguage = ''
}) {
  // 状态
  const [presets, setPresets] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState(activePreset);
  const [selectedLanguage, setSelectedLanguage] = useState(activeLanguage);
  const [enabled, setEnabled] = useState(isEnabled);
  const [showLanguageControls, setShowLanguageControls] = useState(false);
  
  // 初始化预设和语言列表
  useEffect(() => {
    setPresets(getVoiceEnhancementPresetsList());
    setLanguages(getLanguagesList());
  }, []);
  
  // 同步外部状态
  useEffect(() => {
    setEnabled(isEnabled);
  }, [isEnabled]);
  
  useEffect(() => {
    if (activePreset) {
      setSelectedPreset(activePreset);
    }
  }, [activePreset]);
  
  useEffect(() => {
    if (activeLanguage) {
      setSelectedLanguage(activeLanguage);
    }
  }, [activeLanguage]);
  
  // 处理预设选择
  const handlePresetSelect = (presetKey) => {
    setSelectedPreset(presetKey);
    
    if (onPresetSelect) {
      onPresetSelect(presetKey);
    }
    
    // 如果选择了预设，关闭语言相关控制
    if (presetKey) {
      setShowLanguageControls(false);
    }
  };
  
  // 处理语言选择
  const handleLanguageSelect = (languageKey) => {
    setSelectedLanguage(languageKey);
    
    if (onLanguageSelect) {
      onLanguageSelect(languageKey);
    }
    
    // 如果选择了语言，关闭普通预设
    if (languageKey) {
      setSelectedPreset('');
      setShowLanguageControls(true);
    }
  };
  
  // 处理切换启用状态
  const handleToggleEnabled = () => {
    const newStatus = !enabled;
    setEnabled(newStatus);
    
    if (onEnableChange) {
      onEnableChange(newStatus);
    }
  };
  
  // 渲染预设列表
  const renderPresetSelector = () => {
    return (
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          选择语音增强预设
        </label>
        <select 
          className="w-full px-3 py-2 border rounded-md"
          value={selectedPreset}
          onChange={(e) => handlePresetSelect(e.target.value)}
          disabled={!enabled}
        >
          <option value="">选择预设...</option>
          {presets.map(preset => (
            <option key={preset.key} value={preset.key}>
              {preset.name}
            </option>
          ))}
        </select>
        
        {selectedPreset && VoiceEnhancementPresets[selectedPreset] && (
          <p className="text-xs text-gray-500 mt-1">
            {VoiceEnhancementPresets[selectedPreset].description}
          </p>
        )}
      </div>
    );
  };
  
  // 渲染语言选择器
  const renderLanguageSelector = () => {
    return (
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <label className="block text-sm font-medium text-gray-700">
            目标语言优化
          </label>
          <button 
            className="text-xs text-blue-500 hover:text-blue-700"
            onClick={() => setShowLanguageControls(!showLanguageControls)}
          >
            {showLanguageControls ? '隐藏控制' : '显示控制'}
          </button>
        </div>
        
        <select 
          className="w-full px-3 py-2 border rounded-md"
          value={selectedLanguage}
          onChange={(e) => handleLanguageSelect(e.target.value)}
          disabled={!enabled}
        >
          <option value="">选择语言...</option>
          {languages.map(language => (
            <option key={language.key} value={language.key}>
              {language.name}
            </option>
          ))}
        </select>
        
        {selectedLanguage && LanguageFormants[selectedLanguage] && (
          <p className="text-xs text-gray-500 mt-1">
            {LanguageFormants[selectedLanguage].description}
          </p>
        )}
      </div>
    );
  };
  
  // 渲染语言相关频率图表
  const renderLanguageControls = () => {
    if (!showLanguageControls || !selectedLanguage || !LanguageFormants[selectedLanguage]) {
      return null;
    }
    
    const formants = LanguageFormants[selectedLanguage].formants;
    
    return (
      <div className="mb-4 bg-gray-50 p-3 rounded-md">
        <h3 className="text-sm font-medium mb-2">语言特定共振峰</h3>
        <div className="relative h-40 bg-white rounded border flex items-end">
          {/* 频率区域标记 */}
          <div className="absolute top-0 left-0 w-full flex justify-between text-xs text-gray-400 px-2">
            <span>低频</span>
            <span>中低频</span>
            <span>中频</span>
            <span>中高频</span>
            <span>高频</span>
          </div>
          
          {/* 共振峰柱状图 */}
          <div className="flex justify-around items-end w-full h-full pt-5 pb-1 px-2">
            {formants.map((formant, index) => {
              // 计算频率位置 (20Hz-20kHz -> 0-100%)
              const position = Math.min(100, Math.log10(formant.frequency / 20) / Math.log10(1000) * 100);
              
              // 计算增益高度 (-12dB到+12dB -> 0-100%)
              const gainHeight = Math.min(100, 50 + (formant.gain * 50 / 12));
              
              // 计算Q值宽度 (Q值越大，带宽越窄)
              const width = Math.max(10, 100 / formant.Q);
              
              return (
                <div 
                  key={index}
                  className="relative"
                  style={{ left: `${position}%`, marginLeft: `-${width/2}%` }}
                >
                  <div 
                    className="bg-blue-500 rounded-t"
                    style={{ 
                      height: `${gainHeight}%`, 
                      width: `${width}%`,
                      minWidth: '12px'
                    }}
                  ></div>
                  <div className="text-xs text-center text-gray-600 mt-1">
                    {formant.frequency}Hz
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          此图显示了{LanguageFormants[selectedLanguage].name}语言的特定共振峰频率。这些设置能增强语言学习过程中的发音辨识能力。
        </p>
      </div>
    );
  };
  
  return (
    <div className="voice-enhancement-control bg-white border rounded-lg p-4 shadow-sm">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-medium">语音增强设置</h2>
        <div className="flex items-center">
          <span className="text-sm text-gray-600 mr-2">启用</span>
          <button 
            className={`relative inline-flex items-center h-6 rounded-full w-11 focus:outline-none transition-colors ${
              enabled ? 'bg-blue-600' : 'bg-gray-300'
            }`}
            onClick={handleToggleEnabled}
          >
            <span 
              className={`inline-block w-4 h-4 transform transition-transform bg-white rounded-full ${
                enabled ? 'translate-x-6' : 'translate-x-1'
              }`} 
            />
          </button>
        </div>
      </div>
      
      {renderPresetSelector()}
      {renderLanguageSelector()}
      {renderLanguageControls()}
      
      <div className="text-xs text-gray-500 mt-3">
        <p>语音增强可以提高音频中语音的清晰度和特定语言特征的可辨识度，帮助语言学习。</p>
      </div>
    </div>
  );
} 