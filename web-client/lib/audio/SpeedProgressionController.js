/**
 * 语速渐进式调整控制器
 * 实现语言学习中逐步提高音频播放速度的功能
 */

/**
 * 渐进式调整模式
 */
export const ProgressionMode = {
  // 线性：从起始速度均匀增加到目标速度
  LINEAR: 'linear',
  // 阶梯式：按照固定的阶梯增加速度
  STEP: 'step',
  // 指数：初期缓慢增加，后期快速增加
  EXPONENTIAL: 'exponential',
  // 对数：初期快速增加，后期缓慢增加
  LOGARITHMIC: 'logarithmic',
  // 自适应：根据用户掌握程度动态调整
  ADAPTIVE: 'adaptive'
};

/**
 * 预设方案
 */
export const ProgressionPresets = {
  // 初学者：从0.6速度开始，慢慢提高到0.8
  BEGINNER: {
    initialRate: 0.6,
    targetRate: 0.8,
    duration: 300, // 5分钟
    mode: ProgressionMode.LINEAR
  },
  // 中级：从0.8速度开始，提高到1.0（正常速度）
  INTERMEDIATE: {
    initialRate: 0.8,
    targetRate: 1.0,
    duration: 300, // 5分钟
    mode: ProgressionMode.LINEAR
  },
  // 高级：从1.0速度开始，提高到1.2（略快）
  ADVANCED: {
    initialRate: 1.0,
    targetRate: 1.2,
    duration: 300, // 5分钟
    mode: ProgressionMode.LINEAR
  },
  // 专家：使用阶梯式从0.8到1.5
  EXPERT: {
    initialRate: 0.8,
    targetRate: 1.5,
    duration: 600, // 10分钟
    mode: ProgressionMode.STEP,
    steps: 5 // 5个阶梯
  },
  // 快速适应：使用对数模式从0.7快速提高到正常速度
  QUICK_ADAPT: {
    initialRate: 0.7,
    targetRate: 1.0,
    duration: 180, // 3分钟
    mode: ProgressionMode.LOGARITHMIC
  },
  // 强化训练：使用自适应模式，根据掌握程度动态调整
  INTENSIVE: {
    initialRate: 0.8,
    targetRate: 1.3,
    duration: 900, // 15分钟
    mode: ProgressionMode.ADAPTIVE,
    adaptationFactor: 0.8 // 适应系数
  }
};

/**
 * 语速渐进式调整控制器类
 */
export class SpeedProgressionController {
  /**
   * 创建一个语速渐进调整控制器
   * @param {Object} options - 配置选项
   * @param {number} options.initialRate - 起始播放速率(0.5-2.0)
   * @param {number} options.targetRate - 目标播放速率(0.5-2.0)
   * @param {number} options.duration - 渐进持续时间(秒)
   * @param {string} options.mode - 渐进模式
   * @param {number} options.steps - 阶梯式模式下的阶梯数
   * @param {number} options.adaptationFactor - 自适应模式下的适应系数(0-1)
   * @param {Function} options.onRateChange - 速率变化的回调函数
   */
  constructor(options = {}) {
    // 设置默认值和验证输入
    this.initialRate = this.clampRate(options.initialRate || 0.8);
    this.targetRate = this.clampRate(options.targetRate || 1.0);
    this.duration = Math.max(10, options.duration || 300); // 最短10秒
    this.mode = options.mode || ProgressionMode.LINEAR;
    this.steps = Math.max(2, options.steps || 4); // 最少2个阶梯
    this.adaptationFactor = this.clamp(options.adaptationFactor || 0.5, 0, 1);
    this.onRateChange = typeof options.onRateChange === 'function' 
      ? options.onRateChange
      : () => {};
      
    // 内部状态
    this.startTime = 0;
    this.currentRate = this.initialRate;
    this.isActive = false;
    this.lastUpdateTime = 0;
    this.adaptiveFeedback = []; // 用于自适应模式的反馈历史
    this.stepRates = this.calculateStepRates(); // 阶梯式模式的速率数组
    
    // 定时器ID
    this.updateTimerId = null;
  }
  
  /**
   * 限制速率在有效范围内(0.5-2.0)
   * @param {number} rate - 速率
   * @returns {number} 调整后的速率
   */
  clampRate(rate) {
    return this.clamp(rate, 0.5, 2.0);
  }
  
  /**
   * 将值限制在最小值和最大值之间
   * @param {number} value - 要限制的值
   * @param {number} min - 最小值
   * @param {number} max - 最大值
   * @returns {number} 限制后的值
   */
  clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }
  
  /**
   * 计算阶梯式模式的速率数组
   * @returns {Array<number>} 速率数组
   */
  calculateStepRates() {
    const rates = [];
    const step = (this.targetRate - this.initialRate) / (this.steps - 1);
    
    for (let i = 0; i < this.steps; i++) {
      rates.push(this.initialRate + step * i);
    }
    
    return rates;
  }
  
  /**
   * 开始语速渐进调整
   * @param {number} currentTime - 当前播放时间（秒）
   */
  start(currentTime = 0) {
    this.startTime = currentTime;
    this.lastUpdateTime = currentTime;
    this.currentRate = this.initialRate;
    this.isActive = true;
    this.adaptiveFeedback = [];
    
    // 立即应用初始速率
    this.onRateChange(this.currentRate);
    
    // 如果是阶梯式模式，重新计算阶梯
    if (this.mode === ProgressionMode.STEP) {
      this.stepRates = this.calculateStepRates();
    }
    
    // 设置定期更新
    this.scheduleUpdate();
    
    return this.currentRate;
  }
  
  /**
   * 停止语速渐进调整
   */
  stop() {
    this.isActive = false;
    
    // 清除定时器
    if (this.updateTimerId) {
      clearInterval(this.updateTimerId);
      this.updateTimerId = null;
    }
    
    return this.currentRate;
  }
  
  /**
   * 重置控制器
   */
  reset() {
    this.stop();
    this.currentRate = this.initialRate;
    this.startTime = 0;
    this.lastUpdateTime = 0;
    this.adaptiveFeedback = [];
    
    // 应用初始速率
    this.onRateChange(this.currentRate);
    
    return this.currentRate;
  }
  
  /**
   * 安排定期更新
   */
  scheduleUpdate() {
    // 清除现有定时器
    if (this.updateTimerId) {
      clearInterval(this.updateTimerId);
    }
    
    // 设置新定时器，每秒更新一次
    this.updateTimerId = setInterval(() => {
      if (!this.isActive) return;
      
      // 更新当前时间（模拟实时播放）
      this.lastUpdateTime += 1;
      
      // 更新速率
      this.updateRate(this.lastUpdateTime);
    }, 1000);
  }
  
  /**
   * 更新当前播放速率
   * @param {number} currentTime - 当前播放时间（秒）
   */
  updateRate(currentTime) {
    if (!this.isActive) return this.currentRate;
    
    // 计算经过的时间
    const elapsedTime = currentTime - this.startTime;
    
    // 如果超过了持续时间，使用目标速率
    if (elapsedTime >= this.duration) {
      this.currentRate = this.targetRate;
      this.stop(); // 达到目标后停止自动调整
    } else {
      // 根据不同模式计算当前速率
      switch (this.mode) {
        case ProgressionMode.LINEAR:
          this.currentRate = this.calculateLinearRate(elapsedTime);
          break;
        case ProgressionMode.STEP:
          this.currentRate = this.calculateStepRate(elapsedTime);
          break;
        case ProgressionMode.EXPONENTIAL:
          this.currentRate = this.calculateExponentialRate(elapsedTime);
          break;
        case ProgressionMode.LOGARITHMIC:
          this.currentRate = this.calculateLogarithmicRate(elapsedTime);
          break;
        case ProgressionMode.ADAPTIVE:
          this.currentRate = this.calculateAdaptiveRate(elapsedTime);
          break;
        default:
          this.currentRate = this.calculateLinearRate(elapsedTime);
      }
    }
    
    // 调用速率变化回调
    this.onRateChange(this.currentRate);
    
    return this.currentRate;
  }
  
  /**
   * 手动设置当前时间（用于同步播放进度）
   * @param {number} currentTime - 当前播放时间（秒）
   */
  setCurrentTime(currentTime) {
    if (!this.isActive) return this.currentRate;
    
    this.lastUpdateTime = currentTime;
    return this.updateRate(currentTime);
  }
  
  /**
   * 计算线性模式下的速率
   * @param {number} elapsedTime - 经过的时间
   * @returns {number} 当前速率
   */
  calculateLinearRate(elapsedTime) {
    const progress = Math.min(elapsedTime / this.duration, 1);
    return this.initialRate + progress * (this.targetRate - this.initialRate);
  }
  
  /**
   * 计算阶梯式模式下的速率
   * @param {number} elapsedTime - 经过的时间
   * @returns {number} 当前速率
   */
  calculateStepRate(elapsedTime) {
    const progress = Math.min(elapsedTime / this.duration, 1);
    const stepIndex = Math.min(
      Math.floor(progress * this.steps),
      this.steps - 1
    );
    return this.stepRates[stepIndex];
  }
  
  /**
   * 计算指数模式下的速率
   * @param {number} elapsedTime - 经过的时间
   * @returns {number} 当前速率
   */
  calculateExponentialRate(elapsedTime) {
    const progress = Math.min(elapsedTime / this.duration, 1);
    // 使用二次函数: progress^2
    const exponentialProgress = Math.pow(progress, 2);
    return this.initialRate + exponentialProgress * (this.targetRate - this.initialRate);
  }
  
  /**
   * 计算对数模式下的速率
   * @param {number} elapsedTime - 经过的时间
   * @returns {number} 当前速率
   */
  calculateLogarithmicRate(elapsedTime) {
    const progress = Math.min(elapsedTime / this.duration, 1);
    // 使用对数函数: sqrt(progress)
    const logarithmicProgress = Math.sqrt(progress);
    return this.initialRate + logarithmicProgress * (this.targetRate - this.initialRate);
  }
  
  /**
   * 计算自适应模式下的速率
   * @param {number} elapsedTime - 经过的时间
   * @returns {number} 当前速率
   */
  calculateAdaptiveRate(elapsedTime) {
    // 首先计算基本线性进度
    const baseProgress = Math.min(elapsedTime / this.duration, 1);
    let adaptiveProgress = baseProgress;
    
    // 如果有反馈数据，基于反馈调整进度
    if (this.adaptiveFeedback.length > 0) {
      // 计算平均反馈分数 (0-1, 1表示完全掌握)
      const avgScore = this.adaptiveFeedback.reduce((sum, score) => sum + score, 0) 
                      / this.adaptiveFeedback.length;
      
      // 根据掌握程度调整进度
      // adaptationFactor控制自适应的强度：值越小，自适应越强
      adaptiveProgress = baseProgress * (avgScore * (1 - this.adaptationFactor) + this.adaptationFactor);
    }
    
    // 使用调整后的进度计算速率
    return this.initialRate + adaptiveProgress * (this.targetRate - this.initialRate);
  }
  
  /**
   * 提供学习反馈以调整自适应模式
   * @param {number} score - 掌握程度评分 (0-1)
   */
  provideFeedback(score) {
    const normalizedScore = this.clamp(score, 0, 1);
    this.adaptiveFeedback.push(normalizedScore);
    
    // 如果处于自适应模式，立即更新速率
    if (this.isActive && this.mode === ProgressionMode.ADAPTIVE) {
      this.updateRate(this.lastUpdateTime);
    }
    
    return this.currentRate;
  }
  
  /**
   * 应用预设配置
   * @param {string} presetName - 预设名称
   */
  applyPreset(presetName) {
    const preset = ProgressionPresets[presetName];
    if (!preset) {
      console.error(`预设 "${presetName}" 不存在`);
      return false;
    }
    
    // 停止当前进度
    this.stop();
    
    // 应用新配置
    this.initialRate = preset.initialRate;
    this.targetRate = preset.targetRate;
    this.duration = preset.duration;
    this.mode = preset.mode;
    
    // 应用其他可选参数
    if (preset.steps) this.steps = preset.steps;
    if (preset.adaptationFactor) this.adaptationFactor = preset.adaptationFactor;
    
    // 重新计算阶梯（如果需要）
    if (this.mode === ProgressionMode.STEP) {
      this.stepRates = this.calculateStepRates();
    }
    
    // 重置状态
    this.currentRate = this.initialRate;
    this.onRateChange(this.currentRate);
    
    return true;
  }
  
  /**
   * 获取进度信息
   * @returns {Object} 进度信息
   */
  getProgressInfo() {
    const elapsedTime = this.lastUpdateTime - this.startTime;
    const totalProgress = Math.min(elapsedTime / this.duration, 1);
    const remainingTime = Math.max(0, this.duration - elapsedTime);
    
    return {
      currentRate: this.currentRate,
      initialRate: this.initialRate,
      targetRate: this.targetRate,
      progress: totalProgress,
      remainingTime: remainingTime,
      elapsedTime: elapsedTime,
      isActive: this.isActive,
      mode: this.mode
    };
  }
}

/**
 * 创建语速渐进控制器Hook
 * @param {Function} setPlaybackRate - 设置播放速率的函数
 * @param {Object} options - 配置选项
 * @returns {Object} 控制器接口
 */
export function useSpeedProgression(setPlaybackRate, options = {}) {
  // 创建控制器
  const controller = new SpeedProgressionController({
    ...options,
    onRateChange: (rate) => {
      // 调用外部的速率设置函数
      setPlaybackRate(rate);
      
      // 如果有额外的回调，也调用它
      if (options.onRateChange) {
        options.onRateChange(rate);
      }
    }
  });
  
  return {
    // 控制方法
    start: (currentTime) => controller.start(currentTime),
    stop: () => controller.stop(),
    reset: () => controller.reset(),
    setCurrentTime: (time) => controller.setCurrentTime(time),
    provideFeedback: (score) => controller.provideFeedback(score),
    applyPreset: (preset) => controller.applyPreset(preset),
    
    // 获取信息
    getProgressInfo: () => controller.getProgressInfo(),
    
    // 设置配置
    setConfig: (newOptions) => {
      // 更新配置
      if (newOptions.initialRate !== undefined) controller.initialRate = controller.clampRate(newOptions.initialRate);
      if (newOptions.targetRate !== undefined) controller.targetRate = controller.clampRate(newOptions.targetRate);
      if (newOptions.duration !== undefined) controller.duration = Math.max(10, newOptions.duration);
      if (newOptions.mode !== undefined) controller.mode = newOptions.mode;
      if (newOptions.steps !== undefined) controller.steps = Math.max(2, newOptions.steps);
      if (newOptions.adaptationFactor !== undefined) controller.adaptationFactor = controller.clamp(newOptions.adaptationFactor, 0, 1);
      
      // 如果是阶梯式模式，重新计算阶梯
      if (controller.mode === ProgressionMode.STEP) {
        controller.stepRates = controller.calculateStepRates();
      }
      
      return controller.getProgressInfo();
    }
  };
} 