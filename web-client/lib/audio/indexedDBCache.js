/**
 * IndexedDB音频缓存管理器
 * 用于高效缓存音频数据，提高应用性能和离线支持
 */

// 数据库配置
const DB_NAME = 'AudioPlayerCache';
const DB_VERSION = 1;
const AUDIO_STORE = 'audioData';
const METADATA_STORE = 'metadata';
const CHUNK_STORE = 'chunks';

// 缓存配置
const DEFAULT_MAX_CACHE_SIZE = 500 * 1024 * 1024; // 500MB
const DEFAULT_CHUNK_SIZE = 1024 * 1024; // 1MB
const DEFAULT_EXPIRATION = 7 * 24 * 60 * 60 * 1000; // 7天

// 创建数据库连接
async function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = (event) => {
      console.error('打开缓存数据库失败:', event.target.error);
      reject(event.target.error);
    };
    
    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // 创建音频数据存储
      if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        const audioStore = db.createObjectStore(AUDIO_STORE, { keyPath: 'id' });
        audioStore.createIndex('timestamp', 'timestamp', { unique: false });
        audioStore.createIndex('size', 'size', { unique: false });
      }
      
      // 创建元数据存储
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        const metadataStore = db.createObjectStore(METADATA_STORE, { keyPath: 'id' });
        metadataStore.createIndex('timestamp', 'timestamp', { unique: false });
        metadataStore.createIndex('trackId', 'trackId', { unique: false });
      }
      
      // 创建分块存储（用于大文件）
      if (!db.objectStoreNames.contains(CHUNK_STORE)) {
        const chunkStore = db.createObjectStore(CHUNK_STORE, { keyPath: 'id' });
        chunkStore.createIndex('audioId', 'audioId', { unique: false });
        chunkStore.createIndex('chunkIndex', 'chunkIndex', { unique: false });
        chunkStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

/**
 * 音频缓存管理器
 */
export class AudioCacheManager {
  constructor(options = {}) {
    this.maxCacheSize = options.maxCacheSize || DEFAULT_MAX_CACHE_SIZE;
    this.chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE;
    this.expiration = options.expiration || DEFAULT_EXPIRATION;
    this.db = null;
    this.isInitialized = false;
    this.initPromise = null;
    this.debugMode = options.debug || false;
  }
  
  /**
   * 初始化缓存管理器
   */
  async initialize() {
    if (this.isInitialized) return this.db;
    
    // 避免多次初始化
    if (!this.initPromise) {
      this.initPromise = new Promise(async (resolve, reject) => {
        try {
          // 检查浏览器支持
          if (!window.indexedDB) {
            throw new Error('浏览器不支持 IndexedDB');
          }
          
          // 打开数据库
          this.db = await openDatabase();
          this.isInitialized = true;
          this.log('缓存数据库初始化完成');
          
          // 启动后台缓存清理
          this.scheduleCleanup();
          
          resolve(this.db);
        } catch (error) {
          this.log('缓存初始化失败:', error);
          this.isInitialized = false;
          this.initPromise = null;
          reject(error);
        }
      });
    }
    
    return this.initPromise;
  }
  
  /**
   * 检查缓存中是否有指定的音频
   * @param {string} audioId - 音频ID
   * @returns {Promise<boolean>} 是否存在于缓存中
   */
  async hasAudio(audioId) {
    try {
      await this.initialize();
      
      return new Promise((resolve) => {
        const transaction = this.db.transaction([METADATA_STORE], 'readonly');
        const store = transaction.objectStore(METADATA_STORE);
        const request = store.get(audioId);
        
        request.onsuccess = (event) => {
          resolve(!!event.target.result);
        };
        
        request.onerror = () => {
          resolve(false);
        };
      });
    } catch (error) {
      this.log('检查缓存失败:', error);
      return false;
    }
  }
  
  /**
   * 从缓存中获取音频数据
   * @param {string} audioId - 音频ID
   * @returns {Promise<ArrayBuffer|null>} 音频数据或null（如果不存在）
   */
  async getAudio(audioId) {
    try {
      await this.initialize();
      
      // 检查元数据
      const metadata = await this.getMetadata(audioId);
      if (!metadata) return null;
      
      // 更新访问时间戳
      await this.updateTimestamp(audioId);
      
      // 对于小文件，直接从AUDIO_STORE获取
      if (!metadata.isChunked) {
        return new Promise((resolve) => {
          const transaction = this.db.transaction([AUDIO_STORE], 'readonly');
          const store = transaction.objectStore(AUDIO_STORE);
          const request = store.get(audioId);
          
          request.onsuccess = (event) => {
            const result = event.target.result;
            resolve(result ? result.data : null);
          };
          
          request.onerror = () => {
            resolve(null);
          };
        });
      }
      
      // 对于分块文件，需要重组
      return this.getChunkedAudio(audioId, metadata.chunks);
    } catch (error) {
      this.log('获取缓存音频失败:', error);
      return null;
    }
  }
  
  /**
   * 从缓存中获取分块音频数据
   * @private
   * @param {string} audioId - 音频ID
   * @param {number} chunks - 块数
   * @returns {Promise<ArrayBuffer|null>} 合并后的音频数据
   */
  async getChunkedAudio(audioId, chunks) {
    return new Promise(async (resolve) => {
      try {
        const transaction = this.db.transaction([CHUNK_STORE], 'readonly');
        const store = transaction.objectStore(CHUNK_STORE);
        const index = store.index('audioId');
        const request = index.getAll(audioId);
        
        request.onsuccess = (event) => {
          const chunkObjects = event.target.result;
          
          if (!chunkObjects || chunkObjects.length === 0) {
            resolve(null);
            return;
          }
          
          // 排序分块
          chunkObjects.sort((a, b) => a.chunkIndex - b.chunkIndex);
          
          // 验证分块完整性
          if (chunkObjects.length !== chunks) {
            this.log(`分块不完整: ${chunkObjects.length}/${chunks}`);
            resolve(null);
            return;
          }
          
          // 合并分块
          const totalSize = chunkObjects.reduce((size, chunk) => size + chunk.data.byteLength, 0);
          const result = new Uint8Array(totalSize);
          let offset = 0;
          
          for (const chunk of chunkObjects) {
            const chunkData = new Uint8Array(chunk.data);
            result.set(chunkData, offset);
            offset += chunk.data.byteLength;
          }
          
          resolve(result.buffer);
        };
        
        request.onerror = () => {
          resolve(null);
        };
      } catch (error) {
        this.log('获取分块音频失败:', error);
        resolve(null);
      }
    });
  }
  
  /**
   * 缓存音频数据
   * @param {string} audioId - 音频ID
   * @param {ArrayBuffer} data - 音频数据
   * @param {Object} metadata - 元数据
   * @returns {Promise<boolean>} 操作是否成功
   */
  async cacheAudio(audioId, data, metadata = {}) {
    try {
      await this.initialize();
      
      // 检查缓存大小
      await this.ensureCacheSpace(data.byteLength);
      
      // 准备元数据
      const metaObj = {
        id: audioId,
        timestamp: Date.now(),
        size: data.byteLength,
        trackId: metadata.trackId || null,
        duration: metadata.duration || 0,
        format: metadata.format || 'unknown',
        sampleRate: metadata.sampleRate || 44100,
        channels: metadata.channels || 2,
        ...metadata
      };
      
      // 对于大文件，使用分块存储
      if (data.byteLength > this.chunkSize) {
        metaObj.isChunked = true;
        metaObj.chunks = Math.ceil(data.byteLength / this.chunkSize);
        await this.cacheChunkedAudio(audioId, data, metaObj.chunks);
      } else {
        metaObj.isChunked = false;
        metaObj.chunks = 0;
        
        // 存储音频数据
        await this.storeData(AUDIO_STORE, {
          id: audioId,
          data: data,
          timestamp: Date.now(),
          size: data.byteLength
        });
      }
      
      // 存储元数据
      await this.storeData(METADATA_STORE, metaObj);
      
      this.log(`音频已缓存: ${audioId}, 大小: ${(data.byteLength / (1024 * 1024)).toFixed(2)}MB`);
      return true;
    } catch (error) {
      this.log('缓存音频失败:', error);
      return false;
    }
  }
  
  /**
   * 分块存储大型音频文件
   * @private
   * @param {string} audioId - 音频ID
   * @param {ArrayBuffer} data - 音频数据
   * @param {number} totalChunks - 总块数
   * @returns {Promise<boolean>} 操作是否成功
   */
  async cacheChunkedAudio(audioId, data, totalChunks) {
    try {
      const dataView = new Uint8Array(data);
      const timestamp = Date.now();
      
      // 分块存储
      for (let i = 0; i < totalChunks; i++) {
        const start = i * this.chunkSize;
        const end = Math.min(start + this.chunkSize, data.byteLength);
        const chunkData = dataView.slice(start, end);
        
        // 为每个块创建唯一ID
        const chunkId = `${audioId}_chunk_${i}`;
        
        // 存储块
        await this.storeData(CHUNK_STORE, {
          id: chunkId,
          audioId: audioId,
          chunkIndex: i,
          data: chunkData.buffer,
          timestamp: timestamp,
          size: chunkData.byteLength
        });
      }
      
      return true;
    } catch (error) {
      this.log('分块缓存失败:', error);
      
      // 清理已存储的块
      await this.removeChunks(audioId);
      
      return false;
    }
  }
  
  /**
   * 通用数据存储函数
   * @private
   * @param {string} storeName - 存储名称
   * @param {Object} data - 要存储的数据
   * @returns {Promise<boolean>} 操作是否成功
   */
  storeData(storeName, data) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);
      
      request.onsuccess = () => resolve(true);
      request.onerror = (event) => {
        this.log(`存储数据失败: ${storeName}`, event.target.error);
        reject(event.target.error);
      };
    });
  }
  
  /**
   * 获取音频元数据
   * @param {string} audioId - 音频ID
   * @returns {Promise<Object|null>} 元数据或null
   */
  async getMetadata(audioId) {
    try {
      await this.initialize();
      
      return new Promise((resolve) => {
        const transaction = this.db.transaction([METADATA_STORE], 'readonly');
        const store = transaction.objectStore(METADATA_STORE);
        const request = store.get(audioId);
        
        request.onsuccess = (event) => {
          resolve(event.target.result || null);
        };
        
        request.onerror = () => {
          resolve(null);
        };
      });
    } catch (error) {
      this.log('获取元数据失败:', error);
      return null;
    }
  }
  
  /**
   * 更新音频时间戳（用于LRU缓存策略）
   * @private
   * @param {string} audioId - 音频ID
   * @returns {Promise<boolean>} 操作是否成功
   */
  async updateTimestamp(audioId) {
    try {
      const metadata = await this.getMetadata(audioId);
      if (!metadata) return false;
      
      metadata.timestamp = Date.now();
      await this.storeData(METADATA_STORE, metadata);
      
      // 对于小文件，更新数据存储的时间戳
      if (!metadata.isChunked) {
        const transaction = this.db.transaction([AUDIO_STORE], 'readwrite');
        const store = transaction.objectStore(AUDIO_STORE);
        const request = store.get(audioId);
        
        request.onsuccess = (event) => {
          const data = event.target.result;
          if (data) {
            data.timestamp = Date.now();
            store.put(data);
          }
        };
      }
      
      return true;
    } catch (error) {
      this.log('更新时间戳失败:', error);
      return false;
    }
  }
  
  /**
   * 从缓存中移除音频
   * @param {string} audioId - 音频ID
   * @returns {Promise<boolean>} 操作是否成功
   */
  async removeAudio(audioId) {
    try {
      await this.initialize();
      
      // 获取元数据，检查是否分块
      const metadata = await this.getMetadata(audioId);
      
      // 如果是分块，删除所有块
      if (metadata && metadata.isChunked) {
        await this.removeChunks(audioId);
      } else {
        // 否则删除主数据
        const transaction = this.db.transaction([AUDIO_STORE], 'readwrite');
        const store = transaction.objectStore(AUDIO_STORE);
        store.delete(audioId);
      }
      
      // 删除元数据
      const metaTransaction = this.db.transaction([METADATA_STORE], 'readwrite');
      const metaStore = metaTransaction.objectStore(METADATA_STORE);
      metaStore.delete(audioId);
      
      this.log(`从缓存中移除: ${audioId}`);
      return true;
    } catch (error) {
      this.log('移除音频失败:', error);
      return false;
    }
  }
  
  /**
   * 删除分块数据
   * @private
   * @param {string} audioId - 音频ID
   * @returns {Promise<boolean>} 操作是否成功
   */
  async removeChunks(audioId) {
    return new Promise(async (resolve) => {
      try {
        const transaction = this.db.transaction([CHUNK_STORE], 'readwrite');
        const store = transaction.objectStore(CHUNK_STORE);
        const index = store.index('audioId');
        const request = index.openCursor(audioId);
        
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else {
            resolve(true);
          }
        };
        
        request.onerror = () => {
          this.log('删除分块失败');
          resolve(false);
        };
      } catch (error) {
        this.log('删除分块失败:', error);
        resolve(false);
      }
    });
  }
  
  /**
   * 清理过期和超额的缓存
   * @returns {Promise<boolean>} 操作是否成功
   */
  async cleanup() {
    try {
      await this.initialize();
      
      const now = Date.now();
      
      // 清理过期内容
      await this.cleanupExpired(now);
      
      // 检查并清理超额内容
      await this.cleanupOversize();
      
      return true;
    } catch (error) {
      this.log('缓存清理失败:', error);
      return false;
    }
  }
  
  /**
   * 清理过期缓存
   * @private
   * @param {number} now - 当前时间戳
   */
  async cleanupExpired(now) {
    const expirationTime = now - this.expiration;
    
    // 获取过期的元数据
    const expiredIds = await this.getExpiredIds(expirationTime);
    
    // 删除过期内容
    for (const id of expiredIds) {
      await this.removeAudio(id);
    }
    
    if (expiredIds.length > 0) {
      this.log(`已清理 ${expiredIds.length} 个过期缓存`);
    }
  }
  
  /**
   * 获取过期的音频ID
   * @private
   * @param {number} expirationTime - 过期时间戳
   * @returns {Promise<Array<string>>} 过期的音频ID列表
   */
  async getExpiredIds(expirationTime) {
    return new Promise((resolve) => {
      const expiredIds = [];
      const transaction = this.db.transaction([METADATA_STORE], 'readonly');
      const store = transaction.objectStore(METADATA_STORE);
      const index = store.index('timestamp');
      
      // 使用光标找到所有过期的元数据
      const request = index.openCursor();
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          if (cursor.value.timestamp < expirationTime) {
            expiredIds.push(cursor.value.id);
          }
          cursor.continue();
        } else {
          resolve(expiredIds);
        }
      };
      
      request.onerror = () => {
        resolve([]);
      };
    });
  }
  
  /**
   * 清理超额缓存（使用LRU策略）
   * @private
   */
  async cleanupOversize() {
    // 获取当前缓存大小
    const currentSize = await this.getCacheSize();
    
    // 检查是否超过最大缓存大小
    if (currentSize <= this.maxCacheSize) {
      return;
    }
    
    // 需要释放的空间
    const sizeToFree = currentSize - this.maxCacheSize + (10 * 1024 * 1024); // 多释放10MB空间作为缓冲
    
    // 获取所有元数据，按时间戳排序
    const allMetadata = await this.getAllMetadataSorted();
    
    // 从最早访问的开始删除，直到释放足够空间
    let freedSize = 0;
    for (const metadata of allMetadata) {
      // 如果已释放足够空间，停止
      if (freedSize >= sizeToFree) {
        break;
      }
      
      // 删除音频并累计释放的空间
      await this.removeAudio(metadata.id);
      freedSize += metadata.size;
    }
    
    this.log(`已清理 ${(freedSize / (1024 * 1024)).toFixed(2)}MB 超额缓存`);
  }
  
  /**
   * 获取当前缓存大小
   * @private
   * @returns {Promise<number>} 缓存大小（字节）
   */
  async getCacheSize() {
    // 获取所有元数据
    const allMetadata = await this.getAllMetadata();
    
    // 计算总大小
    return allMetadata.reduce((total, item) => total + item.size, 0);
  }
  
  /**
   * 获取所有元数据（按时间戳排序）
   * @private
   * @returns {Promise<Array<Object>>} 元数据数组
   */
  async getAllMetadataSorted() {
    const metadata = await this.getAllMetadata();
    
    // 按时间戳排序（最早的在前）
    return metadata.sort((a, b) => a.timestamp - b.timestamp);
  }
  
  /**
   * 获取所有元数据
   * @private
   * @returns {Promise<Array<Object>>} 元数据数组
   */
  async getAllMetadata() {
    return new Promise((resolve) => {
      const transaction = this.db.transaction([METADATA_STORE], 'readonly');
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.getAll();
      
      request.onsuccess = (event) => {
        resolve(event.target.result || []);
      };
      
      request.onerror = () => {
        resolve([]);
      };
    });
  }
  
  /**
   * 确保有足够的缓存空间
   * @private
   * @param {number} requiredSize - 需要的空间大小（字节）
   */
  async ensureCacheSpace(requiredSize) {
    const currentSize = await this.getCacheSize();
    const projectedSize = currentSize + requiredSize;
    
    // 如果加入新数据后超过最大缓存大小，清理旧数据
    if (projectedSize > this.maxCacheSize) {
      const sizeToFree = projectedSize - this.maxCacheSize + (5 * 1024 * 1024); // 多清理5MB作为缓冲
      
      // 清理最旧的数据
      const allMetadata = await this.getAllMetadataSorted();
      
      let freedSize = 0;
      for (const metadata of allMetadata) {
        if (freedSize >= sizeToFree) {
          break;
        }
        
        await this.removeAudio(metadata.id);
        freedSize += metadata.size;
      }
      
      this.log(`已清理 ${(freedSize / (1024 * 1024)).toFixed(2)}MB 空间用于新数据`);
    }
  }
  
  /**
   * 计划定期缓存清理
   * @private
   */
  scheduleCleanup() {
    // 每天运行一次清理
    const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24小时
    
    setTimeout(async () => {
      await this.cleanup();
      this.scheduleCleanup();
    }, CLEANUP_INTERVAL);
  }
  
  /**
   * 清空整个缓存
   * @returns {Promise<boolean>} 操作是否成功
   */
  async clearCache() {
    try {
      await this.initialize();
      
      const transaction = this.db.transaction([AUDIO_STORE, METADATA_STORE, CHUNK_STORE], 'readwrite');
      transaction.objectStore(AUDIO_STORE).clear();
      transaction.objectStore(METADATA_STORE).clear();
      transaction.objectStore(CHUNK_STORE).clear();
      
      this.log('缓存已完全清除');
      return true;
    } catch (error) {
      this.log('清除缓存失败:', error);
      return false;
    }
  }
  
  /**
   * 获取缓存统计信息
   * @returns {Promise<Object>} 缓存统计
   */
  async getStats() {
    try {
      await this.initialize();
      
      const metadata = await this.getAllMetadata();
      const totalSize = metadata.reduce((size, item) => size + item.size, 0);
      const chunkedCount = metadata.filter(item => item.isChunked).length;
      
      // 获取块计数
      let chunkCount = 0;
      await new Promise((resolve) => {
        const transaction = this.db.transaction([CHUNK_STORE], 'readonly');
        const store = transaction.objectStore(CHUNK_STORE);
        const countRequest = store.count();
        
        countRequest.onsuccess = () => {
          chunkCount = countRequest.result;
          resolve();
        };
        
        countRequest.onerror = () => resolve();
      });
      
      return {
        audioCount: metadata.length,
        totalSize,
        usedPercentage: (totalSize / this.maxCacheSize) * 100,
        chunkedAudioCount: chunkedCount,
        chunkCount,
        oldestItem: metadata.length > 0 
          ? new Date(Math.min(...metadata.map(item => item.timestamp))) 
          : null,
        newestItem: metadata.length > 0 
          ? new Date(Math.max(...metadata.map(item => item.timestamp))) 
          : null
      };
    } catch (error) {
      this.log('获取缓存统计失败:', error);
      return {
        audioCount: 0,
        totalSize: 0,
        usedPercentage: 0,
        chunkedAudioCount: 0,
        chunkCount: 0,
        oldestItem: null,
        newestItem: null
      };
    }
  }
  
  /**
   * 日志输出
   * @private
   */
  log(...args) {
    if (this.debugMode) {
      console.log('[AudioCache]', ...args);
    }
  }
}

// 缓存实例（单例模式）
let instance = null;

/**
 * 获取音频缓存管理器实例
 * @param {Object} options - 配置选项
 * @returns {AudioCacheManager} 缓存管理器实例
 */
export function getAudioCacheManager(options = {}) {
  if (!instance) {
    instance = new AudioCacheManager(options);
  }
  return instance;
}

/**
 * 生成唯一的音频缓存ID
 * @param {string} url - 音频URL或ID
 * @param {Object} options - 额外选项
 * @returns {string} 缓存ID
 */
export function generateCacheId(url, options = {}) {
  // 使用URL作为基础，添加附加信息以区分不同版本
  let baseId = url;
  
  // 添加选项中的标识符（如果有）
  if (options.version) {
    baseId += `-v${options.version}`;
  }
  
  if (options.quality) {
    baseId += `-q${options.quality}`;
  }
  
  if (options.trackId) {
    baseId += `-t${options.trackId}`;
  }
  
  // 计算简单哈希以缩短ID长度
  let hash = 0;
  for (let i = 0; i < baseId.length; i++) {
    const char = baseId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为32位整数
  }
  
  return `audio-${Math.abs(hash).toString(36)}`;
} 