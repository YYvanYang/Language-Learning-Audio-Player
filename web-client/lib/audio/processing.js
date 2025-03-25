// lib/audio/processing.js
import { loadWasmAudioProcessor, isWebAssemblySupported, getWasmAudioProcessor } from './wasm-loader';
import { generateWaveform, normalizeWaveform, smoothWaveform } from './waveform';

let processingManagerInstance = null;
let audioContext = null;

/**
 * 检测浏览器对 AudioContext 的支持情况
 * @returns {Object} 支持信息对象
 */
export function detectAudioContextSupport() {
  return {
    standardContext: typeof window !== 'undefined' && 'AudioContext' in window,
    webkitContext: typeof window !== 'undefined' && 'webkitAudioContext' in window,
    audioWorklet: typeof window !== 'undefined' && 
                  ((window.AudioContext && 'audioWorklet' in AudioContext.prototype) ||
                   (window.webkitAudioContext && 'audioWorklet' in webkitAudioContext.prototype)),
    offlineContext: typeof window !== 'undefined' && 'OfflineAudioContext' in window
  };
}

/**
 * 确保音频上下文已创建，处理跨浏览器兼容性
 * @param {Object} options - 音频上下文选项
 * @param {number} options.sampleRate - 采样率（可选，默认使用浏览器默认值）
 * @param {boolean} options.latencyHint - 延迟提示（可选，默认为'interactive'）
 * @returns {AudioContext} 音频上下文
 */
export function ensureAudioContext(options = {}) {
  if (!audioContext) {
    try {
      const support = detectAudioContextSupport();
      
      if (!support.standardContext && !support.webkitContext) {
        throw new Error('您的浏览器不支持 Web Audio API');
      }
      
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      
      // 构建音频上下文选项
      const contextOptions = {};
      
      // 仅当支持且提供了选项时添加
      if (options.sampleRate) {
        contextOptions.sampleRate = options.sampleRate;
      }
      
      if (options.latencyHint) {
        contextOptions.latencyHint = options.latencyHint;
      } else {
        contextOptions.latencyHint = 'interactive'; // 默认为交互式延迟
      }
      
      audioContext = new AudioContextClass(contextOptions);
      
      // 在iOS Safari上需要特殊处理
      if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        // 记录iOS上下文状态，以便进行特殊处理
        audioContext._isIOS = true;
        
        // iOS 设备可能需要静音处理
        const silentSource = audioContext.createOscillator();
        silentSource.frequency.value = 0;
        silentSource.connect(audioContext.destination);
        silentSource.start(0);
        silentSource.stop(0.1);
      }
      
      // 记录当前支持的功能
      audioContext._support = {
        audioWorklet: support.audioWorklet
      };
      
      console.log(`AudioContext created successfully. 
        State: ${audioContext.state}, 
        Sample Rate: ${audioContext.sampleRate}, 
        BaseLatency: ${audioContext.baseLatency || 'not supported'}, 
        AudioWorklet Support: ${support.audioWorklet ? 'Yes' : 'No'}`);
    } catch (error) {
      console.error('Failed to create AudioContext:', error);
      throw new Error('无法创建音频上下文: ' + error.message);
    }
  }
  
  return audioContext;
}

/**
 * 尝试恢复已暂停的音频上下文
 * @returns {Promise<boolean>} 恢复是否成功
 */
export async function resumeAudioContext() {
  if (!audioContext) {
    return false;
  }
  
  if (audioContext.state === 'suspended') {
    try {
      // 处理iOS Safari的特殊情况
      if (audioContext._isIOS) {
        // iOS需要播放静音音频以解锁音频上下文
        const silentBuffer = audioContext.createBuffer(1, 1, 22050);
        const source = audioContext.createBufferSource();
        source.buffer = silentBuffer;
        source.connect(audioContext.destination);
        source.start(0);
      }
      
      await audioContext.resume();
      console.log(`AudioContext resumed. Current state: ${audioContext.state}`);
      return audioContext.state === 'running';
    } catch (error) {
      console.error('Failed to resume AudioContext:', error);
      return false;
    }
  }
  
  return audioContext.state === 'running';
}

/**
 * 关闭音频上下文
 */
export function closeAudioContext() {
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
}

/**
 * 初始化音频处理器
 * @returns {Promise<Object>} WebAssembly处理器或JavaScript回退处理器
 */
export async function initAudioProcessor() {
  // 检查是否支持 WebAssembly
  if (isWebAssemblySupported()) {
    try {
      // 加载 WebAssembly 处理器
      return await loadWasmAudioProcessor();
    } catch (error) {
      console.warn('Failed to load WebAssembly processor, falling back to JS implementation:', error);
    }
  } else {
    console.warn('WebAssembly not supported, using JavaScript implementation');
  }
  
  // 如果 WebAssembly 不可用或加载失败，返回 JavaScript 实现
  return createJavaScriptProcessor();
}

/**
 * 创建纯 JavaScript 实现的音频处理器
 * @returns {Object} JavaScript 音频处理器接口
 */
function createJavaScriptProcessor() {
  return {
    // 波形生成函数
    generateWaveform: (audioData, numPoints) => {
      const waveform = generateWaveform(audioData, numPoints);
      return normalizeWaveform(waveform);
    },
    
    // 应用均衡器
    applyEqualizer: (audioData, bass, mid, treble) => {
      // 简单实现，实际均衡需要复杂的频域处理
      const processed = new Float32Array(audioData.length);
      
      for (let i = 0; i < audioData.length; i++) {
        // 这是一个非常简化的版本，实际均衡器需要使用滤波器
        processed[i] = audioData[i] * (bass * 0.33 + mid * 0.33 + treble * 0.33);
      }
      
      return processed;
    },
    
    // 音频压缩处理
    applyCompression: (audioData, threshold, ratio) => {
      const processed = new Float32Array(audioData.length);
      const normalizedThreshold = Math.max(0, Math.min(1, threshold));
      const normalizedRatio = Math.max(1, ratio);
      
      for (let i = 0; i < audioData.length; i++) {
        const sample = audioData[i];
        const sampleAbs = Math.abs(sample);
        
        if (sampleAbs > normalizedThreshold) {
          const excess = sampleAbs - normalizedThreshold;
          const compressed = normalizedThreshold + excess / normalizedRatio;
          processed[i] = sample > 0 ? compressed : -compressed;
        } else {
          processed[i] = sample;
        }
      }
      
      return processed;
    },
    
    // 音频分析
    analyzeAudio: (audioData) => {
      let sum = 0;
      let peak = 0;
      let zeroCrossings = 0;
      
      // 计算 RMS 和峰值
      for (let i = 0; i < audioData.length; i++) {
        const sample = audioData[i];
        sum += sample * sample;
        peak = Math.max(peak, Math.abs(sample));
        
        // 计算过零率
        if (i > 0 && ((audioData[i] >= 0 && audioData[i - 1] < 0) ||
            (audioData[i] < 0 && audioData[i - 1] >= 0))) {
          zeroCrossings++;
        }
      }
      
      const rms = Math.sqrt(sum / audioData.length);
      const zeroCrossingRate = zeroCrossings / audioData.length;
      
      // 简单的频谱中心估计（实际应该使用FFT）
      const spectralCentroid = zeroCrossingRate * 11025; // 粗略估计
      
      return {
        rms,
        peak,
        zeroCrossings: zeroCrossingRate,
        spectralCentroid
      };
    },
    
    // 版本信息
    getVersion: () => {
      return "JavaScript Fallback 1.0.0";
    }
  };
}

/**
 * 从URL加载音频文件并解码
 * @param {string} url - 音频文件URL
 * @returns {Promise<AudioBuffer>} 解码后的音频缓冲区
 */
export async function loadAudioFromUrl(url) {
  try {
    const context = ensureAudioContext();
    
    // 获取音频文件
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.statusText}`);
    }
    
    // 获取音频数据
    const arrayBuffer = await response.arrayBuffer();
    
    // 解码音频数据
    return await context.decodeAudioData(arrayBuffer);
  } catch (error) {
    console.error('Error loading audio:', error);
    throw error;
  }
}

/**
 * 从音频元素创建音频源节点
 * @param {HTMLAudioElement} audioElement - 音频元素
 * @returns {MediaElementAudioSourceNode} 音频源节点
 */
export function createAudioSource(audioElement) {
  const context = ensureAudioContext();
  return context.createMediaElementSource(audioElement);
}

/**
 * 设置基本的音频处理链路
 * @param {AudioNode} sourceNode - 音频源节点
 * @returns {Object} 包含各个处理节点的对象
 */
export function setupAudioProcessingChain(sourceNode) {
  const context = ensureAudioContext();
  
  // 创建分析器节点
  const analyser = context.createAnalyser();
  analyser.fftSize = 2048;
  
  // 创建增益节点
  const gainNode = context.createGain();
  
  // 创建均衡器
  const equalizer = {
    bass: context.createBiquadFilter(),
    mid: context.createBiquadFilter(),
    treble: context.createBiquadFilter()
  };
  
  // 配置均衡器
  equalizer.bass.type = 'lowshelf';
  equalizer.bass.frequency.value = 200;
  equalizer.bass.gain.value = 0;
  
  equalizer.mid.type = 'peaking';
  equalizer.mid.frequency.value = 1000;
  equalizer.mid.Q.value = 1;
  equalizer.mid.gain.value = 0;
  
  equalizer.treble.type = 'highshelf';
  equalizer.treble.frequency.value = 3000;
  equalizer.treble.gain.value = 0;
  
  // 创建压缩器
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -24;
  compressor.knee.value = 30;
  compressor.ratio.value = 12;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;
  
  // 连接节点
  sourceNode.connect(analyser);
  analyser.connect(equalizer.bass);
  equalizer.bass.connect(equalizer.mid);
  equalizer.mid.connect(equalizer.treble);
  equalizer.treble.connect(gainNode);
  gainNode.connect(compressor);
  compressor.connect(context.destination);
  
  return {
    analyser,
    gainNode,
    equalizer,
    compressor
  };
}

/**
 * 获取音频的波形数据
 * @param {AnalyserNode} analyser - 分析器节点
 * @returns {Uint8Array} 波形数据
 */
export function getWaveformData(analyser) {
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  analyser.getByteTimeDomainData(dataArray);
  return dataArray;
}

/**
 * 获取音频的频谱数据
 * @param {AnalyserNode} analyser - 分析器节点
 * @returns {Uint8Array} 频谱数据
 */
export function getFrequencyData(analyser) {
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  analyser.getByteFrequencyData(dataArray);
  return dataArray;
}

/**
 * 从音频缓冲区生成波形数据
 * @param {AudioBuffer} audioBuffer - 音频缓冲区
 * @param {number} numPoints - 需要的波形数据点数
 * @returns {Float32Array} 波形数据
 */
export function generateWaveformFromBuffer(audioBuffer, numPoints) {
  try {
    // 优先使用 WebAssembly 处理
    const wasmProcessor = getWasmAudioProcessor();
    if (wasmProcessor) {
      const audioData = audioBuffer.getChannelData(0);
      return wasmProcessor.generateWaveform(audioData, numPoints);
    }
    
    // 回退到 JavaScript 实现
    const audioData = audioBuffer.getChannelData(0);
    const rawWaveform = generateWaveform(audioData, numPoints);
    return normalizeWaveform(rawWaveform);
  } catch (error) {
    console.error('Failed to generate waveform:', error);
    // 返回空数组
    return new Float32Array(numPoints || 1000);
  }
}

/**
 * 设置音频的均衡器参数
 * @param {Object} equalizer - 均衡器对象
 * @param {number} bass - 低音增益值 (-10 到 10)
 * @param {number} mid - 中音增益值 (-10 到 10)
 * @param {number} treble - 高音增益值 (-10 到 10)
 */
export function setEqualizerGain(equalizer, bass, mid, treble) {
  if (!equalizer) return;
  
  try {
    equalizer.bass.gain.value = bass;
    equalizer.mid.gain.value = mid;
    equalizer.treble.gain.value = treble;
  } catch (error) {
    console.error('Failed to set equalizer gain:', error);
  }
}

/**
 * 设置音频的音量
 * @param {GainNode} gainNode - 增益节点
 * @param {number} volume - 音量值 (0 到 1)
 */
export function setVolume(gainNode, volume) {
  if (!gainNode) return;
  
  try {
    // 确保值在有效范围内
    const safeVolume = Math.max(0, Math.min(1, volume));
    gainNode.gain.value = safeVolume;
  } catch (error) {
    console.error('Failed to set volume:', error);
  }
}

/**
 * 检测浏览器支持的音频格式
 * @returns {Object} 支持的格式
 */
export function detectAudioSupport() {
  const audio = document.createElement('audio');
  
  return {
    mp3: audio.canPlayType('audio/mpeg').replace('no', ''),
    ogg: audio.canPlayType('audio/ogg; codecs="vorbis"').replace('no', ''),
    wav: audio.canPlayType('audio/wav; codecs="1"').replace('no', ''),
    aac: audio.canPlayType('audio/aac').replace('no', ''),
    webAudio: typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined'
  };
}

/**
 * 创建音频工作线程
 * @param {string} processorPath - 音频处理器脚本路径
 * @returns {Promise<AudioWorkletNode>} 音频工作线程节点
 */
export async function createAudioWorklet(processorPath) {
  try {
    const context = ensureAudioContext();
    
    // 确保 AudioWorklet 可用
    if (!context.audioWorklet) {
      throw new Error('AudioWorklet API not supported');
    }
    
    // 加载处理器模块
    await context.audioWorklet.addModule(processorPath);
    
    // 创建工作线程节点
    return new AudioWorkletNode(context, 'audio-processor');
  } catch (error) {
    console.error('Failed to create audio worklet:', error);
    throw error;
  }
}