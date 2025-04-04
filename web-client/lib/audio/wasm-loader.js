'use client';

/**
 * WebAssembly 加载和管理工具
 */

// WebAssembly处理器实例
let wasmAudioProcessor = null;

/**
 * 加载 WebAssembly 模块
 * @returns {Promise<Object>} WebAssembly 实例接口
 */
export async function loadWasmAudioProcessor() {
  // 如果处理器已加载，直接返回
  if (wasmAudioProcessor) {
    return wasmAudioProcessor;
  }
  
  // 验证WebAssembly支持
  if (!isWebAssemblySupported()) {
    console.warn('您的浏览器不支持WebAssembly，将使用JavaScript降级版本');
    wasmAudioProcessor = createFallbackProcessor();
    return wasmAudioProcessor;
  }
  
  try {
    // 从环境变量获取WebAssembly路径
    const wasmBasePath = process.env.NEXT_PUBLIC_WASM_PATH || '/wasm';
    
    // 动态导入WebAssembly模块
    // 注意: 使用动态import时必须使用相对于根目录的绝对路径
    const wasmModule = await import(/* webpackIgnore: true */ `${wasmBasePath}/audio_processor.js`);
    
    // 初始化WebAssembly模块
    await wasmModule.default();
    
    // 创建处理器实例
    wasmAudioProcessor = new wasmModule.AudioProcessor();
    
    console.log('WebAssembly音频处理器已加载');
    
    return wasmAudioProcessor;
  } catch (error) {
    console.error('WebAssembly加载失败:', error);
    // 如果加载失败，使用JavaScript降级版本
    console.warn('切换到JavaScript降级实现');
    wasmAudioProcessor = createFallbackProcessor();
    return wasmAudioProcessor;
  }
}

/**
 * 检查浏览器是否支持WebAssembly
 * @returns {boolean} 是否支持WebAssembly
 */
export function isWebAssemblySupported() {
  return typeof WebAssembly === 'object' &&
         typeof WebAssembly.instantiate === 'function' &&
         typeof WebAssembly.compile === 'function';
}

/**
 * 检查是否已加载 WebAssembly 模块
 * @returns {boolean} 是否已加载
 */
export function isWasmLoaded() {
  return wasmAudioProcessor !== null;
}

/**
 * 释放 WebAssembly 资源
 */
export function unloadWasmAudioProcessor() {
  releaseWasmProcessor();
}

/**
 * 获取WebAssembly处理器
 * @returns {Object|null} 处理器对象或null
 */
export function getWasmAudioProcessor() {
  return wasmAudioProcessor;
}

/**
 * 创建WebAssembly音频模块的降级版本
 * @returns {Object} 纯JavaScript实现的音频处理接口
 */
export function createFallbackProcessor() {
  console.warn('使用JavaScript降级处理器');
  
  return {
    /**
     * 生成波形数据
     * @param {Float32Array} audioData - 音频数据
     * @param {number} numPoints - 需要的数据点数
     * @returns {Float32Array} 波形数据
     */
    generateWaveform: (audioData, numPoints) => {
      const result = new Float32Array(numPoints);
      
      // 计算每个点需要处理的样本数
      const sampleSize = Math.floor(audioData.length / numPoints);
      
      // 对于每个输出点，找到对应区间的最大值
      for (let i = 0; i < numPoints; i++) {
        const start = i * sampleSize;
        const end = Math.min(start + sampleSize, audioData.length);
        
        // 找到区间内的最大绝对值
        let maxAmplitude = 0;
        for (let j = start; j < end; j++) {
          const amplitude = Math.abs(audioData[j]);
          if (amplitude > maxAmplitude) {
            maxAmplitude = amplitude;
          }
        }
        
        result[i] = maxAmplitude;
      }
      
      // 归一化波形数据
      let maxValue = 0;
      for (let i = 0; i < numPoints; i++) {
        if (result[i] > maxValue) {
          maxValue = result[i];
        }
      }
      
      // 避免除以零
      if (maxValue > 0) {
        for (let i = 0; i < numPoints; i++) {
          result[i] = result[i] / maxValue;
        }
      }
      
      return result;
    },
    
    /**
     * 应用均衡器
     * @param {Float32Array} audioData - 音频数据
     * @param {Object} settings - 均衡器设置 {bass, mid, treble}
     * @returns {Float32Array} 处理后的音频数据
     */
    applyEqualizer: (audioData, settings) => {
      // 与Rust实现保持一致的接口
      const { bass = 1.0, mid = 1.0, treble = 1.0 } = settings;
      const result = new Float32Array(audioData.length);
      
      for (let i = 0; i < audioData.length; i++) {
        // 简单地应用增益
        result[i] = audioData[i] * ((bass + mid + treble) / 3);
      }
      
      return result;
    },
    
    /**
     * 音频压缩
     * @param {Float32Array} audioData - 音频数据
     * @param {Object} settings - 压缩器设置 {threshold, ratio, attack, release, makeup_gain}
     * @returns {Float32Array} 处理后的音频数据
     */
    applyCompression: (audioData, settings) => {
      const { threshold = 0.5, ratio = 4, makeup_gain = 0 } = settings;
      const result = new Float32Array(audioData.length);
      
      for (let i = 0; i < audioData.length; i++) {
        const sample = audioData[i];
        const amplitude = Math.abs(sample);
        
        if (amplitude > threshold) {
          const gain = threshold + (amplitude - threshold) / ratio;
          result[i] = (sample > 0 ? gain : -gain) * (10 ** (makeup_gain / 20));
        } else {
          result[i] = sample;
        }
      }
      
      return result;
    },
    
    /**
     * 分析音频
     * @param {Float32Array} audioData - 音频数据
     * @returns {Object} 音频特征
     */
    analyzeAudio: (audioData) => {
      // 计算RMS
      let sumSquares = 0;
      for (let i = 0; i < audioData.length; i++) {
        sumSquares += audioData[i] * audioData[i];
      }
      const rms = Math.sqrt(sumSquares / audioData.length);
      
      // 计算峰值
      let peak = 0;
      for (let i = 0; i < audioData.length; i++) {
        const abs = Math.abs(audioData[i]);
        if (abs > peak) peak = abs;
      }
      
      return {
        rms,
        peak,
        pitch: null, // JS降级版不支持音高检测
        spectral_centroid: 0,
        zero_crossing_rate: 0
      };
    },
    
    /**
     * 获取版本信息
     * @returns {string} 版本字符串
     */
    getVersion: () => {
      return "JavaScript Fallback v1.0.0";
    }
  };
}

/**
 * 释放WebAssembly处理器资源
 */
export function releaseWasmProcessor() {
  if (wasmAudioProcessor) {
    if (typeof wasmAudioProcessor.free === 'function') {
      wasmAudioProcessor.free();
    }
    wasmAudioProcessor = null;
  }
} 