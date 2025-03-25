/**
 * 动态音频压缩器工具 - 专为语音优化的动态范围压缩实现
 */

/**
 * 预设压缩参数 - 为不同场景优化的压缩设置
 * @type {Object}
 */
export const compressorPresets = {
  // 语音优化预设 - 增强人声清晰度并保持动态范围
  speech: {
    threshold: -24, // dB
    knee: 12,       // dB
    ratio: 4,       // 压缩比
    attack: 0.005,  // 秒
    release: 0.1,   // 秒
    gain: 6,        // dB
    description: '语音增强 - 提高人声清晰度，特别针对语言学习优化'
  },
  
  // 对话清晰度 - 更强的压缩适合听力不太好的情况
  dialog: {
    threshold: -32, // dB
    knee: 8,        // dB
    ratio: 6,       // 压缩比
    attack: 0.003,  // 秒
    release: 0.15,  // 秒
    gain: 8,        // dB
    description: '对话清晰度 - 强化对话，适合在嘈杂环境或听力障碍情况'
  },
  
  // 柔和压缩 - 轻微的压缩，对音频质量影响最小
  gentle: {
    threshold: -20, // dB
    knee: 20,       // dB
    ratio: 2,       // 压缩比
    attack: 0.01,   // 秒
    release: 0.2,   // 秒
    gain: 3,        // dB
    description: '柔和压缩 - 轻微增强，保持自然音质'
  },
  
  // 强力压缩 - 适合音量差异很大的素材
  strong: {
    threshold: -40, // dB
    knee: 5,        // dB
    ratio: 10,      // 压缩比
    attack: 0.001,  // 秒
    release: 0.1,   // 秒
    gain: 10,       // dB
    description: '强力压缩 - 针对音量差异大的素材，有效减少动态范围'
  },
  
  // 音乐压缩 - 针对音乐内容优化（保留更多动态范围）
  music: {
    threshold: -18, // dB
    knee: 15,       // dB
    ratio: 3,       // 压缩比
    attack: 0.02,   // 秒
    release: 0.3,   // 秒
    gain: 4,        // dB
    description: '音乐压缩 - 保留音乐动态范围，轻微增强整体响度'
  },
  
  // 默认 - 中等压缩，通用设置
  default: {
    threshold: -24, // dB
    knee: 10,       // dB
    ratio: 4,       // 压缩比
    attack: 0.01,   // 秒
    release: 0.15,  // 秒
    gain: 5,        // dB
    description: '默认设置 - 通用压缩，适合大多数音频内容'
  },
  
  // 禁用 - 不进行压缩
  bypass: {
    threshold: 0,   // dB
    knee: 0,        // dB
    ratio: 1,       // 无压缩
    attack: 0.01,   // 秒
    release: 0.01,  // 秒
    gain: 0,        // dB
    description: '禁用 - 不应用任何压缩'
  }
};

/**
 * 创建动态范围压缩器节点
 * @param {AudioContext} context - Web Audio API上下文
 * @param {string|Object} preset - 预设名称或自定义压缩参数对象
 * @returns {DynamicsCompressorNode} 配置好的压缩器节点
 */
export function createCompressor(context, preset = 'default') {
  if (!context) {
    throw new Error('需要有效的AudioContext来创建压缩器');
  }
  
  // 获取预设参数
  const settings = typeof preset === 'string' 
    ? compressorPresets[preset] || compressorPresets.default
    : preset;
  
  // 创建压缩器节点
  const compressor = context.createDynamicsCompressor();
  
  // 应用设置
  compressor.threshold.value = settings.threshold;
  compressor.knee.value = settings.knee;
  compressor.ratio.value = settings.ratio;
  compressor.attack.value = settings.attack;
  compressor.release.value = settings.release;
  
  // 创建增益节点进行输出增益补偿
  const gainNode = context.createGain();
  gainNode.gain.value = Math.pow(10, settings.gain / 20); // 将dB转换为线性增益
  
  // 连接节点
  compressor.connect(gainNode);
  
  // 返回带有输入和输出连接的对象
  return {
    input: compressor,
    output: gainNode,
    
    // 添加调整方法
    setThreshold: (value) => {
      compressor.threshold.value = value;
    },
    
    setKnee: (value) => {
      compressor.knee.value = value;
    },
    
    setRatio: (value) => {
      compressor.ratio.value = value;
    },
    
    setAttack: (value) => {
      compressor.attack.value = value;
    },
    
    setRelease: (value) => {
      compressor.release.value = value;
    },
    
    setGain: (value) => {
      gainNode.gain.value = Math.pow(10, value / 20);
    },
    
    // 应用完整预设的方法
    applyPreset: (presetName) => {
      if (!compressorPresets[presetName]) {
        console.warn(`未找到预设: ${presetName}, 使用默认值替代`);
        presetName = 'default';
      }
      
      const settings = compressorPresets[presetName];
      compressor.threshold.value = settings.threshold;
      compressor.knee.value = settings.knee;
      compressor.ratio.value = settings.ratio;
      compressor.attack.value = settings.attack;
      compressor.release.value = settings.release;
      gainNode.gain.value = Math.pow(10, settings.gain / 20);
    },
    
    // 获取当前状态的方法
    getCurrentSettings: () => {
      return {
        threshold: compressor.threshold.value,
        knee: compressor.knee.value,
        ratio: compressor.ratio.value,
        attack: compressor.attack.value,
        release: compressor.release.value,
        gain: 20 * Math.log10(gainNode.gain.value) // 线性增益转换为dB
      };
    },
    
    // 获取压缩量（减少量）的方法
    getReduction: () => {
      return compressor.reduction.value;
    },
    
    // 释放资源
    dispose: () => {
      compressor.disconnect();
      gainNode.disconnect();
    }
  };
}

/**
 * 创建多波段压缩器
 * @param {AudioContext} context - Web Audio API上下文
 * @param {Object} options - 配置选项
 * @param {number} options.lowCrossover - 低/中频分割点 (Hz) (默认: 300)
 * @param {number} options.highCrossover - 中/高频分割点 (Hz) (默认: 3000)
 * @param {string|Object} options.lowPreset - 低频压缩器预设
 * @param {string|Object} options.midPreset - 中频压缩器预设
 * @param {string|Object} options.highPreset - 高频压缩器预设
 * @returns {Object} 多波段压缩器对象
 */
export function createMultibandCompressor(context, options = {}) {
  const settings = {
    lowCrossover: options.lowCrossover || 300,
    highCrossover: options.highCrossover || 3000,
    lowPreset: options.lowPreset || 'default',
    midPreset: options.midPreset || 'speech',
    highPreset: options.highPreset || 'gentle'
  };
  
  // 创建输入和输出节点
  const inputGain = context.createGain();
  const outputGain = context.createGain();
  
  // 创建三个频段的滤波器
  // 低频段通过低通滤波器
  const lowpassFilter = context.createBiquadFilter();
  lowpassFilter.type = 'lowpass';
  lowpassFilter.frequency.value = settings.lowCrossover;
  lowpassFilter.Q.value = 0.7;
  
  // 高频段通过高通滤波器
  const highpassFilter = context.createBiquadFilter();
  highpassFilter.type = 'highpass';
  highpassFilter.frequency.value = settings.highCrossover;
  highpassFilter.Q.value = 0.7;
  
  // 中频段需要一个低通和一个高通级联
  const midLowpassFilter = context.createBiquadFilter();
  midLowpassFilter.type = 'lowpass';
  midLowpassFilter.frequency.value = settings.highCrossover;
  midLowpassFilter.Q.value = 0.7;
  
  const midHighpassFilter = context.createBiquadFilter();
  midHighpassFilter.type = 'highpass';
  midHighpassFilter.frequency.value = settings.lowCrossover;
  midHighpassFilter.Q.value = 0.7;
  
  // 为每个频段创建压缩器
  const lowCompressor = createCompressor(context, settings.lowPreset);
  const midCompressor = createCompressor(context, settings.midPreset);
  const highCompressor = createCompressor(context, settings.highPreset);
  
  // 连接低频段
  inputGain.connect(lowpassFilter);
  lowpassFilter.connect(lowCompressor.input);
  lowCompressor.output.connect(outputGain);
  
  // 连接中频段
  inputGain.connect(midHighpassFilter);
  midHighpassFilter.connect(midLowpassFilter);
  midLowpassFilter.connect(midCompressor.input);
  midCompressor.output.connect(outputGain);
  
  // 连接高频段
  inputGain.connect(highpassFilter);
  highpassFilter.connect(highCompressor.input);
  highCompressor.output.connect(outputGain);
  
  return {
    input: inputGain,
    output: outputGain,
    
    // 各压缩器的引用
    compressors: {
      low: lowCompressor,
      mid: midCompressor,
      high: highCompressor
    },
    
    // 滤波器引用
    filters: {
      lowpass: lowpassFilter,
      midLowpass: midLowpassFilter,
      midHighpass: midHighpassFilter,
      highpass: highpassFilter
    },
    
    // 调整分频点的方法
    setCrossoverFrequencies: (lowFreq, highFreq) => {
      if (lowFreq) {
        lowpassFilter.frequency.value = lowFreq;
        midHighpassFilter.frequency.value = lowFreq;
      }
      
      if (highFreq) {
        highpassFilter.frequency.value = highFreq;
        midLowpassFilter.frequency.value = highFreq;
      }
    },
    
    // 应用预设到特定频段
    applyPreset: (band, presetName) => {
      if (band === 'low') lowCompressor.applyPreset(presetName);
      else if (band === 'mid') midCompressor.applyPreset(presetName);
      else if (band === 'high') highCompressor.applyPreset(presetName);
      else if (band === 'all') {
        lowCompressor.applyPreset(presetName);
        midCompressor.applyPreset(presetName);
        highCompressor.applyPreset(presetName);
      }
    },
    
    // 应用语音优化预设（特别为语言学习优化）
    applyVoiceEnhancement: () => {
      // 低频段轻微压缩
      lowCompressor.applyPreset('gentle');
      // 中频段（语音范围）使用语音优化
      midCompressor.applyPreset('speech');
      // 高频段使用对话清晰度
      highCompressor.applyPreset('dialog');
      
      // 调整分频点以更好地对应人声范围
      lowpassFilter.frequency.value = 250;
      midHighpassFilter.frequency.value = 250;
      highpassFilter.frequency.value = 3500;
      midLowpassFilter.frequency.value = 3500;
    },
    
    // 获取当前设置
    getCurrentSettings: () => {
      return {
        crossover: {
          low: lowpassFilter.frequency.value,
          high: highpassFilter.frequency.value
        },
        compressors: {
          low: lowCompressor.getCurrentSettings(),
          mid: midCompressor.getCurrentSettings(),
          high: highCompressor.getCurrentSettings()
        }
      };
    },
    
    // 获取所有频段的压缩量
    getReductions: () => {
      return {
        low: lowCompressor.getReduction(),
        mid: midCompressor.getReduction(),
        high: highCompressor.getReduction()
      };
    },
    
    // 释放资源
    dispose: () => {
      lowCompressor.dispose();
      midCompressor.dispose();
      highCompressor.dispose();
      
      inputGain.disconnect();
      outputGain.disconnect();
      lowpassFilter.disconnect();
      highpassFilter.disconnect();
      midLowpassFilter.disconnect();
      midHighpassFilter.disconnect();
    }
  };
}

/**
 * 为特定音频元素创建压缩处理
 * @param {HTMLAudioElement} audioElement - 要处理的音频元素
 * @param {string} preset - 要应用的预设
 * @returns {Object} 包含控制方法的处理对象
 */
export function applyCompressionToAudio(audioElement, preset = 'speech') {
  if (!audioElement) {
    throw new Error('需要有效的音频元素');
  }
  
  // 创建音频上下文
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const context = new AudioContext();
  
  // 创建媒体源
  const source = context.createMediaElementSource(audioElement);
  
  // 创建压缩器
  const compressor = createCompressor(context, preset);
  
  // 连接节点
  source.connect(compressor.input);
  compressor.output.connect(context.destination);
  
  // 确保音频上下文已启动
  if (context.state === 'suspended') {
    const resumeContext = () => {
      context.resume().then(() => {
        console.log('AudioContext已恢复');
      }).catch(err => {
        console.error('无法恢复AudioContext:', err);
      });
    };
    
    // 添加用户交互处理程序来恢复上下文
    document.addEventListener('click', resumeContext, { once: true });
    document.addEventListener('keydown', resumeContext, { once: true });
    document.addEventListener('touchstart', resumeContext, { once: true });
  }
  
  return {
    compressor,
    context,
    
    // 更改预设
    changePreset: (newPreset) => {
      compressor.applyPreset(newPreset);
    },
    
    // 切换启用/禁用
    toggleBypass: (bypass) => {
      if (bypass) {
        compressor.applyPreset('bypass');
      } else {
        compressor.applyPreset(preset);
      }
    },
    
    // 获取压缩量（用于可视化）
    getReduction: () => {
      return compressor.getReduction();
    },
    
    // 清理资源
    dispose: () => {
      source.disconnect();
      compressor.dispose();
      document.removeEventListener('click', resumeContext);
      document.removeEventListener('keydown', resumeContext);
      document.removeEventListener('touchstart', resumeContext);
      context.close();
    }
  };
} 