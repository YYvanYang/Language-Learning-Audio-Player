'use client';

import React, { forwardRef } from 'react';

const Input = forwardRef(({
  type = 'text',
  placeholder = '',
  value,
  onChange,
  disabled = false,
  error = false,
  className = '',
  ...props
}, ref) => {
  return (
    <input
      ref={ref}
      type={type}
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      className={`
        w-full px-3 py-2 border rounded-md transition-colors duration-200
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
        ${error ? 'border-red-500' : 'border-gray-300'} 
        ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
        ${className}
      `}
      {...props}
    />
  );
});

Input.displayName = 'Input';

export default Input; 