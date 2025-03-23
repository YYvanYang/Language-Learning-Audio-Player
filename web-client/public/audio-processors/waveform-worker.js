/**
 * 波形生成Web Worker
 * 用于将音频数据处理为可视化波形
 */

// 接收消息并处理
self.onmessage = function(e) {
  const { audioData, numPoints, downsampleFactor = 1 } = e.data;
  
  if (!audioData || !numPoints) {
    self.postMessage({ error: '缺少必要参数' });
    return;
  }
  
  try {
    // 生成波形数据
    const waveform = generateWaveform(audioData, numPoints, downsampleFactor);
    
    // 发送结果
    self.postMessage({ waveform });
  } catch (err) {
    self.postMessage({ error: err.message });
  }
};

/**
 * 生成波形数据
 * @param {Float32Array} audioData - 音频数据
 * @param {number} numPoints - 需要的数据点数
 * @param {number} downsampleFactor - 降采样因子
 * @returns {Float32Array} 波形数据
 */
function generateWaveform(audioData, numPoints, downsampleFactor) {
  // 创建结果数组
  const result = new Float32Array(numPoints);
  
  // 计算每个点需要处理的样本数
  const sampleSize = Math.floor(audioData.length / numPoints) * downsampleFactor;
  
  // 对于每个输出点，找到对应区间的最大值
  for (let i = 0; i < numPoints; i++) {
    const start = Math.floor(i * sampleSize);
    const end = Math.min(Math.floor((i + 1) * sampleSize), audioData.length);
    
    // 如果区间无效，设置为0
    if (start >= end) {
      result[i] = 0;
      continue;
    }
    
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
  normalizeWaveform(result);
  
  return result;
}

/**
 * 归一化波形数据到0-1范围
 * @param {Float32Array} waveform - 波形数据
 * @returns {Float32Array} 归一化后的波形数据
 */
function normalizeWaveform(waveform) {
  // 找到最大值
  let maxValue = 0;
  for (let i = 0; i < waveform.length; i++) {
    if (waveform[i] > maxValue) {
      maxValue = waveform[i];
    }
  }
  
  // 避免除以零
  if (maxValue === 0) {
    return waveform;
  }
  
  // 归一化
  for (let i = 0; i < waveform.length; i++) {
    waveform[i] = waveform[i] / maxValue;
  }
  
  return waveform;
}

/**
 * 平滑波形数据
 * @param {Float32Array} waveform - 波形数据
 * @param {number} factor - 平滑因子 (0-1)
 * @returns {Float32Array} 平滑后的波形数据
 */
function smoothWaveform(waveform, factor = 0.5) {
  const result = new Float32Array(waveform.length);
  
  // 第一个点不变
  result[0] = waveform[0];
  
  // 应用平滑算法
  for (let i = 1; i < waveform.length; i++) {
    result[i] = factor * waveform[i] + (1 - factor) * result[i - 1];
  }
  
  return result;
} 