// components/audio/AudioImportForm.jsx
'use client';

import React, { useState, useRef } from 'react';
import { Upload, Music, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { generateToken } from '@/lib/auth';

const AudioImportForm = ({ courseId, unitId, userId, onAudioImported }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [audioTitle, setAudioTitle] = useState('');
  const [audioDescription, setAudioDescription] = useState('');
  
  const fileInputRef = useRef(null);
  
  // 处理文件选择
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // 验证文件类型
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/aac', 'audio/mp4'];
    if (!validTypes.includes(file.type)) {
      setUploadError('不支持的音频格式。请上传MP3, WAV, OGG, FLAC或AAC文件。');
      return;
    }
    
    // 验证文件大小 (最大100MB)
    if (file.size > 100 * 1024 * 1024) {
      setUploadError('文件过大。最大支持100MB。');
      return;
    }
    
    setSelectedFile(file);
    setUploadError(null);
    
    // 尝试从文件名中提取标题
    const fileName = file.name.replace(/\.[^/.]+$/, ''); // 去除扩展名
    setAudioTitle(fileName);
  };
  
  // 处理文件上传
  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!selectedFile) {
      setUploadError('请先选择音频文件');
      return;
    }
    
    if (!audioTitle.trim()) {
      setUploadError('请输入音频标题');
      return;
    }
    
    try {
      setIsUploading(true);
      setUploadProgress(0);
      setUploadError(null);
      
      // 创建访问令牌
      const token = generateToken({
        courseId,
        unitId,
        userId,
        action: 'import_audio',
        timestamp: Date.now(),
        fileName: selectedFile.name
      });
      
      // 创建FormData
      const formData = new FormData();
      formData.append('token', token);
      formData.append('audioFile', selectedFile);
      formData.append('title', audioTitle);
      formData.append('description', audioDescription);
      
      // 创建XMLHttpRequest来跟踪上传进度
      const xhr = new XMLHttpRequest();
      
      // 监听上传进度
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(progress);
        }
      });
      
      // 处理完成
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploadSuccess(true);
          setIsUploading(false);
          
          // 解析响应获取新创建的音频信息
          try {
            const response = JSON.parse(xhr.responseText);
            
            // 通知父组件导入成功
            if (onAudioImported && response.trackId) {
              onAudioImported(response);
            }
            
            // 重置表单准备下一次上传
            setTimeout(() => {
              setSelectedFile(null);
              setAudioTitle('');
              setAudioDescription('');
              setUploadSuccess(false);
              setUploadProgress(0);
            }, 3000);
            
          } catch (error) {
            console.error('解析响应失败:', error);
          }
        } else {
          // 处理错误
          try {
            const response = JSON.parse(xhr.responseText);
            setUploadError(response.error || '上传失败');
          } catch (e) {
            setUploadError('上传失败。请稍后重试。');
          }
          setIsUploading(false);
        }
      });
      
      // 处理错误
      xhr.addEventListener('error', () => {
        setUploadError('网络错误。请检查连接后重试。');
        setIsUploading(false);
      });
      
      // 处理中断
      xhr.addEventListener('abort', () => {
        setUploadError('上传已取消。');
        setIsUploading(false);
      });
      
      // 发送请求
      xhr.open('POST', '/api/audio/import');
      xhr.send(formData);
      
    } catch (error) {
      setUploadError('上传失败: ' + error.message);
      setIsUploading(false);
    }
  };
  
  // 处理取消
  const handleCancel = () => {
    setSelectedFile(null);
    setAudioTitle('');
    setAudioDescription('');
    setUploadError(null);
    setUploadProgress(0);
    
    // 重置文件输入
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // 渲染文件选择UI
  const renderFileSelection = () => {
    if (selectedFile) {
      return (
        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center">
            <Music className="text-blue-500 mr-2" size={20} />
            <div>
              <div className="text-sm font-medium truncate max-w-xs">
                {selectedFile.name}
              </div>
              <div className="text-xs text-gray-500">
                {formatFileSize(selectedFile.size)} • {selectedFile.type.split('/')[1].toUpperCase()}
              </div>
            </div>
          </div>
          <button 
            type="button"
            onClick={handleCancel}
            className="text-gray-500 hover:text-red-500"
            disabled={isUploading}
          >
            <X size={18} />
          </button>
        </div>
      );
    }
    
    return (
      <div 
        className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors cursor-pointer"
        onClick={() => fileInputRef.current.click()}
      >
        <Upload className="mx-auto text-gray-400" size={28} />
        <p className="mt-2 text-sm text-gray-500">点击或拖放文件到此处上传</p>
        <p className="text-xs text-gray-400 mt-1">支持 MP3, WAV, OGG, FLAC, AAC (最大100MB)</p>
      </div>
    );
  };
  
  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };
  
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-medium mb-4">导入音频</h3>
      
      <form onSubmit={handleUpload}>
        {/* 隐藏的文件输入 */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="audio/*"
          className="hidden"
        />
        
        {/* 文件选择UI */}
        {renderFileSelection()}
        
        {/* 音频信息表单 */}
        {selectedFile && (
          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                音频标题 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={audioTitle}
                onChange={(e) => setAudioTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="输入音频标题"
                required
                disabled={isUploading}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                描述 (可选)
              </label>
              <textarea
                value={audioDescription}
                onChange={(e) => setAudioDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="添加音频描述..."
                rows={3}
                disabled={isUploading}
              />
            </div>
          </div>
        )}
        
        {/* 上传进度 */}
        {isUploading && (
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span>上传中...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full" 
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          </div>
        )}
        
        {/* 错误信息 */}
        {uploadError && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md flex items-start">
            <AlertCircle className="flex-shrink-0 mr-2" size={18} />
            <span className="text-sm">{uploadError}</span>
          </div>
        )}
        
        {/* 成功消息 */}
        {uploadSuccess && (
          <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-md flex items-start">
            <CheckCircle className="flex-shrink-0 mr-2" size={18} />
            <span className="text-sm">音频上传成功！</span>
          </div>
        )}
        
        {/* 操作按钮 */}
        <div className="mt-4 flex justify-end space-x-3">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            disabled={isUploading}
          >
            取消
          </button>
          
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            disabled={!selectedFile || isUploading || !audioTitle.trim()}
          >
            {isUploading ? (
              <span className="flex items-center">
                <Loader2 className="animate-spin mr-2" size={16} />
                上传中...
              </span>
            ) : '上传音频'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AudioImportForm;