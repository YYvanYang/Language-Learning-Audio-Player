/**
 * 音高调整处理器 - 实现不改变速度的音高控制
 * 
 * 这个处理器使用相位声码器算法实现音高调整
 * 它可以更改音频的音高而不影响播放速度
 */
class PitchShiftProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{
      name: 'pitchFactor',
      defaultValue: 1.0,
      minValue: 0.5,  // 下降一个八度
      maxValue: 2.0,  // 上升一个八度
      automationRate: 'k-rate'
    }];
  }

  constructor() {
    super();
    
    // FFT 参数
    this.fftSize = 2048;
    this.hopSize = 512;
    
    // 初始化状态
    this.inputBuffer = new Float32Array(this.fftSize * 2);
    this.outputBuffer = new Float32Array(this.fftSize * 2);
    this.position = 0;
    this.inputBufferFill = 0;
    this.outputBufferFill = 0;
    this.outputBufferPosition = 0;
    
    // 窗函数
    this.window = this._createHannWindow(this.fftSize);
    
    // FFT 状态
    this.fftReal = new Float32Array(this.fftSize);
    this.fftImag = new Float32Array(this.fftSize);
    this.fftMagnitude = new Float32Array(this.fftSize);
    this.fftPhase = new Float32Array(this.fftSize);
    this.lastPhase = new Float32Array(this.fftSize);
    this.sumPhase = new Float32Array(this.fftSize);
    
    // 是否已处理第一帧
    this.hasProcessedFrame = false;
    
    // 获取当前采样率
    this.sampleRate = sampleRate; // 使用 AudioWorkletGlobalScope 中的全局变量
  }

  /**
   * 创建汉宁窗
   * @param {number} size - 窗口大小
   * @returns {Float32Array} 窗函数
   */
  _createHannWindow(size) {
    const window = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (size - 1)));
    }
    return window;
  }

  /**
   * 执行快速傅里叶变换
   * @param {Float32Array} real - 实部数组
   * @param {Float32Array} imag - 虚部数组
   * @param {boolean} inverse - 是否为逆变换
   */
  _fft(real, imag, inverse) {
    const n = real.length;
    
    // 判断是否为2的幂次
    if ((n & (n - 1)) !== 0 || n <= 1) {
      throw new Error('FFT size must be a power of 2 and greater than 1');
    }
    
    // 位反转排序
    let j = 0;
    for (let i = 0; i < n - 1; i++) {
      if (i < j) {
        // 交换实部
        [real[i], real[j]] = [real[j], real[i]];
        // 交换虚部
        [imag[i], imag[j]] = [imag[j], imag[i]];
      }
      
      let k = n >> 1;
      while (k <= j) {
        j -= k;
        k >>= 1;
      }
      j += k;
    }
    
    // 蝶形运算
    for (let stage = 1; stage <= Math.log2(n); stage++) {
      const butterflySize = 1 << stage;
      const halfButterfly = butterflySize >> 1;
      
      // 计算旋转因子的基础值
      const angleIncrement = (inverse ? 2 : -2) * Math.PI / butterflySize;
      
      for (let i = 0; i < n; i += butterflySize) {
        for (let j = 0; j < halfButterfly; j++) {
          const angle = angleIncrement * j;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          
          const idx1 = i + j;
          const idx2 = i + j + halfButterfly;
          
          // 蝶形运算部分
          const tempReal = real[idx2] * cos - imag[idx2] * sin;
          const tempImag = real[idx2] * sin + imag[idx2] * cos;
          
          real[idx2] = real[idx1] - tempReal;
          imag[idx2] = imag[idx1] - tempImag;
          
          real[idx1] = real[idx1] + tempReal;
          imag[idx1] = imag[idx1] + tempImag;
        }
      }
    }
    
    // 对于逆变换，需要除以n
    if (inverse) {
      for (let i = 0; i < n; i++) {
        real[i] /= n;
        imag[i] /= n;
      }
    }
  }

  /**
   * 应用音高调整
   * @param {Float32Array} inputFrame - 输入帧
   * @param {Float32Array} outputFrame - 输出帧
   * @param {number} pitchFactor - 音高调整因子
   */
  _applyPitchShift(inputFrame, outputFrame, pitchFactor) {
    // 复制输入帧到FFT实部，并清零虚部
    for (let i = 0; i < this.fftSize; i++) {
      this.fftReal[i] = inputFrame[i] * this.window[i];
      this.fftImag[i] = 0;
    }
    
    // 执行正向FFT
    this._fft(this.fftReal, this.fftImag, false);
    
    // 计算幅度和相位
    for (let i = 0; i < this.fftSize; i++) {
      const real = this.fftReal[i];
      const imag = this.fftImag[i];
      
      // 计算幅度
      this.fftMagnitude[i] = Math.sqrt(real * real + imag * imag);
      
      // 计算相位
      this.fftPhase[i] = Math.atan2(imag, real);
    }
    
    // 相位处理
    if (this.hasProcessedFrame) {
      for (let i = 0; i < this.fftSize; i++) {
        // 计算相位差
        let phaseDiff = this.fftPhase[i] - this.lastPhase[i];
        
        // 相位展开
        phaseDiff = phaseDiff - 2 * Math.PI * Math.round(phaseDiff / (2 * Math.PI));
        
        // 计算真实频率
        const frequency = (phaseDiff * this.sampleRate) / (2 * Math.PI * this.hopSize);
        
        // 应用音高调整
        const newPhase = this.sumPhase[i] + 2 * Math.PI * (frequency * pitchFactor) * (this.hopSize / this.sampleRate);
        
        // 更新累积相位
        this.sumPhase[i] = newPhase;
        
        // 计算新的实部和虚部
        this.fftReal[i] = this.fftMagnitude[i] * Math.cos(newPhase);
        this.fftImag[i] = this.fftMagnitude[i] * Math.sin(newPhase);
      }
    } else {
      // 第一帧没有相位差，直接用当前相位
      for (let i = 0; i < this.fftSize; i++) {
        this.sumPhase[i] = this.fftPhase[i];
      }
      this.hasProcessedFrame = true;
    }
    
    // 保存当前相位以便下一帧使用
    for (let i = 0; i < this.fftSize; i++) {
      this.lastPhase[i] = this.fftPhase[i];
    }
    
    // 执行逆向FFT
    this._fft(this.fftReal, this.fftImag, true);
    
    // 应用窗函数并复制到输出帧
    for (let i = 0; i < this.fftSize; i++) {
      outputFrame[i] = this.fftReal[i] * this.window[i];
    }
  }

  /**
   * 处理音频数据
   * @param {Float32Array[][]} inputs - 输入音频数据
   * @param {Float32Array[][]} outputs - 输出音频数据
   * @param {Object} parameters - 处理参数
   * @returns {boolean} 是否继续处理
   */
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    
    // 获取当前音高调整因子
    const pitchFactor = parameters.pitchFactor[0];
    
    // 如果没有输入，输出静音
    if (!input || !input[0] || input[0].length === 0) {
      for (let channel = 0; channel < output.length; channel++) {
        const outputChannel = output[channel];
        for (let i = 0; i < outputChannel.length; i++) {
          outputChannel[i] = 0;
        }
      }
      return true;
    }
    
    // 处理每个通道
    const numChannels = Math.min(input.length, output.length);
    
    for (let channel = 0; channel < numChannels; channel++) {
      const inputChannel = input[channel];
      const outputChannel = output[channel];
      
      // 从输入缓冲区或输出缓冲区中提取数据
      if (this.outputBufferFill > outputChannel.length) {
        // 已有足够的输出数据
        for (let i = 0; i < outputChannel.length; i++) {
          outputChannel[i] = this.outputBuffer[this.outputBufferPosition + i];
        }
        
        this.outputBufferPosition += outputChannel.length;
        this.outputBufferFill -= outputChannel.length;
      } else {
        // 需要处理更多输入数据
        
        // 添加新输入到缓冲区
        for (let i = 0; i < inputChannel.length; i++) {
          if (this.inputBufferFill < this.inputBuffer.length) {
            this.inputBuffer[this.inputBufferFill++] = inputChannel[i];
          }
        }
        
        // 如果输入缓冲区已满，处理数据
        if (this.inputBufferFill >= this.fftSize) {
          // 创建帧
          const inputFrame = new Float32Array(this.fftSize);
          const outputFrame = new Float32Array(this.fftSize);
          
          // 提取输入帧
          for (let i = 0; i < this.fftSize; i++) {
            inputFrame[i] = this.inputBuffer[i];
          }
          
          // 应用音高调整
          this._applyPitchShift(inputFrame, outputFrame, pitchFactor);
          
          // 叠加输出帧到输出缓冲区
          for (let i = 0; i < this.fftSize; i++) {
            if (i < this.hopSize) {
              // 叠加输出
              this.outputBuffer[i] += outputFrame[i];
            } else {
              // 填充新输出
              this.outputBuffer[i] = outputFrame[i];
            }
          }
          
          // 更新输出缓冲区填充级别
          this.outputBufferFill = this.fftSize;
          this.outputBufferPosition = 0;
          
          // 移动输入缓冲区
          for (let i = 0; i < this.inputBufferFill - this.hopSize; i++) {
            this.inputBuffer[i] = this.inputBuffer[i + this.hopSize];
          }
          this.inputBufferFill -= this.hopSize;
          
          // 递归调用以填充输出
          return this.process([], outputs, parameters);
        } else {
          // 不够数据，输出静音
          for (let i = 0; i < outputChannel.length; i++) {
            outputChannel[i] = 0;
          }
        }
      }
    }
    
    return true;
  }
}

// 注册处理器
registerProcessor('pitch-shift-processor', PitchShiftProcessor); 