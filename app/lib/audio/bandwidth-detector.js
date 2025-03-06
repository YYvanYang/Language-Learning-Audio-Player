// lib/audio/bandwidth-detector.js

// 缓存键
const BANDWIDTH_CACHE_KEY = 'bandwidth_test_result';
// 缓存有效期（毫秒）
const CACHE_TTL = 3600000; // 1小时
// 带宽测试文件大小（字节）
const TEST_FILE_SIZE = 1024 * 1024; // 1MB
// 最小测试时间（毫秒）
const MIN_TEST_DURATION = 1000;
// 最大测试时间（毫秒）
const MAX_TEST_DURATION = 5000;
// 测试超时时间（毫秒）
const TEST_TIMEOUT = 7000;

/**
 * 检测当前网络带宽
 * @returns {Promise<number>} 带宽（Kbps）
 */
export async function detectBandwidth() {
  // 首先尝试从缓存获取
  const cachedBandwidth = getBandwidthFromCache();
  if (cachedBandwidth) {
    return cachedBandwidth;
  }

  try {
    // 构建带有随机参数的URL防止缓存
    const testUrl = `/api/bandwidth-test?r=${Math.random()}`;
    
    // 记录开始时间
    const startTime = Date.now();
    
    // 创建带超时的Promise
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TEST_TIMEOUT);
    
    // 发起请求
    const response = await fetch(testUrl, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal
    });
    
    // 获取响应体作为ReadableStream
    const reader = response.body.getReader();
    let receivedBytes = 0;
    
    // 读取数据流
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      receivedBytes += value.length;
      
      // 检查是否已接收足够的数据或时间已足够长
      const elapsedTime = Date.now() - startTime;
      if (receivedBytes >= TEST_FILE_SIZE || elapsedTime >= MAX_TEST_DURATION) {
        break;
      }
    }
    
    // 清除超时
    clearTimeout(timeoutId);
    
    // 计算结束时间
    const endTime = Date.now();
    const elapsedTime = endTime - startTime;
    
    // 确保测试时间至少为MIN_TEST_DURATION
    if (elapsedTime < MIN_TEST_DURATION) {
      console.warn('带宽测试时间过短，可能不准确');
    }
    
    // 计算带宽（Kbps）
    // 将字节转为比特，再除以秒数获得bps，再除以1000转为Kbps
    const bandwidth = Math.round((receivedBytes * 8) / (elapsedTime / 1000) / 1000);
    
    // 缓存结果
    cacheBandwidthResult(bandwidth);
    
    return bandwidth;
  } catch (error) {
    console.error('带宽检测失败:', error);
    // 如果测试失败，返回默认保守估计值（128 Kbps）
    return 128;
  }
}

/**
 * 从缓存中获取带宽测量结果
 * @returns {number|null} 缓存的带宽值或null
 */
function getBandwidthFromCache() {
  if (typeof localStorage === 'undefined') return null;
  
  try {
    const cachedData = localStorage.getItem(BANDWIDTH_CACHE_KEY);
    if (!cachedData) return null;
    
    const { bandwidth, timestamp } = JSON.parse(cachedData);
    const now = Date.now();
    
    // 检查缓存是否过期
    if (now - timestamp < CACHE_TTL) {
      return bandwidth;
    }
    
    return null;
  } catch (error) {
    console.error('读取带宽缓存失败:', error);
    return null;
  }
}

/**
 * 缓存带宽测试结果
 * @param {number} bandwidth 测量的带宽（Kbps）
 */
function cacheBandwidthResult(bandwidth) {
  if (typeof localStorage === 'undefined') return;
  
  try {
    const data = {
      bandwidth,
      timestamp: Date.now()
    };
    
    localStorage.setItem(BANDWIDTH_CACHE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('缓存带宽结果失败:', error);
  }
}

/**
 * 清除带宽缓存
 */
export function clearBandwidthCache() {
  if (typeof localStorage === 'undefined') return;
  
  try {
    localStorage.removeItem(BANDWIDTH_CACHE_KEY);
  } catch (error) {
    console.error('清除带宽缓存失败:', error);
  }
}

/**
 * 基于带宽选择合适的音频质量
 * @param {number} bandwidth 检测到的带宽（Kbps）
 * @returns {string} 音频质量级别（'low', 'medium', 'high'）
 */
export function selectAudioQuality(bandwidth) {
  // 添加安全余量（20%）
  const adjustedBandwidth = bandwidth * 0.8;
  
  // 根据带宽选择合适的质量
  if (adjustedBandwidth < 80) {
    return 'low';     // 适合64kbps音频
  } else if (adjustedBandwidth < 200) {
    return 'medium';  // 适合128kbps音频
  } else {
    return 'high';    // 适合256kbps或更高音频
  }
}