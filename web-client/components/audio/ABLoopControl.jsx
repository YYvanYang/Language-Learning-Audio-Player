// components/audio/ABLoopControl.jsx
'use client';

import React from 'react';
import { Repeat, X } from 'lucide-react';

const ABLoopControl = ({ 
  loopRegion, 
  duration, 
  onLoopClear, 
  onLoopAdjust, 
  isLoopActive, 
  onToggleLoop 
}) => {
  if (!loopRegion) return null;
  
  const startTime = (loopRegion.start / 100) * duration;
  const endTime = (loopRegion.end / 100) * duration;
  
  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-2 mt-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Repeat size={18} className={`mr-2 ${isLoopActive ? 'text-yellow-600' : 'text-gray-500'}`} />
          <span className="text-sm font-medium">AB循环</span>
        </div>
        <button 
          className="p-1 text-red-600 hover:bg-red-100 rounded"
          onClick={onLoopClear}
          title="清除循环"
        >
          <X size={16} />
        </button>
      </div>
      
      <div className="flex items-center justify-between mt-2">
        <div className="space-y-1">
          <div className="flex items-center">
            <span className="text-xs text-gray-600 w-6">A:</span>
            <input 
              type="range"
              min="0"
              max="100"
              value={loopRegion.start}
              onChange={(e) => onLoopAdjust({ ...loopRegion, start: Number(e.target.value) })}
              className="w-32 h-2 accent-yellow-500"
            />
            <span className="text-xs ml-1">{formatTime(startTime)}</span>
          </div>
          
          <div className="flex items-center">
            <span className="text-xs text-gray-600 w-6">B:</span>
            <input 
              type="range"
              min="0"
              max="100"
              value={loopRegion.end}
              onChange={(e) => onLoopAdjust({ ...loopRegion, end: Number(e.target.value) })}
              className="w-32 h-2 accent-yellow-500"
            />
            <span className="text-xs ml-1">{formatTime(endTime)}</span>
          </div>
        </div>
        
        <button 
          className={`px-2 py-1 rounded text-xs font-medium ${
            isLoopActive ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-700'
          }`}
          onClick={onToggleLoop}
        >
          {isLoopActive ? '停用' : '启用'}
        </button>
      </div>
    </div>
  );
};

export default ABLoopControl;