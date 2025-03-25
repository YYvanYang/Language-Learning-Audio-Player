/**
 * 流式音频加载器 - 用于高效处理大型音频文件
 * 
 * 通过流式加载和处理方式，减少内存使用并提高大型音频文件的加载性能
 */

/**
 * 流式加载器配置选项
 * @typedef {Object} StreamLoaderOptions
 * @property {number} chunkSize - 每个数据块的大小（字节）
 * @property {number} bufferSize - 预加载缓冲区大小（字节）
 * @property {boolean} cacheEnabled - 是否启用缓存
 * @property {Object} headers - 请求头
 * @property {string} responseType - 响应类型 ('arraybuffer', 'blob', 等)
 * @property {Function} onProgress - 进度回调函数
 * @property {Function} onDecodeProgress - 解码进度回调函数
 * @property {Function} onError - 错误回调函数
 */

/**
 * 块状态枚举
 * @enum {string}
 */
export const ChunkStatus = {
  PENDING: 'pending',   // 尚未请求
  LOADING: 'loading',   // 正在加载
  LOADED: 'loaded',     // 已加载，尚未解码
  DECODING: 'decoding', // 正在解码
  DECODED: 'decoded',   // 已解码
  FAILED: 'failed'      // 加载或解码失败
};

/**
 * 默认加载器选项
 */
const DEFAULT_OPTIONS = {
  chunkSize: 2 * 1024 * 1024, // 2MB块大小
  bufferSize: 4 * 1024 * 1024, // 4MB预加载缓冲区
  cacheEnabled: true,
  headers: {},
  responseType: 'arraybuffer',
  onProgress: null,
  onDecodeProgress: null,
  onError: null
};

/**
 * 流式音频加载器类
 */
export class StreamLoader {
  /**
   * 创建新的流式加载器实例
   * @param {string} url - 要加载的音频文件URL
   * @param {AudioContext} audioContext - Web Audio API上下文
   * @param {StreamLoaderOptions} options - 加载选项
   */
  constructor(url, audioContext, options = {}) {
    this.url = url;
    this.audioContext = audioContext;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    
    // 数据块信息
    this.chunks = [];
    this.chunkMap = new Map(); // 映射块索引到数据
    
    // 状态信息
    this.totalSize = 0;
    this.loadedSize = 0;
    this.decodedSize = 0;
    this.isInitialized = false;
    this.isLoading = false;
    this.isCancelled = false;
    this.error = null;
    
    // 创建缓存键
    this.cacheKey = `audio_stream_${this._hashString(url)}`;
    
    // 绑定方法
    this._handleProgress = this._handleProgress.bind(this);
    this._handleError = this._handleError.bind(this);
  }
  
  /**
   * 初始化加载器并获取文件元数据
   * @returns {Promise<Object>} 包含音频元数据的对象
   */
  async initialize() {
    if (this.isInitialized) {
      return {
        totalSize: this.totalSize,
        mimeType: this.mimeType,
        duration: this.duration
      };
    }
    
    try {
      // 发送HEAD请求以获取文件大小和类型
      const headResponse = await fetch(this.url, {
        method: 'HEAD',
        headers: this.options.headers
      });
      
      if (!headResponse.ok) {
        throw new Error(`HTTP错误 ${headResponse.status}: ${headResponse.statusText}`);
      }
      
      // 提取内容长度和类型
      this.totalSize = parseInt(headResponse.headers.get('content-length') || '0');
      this.mimeType = headResponse.headers.get('content-type') || '';
      
      // 如果无法获取大小，回退到整个文件请求
      if (!this.totalSize) {
        console.warn('无法确定文件大小，回退到整个文件加载方式');
        return this.loadFull();
      }
      
      // 计算分块信息
      this._calculateChunks();
      
      // 尝试加载文件时长信息（通过小段数据）
      await this._loadDurationInfo();
      
      this.isInitialized = true;
      
      return {
        totalSize: this.totalSize,
        mimeType: this.mimeType,
        duration: this.duration
      };
    } catch (error) {
      this._handleError(error);
      throw error;
    }
  }
  
  /**
   * 加载整个文件（用于回退）
   * @returns {Promise<Object>} 包含音频元数据的对象
   */
  async loadFull() {
    try {
      const response = await fetch(this.url, {
        headers: this.options.headers
      });
      
      if (!response.ok) {
        throw new Error(`HTTP错误 ${response.status}: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      this.totalSize = arrayBuffer.byteLength;
      this.mimeType = response.headers.get('content-type') || '';
      
      // 解码音频
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      this.duration = audioBuffer.duration;
      this.loadedSize = this.totalSize;
      this.decodedSize = this.totalSize;
      this.isInitialized = true;
      
      // 创建单个块
      this.chunks = [{
        start: 0,
        end: this.totalSize - 1,
        size: this.totalSize,
        status: ChunkStatus.DECODED,
        data: audioBuffer
      }];
      
      // 更新块映射
      this.chunkMap.set(0, this.chunks[0]);
      
      // 触发进度回调
      if (this.options.onProgress) {
        this.options.onProgress(this.totalSize, this.totalSize, 1);
      }
      
      if (this.options.onDecodeProgress) {
        this.options.onDecodeProgress(this.totalSize, this.totalSize, 1);
      }
      
      return {
        totalSize: this.totalSize,
        mimeType: this.mimeType,
        duration: this.duration,
        audioBuffer
      };
    } catch (error) {
      this._handleError(error);
      throw error;
    }
  }
  
  /**
   * 启动流式加载过程
   * @param {number} startTime - 开始位置（秒）
   * @returns {Promise<void>}
   */
  async startLoading(startTime = 0) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (this.isLoading) return;
    this.isLoading = true;
    this.isCancelled = false;
    
    try {
      // 确定开始位置对应的数据块
      const startChunkIndex = this._timeToChunkIndex(startTime);
      
      // 加载初始块和预取缓冲区
      await this._loadChunkRange(startChunkIndex, this._calculateBufferChunks(startChunkIndex));
      
      // 如果还没有取消加载，继续加载更多块
      if (!this.isCancelled) {
        this._continuousLoad(startChunkIndex + 1);
      }
    } catch (error) {
      this._handleError(error);
    }
  }
  
  /**
   * 取消加载过程
   */
  cancelLoading() {
    this.isCancelled = true;
    this.isLoading = false;
  }
  
  /**
   * 获取指定时间位置的音频数据
   * @param {number} time - 时间位置（秒）
   * @returns {Promise<AudioBuffer>} 包含请求时间的音频缓冲区
   */
  async getAudioBufferAtTime(time) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // 找到对应的数据块
    const chunkIndex = this._timeToChunkIndex(time);
    if (chunkIndex >= this.chunks.length) {
      throw new Error('请求的时间位置超出音频范围');
    }
    
    // 如果块尚未加载，则加载它
    const chunk = this.chunks[chunkIndex];
    if (chunk.status === ChunkStatus.PENDING || chunk.status === ChunkStatus.FAILED) {
      await this._loadChunk(chunkIndex);
    }
    
    // 等待块解码完成
    if (chunk.status === ChunkStatus.LOADED) {
      await this._decodeChunk(chunkIndex);
    }
    
    // 返回解码后的音频缓冲区
    return chunk.data;
  }
  
  /**
   * 获取完整音频缓冲区（如果已完全加载）
   * @returns {AudioBuffer|null} 完整音频缓冲区或null
   */
  getFullAudioBuffer() {
    // 检查是否所有块都已解码
    const allDecoded = this.chunks.every(chunk => chunk.status === ChunkStatus.DECODED);
    if (!allDecoded) return null;
    
    // 如果只有一个块，直接返回
    if (this.chunks.length === 1) {
      return this.chunks[0].data;
    }
    
    // 合并所有数据块为一个完整的AudioBuffer
    const totalBuffer = this._mergeAudioBuffers(
      this.chunks.map(chunk => chunk.data)
    );
    
    return totalBuffer;
  }
  
  /**
   * 获取当前加载状态
   * @returns {Object} 加载状态对象
   */
  getStatus() {
    return {
      totalSize: this.totalSize,
      loadedSize: this.loadedSize,
      decodedSize: this.decodedSize,
      progress: this.totalSize ? this.loadedSize / this.totalSize : 0,
      decodeProgress: this.totalSize ? this.decodedSize / this.totalSize : 0,
      isInitialized: this.isInitialized,
      isLoading: this.isLoading,
      isCancelled: this.isCancelled,
      error: this.error,
      mimeType: this.mimeType,
      duration: this.duration
    };
  }
  
  /**
   * 计算音频文件的分块信息
   * @private
   */
  _calculateChunks() {
    if (!this.totalSize) return;
    
    this.chunks = [];
    const chunkSize = this.options.chunkSize;
    
    for (let start = 0; start < this.totalSize; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, this.totalSize - 1);
      const size = end - start + 1;
      
      const chunk = {
        start,
        end,
        size,
        status: ChunkStatus.PENDING,
        data: null
      };
      
      this.chunks.push(chunk);
      this.chunkMap.set(this.chunks.length - 1, chunk);
    }
  }
  
  /**
   * 加载音频文件时长信息
   * @private
   * @returns {Promise<void>}
   */
  async _loadDurationInfo() {
    try {
      // 加载文件头部以获取时长信息
      const headerSize = Math.min(64 * 1024, this.totalSize); // 64KB或文件大小
      
      const response = await fetch(this.url, {
        headers: {
          ...this.options.headers,
          Range: `bytes=0-${headerSize - 1}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP错误 ${response.status}: ${response.statusText}`);
      }
      
      const headerData = await response.arrayBuffer();
      
      // 尝试通过解码器获取持续时间
      try {
        const tempBuffer = await this.audioContext.decodeAudioData(headerData.slice(0));
        this.duration = tempBuffer.duration;
      } catch (error) {
        // 如果无法解码，尝试估计时长（基于类型和比特率）
        console.warn('无法从头部解码获取持续时间:', error);
        
        // 根据文件类型估计持续时间
        if (this.mimeType.includes('mp3')) {
          // 假设MP3 128kbps
          this.duration = this.totalSize / (128 * 1024 / 8);
        } else if (this.mimeType.includes('wav')) {
          // 假设WAV 44.1kHz, 16bit立体声
          this.duration = this.totalSize / (44100 * 2 * 2);
        } else {
          // 未知类型，使用通用估计
          this.duration = this.totalSize / (128 * 1024 / 8);
        }
        
        console.warn('估计的音频时长:', this.duration, '秒');
      }
    } catch (error) {
      console.error('加载时长信息失败:', error);
      // 使用默认估计
      this.duration = this.totalSize / (128 * 1024 / 8); // 假设128kbps
    }
  }
  
  /**
   * 将时间位置转换为数据块索引
   * @private
   * @param {number} time - 时间位置（秒）
   * @returns {number} 数据块索引
   */
  _timeToChunkIndex(time) {
    if (!this.duration || !this.totalSize) return 0;
    
    // 将时间转换为字节位置
    const bytePos = Math.floor((time / this.duration) * this.totalSize);
    
    // 查找对应的数据块
    return Math.floor(bytePos / this.options.chunkSize);
  }
  
  /**
   * 计算需要预加载的缓冲区块数
   * @private
   * @param {number} startChunkIndex - 起始块索引
   * @returns {number} 需要预加载的块数
   */
  _calculateBufferChunks(startChunkIndex) {
    const bufferSizeInChunks = Math.ceil(this.options.bufferSize / this.options.chunkSize);
    return Math.min(bufferSizeInChunks, this.chunks.length - startChunkIndex);
  }
  
  /**
   * 加载指定范围的数据块
   * @private
   * @param {number} startIndex - 起始块索引
   * @param {number} count - 块数量
   * @returns {Promise<void>}
   */
  async _loadChunkRange(startIndex, count) {
    const promises = [];
    
    for (let i = 0; i < count; i++) {
      const chunkIndex = startIndex + i;
      if (chunkIndex < this.chunks.length) {
        promises.push(this._loadChunk(chunkIndex));
      }
    }
    
    await Promise.all(promises);
  }
  
  /**
   * 加载单个数据块
   * @private
   * @param {number} index - 块索引
   * @returns {Promise<ArrayBuffer>} 加载的数据
   */
  async _loadChunk(index) {
    const chunk = this.chunks[index];
    
    // 如果块已在加载中或已加载，直接返回
    if (chunk.status !== ChunkStatus.PENDING && chunk.status !== ChunkStatus.FAILED) {
      return chunk.data;
    }
    
    // 标记为加载中
    chunk.status = ChunkStatus.LOADING;
    
    // 检查缓存
    if (this.options.cacheEnabled) {
      const cachedData = await this._getFromCache(`${this.cacheKey}_chunk_${index}`);
      if (cachedData) {
        chunk.data = cachedData;
        chunk.status = ChunkStatus.LOADED;
        this.loadedSize += chunk.size;
        this._handleProgress(this.loadedSize, this.totalSize);
        return cachedData;
      }
    }
    
    try {
      // 发起范围请求
      const response = await fetch(this.url, {
        headers: {
          ...this.options.headers,
          Range: `bytes=${chunk.start}-${chunk.end}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP错误 ${response.status}: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      // 更新块信息
      chunk.data = arrayBuffer;
      chunk.status = ChunkStatus.LOADED;
      this.loadedSize += chunk.size;
      
      // 通知进度
      this._handleProgress(this.loadedSize, this.totalSize);
      
      // 保存到缓存（如果启用）
      if (this.options.cacheEnabled) {
        this._saveToCache(`${this.cacheKey}_chunk_${index}`, arrayBuffer);
      }
      
      // 自动开始解码过程
      this._decodeChunk(index);
      
      return arrayBuffer;
    } catch (error) {
      chunk.status = ChunkStatus.FAILED;
      this._handleError(error);
      throw error;
    }
  }
  
  /**
   * 解码音频数据块
   * @private
   * @param {number} index - 块索引
   * @returns {Promise<AudioBuffer>} 解码后的音频缓冲区
   */
  async _decodeChunk(index) {
    const chunk = this.chunks[index];
    
    // 如果块未加载或已解码，直接返回
    if (chunk.status !== ChunkStatus.LOADED) {
      if (chunk.status === ChunkStatus.DECODED) {
        return chunk.data;
      }
      return null;
    }
    
    // 标记为解码中
    chunk.status = ChunkStatus.DECODING;
    
    try {
      // 解码音频数据
      const audioBuffer = await this.audioContext.decodeAudioData(chunk.data.slice(0));
      
      // 更新块信息
      chunk.data = audioBuffer;
      chunk.status = ChunkStatus.DECODED;
      this.decodedSize += chunk.size;
      
      // 通知解码进度
      if (this.options.onDecodeProgress) {
        this.options.onDecodeProgress(this.decodedSize, this.totalSize, this.decodedSize / this.totalSize);
      }
      
      return audioBuffer;
    } catch (error) {
      chunk.status = ChunkStatus.FAILED;
      this._handleError(error);
      throw error;
    }
  }
  
  /**
   * 连续加载剩余块
   * @private
   * @param {number} startIndex - 起始块索引
   */
  async _continuousLoad(startIndex) {
    for (let i = startIndex; i < this.chunks.length; i++) {
      if (this.isCancelled) break;
      
      await this._loadChunk(i);
      
      // 允许浏览器喘息
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
  
  /**
   * 合并多个音频缓冲区
   * @private
   * @param {AudioBuffer[]} buffers - 要合并的缓冲区数组
   * @returns {AudioBuffer} 合并后的音频缓冲区
   */
  _mergeAudioBuffers(buffers) {
    if (!buffers.length) return null;
    if (buffers.length === 1) return buffers[0];
    
    // 计算总采样数
    let totalLength = 0;
    for (const buffer of buffers) {
      totalLength += buffer.length;
    }
    
    // 创建新的音频缓冲区
    const result = this.audioContext.createBuffer(
      buffers[0].numberOfChannels,
      totalLength,
      buffers[0].sampleRate
    );
    
    // 复制每个通道的数据
    for (let channel = 0; channel < result.numberOfChannels; channel++) {
      const channelData = result.getChannelData(channel);
      let offset = 0;
      
      for (const buffer of buffers) {
        channelData.set(buffer.getChannelData(channel), offset);
        offset += buffer.length;
      }
    }
    
    return result;
  }
  
  /**
   * 处理加载进度
   * @private
   * @param {number} loaded - 已加载字节数
   * @param {number} total - 总字节数
   */
  _handleProgress(loaded, total) {
    if (this.options.onProgress) {
      const progress = total ? loaded / total : 0;
      this.options.onProgress(loaded, total, progress);
    }
  }
  
  /**
   * 处理错误
   * @private
   * @param {Error} error - 错误对象
   */
  _handleError(error) {
    this.error = error;
    console.error('音频流加载错误:', error);
    
    if (this.options.onError) {
      this.options.onError(error);
    }
  }
  
  /**
   * 从缓存获取数据
   * @private
   * @param {string} key - 缓存键
   * @returns {Promise<ArrayBuffer|null>} 缓存的数据或null
   */
  async _getFromCache(key) {
    if (!window.caches) return null;
    
    try {
      const cache = await caches.open('audio-stream-cache');
      const response = await cache.match(new Request(`https://cache/${key}`));
      
      if (response) {
        return await response.arrayBuffer();
      }
      
      return null;
    } catch (error) {
      console.warn('从缓存读取失败:', error);
      return null;
    }
  }
  
  /**
   * 保存数据到缓存
   * @private
   * @param {string} key - 缓存键
   * @param {ArrayBuffer} data - 要缓存的数据
   */
  async _saveToCache(key, data) {
    if (!window.caches) return;
    
    try {
      const cache = await caches.open('audio-stream-cache');
      const response = new Response(data.slice(0));
      await cache.put(new Request(`https://cache/${key}`), response);
    } catch (error) {
      console.warn('保存到缓存失败:', error);
    }
  }
  
  /**
   * 生成字符串的简单哈希
   * @private
   * @param {string} str - 输入字符串
   * @returns {string} 哈希字符串
   */
  _hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(16);
  }
} 