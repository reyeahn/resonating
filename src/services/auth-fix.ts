import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
  User,
  UserCredential,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

// alternative authentication implementation with fixes

const isValidEmail = (email: string): boolean => {
  console.log('Email validation check:');
  console.log('- Email raw value:', email);
  console.log('- Email type:', typeof email);
  console.log('- Email length:', email ? email.length : 0);
  
  // basic validation
  if (!email || email.trim() === '') {
    console.log('Email is empty or null');
    return false;
  }
  
  // check for @ symbol
  const hasAtSymbol = email.includes('@');
  console.log('- Has @ symbol:', hasAtSymbol);
  
  return true;
};

// email & Password Authentication
export const signUpWithEmail = async (
  email: string,
  password: string,
  displayName: string
): Promise<UserCredential> => {
  try {
    console.log(' DEBUG: Starting signup process');
    console.log(' Raw email value:', email);
    console.log(' Display name:', displayName);
    
    // basic email validation
    if (!email || !isValidEmail(email)) {
      console.error(' Invalid email format detected:', email);
      throw new Error('Please enter a valid email address');
    }

    const cleanEmail = email.trim();
    console.log(' Cleaned email:', cleanEmail);
    
    // create user with Firebase
    console.log(' Attempting to create user with Firebase');
    const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    console.log(' User created successfully');
    
    if (auth.currentUser) {
      console.log(' Updating display name');
      await updateProfile(auth.currentUser, { displayName });
    }
    
    // create a user document in Firestore
    console.log(' Creating user document in Firestore');
    await createUserDocument(userCredential.user, { displayName });
    
    console.log(' Sending verification email');
    await sendEmailVerification(userCredential.user);
    
    console.log(' Signup completed successfully');
    return userCredential;
  } catch (error: any) {
    console.error(' ERROR in signUpWithEmail:', error);
    console.error(' Error code:', error.code);
    console.error(' Error message:', error.message);
    
    if (error.code === 'auth/invalid-email') {
      throw new Error('The email address is not valid. Please check and try again.');
    } else if (error.code === 'auth/email-already-in-use') {
      throw new Error('This email is already in use. Please use a different email or try to log in.');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('Password is too weak. Please use a stronger password.');
    }
    
    throw error;
  }
};

export const signInWithEmail = async (
  email: string,
  password: string
): Promise<UserCredential> => {
  try {
    console.log(' DEBUG: Starting signin process');
    console.log(' Raw email value:', email);
    
    //  email validation
    if (!email || !isValidEmail(email)) {
      console.error(' Invalid email format detected:', email);
      throw new Error('Please enter a valid email address');
    }
    
    //  email is properly trimmed
    const cleanEmail = email.trim();
    console.log(' Cleaned email:', cleanEmail);
    
    return await signInWithEmailAndPassword(auth, cleanEmail, password);
  } catch (error: any) {
    console.error(' ERROR in signInWithEmail:', error);
    console.error(' Error code:', error.code);
    console.error(' Error message:', error.message);
    
    //  more user-friendly error messages
    if (error.code === 'auth/invalid-email') {
      throw new Error('The email address is not valid. Please check and try again.');
    } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
      throw new Error('Invalid login credentials. Please check your email and password.');
    }
    
    throw error;
  }
};

// OAuth Authentication
export const signInWithGoogle = async (): Promise<UserCredential> => {
  const provider = new GoogleAuthProvider();
  provider.addScope('profile');
  provider.addScope('email');
  
  try {
    const userCredential = await signInWithPopup(auth, provider);
    
    await createUserDocument(userCredential.user);
    
    return userCredential;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

// sign out
export const logOut = async (): Promise<void> => {
  return signOut(auth);
};

// password reset
export const resetPassword = async (email: string): Promise<void> => {
  if (!email || !isValidEmail(email)) {
    console.error('Invalid email format for password reset:', email);
    throw new Error('Please enter a valid email address');
  }
  
  const cleanEmail = email.trim();
  return sendPasswordResetEmail(auth, cleanEmail);
};

// helper function to create a user document in Firestore
const createUserDocument = async (
  user: User,
  additionalData?: { displayName?: string }
): Promise<void> => {
  if (!user) return;
  
  const userRef = doc(db, 'users', user.uid);
  
  try {
    await setDoc(
      userRef,
      {
        displayName: user.displayName || additionalData?.displayName || '',
        email: user.email,
        emailVerified: user.emailVerified,
        photoURL: user.photoURL,
        createdAt: serverTimestamp(),
        lastActive: serverTimestamp(),
        bio: '',
        preferences: {
          theme: 'dark',
          notificationsEnabled: true,
          privacySettings: {
            postVisibility: 'public',
            profileVisibility: 'public'
          }
        },
        questionnaire: {
          weekendSoundtrack: '',
          moodGenre: '',
          discoveryFrequency: '',
          favoriteSongMemory: '',
          preferredMoodTag: ''
        },
        stats: {
          totalPosts: 0,
          totalMatches: 0,
          totalLikes: 0,
          totalComments: 0
        },
        hasPostedToday: false,
        spotifyConnected: false,
        appleConnected: false
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Error creating user document:', error);
    throw error;
  }
}; 