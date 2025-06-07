// alternative authentication state hook
import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../services/firebase';
import { 
  signUpWithEmail, 
  signInWithEmail, 
  signInWithGoogle, 
  logOut, 
  resetPassword 
} from '../services/auth';

export interface UserData {
  uid: string;
  displayName: string | null;
  email: string | null;
  emailVerified: boolean;
  photoURL: string | null;
  createdAt: any;
  lastActive: any;
  bio: string;
  preferences: {
    theme: string;
    notificationsEnabled: boolean;
    privacySettings: {
      postVisibility: string;
      profileVisibility: string;
    };
  };
  questionnaire: {
    weekendSoundtrack: string;
    moodGenre: string;
    discoveryFrequency: string;
    favoriteSongMemory: string;
    preferredMoodTag: string;
  };
  stats: {
    totalPosts: number;
    totalMatches: number;
    totalLikes: number;
    totalComments: number;
  };
  hasPostedToday: boolean;
  spotifyConnected: boolean;
  appleConnected: boolean;
}

interface AuthHook {
  user: User | null | undefined;
  userData: UserData | null;
  loading: boolean;
  error: Error | undefined;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  googleSignIn: () => Promise<void>;
  logout: () => Promise<void>;
  resetUserPassword: (email: string) => Promise<void>;
}

export const useAuth = (): AuthHook => {
  const [user, loading, error] = useAuthState(auth);
  const [userData, setUserData] = useState<UserData | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        try {
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            setUserData({ uid: user.uid, ...userDoc.data() } as UserData);
          } else {
            console.error('No user document found for this user');
          }
        } catch (err) {
          console.error('Error fetching user data:', err);
        }
      } else {
        setUserData(null);
      }
    };

    if (!loading) {
      fetchUserData();
    }
  }, [user, loading]);

  const signUp = async (email: string, password: string, displayName: string) => {
    console.log('useAuth - signUp called with:');
    console.log('- Email:', email);
    console.log('- Display Name:', displayName);
    
    if (!email || !email.includes('@')) {
      console.error('Invalid email format detected in useAuth:', email);
      throw new Error('Please enter a valid email address');
    }
    
    // Make sure to pass the parameters in the correct order
    await signUpWithEmail(email, password, displayName);
  };

  const signIn = async (email: string, password: string) => {
    console.log('useAuth - signIn called with email:', email);
    
    if (!email || !email.includes('@')) {
      console.error('Invalid email format detected in useAuth:', email);
      throw new Error('Please enter a valid email address');
    }
    
    await signInWithEmail(email, password);
  };

  const googleSignIn = async () => {
    await signInWithGoogle();
  };

  const logout = async () => {
    await logOut();
  };

  const resetUserPassword = async (email: string) => {
    console.log('useAuth - resetPassword called with email:', email);
    
    if (!email || !email.includes('@')) {
      console.error('Invalid email format detected in useAuth for reset:', email);
      throw new Error('Please enter a valid email address');
    }
    
    await resetPassword(email);
  };

  return {
    user,
    userData,
    loading,
    error,
    signUp,
    signIn,
    googleSignIn,
    logout,
    resetUserPassword,
  };
}; 