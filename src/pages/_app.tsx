import React, { useEffect, useState } from 'react';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import AppLayout from '@/components/layout/AppLayout';
import '@/styles/globals.css';

// Define non-authenticated routes
const publicRoutes = ['/', '/login', '/signup'];

// Define routes that should hide the navigation
const noNavRoutes = ['/chat/[matchId]'];

function MyApp({ Component, pageProps }: AppProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const router = useRouter();

  // Check if route is public or needs authentication
  const isPublicRoute = publicRoutes.includes(router.pathname);
  
  // Check if navigation should be hidden for this route
  const hideNav = noNavRoutes.some(route => {
    if (route.includes('[') && route.includes(']')) {
      // For dynamic routes, use a regex pattern
      const regex = new RegExp('^' + route.replace(/\[.*?\]/g, '[^/]+') + '$');
      return regex.test(router.pathname);
    }
    return route === router.pathname;
  });

  // Initialize theme from user preferences or localStorage
  useEffect(() => {
    // Check for saved theme preference in localStorage
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      // Use system preference as fallback
      setTheme('dark');
    } else {
      setTheme('light');
    }
  }, []);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Toggle theme function
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