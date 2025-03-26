/**
 * 实时音频处理器 - 与WebAssembly集成的AudioWorklet处理器
 * 提供实时频谱分析和音频处理功能
 */

// 定义处理器类
class RealtimeAudioProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: 'bassGain',
        defaultValue: 0,
        minValue: -12,
        maxValue: 12,
        automationRate: 'k-rate'
      },
      {
        name: 'midGain',
        defaultValue: 0,
        minValue: -12,
        maxValue: 12,
        automationRate: 'k-rate'
      },
      {
        name: 'trebleGain',
        defaultValue: 0,
        minValue: -12,
        maxValue: 12,
        automationRate: 'k-rate'
      },
      {
        name: 'bypass',
        defaultValue: 0,
        minValue: 0,
        maxValue: 1,
        automationRate: 'k-rate'
      }
    ];
  }

  constructor(options) {
    super();
    
    // 初始化处理器状态
    this.initialized = false;
    this.bufferSize = 512; // 处理缓冲区大小
    this.sampleRate = 44100; // 默认采样率
    
    // 创建环形缓冲区用于频谱分析
    this.ringBuffer = new Float32Array(4096);
    this.ringBufferPos = 0;
    
    // 分析计时器 - 每128帧处理一次频谱分析
    this.analyzeCounter = 0;
    this.analyzeInterval = 128;
    
    // 处理器状态
    this.state = {
      envelope: 0,
      rmsValue: 0,
      pitch: 0,
      spectralFlux: 0
    };
    
    // 处理器选项
    this.options = options?.processorOptions || {};
    
    // 初始化信号标志
    this.port.postMessage({
      type: 'init',
      message: 'RealtimeAudioProcessor初始化'
    });
    
    // 设置消息监听器
    this.port.onmessage = this.handleMessage.bind(this);
  }
  
  /**
   * 处理来自主线程的消息
   * @param {MessageEvent} event - 消息事件
   */
  handleMessage(event) {
    const { data } = event;
    
    switch (data.type) {
      case 'init':
        // WebAssembly模块已加载的通知
        this.initialized = true;
        this.port.postMessage({
          type: 'initialized',
          message: '处理器已准备就绪'
        });
        break;
        
      case 'setParam':
        // 设置处理器参数
        if (data.name && data.value !== undefined) {
          this.options[data.name] = data.value;
        }
        break;
        
      case 'requestAnalysis':
        // 请求分析数据
        this.port.postMessage({
          type: 'analysisData',
          state: this.state
        });
        break;
    }
  }
  
  /**
   * 主处理方法 - 由AudioWorklet系统调用
   * @param {Array} inputs - 输入音频缓冲区
   * @param {Array} outputs - 输出音频缓冲区
   * @param {Object} parameters - 处理参数
   * @returns {boolean} - 返回true表示处理器保持活动状态
   */
  process(inputs, outputs, parameters) {
    // 获取输入和输出缓冲区
    const input = inputs[0];
    const output = outputs[0];
    
    // 检查是否有输入
    if (!input || !input[0] || input[0].length === 0) {
      return true;
    }
    
    // 获取参数
    const bassGain = parameters.bassGain[0];
    const midGain = parameters.midGain[0];
    const trebleGain = parameters.trebleGain[0];
    const bypass = parameters.bypass[0] >= 0.5;
    
    // 取得输入通道数
    const numChannels = Math.min(input.length, output.length);
    const bufferSize = input[0].length;
    
    // 处理每个通道
    for (let channel = 0; channel < numChannels; channel++) {
      const inputChannel = input[channel];
      const outputChannel = output[channel];
      
      // 如果处于旁路模式，直接复制输入到输出
      if (bypass) {
        for (let i = 0; i < bufferSize; i++) {
          outputChannel[i] = inputChannel[i];
        }
        continue;
      }
      
      // 否则，应用处理
      // 在这里，我们会应用我们的音频处理
      // 由于WebAssembly无法直接在AudioWorklet中使用，我们使用基本的JS处理
      
      // 简单的三段均衡器实现
      this.applyEqualizer(inputChannel, outputChannel, bassGain, midGain, trebleGain);
      
      // 更新环形缓冲区 (用于频谱分析)
      if (channel === 0) { // 只使用第一个通道进行分析
        this.updateRingBuffer(inputChannel);
        
        // 计算RMS值
        this.updateRmsValue(inputChannel);
      }
    }
    
    // 执行分析
    this.analyzeCounter++;
    if (this.analyzeCounter >= this.analyzeInterval) {
      this.analyzeCounter = 0;
      this.performAnalysis();
    }
    
    // 继续处理
    return true;
  }
  
  /**
   * 应用三段均衡器
   * @param {Float32Array} input - 输入通道数据
   * @param {Float32Array} output - 输出通道数据
   * @param {number} bassGain - 低频增益
   * @param {number} midGain - 中频增益
   * @param {number} trebleGain - 高频增益
   */
  applyEqualizer(input, output, bassGain, midGain, trebleGain) {
    // 转换dB增益为线性增益
    const bassLinear = Math.pow(10, bassGain / 20);
    const midLinear = Math.pow(10, midGain / 20);
    const trebleLinear = Math.pow(10, trebleGain / 20);
    
    // 简单均衡器实现
    // 在实际产品中，这里应该使用更复杂的IIR或FIR滤波器
    for (let i = 0; i < input.length; i++) {
      // 这里是一个非常简化的均衡器
      // 在生产环境中，应使用适当的滤波器设计
      
      // 这里简单模拟低频中频高频的影响
      output[i] = input[i] * ((bassLinear + midLinear + trebleLinear) / 3);
    }
  }
  
  /**
   * 更新环形缓冲区
   * @param {Float32Array} input - 输入通道数据
   */
  updateRingBuffer(input) {
    for (let i = 0; i < input.length; i++) {
      this.ringBuffer[this.ringBufferPos] = input[i];
      this.ringBufferPos = (this.ringBufferPos + 1) % this.ringBuffer.length;
    }
  }
  
  /**
   * 更新RMS值
   * @param {Float32Array} input - 输入通道数据
   */
  updateRmsValue(input) {
    let sumSquared = 0;
    for (let i = 0; i < input.length; i++) {
      sumSquared += input[i] * input[i];
    }
    
    // 计算RMS
    const rms = Math.sqrt(sumSquared / input.length);
    
    // 平滑RMS值
    this.state.rmsValue = 0.9 * this.state.rmsValue + 0.1 * rms;
    
    // 更新包络
    this.state.envelope = Math.max(this.state.envelope * 0.9, this.state.rmsValue);
  }
  
  /**
   * 执行频谱分析
   */
  performAnalysis() {
    // 在实际产品中，这里可以执行FFT分析
    // 但为了避免在AudioWorklet中进行大量计算，我们发送数据给主线程进行分析
    // 创建一个包含最近帧的数据的副本
    const analysisData = new Float32Array(this.ringBuffer.length);
    
    // 复制环形缓冲区的数据，正确排序
    for (let i = 0; i < this.ringBuffer.length; i++) {
      analysisData[i] = this.ringBuffer[(this.ringBufferPos + i) % this.ringBuffer.length];
    }
    
    // 发送数据到主线程进行分析
    this.port.postMessage({
      type: 'analysisBuffer',
      buffer: analysisData.buffer
    }, [analysisData.buffer]);
  }
}

// 注册处理器
registerProcessor('realtime-audio-processor', RealtimeAudioProcessor); 