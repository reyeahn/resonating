import React, { ReactNode } from 'react';
import Head from 'next/head';
import BottomNav from './BottomNav';
import { useAuth } from '@/hooks/useAuth';

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
  hideNav?: boolean;
}

// main app layout wrapper
const AppLayout: React.FC<AppLayoutProps> = ({ 
  children, 
  title = 'MusicConnect',
  hideNav = false
}) => {
  const { user } = useAuth();
  
  // only show navigation when user is logged in
  const showNav = user && !hideNav;
  
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content="Connect with others through music" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>
      
      <main className={`${showNav ? 'pb-16' : ''}`}>
        {children}
      </main>
      
      {showNav && <BottomNav />}
    </>
  );
};

export default AppLayout; 