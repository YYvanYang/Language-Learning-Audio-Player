/**
 * IIR滤波器设计工具
 * 提供用于语音强化和音频处理的IIR滤波器设计功能
 */

/**
 * 滤波器类型
 */
export const FilterType = {
  LOWPASS: 'lowpass',           // 低通滤波器
  HIGHPASS: 'highpass',         // 高通滤波器
  BANDPASS: 'bandpass',         // 带通滤波器
  NOTCH: 'notch',               // 陷波滤波器
  ALLPASS: 'allpass',           // 全通滤波器
  PEAKING: 'peaking',           // 峰值滤波器
  LOWSHELF: 'lowshelf',         // 低频搁架滤波器
  HIGHSHELF: 'highshelf',       // 高频搁架滤波器
  FORMANT: 'formant',           // 共振峰滤波器（用于语音增强）
  VOWEL: 'vowel'                // 元音滤波器
};

/**
 * 元音配置（元音共振峰频率配置）
 */
export const VowelPresets = {
  A: [800, 1200, 2500],     // "啊"音共振峰
  E: [400, 2000, 2800],     // "诶"音共振峰
  I: [300, 2500, 3500],     // "衣"音共振峰
  O: [450, 800, 2500],      // "哦"音共振峰
  U: [300, 600, 2500]       // "乌"音共振峰
};

/**
 * 语言特定的共振峰增强预设
 */
export const LanguageFormants = {
  CHINESE: {
    name: '汉语',
    description: '优化普通话发音特征',
    formants: [
      { frequency: 400, gain: 3, Q: 4 },   // 第一共振峰区域
      { frequency: 1200, gain: 6, Q: 5 },  // 第二共振峰区域
      { frequency: 2500, gain: 5, Q: 4 },  // 第三共振峰区域
      { frequency: 3800, gain: 3, Q: 6 }   // 第四共振峰区域
    ]
  },
  ENGLISH: {
    name: '英语',
    description: '增强英语发音特征',
    formants: [
      { frequency: 500, gain: 3, Q: 4 },   // 第一共振峰区域
      { frequency: 1500, gain: 5, Q: 5 },  // 第二共振峰区域
      { frequency: 2500, gain: 4, Q: 4 },  // 第三共振峰区域
      { frequency: 3500, gain: 2, Q: 6 }   // 第四共振峰区域
    ]
  },
  JAPANESE: {
    name: '日语',
    description: '优化日语发音清晰度',
    formants: [
      { frequency: 450, gain: 4, Q: 4 },   // 第一共振峰区域
      { frequency: 1100, gain: 5, Q: 5 },  // 第二共振峰区域
      { frequency: 2200, gain: 6, Q: 4 },  // 第三共振峰区域
      { frequency: 3500, gain: 2, Q: 5 }   // 第四共振峰区域
    ]
  },
  FRENCH: {
    name: '法语',
    description: '增强法语鼻化元音',
    formants: [
      { frequency: 400, gain: 3, Q: 5 },   // 第一共振峰区域
      { frequency: 1000, gain: 4, Q: 6 },  // 第二共振峰区域
      { frequency: 2200, gain: 6, Q: 4 },  // 第三共振峰区域
      { frequency: 3400, gain: 3, Q: 5 }   // 第四共振峰区域
    ]
  },
  GERMAN: {
    name: '德语',
    description: '优化德语辅音和元音区分',
    formants: [
      { frequency: 350, gain: 2, Q: 4 },   // 第一共振峰区域
      { frequency: 1400, gain: 4, Q: 5 },  // 第二共振峰区域
      { frequency: 2300, gain: 6, Q: 6 },  // 第三共振峰区域
      { frequency: 3500, gain: 4, Q: 4 }   // 第四共振峰区域
    ]
  },
  SPANISH: {
    name: '西班牙语',
    description: '增强西班牙语元音清晰度',
    formants: [
      { frequency: 500, gain: 3, Q: 5 },   // 第一共振峰区域
      { frequency: 1200, gain: 5, Q: 4 },  // 第二共振峰区域
      { frequency: 2400, gain: 4, Q: 5 },  // 第三共振峰区域
      { frequency: 3600, gain: 2, Q: 6 }   // 第四共振峰区域
    ]
  }
};

/**
 * 语音特性增强预设
 */
export const VoiceEnhancementPresets = {
  CLARITY: {
    name: '清晰度增强',
    description: '增强语音清晰度，适合听力练习',
    filters: [
      { type: FilterType.HIGHPASS, frequency: 120, gain: 0, Q: 0.7 },     // 降低低频噪声
      { type: FilterType.PEAKING, frequency: 180, gain: -2, Q: 1 },       // 降低低频轰鸣
      { type: FilterType.PEAKING, frequency: 1000, gain: 2, Q: 1.2 },     // 提升中频
      { type: FilterType.PEAKING, frequency: 2800, gain: 5, Q: 1.8 },     // 增强清晰度
      { type: FilterType.PEAKING, frequency: 5000, gain: 3, Q: 2 },       // 增加高频细节
      { type: FilterType.LOWPASS, frequency: 12000, gain: 0, Q: 0.7 }     // 限制过高频率
    ]
  },
  WARMTH: {
    name: '温暖音色',
    description: '降低刺耳的高频，增加温暖感',
    filters: [
      { type: FilterType.HIGHPASS, frequency: 80, gain: 0, Q: 0.7 },      // 降低次低音
      { type: FilterType.PEAKING, frequency: 200, gain: 2, Q: 0.8 },      // 增加温暖感
      { type: FilterType.PEAKING, frequency: 800, gain: 1, Q: 1 },        // 增强声音主体
      { type: FilterType.PEAKING, frequency: 3000, gain: -1, Q: 1.5 },    // 降低刺耳的高频
      { type: FilterType.HIGHSHELF, frequency: 8000, gain: -2, Q: 0.7 }   // 柔化高频
    ]
  },
  PRESENCE: {
    name: '增加临场感',
    description: '增强语音存在感，让声音更突出',
    filters: [
      { type: FilterType.HIGHPASS, frequency: 100, gain: 0, Q: 0.7 },     // 降低低频噪声
      { type: FilterType.PEAKING, frequency: 200, gain: -1, Q: 1 },       // 轻微降低低频
      { type: FilterType.PEAKING, frequency: 900, gain: 2, Q: 1.5 },      // 增强语音主体
      { type: FilterType.PEAKING, frequency: 3500, gain: 4, Q: 2 },       // 增强清晰度和临场感
      { type: FilterType.HIGHSHELF, frequency: 10000, gain: 2, Q: 0.7 }   // 增加空气感
    ]
  },
  INTELLIGIBILITY: {
    name: '理解度优化',
    description: '优化语音理解度，适合教学应用',
    filters: [
      { type: FilterType.HIGHPASS, frequency: 150, gain: 0, Q: 0.7 },     // 降低低频噪声
      { type: FilterType.PEAKING, frequency: 250, gain: -3, Q: 1.2 },     // 降低低频混浊
      { type: FilterType.PEAKING, frequency: 800, gain: 1, Q: 1 },        // 轻微增强语音主体
      { type: FilterType.PEAKING, frequency: 1500, gain: 3, Q: 1.5 },     // 增强理解度
      { type: FilterType.PEAKING, frequency: 3000, gain: 6, Q: 2 },       // 显著增强清晰度
      { type: FilterType.PEAKING, frequency: 5000, gain: 2, Q: 1.8 },     // 增加高频细节
      { type: FilterType.LOWPASS, frequency: 10000, gain: 0, Q: 0.7 }     // 限制过高频率
    ]
  },
  NOISE_REDUCTION: {
    name: '降噪增强',
    description: '减少背景噪声，同时保持语音清晰',
    filters: [
      { type: FilterType.HIGHPASS, frequency: 180, gain: 0, Q: 0.9 },     // 过滤低频噪声
      { type: FilterType.PEAKING, frequency: 300, gain: -4, Q: 1.2 },     // 减少低频轰鸣
      { type: FilterType.PEAKING, frequency: 500, gain: -2, Q: 1 },       // 减少低中频噪声
      { type: FilterType.PEAKING, frequency: 1200, gain: 3, Q: 1.5 },     // 增强语音基频
      { type: FilterType.PEAKING, frequency: 2500, gain: 5, Q: 1.8 },     // 增强清晰度
      { type: FilterType.PEAKING, frequency: 6000, gain: -2, Q: 2 },      // 减少高频噪声
      { type: FilterType.LOWPASS, frequency: 8000, gain: 0, Q: 0.8 }      // 限制高频噪声
    ]
  },
  PODCAST: {
    name: '播客优化',
    description: '专为播客、讲座等对话内容优化',
    filters: [
      { type: FilterType.HIGHPASS, frequency: 120, gain: 0, Q: 0.7 },     // 去除低频噪声
      { type: FilterType.PEAKING, frequency: 250, gain: -2, Q: 1 },       // 减轻低频共振
      { type: FilterType.PEAKING, frequency: 800, gain: 1, Q: 1.2 },      // 增强语音温暖度
      { type: FilterType.PEAKING, frequency: 1800, gain: 3, Q: 1.5 },     // 增强语音明亮度
      { type: FilterType.PEAKING, frequency: 3500, gain: 4, Q: 1.8 },     // 提高清晰度
      { type: FilterType.HIGHSHELF, frequency: 8000, gain: 1, Q: 0.8 }    // 适度增加高频亮度
    ]
  }
};

/**
 * 创建IIR滤波器组
 * @param {AudioContext} audioContext - 音频上下文
 * @param {Array} filterSpecs - 滤波器规格数组
 * @returns {Array<BiquadFilterNode>} 滤波器节点数组
 */
export function createIIRFilterGroup(audioContext, filterSpecs) {
  if (!audioContext || !filterSpecs || !Array.isArray(filterSpecs)) {
    return [];
  }

  return filterSpecs.map(spec => {
    const filter = audioContext.createBiquadFilter();
    filter.type = spec.type;
    filter.frequency.value = spec.frequency;
    
    if (typeof spec.gain !== 'undefined') {
      filter.gain.value = spec.gain;
    }
    
    if (typeof spec.Q !== 'undefined') {
      filter.Q.value = spec.Q;
    }
    
    return filter;
  });
}

/**
 * 创建共振峰滤波器组（用于语音增强）
 * @param {AudioContext} audioContext - 音频上下文
 * @param {string} languageKey - 语言键名
 * @returns {Array<BiquadFilterNode>} 滤波器节点数组
 */
export function createFormantFilterGroup(audioContext, languageKey) {
  if (!audioContext || !languageKey || !LanguageFormants[languageKey]) {
    return [];
  }

  const formants = LanguageFormants[languageKey].formants;
  return formants.map(formant => {
    const filter = audioContext.createBiquadFilter();
    filter.type = 'peaking';  // 共振峰使用峰值滤波器
    filter.frequency.value = formant.frequency;
    filter.gain.value = formant.gain;
    filter.Q.value = formant.Q;
    
    return filter;
  });
}

/**
 * 创建元音滤波器组
 * @param {AudioContext} audioContext - 音频上下文
 * @param {string} vowel - 元音名称
 * @param {number} gain - 增益值
 * @param {number} q - Q值
 * @returns {Array<BiquadFilterNode>} 滤波器节点数组
 */
export function createVowelFilterGroup(audioContext, vowel, gain = 10, q = 8) {
  if (!audioContext || !VowelPresets[vowel]) {
    return [];
  }

  const formantFrequencies = VowelPresets[vowel];
  return formantFrequencies.map(frequency => {
    const filter = audioContext.createBiquadFilter();
    filter.type = 'peaking';
    filter.frequency.value = frequency;
    filter.gain.value = gain;
    filter.Q.value = q;
    
    return filter;
  });
}

/**
 * 创建语音增强滤波器组
 * @param {AudioContext} audioContext - 音频上下文
 * @param {string} presetKey - 预设键名
 * @returns {Array<BiquadFilterNode>} 滤波器节点数组
 */
export function createVoiceEnhancementFilters(audioContext, presetKey) {
  if (!audioContext || !presetKey || !VoiceEnhancementPresets[presetKey]) {
    return [];
  }

  return createIIRFilterGroup(audioContext, VoiceEnhancementPresets[presetKey].filters);
}

/**
 * 连接滤波器组
 * @param {Array<BiquadFilterNode>} filters - 滤波器节点数组
 * @param {AudioNode} source - 源节点
 * @param {AudioNode} destination - 目标节点
 */
export function connectFilters(filters, source, destination) {
  if (!filters || !filters.length || !source || !destination) {
    // 如果没有有效的滤波器，直接连接源到目标
    source.connect(destination);
    return;
  }

  // 连接源到第一个滤波器
  source.connect(filters[0]);
  
  // 连接滤波器链
  for (let i = 0; i < filters.length - 1; i++) {
    filters[i].connect(filters[i + 1]);
  }
  
  // 连接最后一个滤波器到目标
  filters[filters.length - 1].connect(destination);
}

/**
 * 断开滤波器组连接
 * @param {Array<BiquadFilterNode>} filters - 滤波器节点数组
 */
export function disconnectFilters(filters) {
  if (!filters || !filters.length) return;
  
  filters.forEach(filter => {
    try {
      filter.disconnect();
    } catch (e) {
      console.warn('滤波器断开连接失败', e);
    }
  });
}

/**
 * 获取语言列表
 * @returns {Array<Object>} 语言列表
 */
export function getLanguagesList() {
  return Object.keys(LanguageFormants).map(key => ({
    key,
    name: LanguageFormants[key].name,
    description: LanguageFormants[key].description
  }));
}

/**
 * 获取语音增强预设列表
 * @returns {Array<Object>} 预设列表
 */
export function getVoiceEnhancementPresetsList() {
  return Object.keys(VoiceEnhancementPresets).map(key => ({
    key,
    name: VoiceEnhancementPresets[key].name,
    description: VoiceEnhancementPresets[key].description
  }));
} 