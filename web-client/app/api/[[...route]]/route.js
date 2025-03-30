// app/api/[[...route]]/route.js
// API路由处理器

import { handleMockRequest } from '../mockHandler';

/**
 * 通用API请求处理函数
 * 如果启用了模拟数据，则使用模拟处理器处理请求
 * 否则转发到实际的后端API
 */
export async function GET(request, { params }) {
  // 尝试使用模拟处理器处理请求
  const mockResponse = await handleMockRequest(request, request.url);
  if (mockResponse) {
    return mockResponse;
  }
  
  // 如果模拟处理器未处理，则转发到实际后端
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';
  const backendUrl = `${apiBaseUrl}/${params.route?.join('/') || ''}`;
  
  try {
    // 创建发送到后端的请求
    const backendRequest = new Request(backendUrl, {
      method: request.method,
      headers: request.headers,
      body: request.method === 'GET' ? undefined : await request.blob(),
      cache: 'no-store'
    });
    
    // 发送请求到后端
    const response = await fetch(backendRequest);
    return response;
  } catch (error) {
    console.error(`API请求失败: ${backendUrl}`, error);
    return new Response(JSON.stringify({ error: '服务器连接失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST请求处理函数
 */
export async function POST(request, { params }) {
  // 尝试使用模拟处理器处理请求
  const mockResponse = await handleMockRequest(request, request.url);
  if (mockResponse) {
    return mockResponse;
  }
  
  // 如果模拟处理器未处理，则转发到实际后端
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';
  const backendUrl = `${apiBaseUrl}/${params.route?.join('/') || ''}`;
  
  try {
    // 创建发送到后端的请求
    const backendRequest = new Request(backendUrl, {
      method: 'POST',
      headers: request.headers,
      body: await request.blob(),
      cache: 'no-store'
    });
    
    // 发送请求到后端
    const response = await fetch(backendRequest);
    return response;
  } catch (error) {
    console.error(`API请求失败: ${backendUrl}`, error);
    return new Response(JSON.stringify({ error: '服务器连接失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * PUT请求处理函数
 */
export async function PUT(request, { params }) {
  // 处理方式与POST类似
  return handleRequest(request, params, 'PUT');
}

/**
 * DELETE请求处理函数
 */
export async function DELETE(request, { params }) {
  // 处理方式与POST类似，但通常没有请求体
  return handleRequest(request, params, 'DELETE');
}

/**
 * 通用请求处理辅助函数
 */
async function handleRequest(request, params, method) {
  // 尝试使用模拟处理器处理请求
  const mockResponse = await handleMockRequest(request, request.url);
  if (mockResponse) {
    return mockResponse;
  }
  
  // 如果模拟处理器未处理，则转发到实际后端
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';
  const backendUrl = `${apiBaseUrl}/${params.route?.join('/') || ''}`;
  
  try {
    // 创建发送到后端的请求
    const backendRequest = new Request(backendUrl, {
      method,
      headers: request.headers,
      body: ['GET', 'HEAD'].includes(method) ? undefined : await request.blob(),
      cache: 'no-store'
    });
    
    // 发送请求到后端
    const response = await fetch(backendRequest);
    return response;
  } catch (error) {
    console.error(`API请求失败: ${backendUrl}`, error);
    return new Response(JSON.stringify({ error: '服务器连接失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 