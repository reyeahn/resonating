// next.js app wrapper and global providers
import React, { useEffect, useState } from 'react';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import AppLayout from '@/components/layout/AppLayout';
import '@/styles/globals.css';

// define non-authenticated routes
const publicRoutes = ['/', '/login', '/signup'];

// define routes that should hide the navigation
const noNavRoutes = ['/chat/[matchId]'];

function MyApp({ Component, pageProps }: AppProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const router = useRouter();

  const isPublicRoute = publicRoutes.includes(router.pathname);
  
  const hideNav = noNavRoutes.some(route => {
    if (route.includes('[') && route.includes(']')) {
      // for dynamic routes, use a regex pattern
      const regex = new RegExp('^' + route.replace(/\[.*?\]/g, '[^/]+') + '$');
      return regex.test(router.pathname);
    }
    return route === router.pathname;
  });

  // initialize theme from user preferences or localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    } else {
      setTheme('light');
    }
  }, []);

  // apply theme to document
  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // toggle theme function
  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };
  return (
    <div className={theme === 'dark' ? 'dark' : 'light'}>
      <AppLayout hideNav={hideNav || isPublicRoute} title="Resonate">
        <Component {...pageProps} toggleTheme={toggleTheme} />
      </AppLayout>
    </div>
  );
}

export default MyApp; 