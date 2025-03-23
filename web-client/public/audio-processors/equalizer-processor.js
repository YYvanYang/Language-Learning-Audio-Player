/**
 * 均衡器音频处理器
 * 实现简单的三段式均衡器（低音、中音、高音）
 */
class EqualizerProcessor extends AudioWorkletProcessor {
  // 静态参数定义
  static get parameterDescriptors() {
    return [
      {
        name: 'bass',
        defaultValue: 1.0,
        minValue: 0.0,
        maxValue: 3.0,
        automationRate: 'k-rate'
      },
      {
        name: 'mid',
        defaultValue: 1.0,
        minValue: 0.0,
        maxValue: 3.0,
        automationRate: 'k-rate'
      },
      {
        name: 'treble',
        defaultValue: 1.0,
        minValue: 0.0,
        maxValue: 3.0,
        automationRate: 'k-rate'
      }
    ];
  }

  // 构造函数
  constructor() {
    super();
    
    // 初始化滤波器系数
    this.bassFilter = {
      a: [1.0, -1.9733, 0.9738],
      b: [0.0001, 0.0002, 0.0001],
      z: [0, 0], // 延迟线
      cutoff: 300 // Hz
    };
    
    this.midFilter = {
      a: [1.0, -1.8961, 0.9026],
      b: [0.0032, 0, -0.0032],
      z: [0, 0], // 延迟线
      cutoff: 1000 // Hz
    };
    
    this.trebleFilter = {
      a: [1.0, -1.6065, 0.6536],
      b: [0.8234, -1.6468, 0.8234],
      z: [0, 0], // 延迟线
      cutoff: 3000 // Hz
    };
    
    // 采样率
    this.sampleRate = 44100;
  }
  
  // 应用双二阶滤波器
  applyBiquadFilter(input, filter, gain) {
    // 应用增益
    const scaledGain = gain;
    
    // 计算输出
    const output = filter.b[0] * input + filter.b[1] * filter.z[0] + filter.b[2] * filter.z[1] - 
                   filter.a[1] * filter.z[0] - filter.a[2] * filter.z[1];
    
    // 更新延迟线
    filter.z[1] = filter.z[0];
    filter.z[0] = output;
    
    return output * scaledGain;
  }

  // 处理音频
  process(inputs, outputs, parameters) {
    // 获取参数值
    const bassGain = parameters.bass[0];
    const midGain = parameters.mid[0];
    const trebleGain = parameters.treble[0];
    
    // 处理所有输入通道
    const input = inputs[0];
    const output = outputs[0];
    
    // 如果没有输入，返回 true 继续处理
    if (!input || !input.length) return true;
    
    // 处理每个通道
    for (let channel = 0; channel < input.length; channel++) {
      const inputChannel = input[channel];
      const outputChannel = output[channel];
      
      // 处理每个样本
      for (let i = 0; i < inputChannel.length; i++) {
        const sample = inputChannel[i];
        
        // 分别应用三个频段的处理
        const bassOut = this.applyBiquadFilter(sample, this.bassFilter, bassGain);
        const midOut = this.applyBiquadFilter(sample, this.midFilter, midGain);
        const trebleOut = this.applyBiquadFilter(sample, this.trebleFilter, trebleGain);
        
        // 合并输出
        outputChannel[i] = bassOut + midOut + trebleOut;
      }
    }
    
    // 返回 true 表示继续处理
    return true;
  }
}

// 注册处理器
registerProcessor('equalizer-processor', EqualizerProcessor); 