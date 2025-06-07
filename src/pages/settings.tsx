// app settings and preferences management
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { doc, updateDoc } from 'firebase/firestore';
import { db, storage } from '@/services/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useAuth } from '@/hooks/useAuth';
import { FaUser, FaArrowLeft, FaSignOutAlt, FaCamera, FaLock, FaBell, FaEye, FaSpotify, FaApple, FaTrash } from 'react-icons/fa';
import SpotifyConnect from '@/components/spotify/SpotifyConnect';

const Settings: React.FC = () => {
  const router = useRouter();
  const { user, userData, logout, updateUserProfile } = useAuth();
  
  // profile information
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  
  // settings sections
  const [activeSection, setActiveSection] = useState('profile');
  
  // notification settings
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [matchNotifications, setMatchNotifications] = useState(true);
  const [commentNotifications, setCommentNotifications] = useState(true);
  
  // privacy settings
  const [profileVisibility, setProfileVisibility] = useState('public');
  const [showActivity, setShowActivity] = useState(true);
  
  // loading & error states
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  useEffect(() => {
    if (userData) {
      setDisplayName(userData.displayName || '');
      setEmail(user?.email || '');
      setBio(userData.bio || '');
      setPhotoURL(userData.photoURL || '');
      
      // initialize notification settings from user data if available
      setEmailNotifications(userData.settings?.emailNotifications ?? true);
      setPushNotifications(userData.settings?.pushNotifications ?? true);
      setMatchNotifications(userData.settings?.matchNotifications ?? true);
      setCommentNotifications(userData.settings?.commentNotifications ?? true);
      
      // initialize privacy settings
      setProfileVisibility(userData.settings?.profileVisibility || 'public');
      setShowActivity(userData.settings?.showActivity ?? true);
    }
  }, [userData, user]);
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    // file validation
    if (!file.type.match('image.*')) {
      setErrorMessage('Please select an image file');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('File size must be less than 5MB');
      return;
    }
    
    try {
      setIsUploading(true);
      setUploadProgress(0);
      setErrorMessage('');
      
      // create a storage reference
      const storageRef = ref(storage, `user-profiles/${user.uid}`);
      
      // upload file with progress monitoring
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          setErrorMessage('Error uploading image: ' + error.message);
          setIsUploading(false);
        },
        async () => {
          // upload completed successfully
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setPhotoURL(downloadURL);
          setIsUploading(false);
          
          // update user profile with new photo URL
          try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
              photoURL: downloadURL
            });
            
            // also update in auth if available
            if (updateUserProfile) {
              await updateUserProfile({ photoURL: downloadURL });
            }
            
            setSuccessMessage('Profile picture updated successfully');
          } catch (error) {
            console.error('Error updating profile picture:', error);
            setErrorMessage('Failed to update profile');
          }
        }
      );
    } catch (error) {
      console.error('Error in file upload:', error);
      setErrorMessage('Failed to upload image');
      setIsUploading(false);
    }
  };
  
  const handleSaveProfile = async () => {
    if (!user) return;
    
    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        displayName,
        bio,
      });
      
      // also update in auth if available
      if (updateUserProfile) {
        await updateUserProfile({ displayName });
      }
      
      setSuccessMessage('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      setErrorMessage('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleSaveNotifications = async () => {
    if (!user) return;
    
    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        'settings.emailNotifications': emailNotifications,
        'settings.pushNotifications': pushNotifications,
        'settings.matchNotifications': matchNotifications,
        'settings.commentNotifications': commentNotifications,
      });
      
      setSuccessMessage('Notification settings updated');
    } catch (error) {
      console.error('Error updating notification settings:', error);
      setErrorMessage('Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleSavePrivacy = async () => {
    if (!user) return;
    
    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        'settings.profileVisibility': profileVisibility,
        'settings.showActivity': showActivity,
      });
      
      setSuccessMessage('Privacy settings updated');
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      setErrorMessage('Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
      setErrorMessage('Failed to sign out');
    }
  };
  
  const handleDeleteAccount = () => {
    if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      alert('This feature is coming soon. Please contact support to delete your account.');
    }
  };
  
  if (!user || !userData) {
    return (
      <div className="min-h-screen bg-light-100 dark:bg-dark-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-light-100 dark:bg-dark-100 pb-20">
      {/* Header */}
      <div className="bg-white dark:bg-dark-200 p-4 shadow-sm mb-4">
        <div className="max-w-md mx-auto flex items-center">
          <button 
            onClick={() => router.back()}
            className="mr-4 text-gray-600 dark:text-gray-400"
            aria-label="Go back"
          >
            <FaArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h1>
        </div>
      </div>
      
      <div className="max-w-md mx-auto px-4">
        {/* Settings Menu */}
        <div className="bg-white dark:bg-dark-200 rounded-lg shadow-sm mb-4 overflow-hidden">
          <div className="grid grid-cols-3 text-center border-b border-gray-200 dark:border-dark-300">
            <button
              onClick={() => setActiveSection('profile')}
              className={`py-3 px-2 transition-colors ${
                activeSection === 'profile'
                  ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Profile
            </button>
            <button
              onClick={() => setActiveSection('notifications')}
              className={`py-3 px-2 transition-colors ${
                activeSection === 'notifications'
                  ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Notifications
            </button>
            <button
              onClick={() => setActiveSection('privacy')}
              className={`py-3 px-2 transition-colors ${
                activeSection === 'privacy'
                  ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Privacy
            </button>
          </div>
          
          {/* Profile Settings */}
          {activeSection === 'profile' && (
            <div className="p-4">
              <div className="flex flex-col items-center mb-6">
                <div className="relative mb-4">
                  {photoURL ? (
                    <img 
                      src={photoURL} 
                      alt={displayName || 'User'} 
                      className="w-24 h-24 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gray-300 dark:bg-dark-300 flex items-center justify-center">
                      <FaUser className="text-gray-500 dark:text-dark-500 text-4xl" />
                    </div>
                  )}
                  
                  <label htmlFor="profile-photo" className="absolute bottom-0 right-0 w-8 h-8 bg-primary-600 dark:bg-primary-500 rounded-full flex items-center justify-center cursor-pointer">
                    <FaCamera className="text-white text-sm" />
                    <input 
                      type="file" 
                      id="profile-photo" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleFileChange}
                      disabled={isUploading}
                    />
                  </label>
                </div>
                
                {isUploading && (
                  <div className="w-full max-w-xs mb-2">
                    <div className="bg-gray-200 dark:bg-dark-300 rounded-full h-2 mb-1">
                      <div 
                        className="bg-primary-600 h-2 rounded-full" 
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                      Uploading: {Math.round(uploadProgress)}%
                    </p>
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-dark-400 rounded-md bg-white dark:bg-dark-100 text-gray-900 dark:text-white"
                    placeholder="Your name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="w-full p-2 border border-gray-300 dark:border-dark-400 rounded-md bg-gray-100 dark:bg-dark-300 text-gray-500 dark:text-gray-400"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Contact support to change your email address
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Bio
                  </label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-dark-400 rounded-md bg-white dark:bg-dark-100 text-gray-900 dark:text-white"
                    placeholder="Write a short bio about yourself..."
                    rows={3}
                  />
                </div>
                
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="w-full py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
              
              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-dark-300">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Connected Music Services
                </h3>
                
                <div className="space-y-3">
                  <SpotifyConnect className="w-full" />
                  
                  <button
                    className="flex items-center justify-center w-full py-3 px-4 bg-black text-white font-medium rounded-lg opacity-50 cursor-not-allowed"
                    disabled
                  >
                    <FaApple className="mr-2 text-lg" />
                    Connect to Apple Music
                    <span className="ml-2 text-xs bg-gray-700 px-2 py-0.5 rounded">Coming Soon</span>
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Notification Settings */}
          {activeSection === 'notifications' && (
            <div className="p-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Notification Preferences
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">Email Notifications</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Receive notifications via email
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={emailNotifications}
                      onChange={() => setEmailNotifications(!emailNotifications)}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-dark-400 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">Push Notifications</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Receive notifications on your device
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={pushNotifications}
                      onChange={() => setPushNotifications(!pushNotifications)}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-dark-400 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                  </label>
                </div>
                
                <hr className="border-gray-200 dark:border-dark-300" />
                
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">New Matches</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      When you get a new music match
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={matchNotifications}
                      onChange={() => setMatchNotifications(!matchNotifications)}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-dark-400 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">Comments & Likes</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      When someone interacts with your posts
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={commentNotifications}
                      onChange={() => setCommentNotifications(!commentNotifications)}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-dark-400 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                  </label>
                </div>
                
                <button
                  onClick={handleSaveNotifications}
                  disabled={isSaving}
                  className="w-full py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Saving...' : 'Save Notification Settings'}
                </button>
              </div>
            </div>
          )}
          
          {/* Privacy Settings */}
          {activeSection === 'privacy' && (
            <div className="p-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Privacy Settings
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Profile Visibility
                  </label>
                  <select
                    value={profileVisibility}
                    onChange={(e) => setProfileVisibility(e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-dark-400 rounded-md bg-white dark:bg-dark-100 text-gray-900 dark:text-white"
                  >
                    <option value="public">Public - Anyone can view your profile</option>
                    <option value="friends">Friends Only - Only people you connect with</option>
                    <option value="private">Private - Only you can see your profile</option>
                  </select>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">Show Activity Status</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Let others see when you're active
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={showActivity}
                      onChange={() => setShowActivity(!showActivity)}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-dark-400 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                  </label>
                </div>
                
                <button
                  onClick={handleSavePrivacy}
                  disabled={isSaving}
                  className="w-full py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Saving...' : 'Save Privacy Settings'}
                </button>
                
                <div className="pt-6 border-t border-gray-200 dark:border-dark-300">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">Security</h4>
                  
                  <button
                    onClick={() => alert('Password reset functionality coming soon')}
                    className="w-full py-2 mb-3 flex items-center justify-center bg-gray-100 dark:bg-dark-300 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-dark-400"
                  >
                    <FaLock className="mr-2" />
                    Change Password
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Status Messages */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
            {errorMessage}
          </div>
        )}
        
        {successMessage && (
          <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400">
            {successMessage}
          </div>
        )}
        
        {/* Account Actions */}
        <div className="bg-white dark:bg-dark-200 rounded-lg shadow-sm p-4 space-y-3">
          <button
            onClick={handleLogout}
            className="w-full py-3 flex items-center justify-center text-red-600 dark:text-red-400 bg-white dark:bg-dark-200 border border-red-200 dark:border-red-900/30 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10"
          >
            <FaSignOutAlt className="mr-2" />
            <span>Logout</span>
          </button>
          
          <button
            onClick={handleDeleteAccount}
            className="w-full py-3 flex items-center justify-center text-gray-600 dark:text-gray-400 bg-white dark:bg-dark-200 border border-gray-200 dark:border-dark-300 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-300"
          >
            <FaTrash className="mr-2" />
            <span>Delete Account</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings; 