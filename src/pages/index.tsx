import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';
import Welcome from './Welcome';

// landing page routing and authentication check
// root index page that redirects based on auth status
export default function Home() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && userData) {
      // user is authenticated, redirect based on onboarding status and post status
      console.log('Index page - User data:', { user, userData });
      
      if (!userData.onboardingCompleted) {
        console.log('User has not completed onboarding, redirecting to onboarding');
        router.push('/onboarding');
      } 
      // if onboarding completed, check if they've already posted today
      else if (userData.hasPostedToday) {
        console.log('User has already posted today, redirecting to matches feed');
        router.push('/matches');
      }
      // if onboarding completed but haven't posted today, redirect to post-song page
      else {
        console.log('User has completed onboarding but not posted today, redirecting to post-song');
        router.push('/post-song');
      }
    }
  }, [user, userData, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-light-100 dark:bg-dark">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-700 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  // if not authenticated, show the welcome page
  if (!user) {
    return <Welcome />;
  }

  return null;
} 