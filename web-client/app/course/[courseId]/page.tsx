import Image from 'next/image';
import Link from 'next/link';

async function getCourseDetails(courseId: string) {
  // 模拟API调用，获取课程详情
  // 实际生产环境中应从后端API获取
  
  const coursesData = {
    'course_1': {
      id: 'course_1',
      title: '英语听力基础',
      description: '适合初学者的英语听力练习课程，包含日常对话和基本表达。本课程专为英语初学者设计，通过大量实用的日常对话和基本表达练习，帮助学习者建立良好的听力基础。课程采用循序渐进的方式，从简单的问候语开始，逐步过渡到更复杂的对话情景。',
      level: '初级',
      imageUrl: '/images/courses/english_basic.jpg',
      language: '英语',
      instructor: '王小明',
      totalDuration: '10小时',
      updatedAt: '2023-12-15',
      units: [
        {
          id: 'unit_1_1',
          title: '基础问候与自我介绍',
          description: '学习基本的英语问候语和如何进行自我介绍',
          trackCount: 4,
          duration: '45分钟'
        },
        {
          id: 'unit_1_2',
          title: '数字与时间表达',
          description: '掌握数字的表达和询问、告知时间的方法',
          trackCount: 3,
          duration: '30分钟'
        },
        {
          id: 'unit_1_3',
          title: '购物对话',
          description: '学习在商店购物时的常用对话',
          trackCount: 5,
          duration: '50分钟'
        },
        {
          id: 'unit_1_4',
          title: '餐厅点餐',
          description: '掌握在餐厅用餐时的常用表达',
          trackCount: 4,
          duration: '40分钟'
        }
      ]
    },
    'course_2': {
      id: 'course_2',
      title: '日语会话进阶',
      description: '针对有基础的学习者，提供各种生活场景的日语对话练习。本课程适合已掌握基础日语的学习者，通过各种实际生活场景的对话练习，提升日语会话能力。课程内容涵盖职场交流、社交活动、旅游出行等多种场景，帮助学习者在实际应用中更加自信。',
      level: '中级',
      imageUrl: '/images/courses/japanese_intermediate.jpg',
      language: '日语',
      instructor: '佐藤健太',
      totalDuration: '12小时',
      updatedAt: '2023-11-20',
      units: [
        {
          id: 'unit_2_1',
          title: '职场交流',
          description: '学习在日本职场环境中的礼仪和交流方式',
          trackCount: 6,
          duration: '1小时'
        },
        {
          id: 'unit_2_2',
          title: '社交活动',
          description: '掌握参加日本社交活动时的表达方式',
          trackCount: 5,
          duration: '55分钟'
        },
        {
          id: 'unit_2_3',
          title: '旅游出行',
          description: '学习在日本旅行时的实用表达',
          trackCount: 4,
          duration: '45分钟'
        }
      ]
    },
    'course_3': {
      id: 'course_3',
      title: '法语发音专项训练',
      description: '专注于法语发音技巧和练习，帮助学习者掌握地道的法语发音。本课程专为希望改善法语发音的学习者设计，通过系统的发音技巧讲解和大量练习，帮助学习者掌握地道的法语发音。课程特别关注法语中的特殊音素、连读和语调，帮助学习者克服发音难点。',
      level: '中高级',
      imageUrl: '/images/courses/french_pronunciation.jpg',
      language: '法语',
      instructor: 'Marie Dupont',
      totalDuration: '8小时',
      updatedAt: '2024-01-10',
      units: [
        {
          id: 'unit_3_1',
          title: '元音发音',
          description: '掌握法语中各种元音的发音方法',
          trackCount: 5,
          duration: '50分钟'
        },
        {
          id: 'unit_3_2',
          title: '辅音发音',
          description: '学习法语辅音的发音技巧',
          trackCount: 4,
          duration: '45分钟'
        },
        {
          id: 'unit_3_3',
          title: '鼻元音与连读',
          description: '掌握法语特有的鼻元音和连读规则',
          trackCount: 6,
          duration: '1小时'
        },
        {
          id: 'unit_3_4',
          title: '语调与节奏',
          description: '学习法语的语调和节奏特点',
          trackCount: 5,
          duration: '55分钟'
        }
      ]
    },
    'course_4': {
      id: 'course_4',
      title: '商务西班牙语',
      description: '面向商务场景的西班牙语学习，包含会议、谈判和商务礼仪等内容。本课程专为需要在西班牙语商务环境中工作的学习者设计，内容涵盖商务会议、商务谈判、合同签署和商务礼仪等实用场景。通过本课程的学习，学习者将能够自信地应对各种商务场合的语言挑战。',
      level: '高级',
      imageUrl: '/images/courses/spanish_business.jpg',
      language: '西班牙语',
      instructor: 'Carlos Rodríguez',
      totalDuration: '15小时',
      updatedAt: '2023-10-05',
      units: [
        {
          id: 'unit_4_1',
          title: '商务会议',
          description: '学习在西班牙语商务会议中的表达方式',
          trackCount: 7,
          duration: '1小时20分钟'
        },
        {
          id: 'unit_4_2',
          title: '商务谈判',
          description: '掌握商务谈判中的关键表达',
          trackCount: 6,
          duration: '1小时10分钟'
        },
        {
          id: 'unit_4_3',
          title: '合同签署',
          description: '学习与合同相关的术语和表达',
          trackCount: 5,
          duration: '55分钟'
        },
        {
          id: 'unit_4_4',
          title: '商务礼仪',
          description: '了解西班牙语国家的商务礼仪',
          trackCount: 4,
          duration: '45分钟'
        }
      ]
    }
  };
  
  return coursesData[courseId as keyof typeof coursesData] || null;
}

export default async function CourseDetailPage({ params }: { params: { courseId: string } }) {
  const course = await getCourseDetails(params.courseId);
  
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
            {course.imageUrl ? (
              <Image 
                src={course.imageUrl} 
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
              <div className="text-center">
                <div className="text-gray-500 text-sm">讲师</div>
                <div className="font-medium">{course.instructor}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-500 text-sm">总时长</div>
                <div className="font-medium">{course.totalDuration}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-500 text-sm">更新日期</div>
                <div className="font-medium">{course.updatedAt}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* 单元列表 */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">课程单元</h2>
        
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
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-800">{unit.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{unit.description}</p>
                  </div>
                </div>
                
                <div className="flex flex-col items-end">
                  <div className="flex items-center text-sm text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                    {unit.trackCount} 个音轨
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {unit.duration}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
      
      {/* 操作按钮 */}
      <div className="mt-8 flex justify-center">
        <Link href="/course" className="px-4 py-2 bg-gray-100 text-gray-600 rounded-md mr-4 hover:bg-gray-200 transition-colors">
          返回课程列表
        </Link>
        <Link href={`/course/${course.id}/${course.units[0].id}`} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
          开始学习
        </Link>
      </div>
    </div>
  );
} 