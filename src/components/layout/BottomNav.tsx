// mobile navigation bar component
import React from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { FaMusic, FaCompass, FaUserFriends, FaUser, FaUsers } from 'react-icons/fa';
import { useAuth } from '@/hooks/useAuth';

const BottomNav: React.FC = () => {
  const router = useRouter();
  const { userData } = useAuth();
  
  const isActive = (path: string) => router.pathname === path;
  
  const navItems = [
    {
      label: 'Post',
      icon: <FaMusic />,
      href: '/post-song',
      disabled: userData?.hasPostedToday === true,
    },
    {
      label: 'Discover',
      icon: <FaCompass />,
      href: '/discover',
      disabled: userData?.hasPostedToday === false,
    },
    {
      label: 'Matches',
      icon: <FaUserFriends />,
      href: '/matches',
      disabled: false,
    },
    {
      label: 'Friends',
      icon: <FaUsers />,
      href: '/friends',
      disabled: false,
    },
    {
      label: 'Profile',
      icon: <FaUser />,
      href: '/profile',
      disabled: false,
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-dark-200 shadow-top z-50">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => (
          <Link 
            key={item.href}
            href={item.disabled ? '#' : item.href}
            className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
              isActive(item.href)
                ? 'text-primary-600 dark:text-primary-400'
                : 'text-gray-500 dark:text-gray-400'
            } ${
              item.disabled
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:text-primary-600 dark:hover:text-primary-400'
            }`}
            onClick={(e) => {
              if (item.disabled) {
                e.preventDefault();
                if (item.href === '/post-song') {
                  alert('You have already posted a song today. Come back tomorrow!');
                } else if (item.href === '/discover') {
                  alert('You need to post a song first before discovering others!');
                }
              }
            }}
          >
            <div className="text-lg">{item.icon}</div>
            <span className="text-xs mt-1">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default BottomNav; 