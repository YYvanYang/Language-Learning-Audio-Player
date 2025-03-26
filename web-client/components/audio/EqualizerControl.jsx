"use client";

import React, { useState, useEffect } from 'react';
import { 
  EqualizerMode, 
  BandType, 
  getEqualizerPreset, 
  getEqualizerPresetDescription,
  createDefaultSettings
} from '../../lib/audio/EqualizerPresets';

/**
 * 均衡器控制组件
 * 
 * @param {Object} props - 组件属性
 * @param {Function} props.onSettingsChange - 设置变更回调
 * @param {Array} props.initialSettings - 初始设置
 * @param {boolean} props.compact - 是否使用紧凑模式
 */
export default function EqualizerControl({ 
  onSettingsChange, 
  initialSettings,
  compact = false
}) {
  // 状态
  const [selectedPreset, setSelectedPreset] = useState(EqualizerMode.FLAT);
  const [settings, setSettings] = useState(() => {
    return initialSettings || createDefaultSettings();
  });
  const [expanded, setExpanded] = useState(!compact);
  const [selectedBand, setSelectedBand] = useState(0);

  // 当预设变更时更新设置
  useEffect(() => {
    if (selectedPreset === EqualizerMode.CUSTOM) return;
    
    const presetSettings = getEqualizerPreset(selectedPreset);
    setSettings(JSON.parse(JSON.stringify(presetSettings)));
    
    if (onSettingsChange) {
      onSettingsChange(presetSettings, selectedPreset);
    }
  }, [selectedPreset, onSettingsChange]);

  // 处理设置变更
  const handleSettingChange = (index, property, value) => {
    const newSettings = [...settings];
    newSettings[index] = { ...newSettings[index], [property]: value };
    
    setSettings(newSettings);
    setSelectedPreset(EqualizerMode.CUSTOM);
    
    if (onSettingsChange) {
      onSettingsChange(newSettings, EqualizerMode.CUSTOM);
    }
  };

  // 处理预设选择
  const handlePresetSelect = (preset) => {
    setSelectedPreset(preset);
  };

  // 重置均衡器
  const handleReset = () => {
    setSelectedPreset(EqualizerMode.FLAT);
  };

  // 渲染预设选择器
  const renderPresetSelector = () => {
    // 语言学习相关预设放前面
    const languagePresets = [
      EqualizerMode.LANGUAGE_LEARNING,
      EqualizerMode.PRONUNCIATION,
      EqualizerMode.LISTENING_PRACTICE,
      EqualizerMode.SPEECH,
      EqualizerMode.PODCAST,
    ];
    
    // 音乐相关预设
    const musicPresets = [
      EqualizerMode.FLAT,
      EqualizerMode.BASS_BOOST,
      EqualizerMode.TREBLE_BOOST,
      EqualizerMode.ACOUSTIC,
      EqualizerMode.ELECTRONIC,
      EqualizerMode.CLASSICAL,
      EqualizerMode.JAZZ,
      EqualizerMode.ROCK,
      EqualizerMode.POP,
    ];
    
    // 其他预设
    const otherPresets = [
      EqualizerMode.HEADPHONES,
      EqualizerMode.NIGHTMODE,
    ];
    
    return (
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          选择均衡器预设
        </label>
        <select 
          className="w-full px-3 py-2 border rounded-md"
          value={selectedPreset}
          onChange={(e) => handlePresetSelect(e.target.value)}
        >
          <optgroup label="语言学习优化">
            {languagePresets.map(preset => (
              <option key={preset} value={preset}>
                {getDisplayName(preset)}
              </option>
            ))}
          </optgroup>
          
          <optgroup label="音乐优化">
            {musicPresets.map(preset => (
              <option key={preset} value={preset}>
                {getDisplayName(preset)}
              </option>
            ))}
          </optgroup>
          
          <optgroup label="其他设置">
            {otherPresets.map(preset => (
              <option key={preset} value={preset}>
                {getDisplayName(preset)}
              </option>
            ))}
            {selectedPreset === EqualizerMode.CUSTOM && (
              <option value={EqualizerMode.CUSTOM}>
                自定义
              </option>
            )}
          </optgroup>
        </select>
        
        <p className="text-xs text-gray-500 mt-1">
          {getEqualizerPresetDescription(selectedPreset)}
        </p>
      </div>
    );
  };

  // 渲染带图形化界面的均衡器
  const renderGraphicalEqualizer = () => {
    return (
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-medium">均衡器设置</h3>
          {selectedPreset !== EqualizerMode.FLAT && (
            <button
              className="text-xs text-blue-600 hover:text-blue-800"
              onClick={handleReset}
            >
              重置
            </button>
          )}
        </div>
        
        <div className="bg-gray-50 rounded-md p-3">
          {/* 均衡器图形界面 */}
          <div className="h-32 flex items-end justify-around mb-2 bg-gray-100 rounded relative">
            {/* 频率刻度 */}
            <div className="absolute top-0 left-0 w-full flex justify-around text-xs text-gray-400 px-2">
              <span>80Hz</span>
              <span>250Hz</span>
              <span>1kHz</span>
              <span>4kHz</span>
              <span>12kHz</span>
            </div>
            
            {/* 中线 - 0dB */}
            <div className="absolute top-1/2 left-0 w-full h-px bg-gray-300"></div>
            
            {/* 频率条 */}
            {settings.map((band, index) => {
              // 计算增益高度（-12db到+12db映射到0-100%）
              const heightPercent = 50 + (band.gain * 50 / 12);
              return (
                <div 
                  key={index}
                  className="relative flex flex-col items-center"
                  style={{ width: `${100 / settings.length}%` }}
                >
                  <div 
                    className={`w-3 ${selectedBand === index ? 'bg-blue-500' : 'bg-blue-400'} rounded-t cursor-pointer hover:bg-blue-600`}
                    style={{ height: `${heightPercent}%` }}
                    onClick={() => setSelectedBand(index)}
                  ></div>
                  <div className="w-6 h-2 rounded-b bg-gray-300 cursor-pointer"></div>
                </div>
              );
            })}
          </div>
          
          {/* 所选频段设置 */}
          {settings[selectedBand] && (
            <div className="mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    增益 ({settings[selectedBand].gain} dB)
                  </label>
                  <input 
                    type="range"
                    min="-12"
                    max="12"
                    step="0.5"
                    value={settings[selectedBand].gain}
                    onChange={(e) => handleSettingChange(selectedBand, 'gain', parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    频率 ({settings[selectedBand].frequency} Hz)
                  </label>
                  <input 
                    type="range"
                    min={getBandMinFreq(selectedBand)}
                    max={getBandMaxFreq(selectedBand)}
                    step={getFrequencyStep(selectedBand)}
                    value={settings[selectedBand].frequency}
                    onChange={(e) => handleSettingChange(selectedBand, 'frequency', parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
                
                {canAdjustQ(settings[selectedBand].type) && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Q值 ({settings[selectedBand].Q.toFixed(1)})
                    </label>
                    <input 
                      type="range"
                      min="0.1"
                      max="10"
                      step="0.1"
                      value={settings[selectedBand].Q}
                      onChange={(e) => handleSettingChange(selectedBand, 'Q', parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>
                )}
                
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    滤波器类型
                  </label>
                  <select 
                    className="w-full px-2 py-1 border rounded-md text-xs"
                    value={settings[selectedBand].type}
                    onChange={(e) => handleSettingChange(selectedBand, 'type', e.target.value)}
                  >
                    {getAvailableFilterTypes(selectedBand).map(type => (
                      <option key={type} value={type}>
                        {getFilterTypeDisplayName(type)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 渲染紧凑模式的均衡器
  const renderCompactEqualizer = () => {
    return (
      <div className="mb-4">
        <button 
          className="flex justify-between items-center w-full px-3 py-2 bg-gray-50 rounded-md"
          onClick={() => setExpanded(!expanded)}
        >
          <span className="font-medium text-sm">均衡器</span>
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            className={`transform transition-transform ${expanded ? 'rotate-180' : 'rotate-0'}`}
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        
        {expanded && (
          <div className="mt-3">
            {renderPresetSelector()}
            {renderCompactBands()}
          </div>
        )}
      </div>
    );
  };

  // 渲染紧凑模式下的频段调整
  const renderCompactBands = () => {
    return (
      <div className="grid gap-2 mt-2">
        {settings.map((band, index) => {
          const label = getBandLabel(index, band.frequency);
          return (
            <div key={index} className="flex items-center">
              <span className="w-16 text-xs text-gray-600">{label}</span>
              <input 
                type="range"
                min="-12"
                max="12"
                step="0.5"
                value={band.gain}
                onChange={(e) => handleSettingChange(index, 'gain', parseFloat(e.target.value))}
                className="flex-1 mx-2"
              />
              <span className="w-8 text-right text-xs text-gray-600">
                {band.gain > 0 ? `+${band.gain}` : band.gain}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  // 根据频段索引获取标签
  const getBandLabel = (index, frequency) => {
    if (frequency <= 100) return "低频";
    if (frequency <= 300) return "中低频";
    if (frequency <= 2000) return "中频";
    if (frequency <= 6000) return "中高频";
    return "高频";
  };

  // 根据索引获取频段最小频率
  const getBandMinFreq = (index) => {
    if (index === 0) return 20;  // 低频
    if (index === 1) return 100; // 中低频
    if (index === 2) return 500; // 中频
    if (index === 3) return 2000; // 中高频
    return 8000; // 高频
  };

  // 根据索引获取频段最大频率
  const getBandMaxFreq = (index) => {
    if (index === 0) return 200;  // 低频
    if (index === 1) return 800;  // 中低频
    if (index === 2) return 3000; // 中频
    if (index === 3) return 8000; // 中高频
    return 20000; // 高频
  };

  // 获取频率调整步长
  const getFrequencyStep = (index) => {
    if (index < 2) return 10;  // 低频和中低频
    if (index < 4) return 100; // 中频和中高频
    return 500; // 高频
  };

  // 检查是否可以调整Q值
  const canAdjustQ = (type) => {
    return type === BandType.PEAKING || 
           type === BandType.NOTCH || 
           type === BandType.LOWPASS || 
           type === BandType.HIGHPASS;
  };

  // 获取滤波器类型显示名称
  const getFilterTypeDisplayName = (type) => {
    const names = {
      [BandType.LOWSHELF]: '低频搁架',
      [BandType.PEAKING]: '峰值滤波',
      [BandType.HIGHSHELF]: '高频搁架',
      [BandType.LOWPASS]: '低通滤波',
      [BandType.HIGHPASS]: '高通滤波',
      [BandType.NOTCH]: '陷波滤波',
      [BandType.ALLPASS]: '全通滤波',
    };
    
    return names[type] || type;
  };

  // 获取预设显示名称
  const getDisplayName = (preset) => {
    const names = {
      [EqualizerMode.FLAT]: '平坦',
      [EqualizerMode.BASS_BOOST]: '增强低音',
      [EqualizerMode.TREBLE_BOOST]: '增强高音',
      [EqualizerMode.SPEECH]: '语音增强',
      [EqualizerMode.PODCAST]: '播客',
      [EqualizerMode.ACOUSTIC]: '原声乐器',
      [EqualizerMode.ELECTRONIC]: '电子音乐',
      [EqualizerMode.CLASSICAL]: '古典音乐',
      [EqualizerMode.JAZZ]: '爵士乐',
      [EqualizerMode.ROCK]: '摇滚乐',
      [EqualizerMode.POP]: '流行音乐',
      [EqualizerMode.LANGUAGE_LEARNING]: '语言学习',
      [EqualizerMode.PRONUNCIATION]: '发音练习',
      [EqualizerMode.LISTENING_PRACTICE]: '听力练习',
      [EqualizerMode.HEADPHONES]: '耳机优化',
      [EqualizerMode.NIGHTMODE]: '夜间模式',
      [EqualizerMode.CUSTOM]: '自定义',
    };
    
    return names[preset] || preset;
  };

  // 获取可用的滤波器类型
  const getAvailableFilterTypes = (index) => {
    if (index === 0) {
      // 低频支持低频搁架、高通滤波和峰值滤波
      return [BandType.LOWSHELF, BandType.HIGHPASS, BandType.PEAKING];
    } else if (index === settings.length - 1) {
      // 高频支持高频搁架、低通滤波和峰值滤波
      return [BandType.HIGHSHELF, BandType.LOWPASS, BandType.PEAKING];
    } else {
      // 中间频段支持峰值滤波、陷波滤波
      return [BandType.PEAKING, BandType.NOTCH];
    }
  };

  return (
    <div className="equalizer-control">
      {compact ? (
        renderCompactEqualizer()
      ) : (
        <>
          {renderPresetSelector()}
          {renderGraphicalEqualizer()}
        </>
      )}
    </div>
  );
} 