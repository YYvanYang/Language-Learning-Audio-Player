import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // 获取认证Cookie
    const authToken = request.cookies.get('auth_token')?.value;
    
    // 构建请求URL
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8080';
    const url = `${backendUrl}/api/auth/logout`;
    
    // 转发请求到后端
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Cookie': authToken ? `auth_token=${authToken}` : '',
        'Authorization': authToken ? `Bearer ${authToken}` : ''
      }
    });
    
    // 创建响应
    const result = NextResponse.json(
      { message: '注销成功' },
      { status: 200 }
    );
    
    // 删除认证Cookie
    result.cookies.delete('auth_token');
    
    return result;
  } catch (error) {
    console.error('注销API路由错误:', error);
    
    // 创建错误响应
    const result = NextResponse.json(
      { message: '注销成功' }, // 即使发生错误，也返回成功消息
      { status: 200 }
    );
    
    // 删除认证Cookie
    result.cookies.delete('auth_token');
    
    return result;
  }
} 