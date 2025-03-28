import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // 获取认证Cookie
    const authToken = request.cookies.get('auth_token')?.value;
    
    // 如果没有认证Token，返回未认证
    if (!authToken) {
      return NextResponse.json(
        { valid: false, error: '未认证' },
        { status: 401 }
      );
    }
    
    // 构建请求URL
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8080';
    const url = `${backendUrl}/api/auth/validate`;
    
    // 转发请求到后端
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Cookie': `auth_token=${authToken}`,
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    // 获取响应数据
    const data = await response.json();
    
    // 如果请求失败，返回错误
    if (!response.ok) {
      return NextResponse.json(
        { valid: false, error: data.error || '验证失败' },
        { status: response.status }
      );
    }
    
    // 返回验证结果
    return NextResponse.json({
      valid: true,
      user: data.user
    });
  } catch (error) {
    console.error('会话验证错误:', error);
    return NextResponse.json(
      { valid: false, error: '服务器内部错误' },
      { status: 500 }
    );
  }
} 