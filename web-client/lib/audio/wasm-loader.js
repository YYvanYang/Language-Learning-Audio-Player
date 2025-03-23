/**
 * WebAssembly 加载和管理工具
 */

// 用于存储已加载的 WebAssembly 模块
let wasmModule = null;
let wasmInstance = null;
let isLoading = false;
let loadPromise = null;

/**
 * WebAssembly处理器实例
 * @type {Object|null}
 */
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
    throw new Error('您的浏览器不支持WebAssembly');
  }
  
  try {
    // 开发环境路径调整
    const wasmBasePath = '/wasm';
    
    // 动态导入WebAssembly模块
    // 注意：这可能需要根据实际部署环境调整路径
    const wasmModule = await import(`${wasmBasePath}/audio_processor.js`);
    
    // 初始化WebAssembly模块
    await wasmModule.default();
    
    // 创建处理器实例
    wasmAudioProcessor = new wasmModule.AudioProcessor();
    
    console.log('WebAssembly音频处理器已加载');
    
    return wasmAudioProcessor;
  } catch (error) {
    console.error('WebAssembly加载失败:', error);
    throw new Error('无法加载WebAssembly音频处理器');
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
  return wasmInstance !== null;
}

/**
 * 释放 WebAssembly 资源
 */
export function unloadWasmAudioProcessor() {
  wasmModule = null;
  wasmInstance = null;
  isLoading = false;
  loadPromise = null;
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
     * @param {number} bass - 低音增益
     * @param {number} mid - 中音增益
     * @param {number} treble - 高音增益
     * @returns {Float32Array} 处理后的音频数据
     */
    applyEqualizer: (audioData, bass, mid, treble) => {
      // 这是一个非常简化的均衡器实现
      // 实际均衡器需要更复杂的频域处理
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
     * @param {number} threshold - 阈值
     * @param {number} ratio - 压缩比率
     * @returns {Float32Array} 处理后的音频数据
     */
    applyCompression: (audioData, threshold, ratio) => {
      const result = new Float32Array(audioData.length);
      
      for (let i = 0; i < audioData.length; i++) {
        const sample = audioData[i];
        const amplitude = Math.abs(sample);
        
        if (amplitude > threshold) {
          const gain = threshold + (amplitude - threshold) / ratio;
          result[i] = sample > 0 ? gain : -gain;
        } else {
          result[i] = sample;
        }
      }
      
      return result;
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