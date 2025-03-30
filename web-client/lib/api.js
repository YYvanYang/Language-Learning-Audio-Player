// lib/api.js
// API工具函数

/**
 * 获取课程数据
 * @param {string} courseId - 课程ID
 * @param {string} unitId - 单元ID
 * @returns {Promise<Object>} 课程数据
 */
export async function getCourseData(courseId, unitId) {
  try {
    // 检查是否在开发环境且设置了使用模拟数据
    if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true') {
      console.log('使用模拟数据模式...');
      return getMockCourseData(courseId, unitId);
    }
    
    // 发送请求到后端API - 修复正确的API路径
    const response = await fetch(`/api/courses/${courseId}/units/${unitId}/tracks`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // 包含cookie以便身份验证
    });

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }

    const data = await response.json();
    
    // 转换后端数据到前端所需格式
    return {
      id: courseId,
      courseName: data.course?.title || '语言学习课程',
      unitTitle: data.unit?.title || '单元内容',
      content: data.unit?.content || '<p>课程内容将在这里显示</p>',
      tracks: data.tracks || [],
      unitId: unitId
    };
    
  } catch (error) {
    console.error('获取课程数据时发生错误:', error);
    
    // 开发环境下自动返回模拟数据作为后备
    if (process.env.NODE_ENV === 'development') {
      console.log('API请求失败，使用模拟数据...');
      return getMockCourseData(courseId, unitId);
    }
    
    throw error;
  }
}

/**
 * 开发环境下的模拟数据
 */
function getMockCourseData(courseId, unitId) {
  // 预设的课程数据
  const mockCourses = {
    'course_1': {
      id: 'course_1',
      courseName: '英语（PEP）',
      unitTitle: '二年级 下册',
      content: '<p>本单元重点学习英语基础词汇和简单对话，通过多种形式的练习帮助学生掌握日常用语。</p><p>请跟随音频练习发音和对话。</p>',
      tracks: [
        {
          id: 'track_1_1',
          title: 'Unit 1 - Part A',
          chineseName: '单元一 - 听力练习A',
          duration: 125,
          sortOrder: 1
        },
        {
          id: 'track_1_2',
          title: 'Unit 1 - Part B',
          chineseName: '单元一 - 对话练习B',
          duration: 180,
          sortOrder: 2
        },
        {
          id: 'track_1_3',
          title: 'Unit 1 - Songs',
          chineseName: '单元一 - 歌曲',
          duration: 95,
          sortOrder: 3
        }
      ],
      unitId: 'unit_1'
    },
    'course_2': {
      id: 'course_2',
      courseName: '日语初级',
      unitTitle: '日常会话入门',
      content: '<p>本单元学习日语日常会话的基础表达，重点掌握问候、自我介绍等内容。</p>',
      tracks: [
        {
          id: 'track_2_1',
          title: 'あいさつ',
          chineseName: '问候语',
          duration: 145,
          sortOrder: 1
        },
        {
          id: 'track_2_2',
          title: '自己紹介',
          chineseName: '自我介绍',
          duration: 210,
          sortOrder: 2
        }
      ],
      unitId: 'unit_1'
    }
  };
  
  // 通用内容，当没有匹配的课程时使用
  const defaultCourse = {
    id: courseId,
    courseName: '语言学习课程',
    unitTitle: '单元 ' + (unitId || 'default'),
    content: '<p>这是课程的详细内容，包含学习说明和文本资料。</p>',
    tracks: [
      {
        id: 'demo_track_1',
        title: '示例音频 1',
        chineseName: '基础听力练习',
        duration: 125,
        sortOrder: 1
      },
      {
        id: 'demo_track_2',
        title: '示例音频 2',
        chineseName: '对话练习',
        duration: 180,
        sortOrder: 2
      },
      {
        id: 'demo_track_3',
        title: '示例音频 3',
        chineseName: '发音训练',
        duration: 95,
        sortOrder: 3
      }
    ],
    unitId: unitId || 'default_unit'
  };
  
  // 尝试匹配请求的课程，如果没有找到则返回默认数据
  return mockCourses[courseId] || defaultCourse;
}

/**
 * 获取用户的所有课程
 * @returns {Promise<Array>} 课程列表
 */
export async function getUserCourses() {
  try {
    // 检查是否使用模拟数据
    if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true') {
      return getMockUserCourses();
    }
    
    const response = await fetch('/api/courses', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch courses');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching user courses:', error);
    
    // 开发环境下返回模拟数据
    if (process.env.NODE_ENV === 'development') {
      return getMockUserCourses();
    }
    
    throw error;
  }
}

/**
 * 模拟用户课程数据
 */
function getMockUserCourses() {
  return {
    courses: [
      {
        id: 'course_1',
        title: '英语（PEP）',
        level: '初级',
        description: '适合小学二年级学生的英语教材，PEP版本',
        language: '英语',
        coverImage: '/images/english_course.jpg'
      },
      {
        id: 'course_2',
        title: '日语初级',
        level: '入门',
        description: '日语入门课程，掌握基本的日常会话和简单语法',
        language: '日语',
        coverImage: '/images/japanese_course.jpg'
      }
    ]
  };
}

/**
 * 更新学习进度
 * @param {string} trackId - 音轨ID
 * @param {number} position - 播放位置（秒）
 * @param {number} completionRate - 完成率（0-100）
 */
export async function updateProgress(trackId, position, completionRate) {
  try {
    // 开发环境模拟成功
    if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true') {
      console.log('模拟更新进度:', { trackId, position, completionRate });
      return true;
    }
    
    const response = await fetch('/api/track-progress', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        trackId,
        position,
        completionRate
      }),
    });
    
    if (!response.ok) {
      throw new Error('更新进度请求失败');
    }
    
    return true;
  } catch (error) {
    console.error('更新进度失败:', error);
    return false;
  }
}

/**
 * 获取最近播放的音轨
 * @returns {Promise<Array>} 最近播放的音轨列表
 */
export async function getRecentTracks() {
  try {
    // 开发环境模拟数据
    if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true') {
      return getMockRecentTracks();
    }
    
    const response = await fetch('/api/recent-tracks', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('获取最近播放记录失败');
    }

    return await response.json();
  } catch (error) {
    console.error('获取最近播放记录错误:', error);
    
    // 开发环境下返回模拟数据
    if (process.env.NODE_ENV === 'development') {
      return getMockRecentTracks();
    }
    
    return { tracks: [] };
  }
}

/**
 * 模拟最近播放记录
 */
function getMockRecentTracks() {
  return {
    tracks: [
      {
        id: 'track_1_1',
        title: 'Unit 1 - Part A',
        courseId: 'course_1',
        unitId: 'unit_1',
        lastPosition: 45.5,
        lastAccessed: new Date().toISOString(),
        courseName: '英语（PEP）'
      },
      {
        id: 'track_2_1',
        title: 'あいさつ',
        courseId: 'course_2',
        unitId: 'unit_1',
        lastPosition: 23.7,
        lastAccessed: new Date(Date.now() - 86400000).toISOString(), // 1天前
        courseName: '日语初级'
      }
    ]
  };
} 