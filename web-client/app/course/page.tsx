import Image from 'next/image';
import Link from 'next/link';

async function getCourses() {
  // 在实际生产环境中，这里应该调用后端API
  // 现在使用模拟数据
  return [
    {
      id: 'course_1',
      title: '英语听力基础',
      description: '适合初学者的英语听力练习课程，包含日常对话和基本表达',
      level: '初级',
      imageUrl: '/images/courses/english_basic.jpg',
      totalUnits: 10,
      totalTracks: 30,
      language: '英语'
    },
    {
      id: 'course_2',
      title: '日语会话进阶',
      description: '针对有基础的学习者，提供各种生活场景的日语对话练习',
      level: '中级',
      imageUrl: '/images/courses/japanese_intermediate.jpg',
      totalUnits: 8,
      totalTracks: 24,
      language: '日语'
    },
    {
      id: 'course_3',
      title: '法语发音专项训练',
      description: '专注于法语发音技巧和练习，帮助学习者掌握地道的法语发音',
      level: '中高级',
      imageUrl: '/images/courses/french_pronunciation.jpg',
      totalUnits: 5,
      totalTracks: 20,
      language: '法语'
    },
    {
      id: 'course_4',
      title: '商务西班牙语',
      description: '面向商务场景的西班牙语学习，包含会议、谈判和商务礼仪等内容',
      level: '高级',
      imageUrl: '/images/courses/spanish_business.jpg',
      totalUnits: 7,
      totalTracks: 28,
      language: '西班牙语'
    }
  ];
}

export default async function CoursePage() {
  const courses = await getCourses();

  return (
    <main className="container mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">语言学习课程</h1>
        <p className="mt-2 text-gray-600">
          选择一门课程开始您的语言学习之旅
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course) => (
          <Link 
            href={`/course/${course.id}`} 
            key={course.id}
            className="group bg-white rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300"
          >
            <div className="aspect-video relative bg-gray-200">
              {course.imageUrl ? (
                <Image 
                  src={course.imageUrl} 
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
                  <span>{course.totalUnits} 单元</span>
                </div>
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                  <span>{course.totalTracks} 音轨</span>
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
    </main>
  );
} 