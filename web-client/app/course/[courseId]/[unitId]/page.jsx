// app/course/[courseId]/[unitId]/page.jsx
// 完整的课程页面组件，集成了音频导入和管理功能

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Plus, X, MusicIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { getCourseData, getCustomTracks } from '@/lib/api';
import AudioPlayer from '@/components/audio/AudioPlayer';
import AudioImportForm from '@/components/audio/AudioImportForm';
import TrackManager from '@/components/audio/TrackManager';
import { toast } from '@/components/ui/toast';

export default function CoursePage() {
  const params = useParams();
  const { courseId, unitId } = params;
  const { user, isAuthenticated, isLoading } = useAuth();
  
  const [courseData, setCourseData] = useState(null);
  const [isLoadingCourse, setIsLoadingCourse] = useState(true);
  const [error, setError] = useState(null);
  const [showImportForm, setShowImportForm] = useState(false);
  const [customTracks, setCustomTracks] = useState([]);
  const [currentTrackId, setCurrentTrackId] = useState(null);
  
  // 加载课程数据
  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      // 重定向到登录页
      window.location.href = `/auth/login?redirect=/course/${courseId}/${unitId}`;
      return;
    }
    
    async function loadCourse() {
      try {
        setIsLoadingCourse(true);
        const data = await getCourseData(courseId, unitId);
        setCourseData(data);
        
        // 加载自定义音轨
        await loadCustomTracks();
      } catch (err) {
        console.error('Error loading course:', err);
        setError('无法加载课程内容');
      } finally {
        setIsLoadingCourse(false);
      }
    }
    
    if (isAuthenticated && courseId && unitId) {
      loadCourse();
    }
  }, [isAuthenticated, isLoading, courseId, unitId]);
  
  // 加载自定义音轨
  const loadCustomTracks = async () => {
    try {
      const data = await getCustomTracks(courseId, unitId);
      setCustomTracks(data.tracks || []);
    } catch (err) {
      console.error('Error loading custom tracks:', err);
      // 失败时设置为空数组
      setCustomTracks([]);
    }
  };
  
  // 处理音频导入成功
  const handleAudioImported = (audioInfo) => {
    // 创建新的音轨对象
    const newTrack = {
      id: audioInfo.trackId,
      title: audioInfo.title,
      chineseName: "自定义音频",
      duration: audioInfo.duration || 0,
      custom: true, // 标记为自定义音频
      sortOrder: (courseData?.tracks?.length || 0) + customTracks.length + 1
    };
    
    // 添加到自定义轨道列表
    setCustomTracks(prev => [...prev, newTrack]);
    
    // 隐藏导入表单
    setShowImportForm(false);
    
    // 显示成功消息
    toast({
      title: "导入成功",
      description: "音频已成功导入！",
      variant: "success",
    });
  };
  
  // 处理音轨删除
  const handleTrackDelete = async (trackId) => {
    try {
      // 调用删除API
      const response = await fetch(`/api/courses/${courseId}/units/${unitId}/custom-tracks/${trackId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('删除音轨失败');
      }
      
      // 从列表中移除
      setCustomTracks(prev => prev.filter(track => track.id !== trackId));
      
      toast({
        title: "删除成功",
        description: "音轨已成功删除！",
        variant: "success",
      });
    } catch (error) {
      console.error('删除音轨失败:', error);
      toast({
        title: "删除失败",
        description: "无法删除音轨，请稍后重试",
        variant: "error",
      });
    }
  };
  
  // 处理音轨重命名
  const handleTrackRename = async (trackId, newTitle) => {
    try {
      // 调用重命名API
      const response = await fetch(`/api/courses/${courseId}/units/${unitId}/custom-tracks/${trackId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ title: newTitle })
      });
      
      if (!response.ok) {
        throw new Error('重命名音轨失败');
      }
      
      // 更新本地数据
      setCustomTracks(prev => 
        prev.map(track => 
          track.id === trackId ? { ...track, title: newTitle } : track
        )
      );
      
      toast({
        title: "重命名成功",
        description: "音轨名称已更新！",
        variant: "success",
      });
    } catch (error) {
      console.error('重命名音轨失败:', error);
      toast({
        title: "重命名失败",
        description: "无法更新音轨名称，请稍后重试",
        variant: "error",
      });
    }
  };
  
  // 处理音轨重排序
  const handleTrackReorder = async (trackId, direction) => {
    const allTracks = [...(courseData?.tracks || []), ...customTracks];
    const currentIndex = allTracks.findIndex(track => track.id === trackId);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    // 检查边界
    if (newIndex < 0 || newIndex >= allTracks.length) {
      return;
    }
    
    try {
      // 找到当前音轨
      const trackToMove = customTracks.find(track => track.id === trackId);
      if (!trackToMove) return; // 不是自定义音轨，无法移动
      
      // 计算新的排序值
      const newSortOrder = direction === 'up' 
        ? Math.max(0, trackToMove.sortOrder - 1)
        : trackToMove.sortOrder + 1;
      
      // 调用重排序API
      const response = await fetch(`/api/courses/${courseId}/units/${unitId}/custom-tracks/${trackId}/reorder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ sortOrder: newSortOrder })
      });
      
      if (!response.ok) {
        throw new Error('重排序音轨失败');
      }
      
      // 更新本地数据
      const updatedTracks = [...customTracks];
      const trackIndex = updatedTracks.findIndex(track => track.id === trackId);
      
      if (trackIndex !== -1) {
        const track = {...updatedTracks[trackIndex], sortOrder: newSortOrder};
        updatedTracks.splice(trackIndex, 1);
        
        if (direction === 'up') {
          // 如果向上移动，需要计算新位置
          const newPosition = Math.max(0, trackIndex - 1);
          updatedTracks.splice(newPosition, 0, track);
        } else {
          // 如果向下移动
          const newPosition = Math.min(updatedTracks.length, trackIndex + 1);
          updatedTracks.splice(newPosition, 0, track);
        }
        
        setCustomTracks(updatedTracks);
      }
    } catch (error) {
      console.error('重排序音轨失败:', error);
      toast({
        title: "排序失败",
        description: "无法调整音轨顺序，请稍后重试",
        variant: "error",
      });
    }
  };
  
  // 获取当前播放的轨道ID
  const handleTrackChange = (trackId) => {
    setCurrentTrackId(trackId);
  };
  
  // 计算所有轨道（包括课程提供的和自定义的）
  const allTracks = [...(courseData?.tracks || []), ...customTracks];
  
  // 加载中状态
  if (isLoading || isLoadingCourse) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-3 text-blue-500 text-lg">正在加载课程...</span>
      </div>
    );
  }
  
  // 错误状态
  if (error) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gray-50">
        <div className="text-red-500 text-xl mb-4">{error}</div>
        <button 
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          onClick={() => window.location.reload()}
        >
          重试
        </button>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {courseData && (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-800">{courseData.courseName}</h1>
              <h2 className="text-xl text-gray-600 mt-2">{courseData.unitTitle}</h2>
            </div>
            
            {/* 音频导入按钮 */}
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setShowImportForm(!showImportForm)}
                className="flex items-center text-sm px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                {showImportForm ? (
                  <>
                    <X size={16} className="mr-1" />
                    取消导入
                  </>
                ) : (
                  <>
                    <Plus size={16} className="mr-1" />
                    导入音频
                  </>
                )}
              </button>
            </div>
            
            {/* 音频导入表单 */}
            {showImportForm && (
              <div className="mb-6">
                <AudioImportForm
                  courseId={courseId}
                  unitId={unitId}
                  userId={user?.id}
                  onAudioImported={handleAudioImported}
                />
              </div>
            )}
            
            {/* 音频播放器 */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <AudioPlayer 
                courseId={courseId}
                unitId={unitId}
                userId={user?.id}
                tracks={allTracks}
                onTrackChange={handleTrackChange}
              />
            </div>
            
            {/* 轨道管理器 */}
            {customTracks.length > 0 && (
              <div className="mb-8">
                <TrackManager
                  tracks={allTracks}
                  currentTrackId={currentTrackId}
                  onTrackDelete={handleTrackDelete}
                  onTrackRename={handleTrackRename}
                  onTrackReorder={handleTrackReorder}
                  courseId={courseId}
                  unitId={unitId}
                  userId={user?.id}
                />
              </div>
            )}
            
            {/* 课程内容 */}
            {courseData.content && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-xl font-semibold mb-4">课程内容</h3>
                <div dangerouslySetInnerHTML={{ __html: courseData.content }} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}