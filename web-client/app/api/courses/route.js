export async function GET(request) {
  try {
    console.log('API路由收到课程请求');
    
    // 获取auth_token cookie
    const cookieHeader = request.headers.get('cookie') || '';
    
    // 转发请求到后端
    const backendUrl = 'http://localhost:8080/api/courses';
    console.log('转发请求到:', backendUrl);
    
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cookie': cookieHeader // 传递cookie
      }
    });
    
    console.log('后端响应状态:', response.status);
    
    // 获取响应数据
    const data = await response.json();
    
    // 返回响应
    return Response.json(data);
  } catch (error) {
    console.error('课程API路由错误:', error);
    return Response.json({
      error: '获取课程失败',
      message: error.message,
      courses: [], // 返回空数组而不是null，避免前端解构错误
      count: 0
    }, { status: 500 });
  }
} 