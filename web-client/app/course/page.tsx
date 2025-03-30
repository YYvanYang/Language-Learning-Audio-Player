import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';

// 添加课程类型定义
interface Course {
  id: string;
  title: string;
  description: string;
  level: string;
  cover_image?: string;
  language: string;
  total_units?: number;
  total_tracks?: number;
  units?: Array<{id: string; title: string}>;
}

// 加载状态组件
function CourseListSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div 
          key={i}
          className="bg-white rounded-lg overflow-hidden shadow-md"
        >
          <div className="aspect-video bg-gray-200 animate-pulse"></div>
          <div className="p-5">
            <div className="h-6 bg-gray-200 rounded w-3/4 mb-4 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-full mb-2 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6 mb-4 animate-pulse"></div>
            
            <div className="mt-4 flex items-center justify-between">
              <div className="h-4 bg-gray-200 rounded w-1/4 animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-1/4 animate-pulse"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// 从后端API获取课程列表
async function getCourses(): Promise<Course[]> {
  try {
    console.log('开始获取课程列表...');
    
    // 导入API函数
    const { getUserCourses } = await import('@/lib/api');
    console.log('成功导入getUserCourses函数');
    
    // 使用API库函数获取课程并直接获取结果
    console.log('调用getUserCourses函数...');
    const result = await getUserCourses();
    console.log('getUserCourses返回结果:', JSON.stringify(result).substring(0, 100) + '...');
    
    // 确保结果的格式正确，并返回课程数组
    if (result && typeof result === 'object' && 'courses' in result) {
      const courses = result.courses as Course[];
      console.log(`找到${courses?.length || 0}门课程`);
      return courses || [];
    }
    
    // 如果结果不符合预期格式，返回空数组
    console.warn('API返回的数据格式不正确:', result);
    return [];
  } catch (error) {
    // 记录详细错误信息，以便诊断问题
    console.error('获取课程列表出错:', error);
    console.error('错误类型:', error instanceof Error ? error.name : typeof error);
    console.error('错误详情:', error instanceof Error ? error.message : String(error));
    
    // 在开发环境下使用模拟数据作为后备选项
    if (process.env.NODE_ENV === 'development') {
      console.log('使用模拟数据作为后备...');
      return getMockCourses();
    }
    
    // 返回空数组而不是抛出错误，避免服务器组件崩溃
    return [];
  }
}

// 备用模拟数据函数 - 仅在API调用失败且处于开发环境时使用
function getMockCourses(): Course[] {
  return [
    {
      id: 'course_1',
      title: '英语听力基础',
      description: '适合初学者的英语听力练习课程，包含日常对话和基本表达',
      level: '初级',
      cover_image: '/images/courses/english_basic.jpg',
      total_units: 10,
      total_tracks: 30,
      language: '英语'
    },
    {
      id: 'course_2',
      title: '日语会话进阶',
      description: '针对有基础的学习者，提供各种生活场景的日语对话练习',
      level: '中级',
      cover_image: '/images/courses/japanese_intermediate.jpg',
      total_units: 8,
      total_tracks: 24,
      language: '日语'
    }
  ];
}

// 课程列表组件
async function CourseList() {
  const courses = await getCourses();

  // 如果没有课程数据，显示提示信息
  if (!courses || courses.length === 0) {
    return (
      <div className="bg-blue-50 p-6 rounded-lg">
        <p className="text-blue-700">
          暂无可用课程。请稍后再试或联系管理员。
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {courses.map((course: Course) => (
        <Link 
          href={`/course/${course.id}`} 
          key={course.id}
          className="group bg-white rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300"
        >
          <div className="aspect-video relative bg-gray-200">
            {course.cover_image ? (
              <Image 
                src={course.cover_image} 
                alt={course.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-100">
                <span className="text-gray-400 text-xl">{course.language}</span>
              </div>
            )}
            <div className="absolute top-3 right-3 bg-blue-600 text-white text-xs font-semibold px-2 py-1 rounded">
              {course.level}
            </div>
          </div>
          
          <div className="p-5">
            <h2 className="text-xl font-semibold text-gray-800 group-hover:text-blue-600 transition-colors duration-300">
              {course.title}
            </h2>
            <p className="mt-2 text-gray-600 line-clamp-2">
              {course.description}
            </p>
            
            <div className="mt-4 flex items-center text-sm text-gray-500 space-x-4">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span>{course.total_units || course.units?.length || '?'} 单元</span>
              </div>
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <span>{course.total_tracks || '?'} 音轨</span>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {course.language}
              </span>
              <span className="text-blue-600 group-hover:text-blue-800 font-medium text-sm flex items-center transition-colors duration-300">
                查看课程
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

// 主页面组件
export default function CoursePage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">语言学习课程</h1>
        <p className="mt-2 text-gray-600">
          选择一门课程开始您的语言学习之旅
        </p>
      </header>

      <Suspense fallback={<CourseListSkeleton />}>
        <CourseList />
      </Suspense>
    </main>
  );
} 