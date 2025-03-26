/**
 * 间隔重复控制器
 * 基于SM-2算法实现记忆最优化
 */

// 间隔重复难度级别
export const DIFFICULTY_LEVEL = {
  VERY_HARD: 0, // 完全不记得 
  HARD: 1,      // 记得但很困难
  MEDIUM: 2,    // 记得但有显著困难
  EASY: 3,      // 记得但有些困难
  VERY_EASY: 4, // 完美回忆，没有困难
  KNOWN: 5      // 长期记忆，不需要复习
};

// 默认配置
const DEFAULT_CONFIG = {
  // 初始间隔（天）
  initialInterval: 1,
  
  // 最长间隔（天）
  maxInterval: 365,
  
  // 简单系数
  easyBonus: 1.3,
  
  // 困难惩罚
  hardPenalty: 0.8,
  
  // 新项目初始难度
  initialEaseFactor: 2.5,
};

/**
 * 间隔重复项目
 */
export class SpacedRepetitionItem {
  /**
   * 创建一个间隔重复项目
   * @param {Object} data - 项目数据
   */
  constructor(data = {}) {
    // 基本信息
    this.id = data.id || generateId();
    this.content = data.content || '';
    this.note = data.note || '';
    this.tags = data.tags || [];
    this.type = data.type || 'vocabulary';
    
    // SM-2算法相关参数
    this.interval = data.interval || 0; // 当前间隔天数
    this.easeFactor = data.easeFactor || DEFAULT_CONFIG.initialEaseFactor; // 简易度因子
    this.repetitions = data.repetitions || 0; // 复习次数
    
    // 学习状态和时间
    this.lastReviewDate = data.lastReviewDate ? new Date(data.lastReviewDate) : null;
    this.nextReviewDate = data.nextReviewDate ? new Date(data.nextReviewDate) : new Date();
    this.dueDate = data.dueDate ? new Date(data.dueDate) : new Date();
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.status = data.status || 'new'; // new, learning, review, graduated
    
    // 复习历史
    this.reviewHistory = data.reviewHistory || [];
  }
  
  /**
   * 获取到期天数
   * @returns {number} 到期天数，负数表示已过期
   */
  getDueDays() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dueDate = new Date(this.nextReviewDate);
    dueDate.setHours(0, 0, 0, 0);
    
    const diffTime = dueDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  
  /**
   * 检查是否到期
   * @returns {boolean} 是否到期
   */
  isDue() {
    return this.getDueDays() <= 0;
  }
  
  /**
   * 记录回答
   * @param {number} difficulty - 难度级别
   * @param {Object} config - 配置项
   */
  recordAnswer(difficulty, config = DEFAULT_CONFIG) {
    // 合并配置
    const cfg = { ...DEFAULT_CONFIG, ...config };
    
    // 记录复习历史
    this.reviewHistory.push({
      date: new Date(),
      difficulty,
      interval: this.interval,
      easeFactor: this.easeFactor
    });
    
    // 增加复习次数
    this.repetitions++;
    
    // 更新上次复习日期
    this.lastReviewDate = new Date();
    
    // 处理不同情况
    if (difficulty < DIFFICULTY_LEVEL.MEDIUM) {
      // 困难或很困难 - 重置学习进度
      this.handleDifficultAnswer(difficulty, cfg);
    } else {
      // 中等或以上 - 应用SM-2算法
      this.applySM2Algorithm(difficulty, cfg);
    }
    
    // 更新状态
    this.updateStatus();
    
    return this;
  }
  
  /**
   * 处理困难的回答
   * @private
   * @param {number} difficulty - 难度级别
   * @param {Object} config - 配置项
   */
  handleDifficultAnswer(difficulty, config) {
    // 对于困难或很困难的项目，缩短下次复习间隔
    
    if (difficulty === DIFFICULTY_LEVEL.VERY_HARD) {
      // 完全不记得 - 重新开始学习
      this.interval = 0;
      this.repetitions = 0; // 重置复习次数
    } else if (difficulty === DIFFICULTY_LEVEL.HARD) {
      // 记得但很困难 - 缩短间隔
      this.interval = Math.max(1, Math.floor(this.interval * config.hardPenalty));
    }
    
    // 降低简易度因子，但不低于1.3
    this.easeFactor = Math.max(1.3, this.easeFactor - 0.2);
    
    // 设置下次复习日期（今天）
    this.nextReviewDate = new Date();
  }
  
  /**
   * 应用SM-2算法
   * @private
   * @param {number} difficulty - 难度级别
   * @param {Object} config - 配置项
   */
  applySM2Algorithm(difficulty, config) {
    // SM-2算法实现
    // 参考: https://www.supermemo.com/en/archives1990-2015/english/ol/sm2
    
    if (this.repetitions === 1) {
      // 第一次正确回答
      this.interval = 1;
    } else if (this.repetitions === 2) {
      // 第二次正确回答
      this.interval = 6;
    } else {
      // 随后的正确回答
      this.interval = Math.round(this.interval * this.easeFactor);
    }
    
    // 应用简单奖励
    if (difficulty === DIFFICULTY_LEVEL.VERY_EASY) {
      this.interval = Math.round(this.interval * config.easyBonus);
    }
    
    // 限制最大间隔
    this.interval = Math.min(this.interval, config.maxInterval);
    
    // 调整简易度因子
    this.easeFactor = this.easeFactor + (0.1 - (5 - difficulty) * (0.08 + (5 - difficulty) * 0.02));
    
    // 简易度因子不应低于1.3
    this.easeFactor = Math.max(1.3, this.easeFactor);
    
    // 计算下次复习日期
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + this.interval);
    this.nextReviewDate = nextDate;
    
    // 设置到期日期
    this.dueDate = new Date(this.nextReviewDate);
  }
  
  /**
   * 更新学习状态
   * @private
   */
  updateStatus() {
    if (this.repetitions === 0) {
      this.status = 'new';
    } else if (this.interval < 21) {
      this.status = 'learning';
    } else if (this.interval >= 21) {
      this.status = 'graduated';
    }
    
    // 如果用户指示已知，则直接标记为毕业
    if (this.reviewHistory.length > 0) {
      const lastReview = this.reviewHistory[this.reviewHistory.length - 1];
      if (lastReview.difficulty === DIFFICULTY_LEVEL.KNOWN) {
        this.status = 'graduated';
      }
    }
  }
  
  /**
   * 将项目转换为普通对象
   * @returns {Object} 普通对象表示
   */
  toJSON() {
    return {
      id: this.id,
      content: this.content,
      note: this.note,
      tags: this.tags,
      type: this.type,
      interval: this.interval,
      easeFactor: this.easeFactor,
      repetitions: this.repetitions,
      lastReviewDate: this.lastReviewDate,
      nextReviewDate: this.nextReviewDate,
      dueDate: this.dueDate,
      createdAt: this.createdAt,
      status: this.status,
      reviewHistory: this.reviewHistory
    };
  }
}

/**
 * 间隔重复控制器类
 */
export class SpacedRepetitionController {
  /**
   * 创建间隔重复控制器
   * @param {Object} options - 配置选项
   */
  constructor(options = {}) {
    // 合并配置
    this.config = { ...DEFAULT_CONFIG, ...options.config };
    
    // 学习项列表
    this.items = [];
    
    // 加载项目
    if (options.items && Array.isArray(options.items)) {
      this.items = options.items.map(itemData => 
        itemData instanceof SpacedRepetitionItem 
          ? itemData 
          : new SpacedRepetitionItem(itemData)
      );
    }
    
    // 存储回调
    this.onItemUpdated = options.onItemUpdated || (() => {});
    this.onStateChanged = options.onStateChanged || (() => {});
  }
  
  /**
   * 添加学习项
   * @param {Object|SpacedRepetitionItem} item - 学习项或学习项数据
   * @returns {SpacedRepetitionItem} 添加的学习项
   */
  addItem(item) {
    const newItem = item instanceof SpacedRepetitionItem 
      ? item 
      : new SpacedRepetitionItem(item);
    
    this.items.push(newItem);
    
    // 触发状态变更回调
    this.onStateChanged({
      type: 'item_added',
      item: newItem
    });
    
    return newItem;
  }
  
  /**
   * 删除学习项
   * @param {string} id - 学习项ID
   * @returns {boolean} 是否成功删除
   */
  removeItem(id) {
    const initialLength = this.items.length;
    this.items = this.items.filter(item => item.id !== id);
    
    const removed = initialLength > this.items.length;
    
    if (removed) {
      // 触发状态变更回调
      this.onStateChanged({
        type: 'item_removed',
        itemId: id
      });
    }
    
    return removed;
  }
  
  /**
   * 获取学习项
   * @param {string} id - 学习项ID
   * @returns {SpacedRepetitionItem|null} 学习项或null
   */
  getItem(id) {
    return this.items.find(item => item.id === id) || null;
  }
  
  /**
   * 获取所有学习项
   * @returns {Array<SpacedRepetitionItem>} 学习项数组
   */
  getAllItems() {
    return [...this.items];
  }
  
  /**
   * 获取到期的学习项
   * @returns {Array<SpacedRepetitionItem>} 到期的学习项数组
   */
  getDueItems() {
    return this.items.filter(item => item.isDue());
  }
  
  /**
   * 记录回答
   * @param {string} id - 学习项ID
   * @param {number} difficulty - 难度级别
   * @returns {SpacedRepetitionItem|null} 更新后的学习项或null
   */
  recordAnswer(id, difficulty) {
    const item = this.getItem(id);
    if (!item) return null;
    
    item.recordAnswer(difficulty, this.config);
    
    // 触发项目更新回调
    this.onItemUpdated(item);
    
    // 触发状态变更回调
    this.onStateChanged({
      type: 'item_updated',
      item: item
    });
    
    return item;
  }
  
  /**
   * 获取今日要复习的项目
   * @returns {Array<SpacedRepetitionItem>} 今天需要复习的项目
   */
  getTodayReviewItems() {
    return this.items.filter(item => {
      const dueDays = item.getDueDays();
      return dueDays <= 0;
    });
  }
  
  /**
   * 获取未来几天要复习的项目
   * @param {number} days - 未来天数
   * @returns {Object} 按日期分组的待复习项目
   */
  getUpcomingReviews(days = 7) {
    const result = {};
    
    // 初始化日期分组
    for (let i = 0; i <= days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dateString = date.toISOString().split('T')[0];
      result[dateString] = [];
    }
    
    // 按日期分组项目
    this.items.forEach(item => {
      const dueDays = item.getDueDays();
      if (dueDays >= 0 && dueDays <= days) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + dueDays);
        const dateString = dueDate.toISOString().split('T')[0];
        
        if (result[dateString]) {
          result[dateString].push(item);
        }
      }
    });
    
    return result;
  }
  
  /**
   * 获取学习统计
   * @returns {Object} 学习统计信息
   */
  getStatistics() {
    const stats = {
      total: this.items.length,
      new: 0,
      learning: 0,
      graduated: 0,
      dueToday: 0,
      dueTomorrow: 0,
      reviewsLastWeek: 0,
      averageEaseFactor: 0,
      successRate: 0
    };
    
    // 如果没有项目，直接返回
    if (this.items.length === 0) {
      return stats;
    }
    
    // 统计各状态项目数
    this.items.forEach(item => {
      // 计数各状态
      if (item.status === 'new') stats.new++;
      else if (item.status === 'learning') stats.learning++;
      else if (item.status === 'graduated') stats.graduated++;
      
      // 计数今明到期项目
      const dueDays = item.getDueDays();
      if (dueDays <= 0) stats.dueToday++;
      else if (dueDays === 1) stats.dueTomorrow++;
      
      // 累计简易度因子
      stats.averageEaseFactor += item.easeFactor;
    });
    
    // 计算平均简易度因子
    stats.averageEaseFactor = stats.averageEaseFactor / this.items.length;
    
    // 计算上周复习次数
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    let totalAnswers = 0;
    let correctAnswers = 0;
    
    this.items.forEach(item => {
      item.reviewHistory.forEach(review => {
        const reviewDate = new Date(review.date);
        
        // 统计上周复习
        if (reviewDate >= oneWeekAgo) {
          stats.reviewsLastWeek++;
        }
        
        // 统计成功率
        totalAnswers++;
        if (review.difficulty >= DIFFICULTY_LEVEL.MEDIUM) {
          correctAnswers++;
        }
      });
    });
    
    // 计算成功率
    if (totalAnswers > 0) {
      stats.successRate = (correctAnswers / totalAnswers) * 100;
    }
    
    return stats;
  }
  
  /**
   * 序列化控制器状态
   * @returns {Object} 序列化的状态
   */
  serialize() {
    return {
      config: this.config,
      items: this.items.map(item => item.toJSON())
    };
  }
  
  /**
   * 反序列化控制器状态
   * @param {Object} data - 序列化的状态
   * @returns {SpacedRepetitionController} 控制器实例
   */
  static deserialize(data) {
    return new SpacedRepetitionController({
      config: data.config,
      items: data.items
    });
  }
}

/**
 * 生成唯一ID
 * @returns {string} 唯一ID
 */
function generateId() {
  return 'id_' + Math.random().toString(36).substr(2, 9);
}

/**
 * 保存控制器到本地存储
 * @param {SpacedRepetitionController} controller - 间隔重复控制器
 * @param {string} key - 存储键名
 */
export function saveToLocalStorage(controller, key = 'spaced_repetition_data') {
  try {
    const data = controller.serialize();
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('保存间隔重复数据失败:', error);
    return false;
  }
}

/**
 * 从本地存储加载控制器
 * @param {string} key - 存储键名
 * @param {Object} options - 额外选项
 * @returns {SpacedRepetitionController} 控制器实例
 */
export function loadFromLocalStorage(key = 'spaced_repetition_data', options = {}) {
  try {
    const dataStr = localStorage.getItem(key);
    if (!dataStr) {
      return new SpacedRepetitionController(options);
    }
    
    const data = JSON.parse(dataStr);
    const controller = SpacedRepetitionController.deserialize(data);
    
    // 添加回调函数
    if (options.onItemUpdated) {
      controller.onItemUpdated = options.onItemUpdated;
    }
    
    if (options.onStateChanged) {
      controller.onStateChanged = options.onStateChanged;
    }
    
    return controller;
  } catch (error) {
    console.error('加载间隔重复数据失败:', error);
    return new SpacedRepetitionController(options);
  }
} 