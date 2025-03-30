// app/api/mockHandler.js
// 前端开发阶段模拟API处理器

/**
 * 根据环境变量决定是否启用模拟数据
 */
export function isMockEnabled() {
  return process.env.NODE_ENV === 'development' && 
         process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';
}

/**
 * 创建模拟响应
 * @param {object} data - 响应数据
 * @param {number} status - HTTP状态码 
 * @param {object} headers - 响应头
 * @returns {Response} - Fetch API响应对象
 */
export function createMockResponse(data, status = 200, headers = {}) {
  const delay = parseInt(process.env.NEXT_PUBLIC_MOCK_DELAY || '200', 10);
  
  // 延迟响应，模拟网络延迟
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(new Response(JSON.stringify(data), {
        status,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      }));
    }, delay);
  });
}

/**
 * 课程相关模拟数据
 */
export const mockCourses = {
  'course_1': {
    id: 'course_1',
    title: '英语（PEP）',
    description: '小学二年级英语教材，包含基础词汇和简单对话',
    level: '初级',
    language: '英语',
    instructor: '王小明',
    totalDuration: '10小时',
    coverImage: '/images/courses/english_basic.jpg',
    units: [
      {
        id: 'unit_1',
        title: 'Unit 1 - Put on my coat!',
        description: '本单元学习与穿衣相关的常用词汇和表达',
        trackCount: 3,
        duration: '45分钟'
      },
      {
        id: 'unit_2',
        title: 'Unit 2 - This is my sister',
        description: '学习家庭成员相关词汇和介绍家人的表达',
        trackCount: 4,
        duration: '50分钟'
      }
    ]
  },
  'course_2': {
    id: 'course_2',
    title: '日语初级',
    description: '日语入门课程，掌握基本的日常会话和简单语法',
    level: '入门',
    language: '日语',
    instructor: '佐藤健太',
    totalDuration: '12小时',
    coverImage: '/images/courses/japanese_basic.jpg',
    units: [
      {
        id: 'unit_1',
        title: '第一課 - 自己紹介',
        description: '学习自我介绍和基本问候语',
        trackCount: 3,
        duration: '40分钟'
      },
      {
        id: 'unit_2',
        title: '第二課 - 買い物',
        description: '学习购物相关的表达和词汇',
        trackCount: 3,
        duration: '45分钟'
      }
    ]
  }
};

/**
 * 单元音轨数据
 */
export const mockUnitTracks = {
  'course_1': {
    'unit_1': {
      course: {
        id: 'course_1',
        title: '英语（PEP）'
      },
      unit: {
        id: 'unit_1',
        title: 'Unit 1 - Put on my coat!',
        content: '<p>本单元重点学习与穿衣相关的词汇和简单对话，帮助学生掌握日常用语。</p><p>请跟随音频练习发音和对话。</p>'
      },
      tracks: [
        {
          id: 'track_1_1',
          title: 'Listen and say',
          chineseName: '听一听，说一说',
          duration: 125,
          sortOrder: 1
        },
        {
          id: 'track_1_2',
          title: 'Listen and number',
          chineseName: '听一听，标序号',
          duration: 180,
          sortOrder: 2
        },
        {
          id: 'track_1_3',
          title: 'Chant: Put on my coat',
          chineseName: '儿歌：穿上我的外套',
          duration: 95,
          sortOrder: 3
        }
      ]
    },
    'unit_2': {
      course: {
        id: 'course_1',
        title: '英语（PEP）'
      },
      unit: {
        id: 'unit_2',
        title: 'Unit 2 - This is my sister',
        content: '<p>本单元学习家庭成员相关词汇和介绍家人的表达方式。</p>'
      },
      tracks: [
        {
          id: 'track_2_1',
          title: 'Listen and say',
          chineseName: '听一听，说一说',
          duration: 135,
          sortOrder: 1
        },
        {
          id: 'track_2_2',
          title: 'Listen and match',
          chineseName: '听一听，连一连',
          duration: 160,
          sortOrder: 2
        },
        {
          id: 'track_2_3',
          title: 'Listen and chant',
          chineseName: '听一听，唱一唱',
          duration: 115,
          sortOrder: 3
        },
        {
          id: 'track_2_4',
          title: 'Read and act',
          chineseName: '读一读，演一演',
          duration: 140,
          sortOrder: 4
        }
      ]
    }
  },
  'course_2': {
    'unit_1': {
      course: {
        id: 'course_2',
        title: '日语初级'
      },
      unit: {
        id: 'unit_1',
        title: '第一課 - 自己紹介',
        content: '<p>本课学习日语自我介绍的表达方式和基本问候语。</p>'
      },
      tracks: [
        {
          id: 'track_2_1_1',
          title: 'あいさつ',
          chineseName: '问候语',
          duration: 145,
          sortOrder: 1
        },
        {
          id: 'track_2_1_2',
          title: '自己紹介',
          chineseName: '自我介绍',
          duration: 210,
          sortOrder: 2
        },
        {
          id: 'track_2_1_3',
          title: '会話練習',
          chineseName: '对话练习',
          duration: 185,
          sortOrder: 3
        }
      ]
    }
  }
};

/**
 * 用户学习进度数据
 */
export const mockUserProgress = {
  recentTracks: [
    {
      id: 'track_1_1',
      title: 'Listen and say',
      courseId: 'course_1',
      unitId: 'unit_1',
      lastPosition: 45.5,
      lastAccessed: new Date().toISOString(),
      courseName: '英语（PEP）'
    },
    {
      id: 'track_2_1_1',
      title: 'あいさつ',
      courseId: 'course_2',
      unitId: 'unit_1',
      lastPosition: 23.7,
      lastAccessed: new Date(Date.now() - 86400000).toISOString(), // 1天前
      courseName: '日语初级'
    }
  ],
  trackProgress: {}
};

// 添加或更新音轨进度
export function updateTrackProgress(trackId, position, completionRate) {
  mockUserProgress.trackProgress[trackId] = {
    position,
    completionRate,
    lastUpdated: new Date().toISOString()
  };
  
  // 更新最近播放列表
  const existingTrackIndex = mockUserProgress.recentTracks.findIndex(t => t.id === trackId);
  
  if (existingTrackIndex >= 0) {
    // 更新现有条目
    mockUserProgress.recentTracks[existingTrackIndex].lastPosition = position;
    mockUserProgress.recentTracks[existingTrackIndex].lastAccessed = new Date().toISOString();
    
    // 移动到列表顶部
    const track = mockUserProgress.recentTracks.splice(existingTrackIndex, 1)[0];
    mockUserProgress.recentTracks.unshift(track);
  }
  
  return true;
}

/**
 * 用户自定义音轨数据
 */
export const mockCustomTracks = {
  'course_1': {
    'unit_1': [
      {
        id: 'custom_1_1_1',
        title: '自定义音频 1',
        chineseName: '用户上传音频',
        duration: 185,
        custom: true,
        sortOrder: 4
      }
    ],
    'unit_1_1': [
      {
        id: 'custom_1_1_1',
        title: '自定义音频 1',
        chineseName: '用户上传音频',
        duration: 185,
        custom: true,
        sortOrder: 4
      }
    ],
    'unit_2': []
  },
  'course_2': {
    'unit_1': [
      {
        id: 'custom_2_1_1',
        title: '日语自学音频',
        chineseName: '补充练习',
        duration: 240,
        custom: true,
        sortOrder: 4
      }
    ],
    'unit_2': []
  }
};

/**
 * 处理模拟API请求
 * @param {Request} request - 请求对象
 * @param {string} url - 请求URL
 * @returns {Response|null} - 如果可以处理则返回响应，否则返回null
 */
export async function handleMockRequest(request, url) {
  // 如果模拟数据被禁用，返回null让实际API处理
  if (!isMockEnabled()) {
    return null;
  }
  
  // 解析URL路径
  const urlObj = new URL(url);
  const path = urlObj.pathname;
  
  console.log('模拟API处理:', path);
  
  // 处理课程列表请求
  if (path === '/api/courses' && request.method === 'GET') {
    return createMockResponse({
      courses: Object.values(mockCourses)
    });
  }
  
  // 处理课程详情请求
  const coursesMatch = path.match(/^\/api\/courses\/([^\/]+)$/);
  if (coursesMatch && request.method === 'GET') {
    const courseId = coursesMatch[1];
    const course = mockCourses[courseId];
    
    if (course) {
      return createMockResponse(course);
    }
    return createMockResponse({ error: '课程不存在' }, 404);
  }
  
  // 处理课程单元请求
  const unitsMatch = path.match(/^\/api\/courses\/([^\/]+)\/units$/);
  if (unitsMatch && request.method === 'GET') {
    const courseId = unitsMatch[1];
    const course = mockCourses[courseId];
    
    if (course) {
      return createMockResponse({
        units: course.units || []
      });
    }
    return createMockResponse({ error: '课程不存在' }, 404);
  }
  
  // 处理单元音轨请求
  const tracksMatch = path.match(/^\/api\/courses\/([^\/]+)\/units\/([^\/]+)\/tracks$/);
  if (tracksMatch && request.method === 'GET') {
    const courseId = tracksMatch[1];
    const unitId = tracksMatch[2];
    
    if (mockUnitTracks[courseId] && mockUnitTracks[courseId][unitId]) {
      return createMockResponse(mockUnitTracks[courseId][unitId]);
    }
    return createMockResponse({ error: '单元不存在' }, 404);
  }
  
  // 处理自定义音轨请求
  const customTracksMatch = path.match(/^\/api\/course\/([^\/]+)\/unit\/([^\/]+)\/custom-tracks$/);
  if (customTracksMatch && request.method === 'GET') {
    const courseId = customTracksMatch[1];
    const unitId = customTracksMatch[2];
    
    // 尝试获取课程和单元的自定义音轨
    const tracks = (mockCustomTracks[courseId] && mockCustomTracks[courseId][unitId]) || [];
    
    return createMockResponse({
      tracks: tracks
    });
  }
  
  // 处理最近播放记录请求
  if (path === '/api/recent-tracks' && request.method === 'GET') {
    return createMockResponse({
      tracks: mockUserProgress.recentTracks
    });
  }
  
  // 处理进度更新请求
  if (path === '/api/track-progress' && request.method === 'POST') {
    try {
      const { trackId, position, completionRate } = await request.json();
      updateTrackProgress(trackId, position, completionRate);
      return createMockResponse({ success: true });
    } catch {
      return createMockResponse({ error: '无效的请求数据' }, 400);
    }
  }
  
  // 处理音频上传请求
  if (path === '/api/audio/upload' && request.method === 'POST') {
    try {
      // 模拟处理上传请求
      // 在实际应用中，这里会处理文件上传并返回处理结果
      return createMockResponse({
        success: true,
        trackId: 'custom_' + Math.random().toString(36).substring(2, 10),
        title: '新上传的音频',
        duration: Math.floor(Math.random() * 300) + 60 // 随机60-360秒
      });
    } catch {
      return createMockResponse({ error: '音频上传处理失败' }, 500);
    }
  }
  
  // 不处理的请求返回null
  return null;
} 