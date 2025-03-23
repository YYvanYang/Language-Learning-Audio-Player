'use client';

import { createRoot } from 'react-dom/client';
import { CheckCircle, AlertCircle, XCircle, Info, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const VARIANTS = {
  success: {
    icon: CheckCircle,
    bgColor: 'bg-green-50',
    borderColor: 'border-green-400',
    textColor: 'text-green-800',
    iconColor: 'text-green-400',
  },
  error: {
    icon: XCircle,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-400',
    textColor: 'text-red-800',
    iconColor: 'text-red-400',
  },
  warning: {
    icon: AlertCircle,
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-400',
    textColor: 'text-yellow-800',
    iconColor: 'text-yellow-400',
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-400',
    textColor: 'text-blue-800',
    iconColor: 'text-blue-400',
  },
};

export const ToastContainer = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} {...toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

export const ToastItem = ({
  variant = 'info',
  title,
  description,
  onClose,
  duration = 5000,
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const { icon: Icon, bgColor, borderColor, textColor, iconColor } = VARIANTS[variant] || VARIANTS.info;

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsClosing(true);
      setTimeout(onClose, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      className={`${bgColor} border-l-4 ${borderColor} p-4 rounded shadow-md
                 transition-all duration-300 ${isClosing ? 'opacity-0 -translate-x-2' : 'opacity-100'}`}
    >
      <div className="flex">
        <div className={`flex-shrink-0 ${iconColor}`}>
          <Icon size={20} />
        </div>
        <div className="ml-3 flex-1">
          {title && <h3 className={`text-sm font-medium ${textColor}`}>{title}</h3>}
          {description && <div className={`mt-1 text-sm ${textColor}`}>{description}</div>}
        </div>
        <button
          onClick={() => {
            setIsClosing(true);
            setTimeout(onClose, 300);
          }}
          className={`flex-shrink-0 ml-auto ${textColor} hover:text-gray-500 focus:outline-none`}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

let toastRoot;
let toastContainer;

// 创建全局 Toast 容器
const createToastContainer = () => {
  // 如果容器已存在，直接返回
  if (toastContainer) {
    return toastContainer;
  }

  // 检查 DOM 是否可用（客户端渲染）
  if (typeof document !== 'undefined') {
    // 创建容器元素
    const containerElement = document.createElement('div');
    containerElement.id = 'toast-container';
    document.body.appendChild(containerElement);

    // 创建根 React 节点
    toastRoot = createRoot(containerElement);
    
    // 初始化 toasts 状态
    let toasts = [];
    
    // 创建 toast 容器组件
    toastContainer = {
      add: (toast) => {
        const id = Date.now().toString();
        toasts = [...toasts, { ...toast, id }];
        toastRoot.render(<ToastContainer toasts={toasts} removeToast={toastContainer.remove} />);
        return id;
      },
      remove: (id) => {
        toasts = toasts.filter((toast) => toast.id !== id);
        toastRoot.render(<ToastContainer toasts={toasts} removeToast={toastContainer.remove} />);
      },
      clear: () => {
        toasts = [];
        toastRoot.render(<ToastContainer toasts={toasts} removeToast={toastContainer.remove} />);
      },
    };
  }

  return toastContainer;
};

export const toast = (options) => {
  // 确保只在客户端渲染
  if (typeof window === 'undefined') {
    return;
  }

  // 获取或创建容器
  const container = createToastContainer();
  
  // 添加 toast
  if (container) {
    return container.add(typeof options === 'string' 
      ? { description: options, variant: 'info' } 
      : options
    );
  }
};

// 添加便捷方法
toast.success = (options) => {
  const config = typeof options === 'string' 
    ? { description: options } 
    : options;
  
  return toast({ ...config, variant: 'success' });
};

toast.error = (options) => {
  const config = typeof options === 'string' 
    ? { description: options } 
    : options;
  
  return toast({ ...config, variant: 'error' });
};

toast.warning = (options) => {
  const config = typeof options === 'string' 
    ? { description: options } 
    : options;
  
  return toast({ ...config, variant: 'warning' });
};

toast.info = (options) => {
  const config = typeof options === 'string' 
    ? { description: options } 
    : options;
  
  return toast({ ...config, variant: 'info' });
};

export default toast; 