import { useEffect, useRef, useState, useCallback } from 'react';
import { loadWasmAudioProcessor, getWasmAudioProcessor } from './wasm-loader';

/**
 * 实时音频处理钩子
 * 集成AudioWorklet和WebAssembly提供实时音频处理和分析功能
 * 
 * @param {Object} options - 配置选项
 * @param {AudioContext} options.audioContext - 音频上下文
 * @param {boolean} options.autoInit - 是否自动初始化
 * @param {Object} options.defaultSettings - 默认均衡器设置
 * @returns {Object} 处理器接口
 */
export function useRealtimeAudioProcessor(options = {}) {
  const { 
    audioContext = null,
    autoInit = true,
    defaultSettings = { bass: 0, mid: 0, treble: 0 } 
  } = options;
  
  // 状态和引用
  const [isInitialized, setIsInitialized] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);
  const [error, setError] = useState(null);
  const [eqSettings, setEqSettings] = useState(defaultSettings);
  
  // 处理器节点引用
  const processorNodeRef = useRef(null);
  const wasmProcessorRef = useRef(null);
  const contextRef = useRef(audioContext);
  const messageHandlersRef = useRef({});
  
  // 检查浏览器支持
  const checkSupport = useCallback(() => {
    if (!window.AudioContext && !window.webkitAudioContext) {
      return { supported: false, reason: '浏览器不支持AudioContext' };
    }
    
    if (!contextRef.current || !contextRef.current.audioWorklet) {
      return { supported: false, reason: '浏览器不支持AudioWorklet' };
    }
    
    if (typeof WebAssembly !== 'object') {
      return { supported: false, reason: '浏览器不支持WebAssembly' };
    }
    
    return { supported: true };
  }, []);
  
  // 初始化处理器
  const initialize = useCallback(async (ctx = null) => {
    // 防止重复初始化
    if (isInitialized) return true;
    
    try {
      // 检查支持
      const support = checkSupport();
      if (!support.supported) {
        throw new Error(support.reason);
      }
      
      // 设置音频上下文
      if (ctx) {
        contextRef.current = ctx;
      } else if (!contextRef.current) {
        contextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      // 加载WebAssembly处理器
      wasmProcessorRef.current = await loadWasmAudioProcessor();
      
      // 设置采样率
      wasmProcessorRef.current.set_sample_rate(contextRef.current.sampleRate);
      
      // 加载AudioWorklet模块
      await contextRef.current.audioWorklet.addModule('/audio-worklets/realtime-processor.js');
      
      // 创建处理器节点
      processorNodeRef.current = new AudioWorkletNode(contextRef.current, 'realtime-audio-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        processorOptions: {
          sampleRate: contextRef.current.sampleRate
        }
      });
      
      // 设置消息处理
      setupMessageHandling();
      
      // 初始化完成
      setIsInitialized(true);
      setError(null);
      
      // 设置初始均衡器值
      updateParameters();
      
      return true;
    } catch (err) {
      console.error('初始化音频处理器失败:', err);
      setError(err.message || '初始化失败');
      setIsInitialized(false);
      return false;
    }
  }, [isInitialized, checkSupport]);
  
  // 设置消息处理
  const setupMessageHandling = useCallback(() => {
    if (!processorNodeRef.current) return;
    
    // 设置消息端口监听器
    processorNodeRef.current.port.onmessage = (event) => {
      const { data } = event;
      
      switch (data.type) {
        case 'init':
          // 处理器初始化
          console.log('接收到处理器初始化消息:', data.message);
          break;
          
        case 'initialized':
          // 处理器已初始化
          console.log('处理器已初始化:', data.message);
          break;
          
        case 'analysisData':
          // 接收分析数据
          setAnalysisData(data.state);
          break;
          
        case 'analysisBuffer':
          // 接收到音频缓冲区，进行分析
          if (wasmProcessorRef.current) {
            processAnalysisBuffer(data.buffer);
          }
          break;
          
        default:
          // 调用注册的处理器
          if (messageHandlersRef.current[data.type]) {
            messageHandlersRef.current[data.type](data);
          }
      }
    };
    
    // 发送初始化消息
    processorNodeRef.current.port.postMessage({
      type: 'init'
    });
  }, []);
  
  // 使用WebAssembly处理分析缓冲区
  const processAnalysisBuffer = useCallback((buffer) => {
    try {
      if (!wasmProcessorRef.current) return;
      
      // 创建Float32Array从传输的缓冲区
      const audioData = new Float32Array(buffer);
      
      // 使用WebAssembly分析频谱
      const result = wasmProcessorRef.current.analyze_spectrum_data(audioData);
      
      // 更新分析数据
      setAnalysisData(prevData => ({
        ...prevData,
        spectrum: result
      }));
      
      // 释放传输的缓冲区
      // 不直接返回新缓冲区，避免频繁的内存分配
    } catch (err) {
      console.error('频谱分析失败:', err);
    }
  }, []);
  
  // 连接节点到音频图
  const connect = useCallback((sourceNode, destinationNode = null) => {
    if (!isInitialized || !processorNodeRef.current) {
      console.error('处理器未初始化，无法连接');
      return false;
    }
    
    try {
      // 连接源到处理器
      sourceNode.connect(processorNodeRef.current);
      
      // 连接处理器到目标（或音频上下文输出）
      if (destinationNode) {
        processorNodeRef.current.connect(destinationNode);
      } else {
        processorNodeRef.current.connect(contextRef.current.destination);
      }
      
      setIsProcessing(true);
      return true;
    } catch (err) {
      console.error('连接处理器失败:', err);
      setError(err.message || '连接失败');
      return false;
    }
  }, [isInitialized]);
  
  // 断开处理器
  const disconnect = useCallback(() => {
    if (!processorNodeRef.current) return;
    
    try {
      processorNodeRef.current.disconnect();
      setIsProcessing(false);
    } catch (err) {
      console.error('断开处理器失败:', err);
    }
  }, []);
  
  // 更新处理参数
  const updateParameters = useCallback(() => {
    if (!processorNodeRef.current) return;
    
    // 更新均衡器参数
    processorNodeRef.current.parameters.get('bassGain').value = eqSettings.bass;
    processorNodeRef.current.parameters.get('midGain').value = eqSettings.mid;
    processorNodeRef.current.parameters.get('trebleGain').value = eqSettings.treble;
  }, [eqSettings]);
  
  // 设置均衡器值
  const setEqualizer = useCallback((bass, mid, treble) => {
    setEqSettings({
      bass: Number(bass) || 0,
      mid: Number(mid) || 0, 
      treble: Number(treble) || 0
    });
  }, []);
  
  // 设置旁路状态
  const setBypass = useCallback((bypass) => {
    if (!processorNodeRef.current) return;
    
    processorNodeRef.current.parameters.get('bypass').value = bypass ? 1 : 0;
  }, []);
  
  // 注册消息处理器
  const registerMessageHandler = useCallback((type, handler) => {
    if (typeof handler !== 'function') return;
    
    messageHandlersRef.current[type] = handler;
  }, []);
  
  // 请求分析数据
  const requestAnalysis = useCallback(() => {
    if (!processorNodeRef.current) return;
    
    processorNodeRef.current.port.postMessage({
      type: 'requestAnalysis'
    });
  }, []);
  
  // 销毁处理器
  const dispose = useCallback(() => {
    disconnect();
    processorNodeRef.current = null;
    wasmProcessorRef.current = null;
    setIsInitialized(false);
    setIsProcessing(false);
    setAnalysisData(null);
  }, [disconnect]);
  
  // 自动初始化
  useEffect(() => {
    if (autoInit && !isInitialized && contextRef.current) {
      initialize();
    }
    
    // 组件卸载时清理
    return () => {
      if (isInitialized) {
        dispose();
      }
    };
  }, [autoInit, isInitialized, initialize, dispose]);
  
  // 参数更新时更新处理器
  useEffect(() => {
    if (isInitialized) {
      updateParameters();
    }
  }, [isInitialized, eqSettings, updateParameters]);
  
  // 返回处理器接口
  return {
    isInitialized,
    isProcessing,
    analysisData,
    error,
    
    // 处理器控制
    initialize,
    connect,
    disconnect,
    dispose,
    
    // 获取处理器节点
    getProcessorNode: () => processorNodeRef.current,
    
    // 均衡器控制
    setEqualizer,
    setBypass,
    eqSettings,
    
    // 分析控制
    requestAnalysis,
    registerMessageHandler,
    
    // 原始引用
    audioContext: contextRef.current
  };
} 