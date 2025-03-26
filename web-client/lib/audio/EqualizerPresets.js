/**
 * 均衡器预设管理器
 * 提供各种音频处理场景的预设均衡器配置
 */

/**
 * 均衡器模式
 */
export const EqualizerMode = {
  CUSTOM: 'custom',
  FLAT: 'flat',
  BASS_BOOST: 'bass_boost',
  TREBLE_BOOST: 'treble_boost',
  SPEECH: 'speech',
  PODCAST: 'podcast',
  ACOUSTIC: 'acoustic',
  ELECTRONIC: 'electronic',
  CLASSICAL: 'classical',
  JAZZ: 'jazz',
  ROCK: 'rock',
  POP: 'pop',
  LANGUAGE_LEARNING: 'language_learning',
  PRONUNCIATION: 'pronunciation',
  LISTENING_PRACTICE: 'listening_practice',
  HEADPHONES: 'headphones',
  NIGHTMODE: 'nightmode',
};

/**
 * 均衡器频段类型
 */
export const BandType = {
  LOWSHELF: 'lowshelf',      // 低频搁架滤波器
  PEAKING: 'peaking',        // 峰值滤波器
  HIGHSHELF: 'highshelf',    // 高频搁架滤波器
  LOWPASS: 'lowpass',        // 低通滤波器
  HIGHPASS: 'highpass',      // 高通滤波器
  NOTCH: 'notch',            // 陷波滤波器
  ALLPASS: 'allpass',        // 全通滤波器
};

/**
 * 预设频段配置，默认使用5段均衡器
 */
export const defaultBands = [
  { type: BandType.LOWSHELF, frequency: 80, gain: 0, Q: 1 },        // 低频
  { type: BandType.PEAKING, frequency: 250, gain: 0, Q: 1 },        // 中低频
  { type: BandType.PEAKING, frequency: 1000, gain: 0, Q: 1 },       // 中频
  { type: BandType.PEAKING, frequency: 4000, gain: 0, Q: 1 },       // 中高频
  { type: BandType.HIGHSHELF, frequency: 12000, gain: 0, Q: 1 },    // 高频
];

/**
 * 均衡器预设配置 - 配置针对不同场景的均衡器设置
 * 
 * 每个频段设置:
 * - type: 滤波器类型
 * - frequency: 中心频率 (Hz)
 * - gain: 增益值 (dB)
 * - Q: 品质因数，控制频带宽度
 */
export const equalizerPresets = {
  // 平坦响应 - 均衡器不改变音频
  [EqualizerMode.FLAT]: [
    { type: BandType.LOWSHELF, frequency: 80, gain: 0, Q: 1 },
    { type: BandType.PEAKING, frequency: 250, gain: 0, Q: 1 },
    { type: BandType.PEAKING, frequency: 1000, gain: 0, Q: 1 },
    { type: BandType.PEAKING, frequency: 4000, gain: 0, Q: 1 },
    { type: BandType.HIGHSHELF, frequency: 12000, gain: 0, Q: 1 },
  ],
  
  // 增强低音 - 增强低频和中低频
  [EqualizerMode.BASS_BOOST]: [
    { type: BandType.LOWSHELF, frequency: 80, gain: 7, Q: 0.9 },
    { type: BandType.PEAKING, frequency: 250, gain: 4, Q: 1 },
    { type: BandType.PEAKING, frequency: 1000, gain: 0, Q: 1 },
    { type: BandType.PEAKING, frequency: 4000, gain: 0, Q: 1 },
    { type: BandType.HIGHSHELF, frequency: 12000, gain: 0, Q: 1 },
  ],
  
  // 增强高音 - 增强中高频和高频
  [EqualizerMode.TREBLE_BOOST]: [
    { type: BandType.LOWSHELF, frequency: 80, gain: 0, Q: 1 },
    { type: BandType.PEAKING, frequency: 250, gain: 0, Q: 1 },
    { type: BandType.PEAKING, frequency: 1000, gain: 2, Q: 1 },
    { type: BandType.PEAKING, frequency: 4000, gain: 5, Q: 1 },
    { type: BandType.HIGHSHELF, frequency: 12000, gain: 6, Q: 1 },
  ],
  
  // 语音增强 - 增强人声频率范围
  [EqualizerMode.SPEECH]: [
    { type: BandType.HIGHPASS, frequency: 120, gain: 0, Q: 0.7 },      // 减弱过低频率
    { type: BandType.PEAKING, frequency: 250, gain: -2, Q: 1 },        // 减弱低频轰鸣
    { type: BandType.PEAKING, frequency: 1000, gain: 2, Q: 1.2 },      // 提升中频语音清晰度
    { type: BandType.PEAKING, frequency: 3000, gain: 5, Q: 1.5 },      // 大幅增强3kHz附近提高清晰度
    { type: BandType.HIGHSHELF, frequency: 10000, gain: 2, Q: 1 },     // 轻微增强高频空气感
  ],
  
  // 播客模式 - 针对讲话内容优化，增强语音清晰度，减少噪音
  [EqualizerMode.PODCAST]: [
    { type: BandType.HIGHPASS, frequency: 100, gain: 0, Q: 0.8 },      // 去除低频噪音
    { type: BandType.PEAKING, frequency: 200, gain: -3, Q: 1 },        // 降低低频共振
    { type: BandType.PEAKING, frequency: 1200, gain: 3, Q: 0.9 },      // 增强声音温暖度
    { type: BandType.PEAKING, frequency: 2500, gain: 4, Q: 0.9 },      // 提高清晰度
    { type: BandType.LOWPASS, frequency: 15000, gain: 0, Q: 0.7 },     // 控制高频噪音
  ],
  
  // 声学音乐 - 优化原声乐器表现
  [EqualizerMode.ACOUSTIC]: [
    { type: BandType.LOWSHELF, frequency: 80, gain: 2, Q: 0.8 },
    { type: BandType.PEAKING, frequency: 250, gain: -1, Q: 1 },
    { type: BandType.PEAKING, frequency: 1000, gain: 0, Q: 1 },
    { type: BandType.PEAKING, frequency: 4000, gain: 3, Q: 1.2 },
    { type: BandType.HIGHSHELF, frequency: 12000, gain: 3, Q: 1 },
  ],
  
  // 电子音乐 - 增强低频和高频，提供更有冲击力的声音
  [EqualizerMode.ELECTRONIC]: [
    { type: BandType.LOWSHELF, frequency: 80, gain: 6, Q: 0.8 },
    { type: BandType.PEAKING, frequency: 250, gain: 2, Q: 1 },
    { type: BandType.PEAKING, frequency: 1000, gain: -2, Q: 1 },
    { type: BandType.PEAKING, frequency: 4000, gain: 2, Q: 1 },
    { type: BandType.HIGHSHELF, frequency: 12000, gain: 4, Q: 1 },
  ],
  
  // 古典音乐 - 平衡的声音，轻微增强高低频
  [EqualizerMode.CLASSICAL]: [
    { type: BandType.LOWSHELF, frequency: 80, gain: 2, Q: 0.9 },
    { type: BandType.PEAKING, frequency: 250, gain: 0, Q: 1 },
    { type: BandType.PEAKING, frequency: 1000, gain: 0, Q: 1 },
    { type: BandType.PEAKING, frequency: 4000, gain: 1, Q: 1.2 },
    { type: BandType.HIGHSHELF, frequency: 10000, gain: 2, Q: 1 },
  ],
  
  // 爵士乐 - 温暖而清晰的声音
  [EqualizerMode.JAZZ]: [
    { type: BandType.LOWSHELF, frequency: 80, gain: 3, Q: 0.8 },
    { type: BandType.PEAKING, frequency: 300, gain: 1, Q: 1 },
    { type: BandType.PEAKING, frequency: 1000, gain: 0, Q: 1 },
    { type: BandType.PEAKING, frequency: 3000, gain: 2, Q: 1 },
    { type: BandType.HIGHSHELF, frequency: 10000, gain: 1, Q: 1 },
  ],
  
  // 摇滚乐 - 增强低频和中高频，提供强劲的声音
  [EqualizerMode.ROCK]: [
    { type: BandType.LOWSHELF, frequency: 80, gain: 4, Q: 0.9 },
    { type: BandType.PEAKING, frequency: 250, gain: 2, Q: 1 },
    { type: BandType.PEAKING, frequency: 1000, gain: -1, Q: 1 },
    { type: BandType.PEAKING, frequency: 3000, gain: 3, Q: 1 },
    { type: BandType.HIGHSHELF, frequency: 10000, gain: 3, Q: 1 },
  ],
  
  // 流行音乐 - 增强低频和高频，提供明亮的声音
  [EqualizerMode.POP]: [
    { type: BandType.LOWSHELF, frequency: 80, gain: 3, Q: 0.9 },
    { type: BandType.PEAKING, frequency: 200, gain: 0, Q: 1 },
    { type: BandType.PEAKING, frequency: 1000, gain: -1, Q: 1 },
    { type: BandType.PEAKING, frequency: 4000, gain: 3, Q: 1 },
    { type: BandType.HIGHSHELF, frequency: 12000, gain: 3, Q: 1 },
  ],
  
  // 语言学习 - 优化语音清晰度，突出中频
  [EqualizerMode.LANGUAGE_LEARNING]: [
    { type: BandType.HIGHPASS, frequency: 150, gain: 0, Q: 0.7 },      // 减弱过低频率
    { type: BandType.PEAKING, frequency: 300, gain: -2, Q: 1 },        // 减弱低频轰鸣
    { type: BandType.PEAKING, frequency: 1200, gain: 4, Q: 1.2 },      // 增强语音基本频率
    { type: BandType.PEAKING, frequency: 2800, gain: 6, Q: 1.5 },      // 大幅增强2.5-3kHz以提高清晰度
    { type: BandType.PEAKING, frequency: 6000, gain: 3, Q: 1.2 },      // 增强6kHz辅助清晰度
  ],
  
  // 发音练习 - 更突出特殊语音成分，帮助发音
  [EqualizerMode.PRONUNCIATION]: [
    { type: BandType.HIGHPASS, frequency: 180, gain: 0, Q: 0.7 },      // 减弱过低频率
    { type: BandType.PEAKING, frequency: 350, gain: -3, Q: 1 },        // 减弱低频轰鸣
    { type: BandType.PEAKING, frequency: 1200, gain: 3, Q: 1.4 },      // 增强语音基频
    { type: BandType.PEAKING, frequency: 3500, gain: 7, Q: 1.6 },      // 显著增强3-4kHz子音
    { type: BandType.PEAKING, frequency: 8000, gain: 5, Q: 1.8 },      // 增强高频清晰度辅助识别摩擦音
  ],
  
  // 听力练习 - 温和平衡，减少听力疲劳
  [EqualizerMode.LISTENING_PRACTICE]: [
    { type: BandType.HIGHPASS, frequency: 120, gain: 0, Q: 0.7 },      // 减弱过低频率
    { type: BandType.PEAKING, frequency: 250, gain: -1, Q: 1 },        // 轻微减弱低频
    { type: BandType.PEAKING, frequency: 1000, gain: 2, Q: 1 },        // 中度增强1kHz增强语音理解
    { type: BandType.PEAKING, frequency: 2500, gain: 3, Q: 1.2 },      // 温和增强清晰度
    { type: BandType.HIGHSHELF, frequency: 8000, gain: -1, Q: 1 },     // 轻微降低高频减少疲劳
  ],
  
  // 耳机优化 - 补偿耳机常见频率响应不足
  [EqualizerMode.HEADPHONES]: [
    { type: BandType.LOWSHELF, frequency: 100, gain: 1, Q: 0.8 },      // 轻微增强低频
    { type: BandType.PEAKING, frequency: 300, gain: -2, Q: 1.2 },      // 减少中低频闷声
    { type: BandType.PEAKING, frequency: 1800, gain: 1, Q: 1 },        // 轻微增强中频清晰度
    { type: BandType.PEAKING, frequency: 5000, gain: -2, Q: 1.5 },     // 减少5kHz刺耳声
    { type: BandType.HIGHSHELF, frequency: 10000, gain: 2, Q: 1 },     // 增强空气感和细节
  ],
  
  // 夜间模式 - 减少低频，增强语音清晰度，允许更低音量
  [EqualizerMode.NIGHTMODE]: [
    { type: BandType.HIGHPASS, frequency: 150, gain: 0, Q: 0.8 },      // 减少低频穿透力
    { type: BandType.PEAKING, frequency: 300, gain: -3, Q: 1 },        // 降低更多低频
    { type: BandType.PEAKING, frequency: 1000, gain: 3, Q: 1 },        // 增强基本语音频率
    { type: BandType.PEAKING, frequency: 3000, gain: 5, Q: 1.2 },      // 显著增强清晰度
    { type: BandType.PEAKING, frequency: 6000, gain: 2, Q: 1 },        // 增强高频细节
  ],
};

/**
 * 获取均衡器预设
 * @param {string} presetName - 预设名称
 * @returns {Array} 均衡器设置
 */
export function getEqualizerPreset(presetName) {
  return equalizerPresets[presetName] || equalizerPresets[EqualizerMode.FLAT];
}

/**
 * 创建均衡器节点
 * @param {AudioContext} audioContext - 音频上下文
 * @param {string} presetName - 预设名称
 * @returns {Array<BiquadFilterNode>} 均衡器节点数组
 */
export function createEqualizerNodes(audioContext, presetName = EqualizerMode.FLAT) {
  const preset = getEqualizerPreset(presetName);
  
  // 创建过滤器节点
  const nodes = preset.map(band => {
    const filter = audioContext.createBiquadFilter();
    filter.type = band.type;
    filter.frequency.value = band.frequency;
    filter.gain.value = band.gain;
    
    // Q值只对某些滤波器类型有效
    if (band.type === BandType.PEAKING || 
        band.type === BandType.NOTCH || 
        band.type === BandType.LOWPASS || 
        band.type === BandType.HIGHPASS) {
      filter.Q.value = band.Q;
    }
    
    return filter;
  });
  
  return nodes;
}

/**
 * 连接均衡器节点
 * @param {Array<BiquadFilterNode>} nodes - 均衡器节点数组
 * @param {AudioNode} source - 音频源节点
 * @param {AudioNode} destination - 目标节点
 */
export function connectEqualizerNodes(nodes, source, destination) {
  if (!nodes || nodes.length === 0) {
    // 如果没有节点，直接连接源和目标
    source.connect(destination);
    return;
  }
  
  // 连接所有节点
  source.connect(nodes[0]);
  
  for (let i = 0; i < nodes.length - 1; i++) {
    nodes[i].connect(nodes[i + 1]);
  }
  
  // 连接最后一个节点到目标
  nodes[nodes.length - 1].connect(destination);
}

/**
 * 更新均衡器设置
 * @param {Array<BiquadFilterNode>} nodes - 均衡器节点数组
 * @param {string|Array} preset - 预设名称或自定义均衡器设置
 */
export function updateEqualizerSettings(nodes, preset) {
  if (!nodes || nodes.length === 0) return;
  
  // 如果提供的是预设名称，获取预设配置
  const settings = typeof preset === 'string' 
    ? getEqualizerPreset(preset) 
    : preset;
  
  // 确保设置数组和节点数组长度一致
  const limit = Math.min(nodes.length, settings.length);
  
  // 更新每个节点的设置
  for (let i = 0; i < limit; i++) {
    const node = nodes[i];
    const band = settings[i];
    
    if (node.type !== band.type) {
      node.type = band.type;
    }
    
    node.frequency.value = band.frequency;
    node.gain.value = band.gain;
    
    // Q值只对某些滤波器类型有效
    if (band.type === BandType.PEAKING || 
        band.type === BandType.NOTCH || 
        band.type === BandType.LOWPASS || 
        band.type === BandType.HIGHPASS) {
      node.Q.value = band.Q;
    }
  }
}

/**
 * 获取均衡器预设的描述
 * @param {string} presetName - 预设名称
 * @returns {string} 预设描述
 */
export function getEqualizerPresetDescription(presetName) {
  const descriptions = {
    [EqualizerMode.FLAT]: '平坦响应，不改变原始音频',
    [EqualizerMode.BASS_BOOST]: '增强低频，提供更有力的低音效果',
    [EqualizerMode.TREBLE_BOOST]: '增强高频，提供更明亮的声音',
    [EqualizerMode.SPEECH]: '优化人声频率，增强语音清晰度',
    [EqualizerMode.PODCAST]: '针对讲话内容优化，增强语音清晰度，减少噪音',
    [EqualizerMode.ACOUSTIC]: '优化原声乐器表现，温暖平衡的音色',
    [EqualizerMode.ELECTRONIC]: '增强低频和高频，提供更有冲击力的电子音乐体验',
    [EqualizerMode.CLASSICAL]: '为古典音乐提供平衡的音色，轻微增强高低频',
    [EqualizerMode.JAZZ]: '营造温暖而清晰的爵士乐聆听体验',
    [EqualizerMode.ROCK]: '增强低频和中高频，提供摇滚乐所需的强劲声音',
    [EqualizerMode.POP]: '增强低频和高频，提供明亮流行的声音',
    [EqualizerMode.LANGUAGE_LEARNING]: '优化语音清晰度，突出语言学习中的关键频率',
    [EqualizerMode.PRONUNCIATION]: '突出特殊语音成分，帮助发音练习',
    [EqualizerMode.LISTENING_PRACTICE]: '平衡温和的设置，减少听力疲劳，适合长时间练习',
    [EqualizerMode.HEADPHONES]: '补偿耳机常见的频率响应不足',
    [EqualizerMode.NIGHTMODE]: '减少低频，增强语音清晰度，适合低音量夜间使用',
    [EqualizerMode.CUSTOM]: '自定义均衡器设置',
  };
  
  return descriptions[presetName] || '未知预设';
}

/**
 * 创建默认均衡器设置
 * @returns {Array} 默认均衡器设置
 */
export function createDefaultSettings() {
  return JSON.parse(JSON.stringify(defaultBands));
} 