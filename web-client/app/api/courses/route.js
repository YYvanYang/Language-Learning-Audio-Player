export async function GET(request) {
  try {
    console.log('API路由收到课程请求');
    
    // 获取auth_token cookie
    const cookieHeader = request.headers.get('cookie') || '';
    
    // 使用环境变量或默认值构建后端URL
    const backendBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
    const backendUrl = `${backendBaseUrl}/api/courses`;
    console.log('转发请求到:', backendUrl);
    
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Cookie': cookieHeader // 传递cookie
      },
      cache: 'no-store' // 确保每次都获取最新数据
    });
    
    console.log('后端响应状态:', response.status);
    
    if (!response.ok) {
      console.error('后端响应错误:', response.status, response.statusText);
      
      let errorData = { message: '服务器错误' };
      try {
        errorData = await response.json();
      } catch (e) {
        console.error('解析错误响应失败:', e);
      }
      
      return Response.json({
        error: errorData.message || `请求失败: ${response.status}`,
        courses: [] // 返回空数组而不是null，避免前端解构错误
      }, { status: response.status });
    }
    
    // 获取响应数据
    const data = await response.json();
    console.log('成功获取课程数据，课程数量:', data.courses?.length || 0);
    
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