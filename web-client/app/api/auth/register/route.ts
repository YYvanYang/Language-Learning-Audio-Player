import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // 获取请求数据
    const body = await request.json();
    console.log('API路由收到注册请求:', body);

    // 构建请求URL
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8080';
    const url = `${backendUrl}/api/auth/register`;
    
    console.log('转发请求到:', url);

    // 转发请求到后端
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: body.email,
        password: body.password,
        name: body.username // 确保使用username字段作为name参数
      }),
    });

    console.log('后端响应状态:', response.status);
    
    // 获取响应数据
    const data = await response.json();
    
    // 如果请求失败，返回错误
    if (!response.ok) {
      console.error('后端注册失败:', data);
      return NextResponse.json(data, { status: response.status });
    }
    
    // 构建成功响应
    const result = NextResponse.json(data);
    
    // 添加认证Cookie
    if (data.token) {
      result.cookies.set({
        name: 'auth_token',
        value: data.token,
        httpOnly: true,
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7天
        sameSite: 'lax',
      });
    }
    
    return result;
  } catch (error) {
    console.error('注册API路由错误:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
} 