import { ensureAudioContext, resumeAudioContext, detectAudioContextSupport } from './processing';

/**
 * 音频引擎类 - 提供Web Audio API的抽象层，处理高级音频处理功能
 */
export class AudioEngine {
  /**
   * 创建新的音频引擎实例
   * @param {Object} options - 初始化选项
   * @param {number} options.sampleRate - 采样率
   * @param {string} options.latencyHint - 延迟提示
   */
  constructor(options = {}) {
    this._initialized = false;
    this._context = null;
    this._sourceNode = null;
    this._processingNodes = {};
    this._timeStretchNode = null;
    this._pitchShiftNode = null;
    this._options = {
      sampleRate: options.sampleRate || 44100,
      latencyHint: options.latencyHint || 'interactive'
    };
    this._playbackRate = 1.0;
    this._pitch = 0;
    this._workletLoaded = false;
  }

  /**
   * 初始化音频引擎
   * @returns {Promise<boolean>} 初始化是否成功
   */
  async initialize() {
    if (this._initialized) return true;

    try {
      // 创建音频上下文
      this._context = ensureAudioContext(this._options);
      
      // 加载AudioWorklet处理器（如果支持）
      if (this._context._support && this._context._support.audioWorklet) {
        await this._loadAudioWorklets();
      }
      
      // 尝试恢复上下文
      await resumeAudioContext();
      
      this._initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize audio engine:', error);
      return false;
    }
  }

  /**
   * 加载音频处理器工作线程
   * @private
   */
  async _loadAudioWorklets() {
    try {
      // 检查是否已加载
      if (this._workletLoaded) return;

      // 加载时间拉伸处理器
      await this._context.audioWorklet.addModule('/audio-worklets/time-stretch-processor.js');
      
      // 加载音高调整处理器
      await this._context.audioWorklet.addModule('/audio-worklets/pitch-shift-processor.js');
      
      this._workletLoaded = true;
      console.log('Audio worklets loaded successfully');
    } catch (error) {
      console.error('Failed to load audio worklets:', error);
      this._workletLoaded = false;
    }
  }

  /**
   * 创建时间拉伸节点
   * @private
   */
  _createTimeStretchNode() {
    if (!this._workletLoaded) {
      console.warn('AudioWorklet not loaded, time stretch will not work');
      return null;
    }

    try {
      return new AudioWorkletNode(this._context, 'time-stretch-processor', {
        parameterData: {
          playbackRate: this._playbackRate
        }
      });
    } catch (error) {
      console.error('Failed to create time stretch node:', error);
      return null;
    }
  }

  /**
   * 创建音高调整节点
   * @private
   */
  _createPitchShiftNode() {
    if (!this._workletLoaded) {
      console.warn('AudioWorklet not loaded, pitch shift will not work');
      return null;
    }

    try {
      return new AudioWorkletNode(this._context, 'pitch-shift-processor', {
        parameterData: {
          pitchFactor: Math.pow(2, this._pitch / 12) // 变换为半音
        }
      });
    } catch (error) {
      console.error('Failed to create pitch shift node:', error);
      return null;
    }
  }

  /**
   * 使用ScriptProcessorNode创建时间拉伸节点的回退实现
   * @private
   */
  _createFallbackTimeStretchNode() {
    try {
      // 创建一个scriptProcessor作为回退
      const bufferSize = 4096;
      const scriptNode = this._context.createScriptProcessor(
        bufferSize, 
        2,  // 输入声道数
        2   // 输出声道数
      );
      
      // 初始化处理状态
      const state = {
        playbackRate: this._playbackRate,
        grainSize: bufferSize * 2,
        grainWindow: new Float32Array(bufferSize * 2),
        inputBuffer: new Float32Array(bufferSize * 4),
        outputBufferL: new Float32Array(bufferSize),
        outputBufferR: new Float32Array(bufferSize),
        position: 0
      };
      
      // 创建汉宁窗
      for (let i = 0; i < state.grainWindow.length; i++) {
        state.grainWindow[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / state.grainWindow.length));
      }
      
      // 音频处理回调
      scriptNode.onaudioprocess = (e) => {
        const inputL = e.inputBuffer.getChannelData(0);
        const inputR = e.inputBuffer.getChannelData(1);
        const outputL = e.outputBuffer.getChannelData(0);
        const outputR = e.outputBuffer.getChannelData(1);
        
        // 将新输入复制到输入缓冲区
        for (let i = 0; i < inputL.length; i++) {
          state.inputBuffer[state.position + i] = inputL[i];
          state.inputBuffer[state.position + i + bufferSize] = inputR[i];
        }
        
        // 更新位置
        state.position += inputL.length;
        if (state.position > state.grainSize) {
          state.position = 0;
        }
        
        // 清除输出缓冲区
        for (let i = 0; i < outputL.length; i++) {
          state.outputBufferL[i] = 0;
          state.outputBufferR[i] = 0;
        }
        
        // 简单的SOLA (同步叠加加法) 时间拉伸实现
        const rate = state.playbackRate;
        const grainIntervalInput = state.grainSize;
        const grainIntervalOutput = Math.round(grainIntervalInput / rate);
        
        // 处理覆盖的窗口
        let readPosition = 0;
        for (let i = 0; i < 2; i++) {
          // 应用窗口
          for (let j = 0; j < state.grainSize && j < outputL.length; j++) {
            const index = (readPosition + j) % state.inputBuffer.length;
            const windowGain = state.grainWindow[j];
            
            // 左声道
            state.outputBufferL[j] += state.inputBuffer[index] * windowGain;
            // 右声道
            state.outputBufferR[j] += state.inputBuffer[index + bufferSize] * windowGain;
          }
          
          readPosition += grainIntervalInput;
        }
        
        // 复制到输出
        for (let i = 0; i < outputL.length; i++) {
          outputL[i] = state.outputBufferL[i];
          outputR[i] = state.outputBufferR[i];
        }
        
        // 更新播放速率
        state.playbackRate = this._playbackRate;
      };
      
      return scriptNode;
    } catch (error) {
      console.error('Failed to create fallback time stretch node:', error);
      return null;
    }
  }

  /**
   * 连接音频源
   * @param {HTMLAudioElement|AudioBuffer} source - 音频源
   * @returns {boolean} 连接是否成功
   */
  connectSource(source) {
    if (!this._initialized) {
      console.error('Audio engine not initialized');
      return false;
    }
    
    try {
      // 断开现有源
      this.disconnectSource();
      
      // 创建源节点
      if (source instanceof HTMLAudioElement) {
        this._sourceNode = this._context.createMediaElementSource(source);
        
        // 保存源元素的引用，用于控制播放速度
        this._sourceElement = source;
      } else if (source instanceof AudioBuffer) {
        this._sourceNode = this._context.createBufferSource();
        this._sourceNode.buffer = source;
      } else {
        throw new Error('不支持的音频源类型');
      }
      
      // 创建处理链
      this._setupProcessingChain();
      
      // 如果是缓冲源，开始播放
      if (this._sourceNode instanceof AudioBufferSourceNode) {
        this._sourceNode.start();
      }
      
      return true;
    } catch (error) {
      console.error('Failed to connect audio source:', error);
      return false;
    }
  }

  /**
   * 断开音频源
   */
  disconnectSource() {
    if (this._sourceNode) {
      try {
        this._sourceNode.disconnect();
        this._sourceNode = null;
      } catch (error) {
        console.warn('Error disconnecting source node:', error);
      }
    }
    
    // 断开所有处理节点
    Object.keys(this._processingNodes).forEach(key => {
      const node = this._processingNodes[key];
      try {
        if (node) node.disconnect();
      } catch (error) {
        // 忽略已断开的节点错误
      }
    });
    
    // 断开时间拉伸节点
    if (this._timeStretchNode) {
      try {
        this._timeStretchNode.disconnect();
        this._timeStretchNode = null;
      } catch (error) {
        // 忽略已断开的节点错误
      }
    }
    
    // 断开音高调整节点
    if (this._pitchShiftNode) {
      try {
        this._pitchShiftNode.disconnect();
        this._pitchShiftNode = null;
      } catch (error) {
        // 忽略已断开的节点错误
      }
    }
    
    this._sourceElement = null;
  }

  /**
   * 设置处理链
   * @private
   */
  _setupProcessingChain() {
    if (!this._sourceNode || !this._context) return;
    
    // 创建基本处理节点
    const analyser = this._context.createAnalyser();
    analyser.fftSize = 2048;
    
    const gain = this._context.createGain();
    
    const compressor = this._context.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 30;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;
    
    // 创建均衡器
    const eq = {
      bass: this._context.createBiquadFilter(),
      mid: this._context.createBiquadFilter(),
      treble: this._context.createBiquadFilter()
    };
    
    // 配置均衡器
    eq.bass.type = 'lowshelf';
    eq.bass.frequency.value = 200;
    eq.bass.gain.value = 0;
    
    eq.mid.type = 'peaking';
    eq.mid.frequency.value = 1000;
    eq.mid.Q.value = 1;
    eq.mid.gain.value = 0;
    
    eq.treble.type = 'highshelf';
    eq.treble.frequency.value = 3000;
    eq.treble.gain.value = 0;
    
    // 创建时间拉伸节点和音高调整节点（如果支持）
    if (this._workletLoaded) {
      // 创建时间拉伸和音高调整节点
      this._timeStretchNode = this._createTimeStretchNode();
      this._pitchShiftNode = this._createPitchShiftNode();
    } else {
      // 回退实现
      this._timeStretchNode = this._createFallbackTimeStretchNode();
    }
    
    // 保存节点引用
    this._processingNodes = {
      analyser,
      gain,
      eq,
      compressor
    };
    
    // 连接处理链
    // 基本连接：source -> analyser -> eq -> gain -> compressor -> destination
    
    if (this._timeStretchNode && this._pitchShiftNode) {
      // 高级连接：source -> analyser -> timeStretch -> pitchShift -> eq -> gain -> compressor -> destination
      this._sourceNode.connect(analyser);
      analyser.connect(this._timeStretchNode);
      this._timeStretchNode.connect(this._pitchShiftNode);
      this._pitchShiftNode.connect(eq.bass);
    } else if (this._timeStretchNode) {
      // 只有时间拉伸：source -> analyser -> timeStretch -> eq -> gain -> compressor -> destination
      this._sourceNode.connect(analyser);
      analyser.connect(this._timeStretchNode);
      this._timeStretchNode.connect(eq.bass);
    } else {
      // 基本连接
      this._sourceNode.connect(analyser);
      analyser.connect(eq.bass);
    }
    
    // 其余连接
    eq.bass.connect(eq.mid);
    eq.mid.connect(eq.treble);
    eq.treble.connect(gain);
    gain.connect(compressor);
    compressor.connect(this._context.destination);
  }

  /**
   * 设置播放速度（时间拉伸）
   * @param {number} rate - 播放速率
   * @returns {boolean} 设置是否成功
   */
  setPlaybackRate(rate) {
    // 限制速度范围
    const safeRate = Math.max(0.25, Math.min(3.0, rate));
    this._playbackRate = safeRate;
    
    // 更新时间拉伸节点
    if (this._timeStretchNode) {
      try {
        if (this._workletLoaded) {
          // 使用AudioParam接口更新
          const param = this._timeStretchNode.parameters.get('playbackRate');
          if (param) {
            param.setValueAtTime(safeRate, this._context.currentTime);
          }
        }
        // 否则使用回退实现（会在下一个处理回调中更新）
        return true;
      } catch (error) {
        console.error('Failed to set playback rate on time stretch node:', error);
      }
    }
    
    // 如果没有时间拉伸节点或它不能工作，尝试直接设置源元素的playbackRate
    if (this._sourceElement) {
      try {
        this._sourceElement.playbackRate = safeRate;
        return true;
      } catch (error) {
        console.error('Failed to set playbackRate on source element:', error);
      }
    } else if (this._sourceNode instanceof AudioBufferSourceNode) {
      try {
        this._sourceNode.playbackRate.setValueAtTime(safeRate, this._context.currentTime);
        return true;
      } catch (error) {
        console.error('Failed to set playbackRate on buffer source:', error);
      }
    }
    
    return false;
  }

  /**
   * 设置音高调整（不影响速度）
   * @param {number} semitones - 半音调整（-12到12）
   * @returns {boolean} 设置是否成功
   */
  setPitch(semitones) {
    // 限制范围到±12半音
    const safePitch = Math.max(-12, Math.min(12, semitones));
    this._pitch = safePitch;
    
    // 更新音高调整节点
    if (this._pitchShiftNode && this._workletLoaded) {
      try {
        const pitchFactor = Math.pow(2, safePitch / 12); // 将半音转换为音高因子
        const param = this._pitchShiftNode.parameters.get('pitchFactor');
        if (param) {
          param.setValueAtTime(pitchFactor, this._context.currentTime);
        }
        return true;
      } catch (error) {
        console.error('Failed to set pitch on pitch shift node:', error);
      }
    }
    
    return false;
  }

  /**
   * 设置音量
   * @param {number} volume - 音量（0-1）
   * @returns {boolean} 设置是否成功
   */
  setVolume(volume) {
    if (!this._processingNodes.gain) return false;
    
    try {
      const safeVolume = Math.max(0, Math.min(1, volume));
      this._processingNodes.gain.gain.value = safeVolume;
      return true;
    } catch (error) {
      console.error('Failed to set volume:', error);
      return false;
    }
  }

  /**
   * 设置均衡器
   * @param {number} bass - 低频增益（0-2，1为中性）
   * @param {number} mid - 中频增益（0-2，1为中性）
   * @param {number} treble - 高频增益（0-2，1为中性）
   * @returns {boolean} 设置是否成功
   */
  setEqualizer(bass, mid, treble) {
    if (!this._processingNodes.eq) return false;
    
    try {
      const eq = this._processingNodes.eq;
      
      // 转换为dB值（0-2映射到-40dB到+40dB）
      const bassGain = (Math.max(0, Math.min(2, bass)) - 1) * 40;
      const midGain = (Math.max(0, Math.min(2, mid)) - 1) * 40;
      const trebleGain = (Math.max(0, Math.min(2, treble)) - 1) * 40;
      
      eq.bass.gain.value = bassGain;
      eq.mid.gain.value = midGain;
      eq.treble.gain.value = trebleGain;
      
      return true;
    } catch (error) {
      console.error('Failed to set equalizer:', error);
      return false;
    }
  }

  /**
   * 获取波形数据
   * @returns {Uint8Array} 波形数据
   */
  getWaveformData() {
    if (!this._processingNodes.analyser) {
      return new Uint8Array(0);
    }
    
    try {
      const analyser = this._processingNodes.analyser;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteTimeDomainData(dataArray);
      return dataArray;
    } catch (error) {
      console.error('Failed to get waveform data:', error);
      return new Uint8Array(0);
    }
  }

  /**
   * 获取频谱数据
   * @returns {Uint8Array} 频谱数据
   */
  getFrequencyData() {
    if (!this._processingNodes.analyser) {
      return new Uint8Array(0);
    }
    
    try {
      const analyser = this._processingNodes.analyser;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);
      return dataArray;
    } catch (error) {
      console.error('Failed to get frequency data:', error);
      return new Uint8Array(0);
    }
  }

  /**
   * 设置语音增强模式
   * @param {boolean} enabled - 是否启用语音增强
   * @returns {boolean} 设置是否成功
   */
  setVoiceEnhancement(enabled) {
    if (!this._processingNodes.eq) return false;
    
    try {
      if (enabled) {
        // 语音增强预设 - 增强人声频率范围
        this._processingNodes.eq.bass.frequency.value = 200;
        this._processingNodes.eq.bass.gain.value = -10; // 降低低频
        
        this._processingNodes.eq.mid.frequency.value = 1000;
        this._processingNodes.eq.mid.gain.value = 5; // 增强中频
        this._processingNodes.eq.mid.Q.value = 1.5; // 窄化中频带宽
        
        this._processingNodes.eq.treble.frequency.value = 3000;
        this._processingNodes.eq.treble.gain.value = 2; // 略微增强高频
        
        // 调整压缩器设置，提高清晰度
        if (this._processingNodes.compressor) {
          this._processingNodes.compressor.threshold.value = -30;
          this._processingNodes.compressor.ratio.value = 12;
          this._processingNodes.compressor.attack.value = 0.003;
          this._processingNodes.compressor.release.value = 0.25;
        }
      } else {
        // 恢复默认设置
        this._processingNodes.eq.bass.gain.value = 0;
        this._processingNodes.eq.mid.gain.value = 0;
        this._processingNodes.eq.treble.gain.value = 0;
        this._processingNodes.eq.mid.Q.value = 1;
        
        // 恢复压缩器默认设置
        if (this._processingNodes.compressor) {
          this._processingNodes.compressor.threshold.value = -24;
          this._processingNodes.compressor.ratio.value = 12;
          this._processingNodes.compressor.attack.value = 0.003;
          this._processingNodes.compressor.release.value = 0.25;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Failed to set voice enhancement:', error);
      return false;
    }
  }

  /**
   * 释放资源
   */
  dispose() {
    this.disconnectSource();
    
    // 清理加载标志
    this._workletLoaded = false;
    this._initialized = false;
    
    // 不要关闭上下文，因为它可能是共享的
    this._context = null;
  }

  /**
   * 检查功能是否可用
   * @returns {Object} 支持的功能列表
   */
  getSupportInfo() {
    const support = detectAudioContextSupport();
    
    return {
      webAudio: !!support.standardContext || !!support.webkitContext,
      timeStretch: this._workletLoaded,
      pitchShift: this._workletLoaded,
      audioWorklet: !!support.audioWorklet,
      offlineAudioContext: !!support.offlineContext
    };
  }
}

/**
 * 使用音频引擎的React钩子
 * @param {Object} options - 引擎选项
 * @returns {Object} 包含音频引擎和相关函数的对象
 */
export function useAudioEngine(options = {}) {
  const engineRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [supportInfo, setSupportInfo] = useState({
    webAudio: false,
    timeStretch: false,
    pitchShift: false,
    audioWorklet: false,
    offlineAudioContext: false
  });
  
  // 初始化引擎
  const initialize = useCallback(async () => {
    if (!engineRef.current) {
      engineRef.current = new AudioEngine(options);
    }
    
    const success = await engineRef.current.initialize();
    setIsInitialized(success);
    
    if (success) {
      setSupportInfo(engineRef.current.getSupportInfo());
    }
    
    return success;
  }, [options]);
  
  // 清理引擎
  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.dispose();
      }
    };
  }, []);
  
  // 提供API函数
  return {
    initialize,
    isInitialized,
    supportInfo,
    connectSource: useCallback((source) => {
      return engineRef.current?.connectSource(source) || false;
    }, []),
    disconnectSource: useCallback(() => {
      engineRef.current?.disconnectSource();
    }, []),
    setPlaybackRate: useCallback((rate) => {
      return engineRef.current?.setPlaybackRate(rate) || false;
    }, []),
    setPitch: useCallback((semitones) => {
      return engineRef.current?.setPitch(semitones) || false;
    }, []),
    setVolume: useCallback((volume) => {
      return engineRef.current?.setVolume(volume) || false;
    }, []),
    setEqualizer: useCallback((bass, mid, treble) => {
      return engineRef.current?.setEqualizer(bass, mid, treble) || false;
    }, []),
    setVoiceEnhancement: useCallback((enabled) => {
      return engineRef.current?.setVoiceEnhancement(enabled) || false;
    }, []),
    getWaveformData: useCallback(() => {
      return engineRef.current?.getWaveformData() || new Uint8Array(0);
    }, []),
    getFrequencyData: useCallback(() => {
      return engineRef.current?.getFrequencyData() || new Uint8Array(0);
    }, [])
  };
} 