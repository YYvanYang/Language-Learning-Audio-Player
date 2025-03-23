'use client';

import React from 'react';

export const Card = ({ 
  children, 
  className = '' 
}) => {
  return (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden ${className}`}>
      {children}
    </div>
  );
};

export const CardHeader = ({ 
  children, 
  className = '' 
}) => {
  return (
    <div className={`px-6 py-4 border-b border-gray-200 ${className}`}>
      {children}
    </div>
  );
};

export const CardTitle = ({ 
  children, 
  className = '' 
}) => {
  return (
    <h3 className={`text-xl font-semibold text-gray-800 ${className}`}>
      {children}
    </h3>
  );
};

export const CardContent = ({ 
  children, 
  className = '' 
}) => {
  return (
    <div className={`px-6 py-4 ${className}`}>
      {children}
    </div>
  );
};

export const CardFooter = ({ 
  children, 
  className = '' 
}) => {
  return (
    <div className={`px-6 py-4 bg-gray-50 border-t border-gray-200 ${className}`}>
      {children}
    </div>
  );
};

// 导出所有卡片组件
export default {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter
}; 