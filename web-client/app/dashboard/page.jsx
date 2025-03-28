'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { toast } from '@/components/ui/toast';
import Link from 'next/link';
import { BookOpen, Music, Clock, Settings } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  
  const [courses, setCourses] = useState([]);
  const [recentTracks, setRecentTracks] = useState([]);
  const [isCoursesLoading, setIsCoursesLoading] = useState(true);
  const [isTracksLoading, setIsTracksLoading] = useState(true);
  
  // 当未认证时重定向到登录页面
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login?redirect=/dashboard');
    }
  }, [isLoading, isAuthenticated, router]);
  
  // 加载用户课程
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const loadCourses = async () => {
      try {
        setIsCoursesLoading(true);
        console.log('开始加载课程数据...');
        
        // 重试功能
        let retries = 2; // 最多重试2次
        let response;
        
        while (retries >= 0) {
          try {
            response = await fetch('/api/courses', {
              method: 'GET',
              credentials: 'include',
              headers: {
                'Accept': 'application/json'
              }
            });
            
            // 如果成功，跳出循环
            break;
          } catch (fetchError) {
            console.error(`课程数据请求失败 (剩余重试次数: ${retries}):`, fetchError);
            
            if (retries === 0) {
              // 最后一次重试也失败，抛出错误
              throw fetchError;
            }
            
            // 等待1秒后重试
            await new Promise(resolve => setTimeout(resolve, 1000));
            retries--;
          }
        }
        
        console.log(`课程数据请求状态: ${response?.status || 'unknown'}`);
        
        if (!response?.ok) {
          // 尝试读取错误响应
          let errorMessage = '加载课程失败';
          try {
            const errorText = await response.text();
            console.error('课程加载错误响应:', errorText);
            errorMessage = `加载课程失败: ${response.status} - ${errorText}`;
          } catch (e) {
            console.error('无法读取错误响应:', e);
          }
          
          console.log(errorMessage);
          setCourses([]);
          return;
        }
        
        const data = await response.json();
        console.log('课程数据加载成功:', data);
        setCourses(data.courses || []);
      } catch (error) {
        console.error('课程加载错误:', error);
        
        // 提供更详细的错误诊断
        if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
          console.error('网络请求失败，可能原因: 网络连接问题、CORS错误、服务器未响应等');
          console.error('建议: 1. 检查后端服务是否运行 2. 检查网络连接 3. 检查浏览器控制台是否有CORS错误');
        }
        
        // 默认显示空数据
        setCourses([]);
      } finally {
        setIsCoursesLoading(false);
      }
    };
    
    loadCourses();
  }, [isAuthenticated]);
  
  // 加载最近播放的音轨
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const loadRecentTracks = async () => {
      try {
        setIsTracksLoading(true);
        console.log('开始加载最近播放记录...');
        
        const response = await fetch('/api/recent-tracks', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'application/json'
          }
        });
        
        console.log(`最近播放记录请求状态: ${response.status}`);
        
        if (!response.ok) {
          // 尝试读取错误响应
          let errorMessage = '加载最近播放记录失败';
          try {
            const errorText = await response.text();
            console.error('最近播放记录错误响应:', errorText);
            errorMessage = `加载最近播放记录失败: ${response.status} - ${errorText}`;
          } catch (e) {
            console.error('无法读取错误响应:', e);
          }
          
          console.log(errorMessage);
          setRecentTracks([]);
          return;
        }
        
        const data = await response.json();
        console.log('最近播放记录加载成功:', data);
        setRecentTracks(data.tracks || []);
      } catch (error) {
        console.error('最近播放记录加载错误:', error);
        setRecentTracks([]);
      } finally {
        setIsTracksLoading(false);
      }
    };
    
    loadRecentTracks();
  }, [isAuthenticated]);
  
  // 处理退出登录
  const handleLogout = async () => {
    try {
      await logout();
      toast.success('退出登录成功');
      router.push('/auth/login');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('退出登录失败，请重试');
    }
  };
  
  // 加载中状态
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-3 text-blue-500 text-lg">正在加载...</span>
      </div>
    );
  }
  
  // 如果未登录，显示空内容，重定向会在 useEffect 中处理
  if (!isAuthenticated) {
    return null;
  }
  
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">欢迎，{user?.username || '用户'}</h1>
            <p className="text-gray-600 mt-1">您的语言学习进度一目了然</p>
          </div>
          
          <Button variant="outline" onClick={handleLogout}>
            退出登录
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="bg-blue-100 p-3 rounded-full">
                  <BookOpen className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">课程总数</p>
                  <p className="text-2xl font-semibold text-gray-800">{courses.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="bg-green-100 p-3 rounded-full">
                  <Music className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">音轨总数</p>
                  <p className="text-2xl font-semibold text-gray-800">
                    {isTracksLoading ? '...' : recentTracks.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="bg-yellow-100 p-3 rounded-full">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">学习时长</p>
                  <p className="text-2xl font-semibold text-gray-800">32小时</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="bg-purple-100 p-3 rounded-full">
                  <Settings className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">设置</p>
                  <Link href="/settings" className="text-purple-600 font-medium text-sm">
                    管理账户
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>我的课程</CardTitle>
              </CardHeader>
              <CardContent>
                {isCoursesLoading ? (
                  <div className="flex justify-center py-6">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : courses.length > 0 ? (
                  <div className="space-y-4">
                    {courses.map((course) => (
                      <div key={course.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <Link href={`/course/${course.id}`}>
                          <div className="flex justify-between items-center">
                            <div>
                              <h3 className="font-medium text-gray-800">{course.title}</h3>
                              <p className="text-sm text-gray-500">{course.description}</p>
                            </div>
                            <span className="text-sm text-blue-600">单元: {course.unitCount || 0}</span>
                          </div>
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <BookOpen className="h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">没有可用的课程</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      您还没有加入任何课程，请联系管理员添加课程
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          <div>
            <Card>
              <CardHeader>
                <CardTitle>最近播放</CardTitle>
              </CardHeader>
              <CardContent>
                {isTracksLoading ? (
                  <div className="flex justify-center py-6">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : recentTracks.length > 0 ? (
                  <div className="space-y-3">
                    {recentTracks.map((track) => (
                      <div key={track.id} className="flex items-center p-2 hover:bg-gray-50 rounded-md">
                        <Music className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <p className="font-medium text-sm text-gray-800">{track.title}</p>
                          <p className="text-xs text-gray-500">{track.courseName}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Music className="h-10 w-10 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">
                      没有最近播放记录
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
} 