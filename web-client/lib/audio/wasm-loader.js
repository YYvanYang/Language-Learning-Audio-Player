/**
 * WebAssembly 加载和管理工具
 */

// 用于存储已加载的 WebAssembly 模块
let wasmModule = null;
let wasmInstance = null;
let isLoading = false;
let loadPromise = null;

/**
 * 加载 WebAssembly 模块
 * @returns {Promise<Object>} WebAssembly 实例接口
 */
export async function loadWasmAudioProcessor() {
  // 如果已经加载了，直接返回
  if (wasmInstance) {
    return wasmInstance;
  }
  
  // 如果正在加载中，返回同一个 Promise
  if (isLoading && loadPromise) {
    return loadPromise;
  }
  
  // 开始加载过程
  isLoading = true;
  
  // 创建加载 Promise
  loadPromise = (async () => {
    try {
      // 注意：此路径需要根据实际部署情况调整
      const wasmPath = '/audio-processor.wasm';
      
      // 获取 .wasm 文件
      const response = await fetch(wasmPath);
      
      if (!response.ok) {
        throw new Error(`Failed to load WebAssembly module: ${response.statusText}`);
      }
      
      // 获取二进制数据
      const wasmBytes = await response.arrayBuffer();
      
      // 编译 WebAssembly 模块
      wasmModule = await WebAssembly.compile(wasmBytes);
      
      // 实例化模块
      const instance = await WebAssembly.instantiate(wasmModule, {
        env: {
          // 浏览器环境函数
          memory: new WebAssembly.Memory({ initial: 10, maximum: 100 }),
          
          // 可以在这里导入 JavaScript 函数给 Rust 使用
          console_log: (ptr, len) => {
            const memory = instance.exports.memory;
            const buffer = new Uint8Array(memory.buffer, ptr, len);
            const text = new TextDecoder().decode(buffer);
            console.log('[WASM]', text);
          },
          
          performance_now: () => {
            return performance.now();
          }
        }
      });
      
      // 创建友好的 API 接口
      wasmInstance = {
        // 波形生成函数
        generateWaveform: (audioData, numPoints) => {
          try {
            // 分配内存
            const audioDataPtr = instance.exports.allocate(audioData.length * 4);
            
            // 创建视图
            const memory = instance.exports.memory;
            const audioDataView = new Float32Array(memory.buffer, audioDataPtr, audioData.length);
            
            // 复制数据
            audioDataView.set(audioData);
            
            // 调用 Rust 函数
            const resultPtr = instance.exports.generate_waveform(audioDataPtr, audioData.length, numPoints);
            
            // 获取结果
            const resultView = new Float32Array(memory.buffer, resultPtr, numPoints);
            
            // 复制结果到新数组，避免内存释放后数据丢失
            const result = new Float32Array(resultView);
            
            // 释放内存
            instance.exports.deallocate(audioDataPtr, audioData.length * 4);
            instance.exports.deallocate(resultPtr, numPoints * 4);
            
            return result;
          } catch (error) {
            console.error('WebAssembly generateWaveform error:', error);
            return new Float32Array(numPoints);
          }
        },
        
        // 音频均衡器处理
        applyEqualizer: (audioData, bass, mid, treble) => {
          try {
            // 分配内存
            const audioDataPtr = instance.exports.allocate(audioData.length * 4);
            
            // 创建视图
            const memory = instance.exports.memory;
            const audioDataView = new Float32Array(memory.buffer, audioDataPtr, audioData.length);
            
            // 复制数据
            audioDataView.set(audioData);
            
            // 调用 Rust 函数
            instance.exports.apply_equalizer(audioDataPtr, audioData.length, bass, mid, treble);
            
            // 获取处理后的数据
            const processedData = new Float32Array(audioDataView);
            
            // 释放内存
            instance.exports.deallocate(audioDataPtr, audioData.length * 4);
            
            return processedData;
          } catch (error) {
            console.error('WebAssembly applyEqualizer error:', error);
            return audioData;
          }
        },
        
        // 音频压缩处理
        applyCompression: (audioData, threshold, ratio) => {
          try {
            // 分配内存
            const audioDataPtr = instance.exports.allocate(audioData.length * 4);
            
            // 创建视图
            const memory = instance.exports.memory;
            const audioDataView = new Float32Array(memory.buffer, audioDataPtr, audioData.length);
            
            // 复制数据
            audioDataView.set(audioData);
            
            // 调用 Rust 函数
            instance.exports.apply_compression(audioDataPtr, audioData.length, threshold, ratio);
            
            // 获取处理后的数据
            const processedData = new Float32Array(audioDataView);
            
            // 释放内存
            instance.exports.deallocate(audioDataPtr, audioData.length * 4);
            
            return processedData;
          } catch (error) {
            console.error('WebAssembly applyCompression error:', error);
            return audioData;
          }
        },
        
        // 音频分析
        analyzeAudio: (audioData) => {
          try {
            // 分配内存
            const audioDataPtr = instance.exports.allocate(audioData.length * 4);
            
            // 创建视图
            const memory = instance.exports.memory;
            const audioDataView = new Float32Array(memory.buffer, audioDataPtr, audioData.length);
            
            // 复制数据
            audioDataView.set(audioData);
            
            // 调用 Rust 函数
            const resultPtr = instance.exports.analyze_audio(audioDataPtr, audioData.length);
            
            // 读取分析结果
            // 假设 Rust 返回的是一个包含 rms, peak, zeroCrossings 等字段的结构体
            // 这里需要根据实际的 Rust 代码调整
            const resultView = new Float32Array(memory.buffer, resultPtr, 4);
            
            const result = {
              rms: resultView[0],
              peak: resultView[1],
              zeroCrossings: resultView[2],
              spectralCentroid: resultView[3]
            };
            
            // 释放内存
            instance.exports.deallocate(audioDataPtr, audioData.length * 4);
            instance.exports.deallocate(resultPtr, 4 * 4);
            
            return result;
          } catch (error) {
            console.error('WebAssembly analyzeAudio error:', error);
            return {
              rms: 0,
              peak: 0,
              zeroCrossings: 0,
              spectralCentroid: 0
            };
          }
        },
        
        // 获取 WebAssembly 版本信息
        getVersion: () => {
          try {
            // 确保版本导出函数存在
            if (typeof instance.exports.get_version === 'function') {
              const versionPtr = instance.exports.get_version();
              
              // 读取版本字符串
              const memory = instance.exports.memory;
              const view = new Uint8Array(memory.buffer);
              
              // 找到字符串终止符
              let length = 0;
              while (view[versionPtr + length] !== 0) {
                length++;
              }
              
              // 解码字符串
              const versionArray = new Uint8Array(memory.buffer, versionPtr, length);
              const version = new TextDecoder().decode(versionArray);
              
              return version;
            }
            return "Unknown";
          } catch (error) {
            console.error('WebAssembly getVersion error:', error);
            return "Error";
          }
        }
      };
      
      // 重置状态
      isLoading = false;
      
      // 输出成功信息
      console.log(`Audio processor WebAssembly module loaded, version: ${wasmInstance.getVersion()}`);
      
      return wasmInstance;
    } catch (error) {
      // 重置状态
      isLoading = false;
      wasmModule = null;
      wasmInstance = null;
      
      console.error('Failed to load WebAssembly module:', error);
      throw error;
    }
  })();
  
  return loadPromise;
}

/**
 * 检查当前浏览器是否支持 WebAssembly
 * @returns {boolean} 是否支持 WebAssembly
 */
export function isWebAssemblySupported() {
  return (
    typeof WebAssembly === 'object' &&
    typeof WebAssembly.instantiate === 'function' &&
    typeof WebAssembly.compile === 'function'
  );
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
 * 获取已加载的 WebAssembly 实例
 * @returns {Object|null} WebAssembly 实例接口或 null
 */
export function getWasmAudioProcessor() {
  return wasmInstance;
} 