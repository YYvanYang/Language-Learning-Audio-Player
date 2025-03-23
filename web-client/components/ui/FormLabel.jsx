'use client';

import React from 'react';

const FormLabel = ({
  htmlFor,
  children,
  className = '',
  required = false,
}) => {
  return (
    <label
      htmlFor={htmlFor}
      className={`block mb-2 text-sm font-medium text-gray-700 ${className}`}
    >
      {children}
      {required && <span className="ml-1 text-red-500">*</span>}
    </label>
  );
};

export default FormLabel; 