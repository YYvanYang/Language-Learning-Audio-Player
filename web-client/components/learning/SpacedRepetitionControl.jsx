"use client";

import React, { useState, useEffect } from 'react';
import { 
  DIFFICULTY_LEVEL, 
  SpacedRepetitionItem, 
  SpacedRepetitionController,
  saveToLocalStorage,
  loadFromLocalStorage
} from '../../lib/learning/SpacedRepetitionController';

/**
 * 间隔重复学习控制组件
 * 
 * @param {Object} props - 组件属性
 * @param {string} props.storageKey - 本地存储键名
 * @param {Function} props.onStatusChange - 状态变更回调
 */
export default function SpacedRepetitionControl({ 
  storageKey = 'language_learning_spaced_repetition',
  onStatusChange = null
}) {
  // 状态
  const [controller, setController] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [activeView, setActiveView] = useState('summary'); // summary, review, new, browse
  const [dueItems, setDueItems] = useState([]);
  const [currentReviewItem, setCurrentReviewItem] = useState(null);
  const [newItemForm, setNewItemForm] = useState({
    content: '',
    note: '',
    tags: '',
    type: 'vocabulary'
  });
  const [editMode, setEditMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredItems, setFilteredItems] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [allTags, setAllTags] = useState([]);
  
  // 加载控制器和数据
  useEffect(() => {
    const srController = loadFromLocalStorage(storageKey, {
      onItemUpdated: (item) => {
        // 当项目更新时，更新统计和到期项目
        updateStatistics();
        updateDueItems();
      },
      onStateChanged: (event) => {
        // 当控制器状态变更时
        updateStatistics();
        updateDueItems();
        updateTagList();
        
        // 调用外部回调
        if (onStatusChange) {
          onStatusChange(event);
        }
        
        // 保存到本地存储
        saveToLocalStorage(controller, storageKey);
      }
    });
    
    setController(srController);
    
    // 初始化统计和到期项目
    if (srController) {
      updateStatistics(srController);
      updateDueItems(srController);
      updateTagList(srController);
    }
  }, [storageKey]);
  
  // 更新搜索结果
  useEffect(() => {
    if (!controller) return;
    
    const items = controller.getAllItems();
    let filtered = items;
    
    // 应用搜索词过滤
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.content.toLowerCase().includes(term) || 
        item.note.toLowerCase().includes(term)
      );
    }
    
    // 应用标签过滤
    if (selectedTags.length > 0) {
      filtered = filtered.filter(item => 
        selectedTags.every(tag => item.tags.includes(tag))
      );
    }
    
    setFilteredItems(filtered);
  }, [controller, searchTerm, selectedTags]);
  
  // 更新统计
  const updateStatistics = (ctrl = controller) => {
    if (!ctrl) return;
    setStatistics(ctrl.getStatistics());
  };
  
  // 更新到期项目
  const updateDueItems = (ctrl = controller) => {
    if (!ctrl) return;
    setDueItems(ctrl.getTodayReviewItems());
  };
  
  // 更新标签列表
  const updateTagList = (ctrl = controller) => {
    if (!ctrl) return;
    
    const items = ctrl.getAllItems();
    const tags = new Set();
    
    items.forEach(item => {
      if (item.tags && Array.isArray(item.tags)) {
        item.tags.forEach(tag => tags.add(tag));
      }
    });
    
    setAllTags(Array.from(tags));
  };
  
  // 开始复习
  const startReview = () => {
    if (!controller || dueItems.length === 0) return;
    
    setActiveView('review');
    setCurrentReviewItem(dueItems[0]);
  };
  
  // 记录回答并继续复习
  const recordAnswer = (difficulty) => {
    if (!controller || !currentReviewItem) return;
    
    // 记录回答
    controller.recordAnswer(currentReviewItem.id, difficulty);
    
    // 更新到期项目
    const updatedDueItems = controller.getTodayReviewItems();
    setDueItems(updatedDueItems);
    
    // 如果还有项目待复习，继续复习
    if (updatedDueItems.length > 0) {
      setCurrentReviewItem(updatedDueItems[0]);
    } else {
      // 复习完成，返回摘要
      setCurrentReviewItem(null);
      setActiveView('summary');
    }
    
    // 保存状态
    saveToLocalStorage(controller, storageKey);
  };
  
  // 添加新项目
  const addNewItem = () => {
    if (!controller) return;
    
    // 验证内容不为空
    if (!newItemForm.content.trim()) {
      alert('内容不能为空');
      return;
    }
    
    // 处理标签
    const tags = newItemForm.tags
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag);
    
    // 创建新项目
    const newItem = new SpacedRepetitionItem({
      content: newItemForm.content,
      note: newItemForm.note,
      tags,
      type: newItemForm.type,
      createdAt: new Date()
    });
    
    // 添加到控制器
    controller.addItem(newItem);
    
    // 清空表单
    setNewItemForm({
      content: '',
      note: '',
      tags: '',
      type: 'vocabulary'
    });
    
    // 更新状态
    updateStatistics();
    updateDueItems();
    updateTagList();
    
    // 保存到本地存储
    saveToLocalStorage(controller, storageKey);
    
    // 返回浏览视图
    setActiveView('browse');
  };
  
  // 编辑项目
  const startEditItem = (item) => {
    setNewItemForm({
      id: item.id,
      content: item.content,
      note: item.note,
      tags: item.tags.join(', '),
      type: item.type
    });
    
    setEditMode(true);
    setActiveView('new');
  };
  
  // 保存编辑的项目
  const saveEditedItem = () => {
    if (!controller || !newItemForm.id) return;
    
    const item = controller.getItem(newItemForm.id);
    if (!item) return;
    
    // 更新项目信息
    item.content = newItemForm.content;
    item.note = newItemForm.note;
    item.tags = newItemForm.tags
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag);
    item.type = newItemForm.type;
    
    // 触发状态更新
    controller.onStateChanged({
      type: 'item_updated',
      item
    });
    
    // 退出编辑模式
    setEditMode(false);
    setNewItemForm({
      content: '',
      note: '',
      tags: '',
      type: 'vocabulary'
    });
    
    // 保存到本地存储
    saveToLocalStorage(controller, storageKey);
    
    // 返回浏览视图
    setActiveView('browse');
  };
  
  // 删除项目
  const deleteItem = (id) => {
    if (!controller) return;
    
    // 确认删除
    if (!confirm('确定要删除此项目吗？')) {
      return;
    }
    
    // 删除项目
    controller.removeItem(id);
    
    // 更新状态
    updateStatistics();
    updateDueItems();
    updateTagList();
    
    // 保存到本地存储
    saveToLocalStorage(controller, storageKey);
  };
  
  // 切换标签选择
  const toggleTag = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };
  
  // 渲染摘要视图
  const renderSummaryView = () => {
    if (!statistics) return <div>加载中...</div>;
    
    return (
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-4">学习统计</h2>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-blue-50 p-3 rounded-md">
            <p className="text-sm text-gray-600">总计项目</p>
            <p className="text-2xl font-bold">{statistics.total}</p>
          </div>
          
          <div className="bg-green-50 p-3 rounded-md">
            <p className="text-sm text-gray-600">今日待复习</p>
            <p className="text-2xl font-bold">{statistics.dueToday}</p>
          </div>
          
          <div className="bg-yellow-50 p-3 rounded-md">
            <p className="text-sm text-gray-600">新项目</p>
            <p className="text-2xl font-bold">{statistics.new}</p>
          </div>
          
          <div className="bg-purple-50 p-3 rounded-md">
            <p className="text-sm text-gray-600">学习中</p>
            <p className="text-2xl font-bold">{statistics.learning}</p>
          </div>
        </div>
        
        <div className="mb-4">
          <p className="text-sm text-gray-700 mb-1">复习进度</p>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-blue-600 h-2.5 rounded-full" 
              style={{ width: `${Math.min(100, (statistics.dueToday / Math.max(1, statistics.total)) * 100)}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            已完成: {statistics.total - statistics.dueToday} / {statistics.total}
          </p>
        </div>
        
        <div className="mb-4">
          <p className="text-sm text-gray-700 mb-1">掌握情况</p>
          <div className="flex space-x-1 h-4">
            <div 
              className="bg-green-500 rounded-l-sm" 
              style={{ width: `${Math.min(100, (statistics.graduated / Math.max(1, statistics.total)) * 100)}%` }}
            ></div>
            <div 
              className="bg-yellow-500" 
              style={{ width: `${Math.min(100, (statistics.learning / Math.max(1, statistics.total)) * 100)}%` }}
            ></div>
            <div 
              className="bg-blue-500 rounded-r-sm" 
              style={{ width: `${Math.min(100, (statistics.new / Math.max(1, statistics.total)) * 100)}%` }}
            ></div>
          </div>
          <div className="flex text-xs text-gray-500 mt-1 justify-between">
            <span>已掌握: {statistics.graduated}</span>
            <span>学习中: {statistics.learning}</span>
            <span>新项目: {statistics.new}</span>
          </div>
        </div>
        
        {statistics.dueToday > 0 && (
          <button 
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md"
            onClick={startReview}
          >
            开始今日复习 ({statistics.dueToday}项)
          </button>
        )}
        
        {statistics.dueToday === 0 && statistics.total > 0 && (
          <div className="text-center p-3 bg-green-50 rounded-md">
            <p className="text-green-700">今日复习已完成！</p>
          </div>
        )}
        
        {statistics.total === 0 && (
          <div className="text-center p-3 bg-yellow-50 rounded-md">
            <p className="text-yellow-700 mb-2">还没有学习项目</p>
            <button 
              className="bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded-md text-sm"
              onClick={() => setActiveView('new')}
            >
              添加新项目
            </button>
          </div>
        )}
      </div>
    );
  };
  
  // 渲染复习视图
  const renderReviewView = () => {
    if (!currentReviewItem) {
      return (
        <div className="bg-white p-4 rounded-lg shadow-sm text-center">
          <p className="text-lg mb-3">没有需要复习的项目</p>
          <button 
            className="bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded-md"
            onClick={() => setActiveView('summary')}
          >
            返回摘要
          </button>
        </div>
      );
    }
    
    return (
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <div className="mb-2 flex justify-between items-center">
          <span className="text-xs text-gray-500">
            剩余: {dueItems.length}项
          </span>
          <span className="text-xs text-gray-500">
            {currentReviewItem.type}
          </span>
        </div>
        
        <div className="mb-6 mt-4 text-center">
          <p className="text-2xl font-medium mb-2">{currentReviewItem.content}</p>
          
          {currentReviewItem.note && (
            <p className="text-gray-600 mt-4 p-3 bg-gray-50 rounded-md">
              {currentReviewItem.note}
            </p>
          )}
          
          {currentReviewItem.tags && currentReviewItem.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3 justify-center">
              {currentReviewItem.tags.map(tag => (
                <span 
                  key={tag} 
                  className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        
        <p className="text-center text-sm text-gray-700 mb-2">评价你的记忆程度:</p>
        
        <div className="grid grid-cols-3 gap-2 mb-3">
          <button 
            className="bg-red-500 hover:bg-red-600 text-white py-2 px-3 rounded-md text-sm"
            onClick={() => recordAnswer(DIFFICULTY_LEVEL.VERY_HARD)}
          >
            完全不记得
          </button>
          <button 
            className="bg-yellow-500 hover:bg-yellow-600 text-white py-2 px-3 rounded-md text-sm"
            onClick={() => recordAnswer(DIFFICULTY_LEVEL.HARD)}
          >
            很困难
          </button>
          <button 
            className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-3 rounded-md text-sm"
            onClick={() => recordAnswer(DIFFICULTY_LEVEL.MEDIUM)}
          >
            有些困难
          </button>
        </div>
        
        <div className="grid grid-cols-3 gap-2">
          <button 
            className="bg-teal-500 hover:bg-teal-600 text-white py-2 px-3 rounded-md text-sm"
            onClick={() => recordAnswer(DIFFICULTY_LEVEL.EASY)}
          >
            记得
          </button>
          <button 
            className="bg-green-500 hover:bg-green-600 text-white py-2 px-3 rounded-md text-sm"
            onClick={() => recordAnswer(DIFFICULTY_LEVEL.VERY_EASY)}
          >
            很容易记得
          </button>
          <button 
            className="bg-purple-500 hover:bg-purple-600 text-white py-2 px-3 rounded-md text-sm"
            onClick={() => recordAnswer(DIFFICULTY_LEVEL.KNOWN)}
          >
            已掌握
          </button>
        </div>
      </div>
    );
  };
  
  // 渲染新项目视图
  const renderNewItemView = () => {
    return (
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-4">
          {editMode ? '编辑学习项目' : '添加新学习项目'}
        </h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">内容</label>
          <input 
            type="text"
            className="w-full px-3 py-2 border rounded-md"
            value={newItemForm.content}
            onChange={(e) => setNewItemForm({...newItemForm, content: e.target.value})}
            placeholder="词汇或短语"
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">笔记</label>
          <textarea 
            className="w-full px-3 py-2 border rounded-md"
            value={newItemForm.note}
            onChange={(e) => setNewItemForm({...newItemForm, note: e.target.value})}
            placeholder="解释、例句等"
            rows={4}
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">标签 (用逗号分隔)</label>
          <input 
            type="text"
            className="w-full px-3 py-2 border rounded-md"
            value={newItemForm.tags}
            onChange={(e) => setNewItemForm({...newItemForm, tags: e.target.value})}
            placeholder="例如: 名词, 动词, 日常用语"
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">类型</label>
          <select 
            className="w-full px-3 py-2 border rounded-md"
            value={newItemForm.type}
            onChange={(e) => setNewItemForm({...newItemForm, type: e.target.value})}
          >
            <option value="vocabulary">词汇</option>
            <option value="phrase">短语</option>
            <option value="grammar">语法</option>
            <option value="sentence">句子</option>
            <option value="pronunciation">发音</option>
          </select>
        </div>
        
        <div className="flex space-x-2">
          {editMode ? (
            <>
              <button 
                className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-md"
                onClick={saveEditedItem}
              >
                保存更改
              </button>
              <button 
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded-md"
                onClick={() => {
                  setEditMode(false);
                  setNewItemForm({
                    content: '',
                    note: '',
                    tags: '',
                    type: 'vocabulary'
                  });
                  setActiveView('browse');
                }}
              >
                取消
              </button>
            </>
          ) : (
            <>
              <button 
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md"
                onClick={addNewItem}
              >
                添加项目
              </button>
              <button 
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded-md"
                onClick={() => setActiveView('browse')}
              >
                取消
              </button>
            </>
          )}
        </div>
      </div>
    );
  };
  
  // 渲染浏览视图
  const renderBrowseView = () => {
    return (
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <div className="mb-4">
          <input 
            type="text"
            className="w-full px-3 py-2 border rounded-md"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜索内容或笔记..."
          />
        </div>
        
        {allTags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1">
            {allTags.map(tag => (
              <button
                key={tag}
                className={`text-xs px-2 py-1 rounded-md ${
                  selectedTags.includes(tag)
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
        
        <div className="mb-4 flex justify-between items-center">
          <p className="text-sm text-gray-600">
            找到 {filteredItems.length} 项结果
          </p>
          <button 
            className="bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded-md text-sm"
            onClick={() => setActiveView('new')}
          >
            添加新项目
          </button>
        </div>
        
        {filteredItems.length === 0 ? (
          <div className="text-center p-4 bg-gray-50 rounded-md">
            <p className="text-gray-500">没有找到匹配的项目</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map(item => (
              <div key={item.id} className="border rounded-md p-3">
                <div className="flex justify-between mb-1">
                  <h3 className="font-medium">{item.content}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    item.status === 'new' 
                      ? 'bg-blue-100 text-blue-800' 
                      : item.status === 'learning'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                  }`}>
                    {item.status === 'new' 
                      ? '新项目' 
                      : item.status === 'learning'
                        ? '学习中'
                        : '已掌握'}
                  </span>
                </div>
                
                {item.note && (
                  <p className="text-sm text-gray-600 mb-2">{item.note}</p>
                )}
                
                <div className="flex justify-between items-center">
                  <div className="flex flex-wrap gap-1">
                    {item.tags.map(tag => (
                      <span 
                        key={`${item.id}_${tag}`} 
                        className="bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  
                  <div className="flex space-x-1">
                    <button 
                      className="text-blue-600 hover:text-blue-700 text-xs"
                      onClick={() => startEditItem(item)}
                    >
                      编辑
                    </button>
                    <button 
                      className="text-red-600 hover:text-red-700 text-xs"
                      onClick={() => deleteItem(item.id)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };
  
  // 渲染内容区域
  const renderContent = () => {
    switch (activeView) {
      case 'summary':
        return renderSummaryView();
      case 'review':
        return renderReviewView();
      case 'new':
        return renderNewItemView();
      case 'browse':
        return renderBrowseView();
      default:
        return renderSummaryView();
    }
  };
  
  // 渲染底部导航
  const renderNavigation = () => {
    return (
      <div className="flex mt-4 border-t pt-4">
        <button 
          className={`flex-1 text-center py-2 ${
            activeView === 'summary' 
              ? 'text-blue-600 border-b-2 border-blue-600' 
              : 'text-gray-600'
          }`}
          onClick={() => setActiveView('summary')}
        >
          摘要
        </button>
        <button 
          className={`flex-1 text-center py-2 ${
            activeView === 'review' 
              ? 'text-blue-600 border-b-2 border-blue-600' 
              : 'text-gray-600'
          }`}
          onClick={() => {
            if (dueItems.length > 0) {
              startReview();
            } else {
              setActiveView('review');
            }
          }}
        >
          复习
        </button>
        <button 
          className={`flex-1 text-center py-2 ${
            activeView === 'new' 
              ? 'text-blue-600 border-b-2 border-blue-600' 
              : 'text-gray-600'
          }`}
          onClick={() => setActiveView('new')}
        >
          添加
        </button>
        <button 
          className={`flex-1 text-center py-2 ${
            activeView === 'browse' 
              ? 'text-blue-600 border-b-2 border-blue-600' 
              : 'text-gray-600'
          }`}
          onClick={() => setActiveView('browse')}
        >
          浏览
        </button>
      </div>
    );
  };
  
  // 主渲染
  return (
    <div className="bg-gray-50 p-2 rounded-lg">
      {renderContent()}
      {renderNavigation()}
    </div>
  );
} 