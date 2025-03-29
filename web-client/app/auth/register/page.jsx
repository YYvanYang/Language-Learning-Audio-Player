'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import FormLabel from '@/components/ui/FormLabel';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/Card';
import { toast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  
  const [isLoading, setIsLoading] = useState(false);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };
  
  const validateForm = () => {
    if (!formData.username) {
      toast.error('请输入用户名');
      return false;
    }
    
    if (!formData.email) {
      toast.error('请输入电子邮箱');
      return false;
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast.error('请输入有效的电子邮箱地址');
      return false;
    }
    
    if (!formData.password) {
      toast.error('请输入密码');
      return false;
    }
    
    if (formData.password.length < 8) {
      toast.error('密码长度至少为8个字符');
      return false;
    }
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('两次密码输入不一致');
      return false;
    }
    
    return true;
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setIsLoading(true);
      
      const userData = {
        username: formData.username,
        email: formData.email,
        password: formData.password
      };
      
      const result = await register(userData);
      
      if (result.success) {
        toast.success('注册成功！请登录您的账户');
        router.push('/auth/login');
      } else {
        toast.error(result.error || '注册失败，请稍后重试');
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('注册过程中发生错误，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">注册新账户</h2>
          <p className="mt-2 text-sm text-gray-600">
            已有账户?{' '}
            <Link href="/auth/login" className="text-blue-600 hover:text-blue-500">
              登录
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
                    className="text-base px-4 py-3 border border-gray-300 focus:border-blue-500 focus:ring-0 bg-white rounded-md transition-all duration-200 text-gray-900 placeholder:text-gray-400"
                  />
                </div>
                
                <div>
                  <FormLabel htmlFor="email" required>电子邮箱</FormLabel>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="请输入电子邮箱"
                    className="text-base px-4 py-3 border border-gray-300 focus:border-blue-500 focus:ring-0 bg-white rounded-md transition-all duration-200 text-gray-900 placeholder:text-gray-400"
                  />
                </div>
                
                <div>
                  <FormLabel htmlFor="password" required>密码</FormLabel>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="请输入密码（至少8个字符）"
                    className="text-base px-4 py-3 border border-gray-300 focus:border-blue-500 focus:ring-0 bg-white rounded-md transition-all duration-200 text-gray-900 placeholder:text-gray-400"
                  />
                </div>
                
                <div>
                  <FormLabel htmlFor="confirmPassword" required>确认密码</FormLabel>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="请再次输入密码"
                    className="text-base px-4 py-3 border border-gray-300 focus:border-blue-500 focus:ring-0 bg-white rounded-md transition-all duration-200 text-gray-900 placeholder:text-gray-400"
                  />
                </div>
                
                <div>
                  <p className="text-xs text-gray-500">
                    注册即表示您同意我们的{' '}
                    <Link href="/terms" className="text-blue-600 hover:text-blue-500">
                      服务条款
                    </Link>{' '}
                    和{' '}
                    <Link href="/privacy" className="text-blue-600 hover:text-blue-500">
                      隐私政策
                    </Link>
                  </p>
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
                {isLoading ? '注册中...' : '注册'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
} 