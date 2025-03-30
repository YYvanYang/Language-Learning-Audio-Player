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
    // 获取课程详情
    const courseResponse = await fetch(`/api/courses/${courseId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!courseResponse.ok) {
      throw new Error(`课程请求失败: ${courseResponse.status}`);
    }

    const courseData = await courseResponse.json();

    // 获取单元详情
    const unitResponse = await fetch(`/api/courses/${courseId}/units/${unitId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!unitResponse.ok) {
      throw new Error(`单元请求失败: ${unitResponse.status}`);
    }

    const unitData = await unitResponse.json();

    // 获取单元音轨
    const tracksResponse = await fetch(`/api/courses/${courseId}/units/${unitId}/tracks`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!tracksResponse.ok) {
      throw new Error(`音轨请求失败: ${tracksResponse.status}`);
    }

    const tracksData = await tracksResponse.json();

    // 合并数据，返回前端需要的格式
    return {
      id: courseId,
      courseName: courseData.title || '语言学习课程',
      unitTitle: unitData.title || '单元内容',
      content: unitData.content || '<p>课程内容将在这里显示</p>',
      tracks: tracksData.tracks || [],
      unitId: unitId
    };
  } catch (error) {
    console.error('获取课程数据时发生错误:', error);
    
    // 开发环境下自动返回模拟数据作为后备
    if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true') {
      console.log('API请求失败，使用模拟数据...');
      return getMockCourseData(courseId, unitId);
    }
    
    throw error;
  }
}

/**
 * 获取音频访问令牌
 * @param {string} trackId - 音轨ID
 * @returns {Promise<string>} 访问令牌
 */
export async function getAudioToken(trackId, courseId, unitId) {
  try {
    const response = await fetch(`/api/audio/token/${trackId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        courseId,
        unitId,
        trackId,
        action: 'stream_audio'
      })
    });

    if (!response.ok) {
      throw new Error(`获取音频令牌失败: ${response.status}`);
    }

    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error('获取音频令牌失败:', error);
    throw error;
  }
}

/**
 * 获取自定义音轨
 * @param {string} courseId - 课程ID
 * @param {string} unitId - 单元ID
 * @returns {Promise<Array>} 自定义音轨列表
 */
export async function getCustomTracks(courseId, unitId) {
  try {
    const response = await fetch(`/api/courses/${courseId}/units/${unitId}/custom-tracks`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`获取自定义音轨失败: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('获取自定义音轨失败:', error);
    
    // 开发环境下返回模拟数据
    if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true') {
      return { tracks: [] };
    }
    
    return { tracks: [] }; // 失败时返回空数组
  }
}

/**
 * 上传自定义音频
 * @param {FormData} formData - 包含音频文件和元数据的表单数据
 * @returns {Promise<Object>} 上传结果
 */
export async function uploadAudio(formData) {
  try {
    const response = await fetch('/api/audio/upload', {
      method: 'POST',
      credentials: 'include',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`上传音频失败: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('上传音频失败:', error);
    throw error;
  }
}

/**
 * 获取用户的所有课程
 * @returns {Promise<Array>} 课程列表
 */
export async function getUserCourses() {
  try {
    const response = await fetch('/api/courses', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('获取课程列表失败');
    }

    return await response.json();
  } catch (error) {
    console.error('获取课程列表错误:', error);
    
    // 开发环境下返回模拟数据
    if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true') {
      return getMockUserCourses();
    }
    
    throw error;
  }
}

/**
 * 更新学习进度
 * @param {string} trackId - 音轨ID
 * @param {number} position - 播放位置（秒）
 * @param {number} completionRate - 完成率（0-100）
 */
export async function updateProgress(trackId, position, completionRate) {
  try {
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
    if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true') {
      return getMockRecentTracks();
    }
    
    return { tracks: [] };
  }
}

// 以下保留mock数据函数用于开发环境

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