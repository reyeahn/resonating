import React, { InputHTMLAttributes, forwardRef } from 'react';

// styled input field component
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  helperText?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, leftIcon, rightIcon, helperText, className = '', ...rest }, ref) => {
    const baseClasses = 'w-full rounded-md border-gray-300 shadow-sm focus:border-primary-300 focus:ring focus:ring-primary-200 focus:ring-opacity-50 bg-white dark:bg-dark-100 dark:border-dark-300 dark:text-light-300';
    const errorClasses = error ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : '';
    const leftIconClasses = leftIcon ? 'pl-10' : '';
    const rightIconClasses = rightIcon ? 'pr-10' : '';
    
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={rest.id} className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            {label}
          </label>
        )}
        
        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {leftIcon}
            </div>
          )}
          
          <input
            ref={ref}
            className={`${baseClasses} ${errorClasses} ${leftIconClasses} ${rightIconClasses} ${className}`}
            {...rest}
          />
          
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              {rightIcon}
            </div>
          )}
        </div>
        
        {error ? (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : helperText ? (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input; 