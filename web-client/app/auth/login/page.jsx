'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import FormLabel from '@/components/ui/FormLabel';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/Card';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';
  const { login } = useAuth();
  
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  
  const [isLoading, setIsLoading] = useState(false);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.username || !formData.password) {
      toast.error('请填写用户名和密码');
      return;
    }
    
    try {
      setIsLoading(true);
      
      const result = await login(formData.username, formData.password);
      
      if (result.success) {
        toast.success('登录成功！');
        router.push(redirect);
      } else {
        toast.error(result.message || '登录失败，请检查用户名和密码');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('登录过程中发生错误，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">登录您的账户</h2>
          <p className="mt-2 text-sm text-gray-600">
            或{' '}
            <Link href="/auth/register" className="text-blue-600 hover:text-blue-500">
              注册新账户
            </Link>
          </p>
        </div>
        
        <Card>
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <FormLabel htmlFor="username" required>用户名</FormLabel>
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    required
                    value={formData.username}
                    onChange={handleChange}
                    placeholder="请输入用户名"
                  />
                </div>
                
                <div>
                  <FormLabel htmlFor="password" required>密码</FormLabel>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="请输入密码"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                      记住我
                    </label>
                  </div>
                  
                  <div className="text-sm">
                    <Link href="/auth/forgot-password" className="text-blue-600 hover:text-blue-500">
                      忘记密码?
                    </Link>
                  </div>
                </div>
              </div>
            </CardContent>
            
            <CardFooter>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? '登录中...' : '登录'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
} 