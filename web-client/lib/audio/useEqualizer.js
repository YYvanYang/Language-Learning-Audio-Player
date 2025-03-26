import { useState, useEffect, useCallback, useRef } from 'react';
import {
  EqualizerMode,
  createEqualizerNodes,
  connectEqualizerNodes,
  updateEqualizerSettings,
  getEqualizerPreset
} from './EqualizerPresets';

/**
 * 均衡器钩子函数
 * 创建和管理音频均衡器
 * 
 * @param {AudioContext} audioContext - 音频上下文
 * @param {Object} options - 配置选项
 * @param {AudioNode} options.source - 音频源节点
 * @param {AudioNode} options.destination - 目标节点
 * @param {string} options.initialPreset - 初始预设名称
 * @returns {Object} 均衡器控制接口
 */
export function useEqualizer(audioContext, options = {}) {
  const {
    source = null,
    destination = null,
    initialPreset = EqualizerMode.FLAT
  } = options;
  
  // 状态
  const [isActive, setIsActive] = useState(true);
  const [currentPreset, setCurrentPreset] = useState(initialPreset);
  const [bypassNode, setBypassNode] = useState(null);
  
  // 引用
  const equalizerNodesRef = useRef([]);
  const sourceRef = useRef(source);
  const destinationRef = useRef(destination);
  const isMountedRef = useRef(true);
  
  // 当源或目标更改时，更新引用
  useEffect(() => {
    sourceRef.current = source;
    destinationRef.current = destination;
    
    // 如果均衡器已创建且源和目标都可用，则重新连接
    if (equalizerNodesRef.current.length > 0 && source && destination) {
      reconnectEqualizer();
    }
  }, [source, destination]);
  
  // 创建旁路节点
  useEffect(() => {
    if (!audioContext) return;
    
    // 创建增益节点作为旁路
    const bypass = audioContext.createGain();
    bypass.gain.value = 1.0;
    setBypassNode(bypass);
    
    return () => {
      // 组件卸载时标记
      isMountedRef.current = false;
    };
  }, [audioContext]);
  
  // 初始化均衡器
  useEffect(() => {
    if (!audioContext || !bypassNode) return;
    
    // 创建均衡器节点
    const nodes = createEqualizerNodes(audioContext, currentPreset);
    equalizerNodesRef.current = nodes;
    
    // 如果有源和目标，连接均衡器
    if (sourceRef.current && destinationRef.current) {
      connectEqualizerNodes(
        isActive ? nodes : [bypassNode], 
        sourceRef.current, 
        destinationRef.current
      );
    }
    
    return () => {
      // 断开旧节点连接
      disconnectEqualizer();
    };
  }, [audioContext, bypassNode, currentPreset, isActive]);
  
  // 断开均衡器连接
  const disconnectEqualizer = useCallback(() => {
    try {
      // 断开所有节点
      equalizerNodesRef.current.forEach(node => {
        node.disconnect();
      });
      
      if (bypassNode) {
        bypassNode.disconnect();
      }
    } catch (error) {
      console.error('断开均衡器连接时出错:', error);
    }
  }, [bypassNode]);
  
  // 重新连接均衡器
  const reconnectEqualizer = useCallback(() => {
    // 首先断开旧连接
    disconnectEqualizer();
    
    // 如果源和目标都可用，重新连接
    if (sourceRef.current && destinationRef.current) {
      connectEqualizerNodes(
        isActive ? equalizerNodesRef.current : [bypassNode], 
        sourceRef.current, 
        destinationRef.current
      );
    }
  }, [isActive, bypassNode, disconnectEqualizer]);
  
  // 更改预设
  const changePreset = useCallback((presetName) => {
    if (!audioContext) return;
    
    setCurrentPreset(presetName);
    
    // 如果均衡器节点已存在，更新设置
    if (equalizerNodesRef.current.length > 0) {
      updateEqualizerSettings(equalizerNodesRef.current, presetName);
    } else {
      // 否则创建新节点
      const nodes = createEqualizerNodes(audioContext, presetName);
      equalizerNodesRef.current = nodes;
      
      // 重新连接
      reconnectEqualizer();
    }
  }, [audioContext, reconnectEqualizer]);
  
  // 启用/禁用均衡器
  const toggleEqualizer = useCallback((enabled = null) => {
    const newState = enabled !== null ? enabled : !isActive;
    setIsActive(newState);
    
    // 重新连接以应用变更
    reconnectEqualizer();
  }, [isActive, reconnectEqualizer]);
  
  // 应用自定义设置
  const applyCustomSettings = useCallback((settings) => {
    if (!equalizerNodesRef.current.length) return;
    
    updateEqualizerSettings(equalizerNodesRef.current, settings);
    setCurrentPreset(EqualizerMode.CUSTOM);
  }, []);
  
  // 获取当前设置
  const getCurrentSettings = useCallback(() => {
    if (currentPreset === EqualizerMode.CUSTOM) {
      // 如果是自定义设置，从节点中提取
      return equalizerNodesRef.current.map(node => ({
        type: node.type,
        frequency: node.frequency.value,
        gain: node.gain.value,
        Q: node.Q ? node.Q.value : 1
      }));
    } else {
      // 否则返回预设
      return getEqualizerPreset(currentPreset);
    }
  }, [currentPreset]);
  
  return {
    isActive,
    currentPreset,
    getCurrentSettings,
    changePreset,
    toggleEqualizer,
    applyCustomSettings
  };
} 