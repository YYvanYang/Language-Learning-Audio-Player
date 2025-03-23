// lib/audio/processing.js
let processingManagerInstance = null;

/**
 * 初始化音频处理器
 * 加载并初始化WebAssembly音频处理模块
 * 
 * @returns {Promise<Object>} 初始化后的处理器
 */
export async function initAudioProcessor() {
  // 如果已经初始化，直接返回
  if (processingManagerInstance) {
    return processingManagerInstance;
  }
  
  try {
    // 动态导入WebAssembly模块
    // 检查WebAssembly是否受支持
    if (typeof WebAssembly !== 'object') {
      console.warn('WebAssembly不受支持，将禁用高级音频处理');
      return createFallbackProcessor();
    }
    
    // 尝试加载WebAssembly模块
    const wasm = await import('/wasm/audio_processing.js');
    await wasm.default();
    
    // 创建处理器
    processingManagerInstance = await createWasmProcessor(wasm);
    console.log('WebAssembly音频处理模块已初始化');
    
    return processingManagerInstance;
  } catch (error) {
    console.error('WebAssembly音频处理模块加载失败:', error);
    
    // 使用JavaScript实现的后备处理器
    return createFallbackProcessor();
  }
}

/**
 * 创建WebAssembly音频处理器
 * 
 * @param {Object} wasmModule - 加载的WebAssembly模块
 * @returns {Object} 音频处理器接口
 */
async function createWasmProcessor(wasmModule) {
  // 创建内部处理器
  const processor = new wasmModule.AudioProcessor(44100, 2);
  
  return {
    // 设置参数
    init(sampleRate, channels) {
      // 如果传入了新的参数，重新创建处理器
      if (sampleRate && channels) {
        processor = new wasmModule.AudioProcessor(sampleRate, channels);
      }
    },
    
    // 生成波形数据
    generateWaveformData(audioData, numPoints = 200) {
      return processor.generate_waveform_data(audioData, numPoints);
    },
    
    // 应用均衡器
    applyEqualizer(audioData, bass = 1.0, mid = 1.0, treble = 1.0) {
      // 创建副本以避免修改原始数据
      const dataCopy = new Float32Array(audioData);
      processor.apply_equalizer(dataCopy, bass, mid, treble);
      return dataCopy;
    },
    
    // 音量标准化
    normalizeVolume(audioData, targetLevel = 0.8) {
      const dataCopy = new Float32Array(audioData);
      const gain = processor.normalize_volume(dataCopy, targetLevel);
      return { 
        processedData: dataCopy, 
        gain 
      };
    },
    
    // 应用压缩器
    applyCompressor(audioData, threshold = 0.5, ratio = 4.0, attack = 0.01, release = 0.1) {
      const dataCopy = new Float32Array(audioData);
      processor.apply_compressor(dataCopy, threshold, ratio, attack, release);
      return dataCopy;
    },
    
    // 计算A/B循环点
    calculateLoopPoints(totalSamples, startPercent, endPercent) {
      return processor.calculate_loop_points(totalSamples, startPercent, endPercent);
    },
    
    // 检查是否使用WebAssembly
    isUsingWasm: true
  };
}

/**
 * 创建JavaScript实现的后备处理器
 * 当WebAssembly不可用或加载失败时使用
 * 
 * @returns {Object} 音频处理器接口
 */
function createFallbackProcessor() {
  return {
    // 初始化参数 - JS版本不需要
    init() {
      // 不操作
    },
    
    // 生成波形数据 - JavaScript实现
    generateWaveformData(audioData, numPoints = 200) {
      const result = new Float32Array(numPoints);
      const blockSize = Math.floor(audioData.length / numPoints);
      
      for (let i = 0; i < numPoints; i++) {
        const start = i * blockSize;
        const end = Math.min(start + blockSize, audioData.length);
        
        let sum = 0;
        for (let j = start; j < end; j++) {
          sum += Math.abs(audioData[j]);
        }
        
        result[i] = sum / blockSize;
      }
      
      // 归一化到0-1范围
      const maxValue = Math.max(...result);
      if (maxValue > 0) {
        for (let i = 0; i < result.length; i++) {
          result[i] /= maxValue;
        }
      }
      
      return result;
    },
    
    // 应用均衡器 - 简化实现
    applyEqualizer(audioData, bass = 1.0, mid = 1.0, treble = 1.0) {
      // JavaScript版本只实现简单的增益
      const result = new Float32Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        result[i] = audioData[i] * ((bass + mid + treble) / 3);
      }
      return result;
    },
    
    // 音量标准化 - 简化实现
    normalizeVolume(audioData, targetLevel = 0.8) {
      // 找出最大值
      let maxValue = 0;
      for (let i = 0; i < audioData.length; i++) {
        maxValue = Math.max(maxValue, Math.abs(audioData[i]));
      }
      
      // 计算增益
      const gain = maxValue > 0 ? targetLevel / maxValue : 1;
      
      // 应用增益
      const result = new Float32Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        result[i] = audioData[i] * gain;
      }
      
      return { 
        processedData: result, 
        gain 
      };
    },
    
    // 应用压缩器 - 简化实现
    applyCompressor(audioData, threshold = 0.5, ratio = 4.0, attack = 0.01, release = 0.1) {
      // JavaScript简化版本，仅进行基础压缩
      const result = new Float32Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        const value = audioData[i];
        const absValue = Math.abs(value);
        
        if (absValue > threshold) {
          // 过阈值部分进行压缩
          const excess = absValue - threshold;
          const compressed = threshold + excess / ratio;
          result[i] = value > 0 ? compressed : -compressed;
        } else {
          result[i] = value;
        }
      }
      
      return result;
    },
    
    // 计算A/B循环点
    calculateLoopPoints(totalSamples, startPercent, endPercent) {
      const startSample = Math.floor(totalSamples * startPercent / 100);
      const endSample = Math.floor(totalSamples * endPercent / 100);
      return [startSample, endSample];
    },
    
    // 标记为非WebAssembly版本
    isUsingWasm: false
  };
}