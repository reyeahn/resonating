import React from 'react';

// content container with responsive padding
interface ContainerProps {
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  className?: string;
}

const Container: React.FC<ContainerProps> = ({
  children,
  maxWidth = 'xl',
  className = '',
}) => {
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    full: 'max-w-full',
  };

  return (
    <div className={`w-full mx-auto px-4 sm:px-6 ${maxWidthClasses[maxWidth]} ${className}`}>
      {children}
    </div>
  );
};

export default Container; 