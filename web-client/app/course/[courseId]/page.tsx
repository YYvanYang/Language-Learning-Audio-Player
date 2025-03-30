import Image from 'next/image';
import Link from 'next/link';

// 定义课程数据类型
interface Course {
  id: string;
  title: string;
  description: string;
  level: string;
  cover_image?: string;
  language: string;
  instructor?: string;
  total_duration?: string;
  updated_at?: string;
  units: Unit[];
}

// 定义单元数据类型
interface Unit {
  id: string;
  title: string;
  description: string;
  track_count?: number;
  duration?: string;
  sort_order?: number;
}

// 从后端API获取课程详情
async function getCourseDetails(courseId: string): Promise<Course | null> {
  try {
    // 导入API函数
    const { createApiUrl } = await import('@/lib/api');
    
    // 获取课程详情
    const courseApiUrl = createApiUrl(`/courses/${courseId}`);
    console.log(`正在请求课程详情: ${courseApiUrl}`);
    
    const courseResponse = await fetch(courseApiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      cache: 'no-store',
    });

    if (!courseResponse.ok) {
      console.error(`获取课程详情失败: ${courseResponse.status} ${courseResponse.statusText}`);
      return null;
    }

    const courseData = await courseResponse.json();

    // 获取课程单元
    const unitsApiUrl = createApiUrl(`/courses/${courseId}/units`);
    console.log(`正在请求课程单元: ${unitsApiUrl}`);
    
    const unitsResponse = await fetch(unitsApiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      cache: 'no-store',
    });

    if (!unitsResponse.ok) {
      console.error(`获取课程单元失败: ${unitsResponse.status} ${unitsResponse.statusText}`);
      // 即使获取单元失败，我们仍然返回课程信息，但单元列表为空
      return {...courseData, units: []};
    }

    const unitsData = await unitsResponse.json();
    
    // 将课程信息和单元信息组合
    return {
      ...courseData,
      units: unitsData.units || []
    };
  } catch (error) {
    console.error('获取课程详情时出错:', error);
    
    // 在开发环境下使用模拟数据作为后备选项
    if (process.env.NODE_ENV === 'development') {
      console.log('使用模拟数据...');
      return getMockCourseDetails(courseId);
    }
    
    return null;
  }
}

// 备用模拟数据函数 - 仅在API调用失败且处于开发环境时使用
function getMockCourseDetails(courseId: string): Course | null {
  const coursesData: Record<string, Course> = {
    'course_1': {
      id: 'course_1',
      title: '英语听力基础',
      description: '适合初学者的英语听力练习课程，包含日常对话和基本表达。本课程专为英语初学者设计，通过大量实用的日常对话和基本表达练习，帮助学习者建立良好的听力基础。课程采用循序渐进的方式，从简单的问候语开始，逐步过渡到更复杂的对话情景。',
      level: '初级',
      cover_image: '/images/courses/english_basic.jpg',
      language: '英语',
      instructor: '王小明',
      total_duration: '10小时',
      updated_at: '2023-12-15',
      units: [
        {
          id: 'unit_1_1',
          title: '基础问候与自我介绍',
          description: '学习基本的英语问候语和如何进行自我介绍',
          track_count: 4,
          duration: '45分钟'
        },
        {
          id: 'unit_1_2',
          title: '数字与时间表达',
          description: '掌握数字的表达和询问、告知时间的方法',
          track_count: 3,
          duration: '30分钟'
        },
        {
          id: 'unit_1_3',
          title: '购物对话',
          description: '学习在商店购物时的常用对话',
          track_count: 5,
          duration: '50分钟'
        }
      ]
    },
    'course_2': {
      id: 'course_2',
      title: '日语会话进阶',
      description: '针对有基础的学习者，提供各种生活场景的日语对话练习。本课程适合已掌握基础日语的学习者，通过各种实际生活场景的对话练习，提升日语会话能力。课程内容涵盖职场交流、社交活动、旅游出行等多种场景，帮助学习者在实际应用中更加自信。',
      level: '中级',
      cover_image: '/images/courses/japanese_intermediate.jpg',
      language: '日语',
      instructor: '佐藤健太',
      total_duration: '12小时',
      updated_at: '2023-11-20',
      units: [
        {
          id: 'unit_2_1',
          title: '职场交流',
          description: '学习在日本职场环境中的礼仪和交流方式',
          track_count: 6,
          duration: '1小时'
        },
        {
          id: 'unit_2_2',
          title: '社交活动',
          description: '掌握参加日本社交活动时的表达方式',
          track_count: 5,
          duration: '55分钟'
        }
      ]
    }
  };
  
  return coursesData[courseId] || null;
}

export default async function CourseDetailPage({ params }: { params: { courseId: string } }) {
  const course = await getCourseDetails(params.courseId);
  
  // 课程未找到时显示错误信息
  if (!course) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 p-4 rounded-lg">
          <h1 className="text-xl font-semibold text-red-700">课程未找到</h1>
          <p className="mt-2 text-red-600">
            抱歉，您请求的课程不存在或已被移除。
          </p>
          <Link href="/course" className="mt-4 inline-block text-blue-600 hover:text-blue-800">
            返回课程列表
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      {/* 课程头部信息 */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
        <div className="md:flex">
          <div className="md:w-1/3 relative aspect-video md:aspect-auto">
            {course.cover_image ? (
              <Image 
                src={course.cover_image} 
                alt={course.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 33vw"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-100">
                <span className="text-gray-400 text-xl">{course.language}</span>
              </div>
            )}
          </div>
          
          <div className="p-6 md:w-2/3">
            <div className="flex items-center">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800">{course.title}</h1>
              <span className="ml-3 px-2 py-1 text-xs font-semibold rounded bg-blue-600 text-white">
                {course.level}
              </span>
            </div>
            
            <p className="mt-4 text-gray-600">
              {course.description}
            </p>
            
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-gray-500 text-sm">语言</div>
                <div className="font-medium">{course.language}</div>
              </div>
              {course.instructor && (
                <div className="text-center">
                  <div className="text-gray-500 text-sm">讲师</div>
                  <div className="font-medium">{course.instructor}</div>
                </div>
              )}
              {course.total_duration && (
                <div className="text-center">
                  <div className="text-gray-500 text-sm">总时长</div>
                  <div className="font-medium">{course.total_duration}</div>
                </div>
              )}
              {course.updated_at && (
                <div className="text-center">
                  <div className="text-gray-500 text-sm">更新日期</div>
                  <div className="font-medium">{course.updated_at}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* 单元列表 */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">课程单元</h2>
        
        {course.units.length === 0 ? (
          <div className="bg-yellow-50 p-4 rounded-lg">
            <p className="text-yellow-700">此课程暂无可用单元。</p>
          </div>
        ) : (
          <div className="space-y-4">
            {course.units.map((unit, index) => (
              <Link 
                key={unit.id}
                href={`/course/${course.id}/${unit.id}`}
                className="block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-4 border border-gray-100"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-medium mr-4">
                      {unit.sort_order || index + 1}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-800">{unit.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{unit.description}</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end">
                    {unit.track_count !== undefined && (
                      <div className="flex items-center text-sm text-gray-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                        {unit.track_count} 个音轨
                      </div>
                    )}
                    {unit.duration && (
                      <div className="text-sm text-gray-500 mt-1">
                        {unit.duration}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      
      {/* 操作按钮 */}
      <div className="mt-8 flex justify-center">
        <Link href="/course" className="px-4 py-2 bg-gray-100 text-gray-600 rounded-md mr-4 hover:bg-gray-200 transition-colors">
          返回课程列表
        </Link>
        {course.units.length > 0 && (
          <Link href={`/course/${course.id}/${course.units[0].id}`} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
            开始学习
          </Link>
        )}
      </div>
    </div>
  );
} 