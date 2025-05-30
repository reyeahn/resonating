import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';
import Welcome from './Welcome';

// Root index page that redirects based on auth status
export default function Home() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && userData) {
      // User is authenticated, redirect based on onboarding status and post status
      console.log('Index page - User data:', { user, userData });
      
      // Check if user has completed onboarding
      if (!userData.onboardingCompleted) {
        console.log('User has not completed onboarding, redirecting to onboarding');
        router.push('/onboarding');
      } 
      // If onboarding completed, check if they've already posted today
      else if (userData.hasPostedToday) {
        console.log('User has already posted today, redirecting to matches feed');
        router.push('/matches');
      }
      // If onboarding completed but haven't posted today, redirect to post-song page
      else {
        console.log('User has completed onboarding but not posted today, redirecting to post-song');
        router.push('/post-song');
      }
    }
  }, [user, userData, loading, router]);

  // If loading, show a loading spinner
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

  // If not authenticated, show the welcome page
  if (!user) {
    return <Welcome />;
  }

  // This should not be visible due to the redirects above
  return null;
} 