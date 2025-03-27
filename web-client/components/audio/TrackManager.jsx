// components/audio/TrackManager.jsx
'use client';

import React, { useState } from 'react';
import { MoreVertical, Edit, Trash2, Music, MoveUp, MoveDown } from 'lucide-react';
import { generateToken } from '@/lib/auth';

const TrackManager = ({ 
  tracks, 
  currentTrackId,
  onTrackDelete,
  onTrackRename,
  onTrackReorder,
  courseId,
  unitId,
  userId
}) => {
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [isRenaming, setIsRenaming] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(null);
  
  // 切换下拉菜单
  const toggleDropdown = (trackId) => {
    if (activeDropdown === trackId) {
      setActiveDropdown(null);
    } else {
      setActiveDropdown(trackId);
      // 关闭其他打开的操作
      setIsRenaming(null);
      setIsDeleteConfirming(null);
    }
  };
  
  // 开始重命名
  const startRename = (track) => {
    setNewTitle(track.title);
    setIsRenaming(track.id);
    setActiveDropdown(null);
  };
  
  // 取消重命名
  const cancelRename = () => {
    setIsRenaming(null);
    setNewTitle('');
  };
  
  // 提交重命名
  const submitRename = async (track) => {
    if (!newTitle.trim() || newTitle === track.title) {
      cancelRename();
      return;
    }
    
    try {
      // 创建访问令牌
      const token = await generateToken({
        courseId,
        unitId,
        trackId: track.id,
        userId,
        action: 'update_track',
        timestamp: Date.now()
      });
      
      // 发送请求
      const response = await fetch('/api/audio/track/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          title: newTitle
        })
      });
      
      if (!response.ok) {
        throw new Error('更新失败');
      }
      
      // 更新本地状态
      onTrackRename(track.id, newTitle);
      
      // 重置状态
      cancelRename();
      
    } catch (error) {
      console.error('重命名失败:', error);
      alert('重命名音轨失败，请重试');
      cancelRename();
    }
  };
  
  // 开始删除确认
  const startDeleteConfirm = (trackId) => {
    setIsDeleteConfirming(trackId);
    setActiveDropdown(null);
  };
  
  // 取消删除
  const cancelDelete = () => {
    setIsDeleteConfirming(null);
  };
  
  // 提交删除
  const submitDelete = async (track) => {
    try {
      // 只允许删除自定义轨道
      if (!track.custom) {
        alert('无法删除系统音轨');
        cancelDelete();
        return;
      }
      
      // 创建访问令牌
      const token = await generateToken({
        courseId,
        unitId,
        trackId: track.id,
        userId,
        action: 'delete_track',
        timestamp: Date.now()
      });
      
      // 发送请求
      const response = await fetch('/api/audio/track/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token })
      });
      
      if (!response.ok) {
        throw new Error('删除失败');
      }
      
      // 更新本地状态
      onTrackDelete(track.id);
      
      // 重置状态
      cancelDelete();
      
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除音轨失败，请重试');
      cancelDelete();
    }
  };
  
  // 移动轨道位置
  const moveTrack = async (track, direction) => {
    // 计算新的排序位置
    const currentIndex = tracks.findIndex(t => t.id === track.id);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    // 检查边界
    if (newIndex < 0 || newIndex >= tracks.length) {
      return;
    }
    
    try {
      // 创建访问令牌
      const token = await generateToken({
        courseId,
        unitId,
        trackId: track.id,
        userId,
        action: 'reorder_track',
        timestamp: Date.now()
      });
      
      // 发送请求
      const response = await fetch('/api/audio/track/reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          newPosition: tracks[newIndex].sortOrder
        })
      });
      
      if (!response.ok) {
        throw new Error('移动失败');
      }
      
      // 更新本地状态
      onTrackReorder(track.id, direction);
      
      // 关闭下拉菜单
      setActiveDropdown(null);
      
    } catch (error) {
      console.error('移动失败:', error);
      alert('移动音轨失败，请重试');
    }
  };
  
  // 检查是否存在自定义轨道
  const hasCustomTracks = tracks.some(track => track.custom);
  
  // 如果没有自定义轨道且不需要管理，不显示组件
  if (!hasCustomTracks) {
    return null;
  }
  
  return (
    <div className="mt-4 border rounded-lg overflow-hidden">
      <div className="bg-gray-100 px-3 py-2 font-medium border-b">
        音轨管理
      </div>
      
      <div className="max-h-60 overflow-y-auto">
        {tracks.map((track) => (
          <div 
            key={track.id}
            className={`flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-gray-50 ${
              currentTrackId === track.id ? 'bg-blue-50' : ''
            }`}
          >
            <div className="flex items-center">
              <Music size={16} className="text-gray-500 mr-2" />
              
              {isRenaming === track.id ? (
                // 重命名输入框
                <div className="flex items-center">
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="border rounded px-2 py-1 text-sm w-48"
                    autoFocus
                  />
                  <div className="flex space-x-1 ml-2">
                    <button
                      onClick={() => submitRename(track)}
                      className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      保存
                    </button>
                    <button
                      onClick={cancelRename}
                      className="text-xs px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : isDeleteConfirming === track.id ? (
                // 删除确认
                <div className="flex items-center">
                  <span className="text-sm text-red-500 font-medium">确定要删除吗？</span>
                  <div className="flex space-x-1 ml-2">
                    <button
                      onClick={() => submitDelete(track)}
                      className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      删除
                    </button>
                    <button
                      onClick={cancelDelete}
                      className="text-xs px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                // 正常显示
                <div>
                  <span className="text-sm font-medium">{track.title}</span>
                  {track.chineseName && (
                    <span className="text-xs text-gray-500 ml-2">{track.chineseName}</span>
                  )}
                  {track.custom && (
                    <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                      自定义
                    </span>
                  )}
                </div>
              )}
            </div>
            
            {!isRenaming && !isDeleteConfirming && (
              <div className="relative">
                <button
                  onClick={() => toggleDropdown(track.id)}
                  className="p-1 rounded-full hover:bg-gray-200"
                >
                  <MoreVertical size={16} />
                </button>
                
                {activeDropdown === track.id && (
                  <div className="absolute right-0 mt-1 w-36 bg-white rounded-md shadow-lg z-20 border">
                    <div className="py-1">
                      <button
                        onClick={() => startRename(track)}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                      >
                        <Edit size={14} className="mr-2" />
                        重命名
                      </button>
                      
                      {track.custom && (
                        <button
                          onClick={() => startDeleteConfirm(track.id)}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center"
                        >
                          <Trash2 size={14} className="mr-2" />
                          删除
                        </button>
                      )}
                      
                      <div className="border-t my-1"></div>
                      
                      <button
                        onClick={() => moveTrack(track, 'up')}
                        disabled={tracks.indexOf(track) === 0}
                        className={`w-full text-left px-4 py-2 text-sm flex items-center ${
                          tracks.indexOf(track) === 0 
                            ? 'text-gray-400' 
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <MoveUp size={14} className="mr-2" />
                        上移
                      </button>
                      
                      <button
                        onClick={() => moveTrack(track, 'down')}
                        disabled={tracks.indexOf(track) === tracks.length - 1}
                        className={`w-full text-left px-4 py-2 text-sm flex items-center ${
                          tracks.indexOf(track) === tracks.length - 1 
                            ? 'text-gray-400' 
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <MoveDown size={14} className="mr-2" />
                        下移
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrackManager;