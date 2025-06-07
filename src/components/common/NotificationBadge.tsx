import React from 'react';
import { FaBell } from 'react-icons/fa';

// unread count indicator badge
interface NotificationBadgeProps {
  count: number;
  className?: string;
}

const NotificationBadge: React.FC<NotificationBadgeProps> = ({ count, className = '' }) => {
  if (count === 0) return null;

  return (
    <div className={`relative inline-block ${className}`}>
      <FaBell className="h-5 w-5 text-gray-600 dark:text-gray-400" />
      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
        {count > 99 ? '99+' : count}
      </span>
    </div>
  );
};

export default NotificationBadge; 