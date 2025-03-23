/**
 * 波形生成和处理工具函数
 */

/**
 * 从音频数据生成波形数据
 * @param {Float32Array} audioData - 音频数据数组
 * @param {number} numPoints - 需要生成的波形点数
 * @returns {Float32Array} 波形数据数组
 */
export function generateWaveform(audioData, numPoints) {
  if (!audioData || audioData.length === 0 || !numPoints) {
    console.warn('无效的音频数据或点数');
    return new Float32Array(numPoints || 0);
  }

  // 创建结果数组
  const result = new Float32Array(numPoints);
  
  // 计算每个点包含的样本数量
  const samplesPerPoint = Math.floor(audioData.length / numPoints);
  
  // 如果没有足够的样本，直接返回空数组
  if (samplesPerPoint < 1) {
    console.warn('音频数据不足以生成指定数量的波形点');
    return result;
  }
  
  // 遍历每个波形点
  for (let i = 0; i < numPoints; i++) {
    const startIndex = i * samplesPerPoint;
    const endIndex = Math.min(startIndex + samplesPerPoint, audioData.length);
    
    // 初始化最大值和最小值
    let min = audioData[startIndex];
    let max = audioData[startIndex];
    
    // 查找该区间的最大值和最小值
    for (let j = startIndex; j < endIndex; j++) {
      if (audioData[j] < min) min = audioData[j];
      if (audioData[j] > max) max = audioData[j];
    }
    
    // 保存最大绝对值
    result[i] = Math.max(Math.abs(min), Math.abs(max));
  }
  
  return result;
}

/**
 * 从音频缓冲区生成波形数据
 * @param {AudioBuffer} audioBuffer - Web Audio API 的 AudioBuffer 对象
 * @param {number} numPoints - 需要生成的波形点数
 * @returns {Float32Array} 波形数据数组
 */
export function generateWaveformFromBuffer(audioBuffer, numPoints) {
  if (!audioBuffer || !numPoints) {
    return new Float32Array(numPoints || 0);
  }
  
  // 获取第一个声道的数据
  const audioData = audioBuffer.getChannelData(0);
  
  return generateWaveform(audioData, numPoints);
}

/**
 * 对波形数据进行归一化处理
 * @param {Float32Array} waveformData - 波形数据数组
 * @returns {Float32Array} 归一化后的波形数据
 */
export function normalizeWaveform(waveformData) {
  if (!waveformData || waveformData.length === 0) {
    return new Float32Array(0);
  }
  
  // 查找最大值
  let max = 0;
  for (let i = 0; i < waveformData.length; i++) {
    if (waveformData[i] > max) {
      max = waveformData[i];
    }
  }
  
  // 如果最大值太小，避免除以零
  if (max < 0.0001) {
    return new Float32Array(waveformData.length).fill(0);
  }
  
  // 创建归一化后的数组
  const normalized = new Float32Array(waveformData.length);
  
  // 归一化每个值
  for (let i = 0; i < waveformData.length; i++) {
    normalized[i] = waveformData[i] / max;
  }
  
  return normalized;
}

/**
 * 对波形数据进行平滑处理
 * @param {Float32Array} waveformData - 波形数据数组
 * @param {number} windowSize - 平滑窗口大小
 * @returns {Float32Array} 平滑后的波形数据
 */
export function smoothWaveform(waveformData, windowSize = 3) {
  if (!waveformData || waveformData.length === 0) {
    return new Float32Array(0);
  }
  
  // 确保窗口大小是奇数
  windowSize = Math.max(3, Math.floor(windowSize));
  if (windowSize % 2 === 0) windowSize++;
  
  // 如果窗口大小大于数据长度，减小窗口大小
  if (windowSize > waveformData.length) {
    windowSize = Math.max(3, waveformData.length - (waveformData.length % 2 === 0 ? 1 : 0));
  }
  
  const halfWindow = Math.floor(windowSize / 2);
  const smoothed = new Float32Array(waveformData.length);
  
  // 对每个点应用均值滤波
  for (let i = 0; i < waveformData.length; i++) {
    let sum = 0;
    let count = 0;
    
    for (let j = -halfWindow; j <= halfWindow; j++) {
      const index = i + j;
      if (index >= 0 && index < waveformData.length) {
        sum += waveformData[index];
        count++;
      }
    }
    
    smoothed[i] = sum / count;
  }
  
  return smoothed;
}

/**
 * 将波形数据调整为特定长度
 * @param {Float32Array} waveformData - 波形数据数组
 * @param {number} targetLength - 目标长度
 * @returns {Float32Array} 调整后的波形数据
 */
export function resizeWaveform(waveformData, targetLength) {
  if (!waveformData || waveformData.length === 0 || targetLength <= 0) {
    return new Float32Array(targetLength || 0);
  }
  
  // 如果长度相同，返回原数组的拷贝
  if (waveformData.length === targetLength) {
    return new Float32Array(waveformData);
  }
  
  const result = new Float32Array(targetLength);
  
  // 计算缩放因子
  const scaleFactor = waveformData.length / targetLength;
  
  for (let i = 0; i < targetLength; i++) {
    const indexStart = Math.floor(i * scaleFactor);
    const indexEnd = Math.floor((i + 1) * scaleFactor);
    
    let max = 0;
    
    // 查找区间内的最大值
    for (let j = indexStart; j < indexEnd && j < waveformData.length; j++) {
      if (waveformData[j] > max) {
        max = waveformData[j];
      }
    }
    
    result[i] = max;
  }
  
  return result;
}

/**
 * 根据音频持续时间和采样率，估算生成波形所需的内存
 * @param {number} duration - 音频持续时间（秒）
 * @param {number} sampleRate - 采样率（默认44100）
 * @returns {number} 估算的内存占用（字节）
 */
export function estimateWaveformMemory(duration, sampleRate = 44100) {
  // 每个样本占用 4 字节（Float32）
  const bytesPerSample = 4;
  
  // 总样本数
  const totalSamples = duration * sampleRate;
  
  // 内存占用（字节）
  return totalSamples * bytesPerSample;
}

/**
 * 将时间转换为波形数据中的索引
 * @param {number} time - 当前时间（秒）
 * @param {number} duration - 音频总时长（秒）
 * @param {number} waveformLength - 波形数据长度
 * @returns {number} 波形数据中的索引
 */
export function timeToWaveformIndex(time, duration, waveformLength) {
  if (!duration || !waveformLength) return 0;
  
  const percentage = Math.max(0, Math.min(1, time / duration));
  return Math.floor(percentage * waveformLength);
}

/**
 * 从波形数据索引转换为时间
 * @param {number} index - 波形数据中的索引
 * @param {number} waveformLength - 波形数据长度
 * @param {number} duration - 音频总时长（秒）
 * @returns {number} 时间（秒）
 */
export function waveformIndexToTime(index, waveformLength, duration) {
  if (!waveformLength || !duration) return 0;
  
  const percentage = Math.max(0, Math.min(1, index / waveformLength));
  return percentage * duration;
} 