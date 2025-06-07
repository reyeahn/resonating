// firebase app initialization and configuration
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

/**
 * utility to check if an error is caused by ad blocker blocking
 */
export const isBlockedByAdBlocker = (error: any): boolean => {
  if (!error) return false;
  
  const errorString = error.toString().toLowerCase();
  const errorMessage = error.message?.toLowerCase() || '';
  const errorCode = error.code || '';
  
  return (
    errorString.includes('err_blocked_by_client') ||
    errorString.includes('blocked') ||
    errorMessage.includes('err_blocked_by_client') ||
    errorMessage.includes('blocked') ||
    errorCode === 'ERR_BLOCKED_BY_CLIENT'
  );
};

/**
 * show a user-friendly notification when ad blockers interfere
 */
export const showAdBlockerNotification = (operation: string = 'operation') => {
  const sessionKey = `adBlockerNotified_${operation}`;
  if (sessionStorage.getItem(sessionKey)) return;
  
  sessionStorage.setItem(sessionKey, 'true');
  
  const notification = document.createElement('div');
  notification.className = 'fixed top-4 right-4 bg-orange-500 text-white px-4 py-3 rounded-lg shadow-lg z-50 max-w-sm';
  notification.innerHTML = `
    <div class="flex items-start gap-3">
      <div class="text-xl">⚠️</div>
      <div>
        <div class="font-semibold">Ad Blocker Detected</div>
        <div class="text-sm mt-1">Some features may not work properly. Try disabling ad blockers for this site.</div>
        <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                class="text-xs underline mt-2 hover:no-underline">
          Dismiss
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentElement) {
      notification.parentElement.removeChild(notification);
    }
  }, 8000);
};

/**
 * enhanced error handler for Firestore operations
 */
export const handleFirestoreError = (error: any, operation: string = 'operation', silent: boolean = false) => {
  if (isBlockedByAdBlocker(error)) {
    if (!silent) {
      console.warn(`⚠️ ${operation} blocked by ad blocker - this may affect functionality`);
      showAdBlockerNotification(operation);
    }
    return 'blocked';
  } else {
    console.error(`Error in ${operation}:`, error);
    return 'error';
  }
};

export { app, auth, db, storage }; 