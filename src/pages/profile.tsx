import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError } from '@/services/firebase';
import { useAuth } from '@/hooks/useAuth';
import { FaUser, FaCog, FaEdit, FaSignOutAlt, FaMusic, FaHeart, FaComment, FaRegHeart, FaLock, FaGlobe, FaChartLine, FaPhone } from 'react-icons/fa';
import { getUserProfilePosts } from '@/services/posts';
import { likePost, addComment, getPostComments } from '@/services/posts';
import NotificationBadge from '@/components/common/NotificationBadge';
import { getUnreadNotifications } from '@/services/notifications';
import ClickableAlbumCover from '@/components/spotify/ClickableAlbumCover';
import { formatPostDate } from '@/services/timeUtils';
import WeeklyInsights from '@/components/analytics/WeeklyInsights';
import PhotoCarousel from '@/components/PhotoCarousel';

// user profile display and editing

interface Post {
  id: string;
  userId: string;
  userDisplayName: string;
  userPhotoURL: string;
  songTitle: string;
  songArtist: string;
  songAlbumArt: string;
  spotifyId?: string;
  previewUrl?: string;
  mood: string;
  caption: string;
  likes: number;
  comments: number;
  createdAt: Date;
  likedBy?: string[];
  mediaUrl?: string; 
  mediaUrls?: string[]; 
}

const Profile: React.FC = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const { user, userData, logout } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<string | null>(null);
  const [comments, setComments] = useState<{[key: string]: any[]}>({});
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState<{[key: string]: boolean}>({});
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [postsVisibility, setPostsVisibility] = useState<'public' | 'private'>('public');
  const [activeTab, setActiveTab] = useState<'posts' | 'analytics'>('posts');

  useEffect(() => {
    if (userData) {
      setName(userData.displayName || '');
      setBio(userData.bio || '');
      setPostsVisibility(userData.settings?.postsVisibility || 'public');
    }
  }, [userData]);

  useEffect(() => {
    if (user) {
      fetchUserPosts();
      fetchNotifications();
    }
  }, [user]);

  const fetchUserPosts = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // fetch real user posts from Firestore
      const userPosts = await getUserProfilePosts(user.uid);
      
      if (userPosts.length > 0) {
        setPosts(userPosts);
      } else {
        console.log('No posts found for this user');
        setPosts([]);
      }
    } catch (error) {
      console.error('Error fetching user posts:', error);
      
      if (posts.length === 0) {
        const mockUserPosts: Post[] = [
          {
            id: 'userpost1',
            userId: user.uid,
            userDisplayName: userData?.displayName || user.displayName || 'User',
            userPhotoURL: userData?.photoURL || user.photoURL || '',
            songTitle: 'White Ferrari',
            songArtist: 'Frank Ocean',
            songAlbumArt: 'https://i.scdn.co/image/ab67616d0000b273c5649add07ed3720be9d5526',
            mood: 'Nostalgic',
            caption: 'This song takes me back to summer nights...',
            likes: 27,
            comments: 5,
            createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
            likedBy: ['friend1', 'friend2'],
          },
        ];
        setPosts(mockUserPosts);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    if (!user) return;
    
    try {
      // get real unread notifications count using the service
      const notifications = await getUnreadNotifications(user.uid);
      setUnreadNotifications(notifications.length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setUnreadNotifications(0);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    
    setIsSaving(true);
    
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        displayName: name,
        bio: bio
      });
      
      setIsEditing(false);
      
      const successMessage = document.createElement('div');
      successMessage.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      successMessage.textContent = 'Profile updated successfully!';
      document.body.appendChild(successMessage);
      setTimeout(() => {
        if (successMessage.parentElement) {
          successMessage.parentElement.removeChild(successMessage);
        }
      }, 3000);
      
    } catch (error: any) {
      console.error('Error updating profile:', error);
      
      const errorType = handleFirestoreError(error, 'profile update');
      
      if (errorType === 'blocked') {
        return;
      }
      
      let errorMessage = 'Failed to update profile. ';
      
      if (error.code === 'permission-denied') {
        errorMessage += 'Permission denied. Please refresh the page and try again.';
      } else if (error.code === 'unavailable') {
        errorMessage += 'Service temporarily unavailable. Please check your internet connection and try again.';
      } else {
        errorMessage += 'Please try again. If the problem persists, try refreshing the page.';
      }
      
      // show error dialog 
      const errorDialog = document.createElement('div');
      errorDialog.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
      errorDialog.innerHTML = `
        <div class="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-md mx-4">
          <h3 class="text-lg font-bold text-red-600 mb-2">Profile Update Failed</h3>
          <p class="text-gray-700 dark:text-gray-300 mb-4">${errorMessage}</p>
          <div class="flex gap-2">
            <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                    class="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700">
              OK
            </button>
            <button onclick="window.location.reload()" 
                    class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
              Refresh Page
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(errorDialog);
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
    }
  };

  const handleLikePost = async (postId: string) => {
    if (!user) return;

    try {
      // find the post to update locally
      const post = posts.find(p => p.id === postId);
      
      if (!post) return;
      
      // check if user has already liked the post
      const userLiked = post.likedBy?.includes(user.uid);
      
      // call the real likePost service to update Firestore
      await likePost(postId, user.uid);
      
      if (userLiked) {
        setPosts(posts.map(post => 
          post.id === postId 
            ? { 
                ...post, 
                likes: Math.max(0, post.likes - 1),
                likedBy: post.likedBy?.filter(id => id !== user.uid) || []
              }
            : post
        ));
      } else {
        setPosts(posts.map(post => 
          post.id === postId 
            ? { 
                ...post, 
                likes: post.likes + 1,
                likedBy: [...(post.likedBy || []), user.uid]
              }
            : post
        ));
      }
    } catch (error) {
      console.error('Error liking post:', error);
      fetchUserPosts();
    }
  };

  const handleAddComment = async (postId: string) => {
    if (!user || !newComment.trim()) return;

    try {
      // call the real addComment service
      const commentId = await addComment(
        postId,
        user.uid,
        newComment.trim()
      );
      
      const userDisplayName = userData?.displayName || user.displayName || 'You';
      const userPhotoURL = userData?.photoURL || user.photoURL;
      
      const newCommentObj = {
        id: commentId,
        postId,
        userId: user.uid,
        userDisplayName,
        userPhotoURL,
        content: newComment.trim(),
        createdAt: new Date(),
      };
      
      setComments(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), newCommentObj]
      }));
      
      setPosts(posts.map(post => 
        post.id === postId 
          ? { ...post, comments: post.comments + 1 }
          : post
      ));
      
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const fetchComments = async (postId: string) => {
    try {
      // call the real getPostComments service
      const postComments = await getPostComments(postId);
      
      setComments(prev => ({ 
        ...prev, 
        [postId]: postComments 
      }));
    } catch (error) {
      console.error('Error fetching comments:', error);
      
      const mockComments = [
        {
          id: `mock-${Date.now()}`,
          postId,
          userId: 'mock-user',
          userDisplayName: 'Example User',
          userPhotoURL: 'https://i.pravatar.cc/150?img=1',
          content: 'This is a placeholder comment when real comments can\'t be loaded.',
          createdAt: new Date(),
        }
      ];
      
      setComments(prev => ({ 
        ...prev, 
        [postId]: mockComments
      }));
    }
  };

  const toggleComments = async (postId: string) => {
    if (!showComments[postId]) {
      await fetchComments(postId);
    }
    setShowComments(prev => ({ ...prev, [postId]: !prev[postId] }));
  };

  const handleTogglePostsVisibility = async () => {
    if (!user) return;
    
    const newVisibility = postsVisibility === 'public' ? 'private' : 'public';
    setPostsVisibility(newVisibility);
    
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        'settings.postsVisibility': newVisibility
      });
    } catch (error) {
      console.error('Error updating posts visibility:', error);
      setPostsVisibility(postsVisibility);
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
    <div className="min-h-screen bg-light-100 dark:bg-dark-100 pb-16">
      {/* User Profile Header */}
      <div className="bg-white dark:bg-dark-200 p-4 shadow-sm">
        <div className="max-w-md mx-auto">
          <div className="flex items-center">
            <div className="relative">
              {userData?.photoURL ? (
                <img 
                  src={userData.photoURL} 
                  alt={userData.displayName || 'User'} 
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gray-300 dark:bg-dark-300 flex items-center justify-center">
                  <FaUser className="text-gray-500 dark:text-dark-500 text-2xl" />
                </div>
              )}
            </div>
            
            <div className="ml-4 flex-grow">
              {isEditing ? (
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-dark-400 rounded-md bg-white dark:bg-dark-100 text-gray-900 dark:text-white mb-2"
                  placeholder="Your name"
                />
              ) : (
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  {userData?.displayName || user?.displayName || 'Your Profile'}
                </h1>
              )}
              
              <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                <span>{posts.length} posts</span>
                <span>·</span>
                <span>0 friends</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {isEditing ? (
                <button 
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="text-primary-600 dark:text-primary-400"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              ) : (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="text-gray-700 dark:text-gray-300 p-2"
                >
                  <FaEdit className="h-5 w-5" />
                </button>
              )}
              
              <button 
                onClick={() => router.push('/settings')}
                className="text-gray-700 dark:text-gray-300 p-2"
                aria-label="Settings"
              >
                <FaCog className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          {isEditing ? (
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full mt-4 p-2 border border-gray-300 dark:border-dark-400 rounded-md bg-white dark:bg-dark-100 text-gray-900 dark:text-white"
              placeholder="Write a short bio about yourself..."
              rows={3}
            />
          ) : (
            <p className="mt-4 text-gray-700 dark:text-gray-300">
              {userData?.bio || 'No bio yet'}
            </p>
          )}

          {/* Stats section */}
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="bg-gray-100 dark:bg-dark-300 rounded-lg p-2">
              <div className="text-primary-600 dark:text-primary-400 text-lg font-bold">
                {userData?.stats?.totalPosts || posts.length}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Posts</div>
            </div>
            <div className="bg-gray-100 dark:bg-dark-300 rounded-lg p-2">
              <div className="text-primary-600 dark:text-primary-400 text-lg font-bold">
                {userData?.stats?.totalMatches || 0}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Matches</div>
            </div>
            <div className="bg-gray-100 dark:bg-dark-300 rounded-lg p-2">
              <div className="text-primary-600 dark:text-primary-400 text-lg font-bold">
                {userData?.stats?.totalLikes || 0}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Likes</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Posts and Analytics Container - Match header width */}
      <div className="max-w-md mx-auto px-4">
        <div className="bg-white dark:bg-dark-200 rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Your Content</h2>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex space-x-1 mb-6">
            <button
              onClick={() => setActiveTab('posts')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'posts'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-dark-300 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-400'
              }`}
            >
              <FaMusic className="inline mr-2" />
              Posts
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'analytics'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-dark-300 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-400'
              }`}
            >
              <FaChartLine className="inline mr-2" />
              Analytics
            </button>
          </div>

          {/* Posts Tab Content */}
          {activeTab === 'posts' && (
            <>
              {posts.length === 0 ? (
                <div className="text-center py-8">
                  <div className="mx-auto h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
                    <FaMusic className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No posts yet
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Share your first song to start building your music story.
                  </p>
                  <button
                    onClick={() => router.push('/post-song')}
                    className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Post a Song
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1">
                  {posts.map((post) => (
                    <div
                      key={post.id}
                      className="aspect-square bg-gray-700 rounded-lg overflow-hidden relative group cursor-pointer"
                      onClick={() => setSelectedPost(selectedPost === post.id ? null : post.id)}
                    >
                      <ClickableAlbumCover
                        coverArtUrl={post.songAlbumArt}
                        previewUrl={post.previewUrl}
                        songTitle={post.songTitle}
                        songArtist={post.songArtist}
                        size="large"
                        className="w-full h-full"
                      />
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center">
                        <div className="text-white text-center px-2">
                          <p className="text-xs font-medium truncate mb-1">{post.songTitle}</p>
                          <p className="text-xs text-gray-300 truncate mb-2">{post.songArtist}</p>
                          <p className="text-xs text-gray-300 mb-2">{formatPostDate(post.createdAt)}</p>
                          <div className="flex items-center space-x-4 text-xs">
                            <div className="flex items-center">
                              <FaHeart className="mr-1" />
                              <span>{post.likes}</span>
                            </div>
                            <div className="flex items-center">
                              <FaComment className="mr-1" />
                              <span>{post.comments}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Analytics Tab Content */}
          {activeTab === 'analytics' && (
            <div className="space-y-4">
              <WeeklyInsights />
            </div>
          )}
        </div>
      </div>

      {/* Expanded Post View */}
      {selectedPost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-200 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            {(() => {
              const post = posts.find(p => p.id === selectedPost);
              if (!post) return null;
              
              return (
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {post.songTitle}
                    </h3>
                    <button
                      onClick={() => setSelectedPost(null)}
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      ✕
                    </button>
                  </div>
                  
                  <div className="flex gap-4 mb-4">
                    <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-700">
                      <ClickableAlbumCover
                        coverArtUrl={post.songAlbumArt}
                        previewUrl={post.previewUrl}
                        songTitle={post.songTitle}
                        songArtist={post.songArtist}
                        size="large"
                        className="w-full h-full"
                      />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-gray-900 dark:text-white font-semibold">
                        {post.songTitle}
                      </h4>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">
                        {post.songArtist}
                      </p>
                      <p className="text-primary-600 dark:text-primary-400 text-sm mt-1">
                        {post.mood}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {formatPostDate(post.createdAt)}
                      </p>
                    </div>
                  </div>

                  {post.caption && (
                    <p className="text-gray-700 dark:text-gray-300 mb-4">{post.caption}</p>
                  )}

                  {/* Photo carousel if multiple photos exist, or single photo */}
                  {(post.mediaUrls && post.mediaUrls.length > 0) ? (
                    <div className="mb-4 rounded-lg overflow-hidden h-40">
                      <PhotoCarousel
                        mediaUrls={post.mediaUrls}
                        className="w-full h-full rounded-lg"
                        showCounter={true}
                        counterPosition="top-right"
                        showNavigation={true}
                      />
                    </div>
                  ) : post.mediaUrl ? (
                    <div className="mb-4 rounded-lg overflow-hidden">
                      <img
                        src={post.mediaUrl}
                        alt="Attached media"
                        className="w-full h-40 object-cover rounded-lg"
                      />
                    </div>
                  ) : null}

                  <div className="flex items-center gap-6 mb-4">
                    <button
                      onClick={() => handleLikePost(post.id)}
                      className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                    >
                      {post.likedBy?.includes(user.uid) ? (
                        <FaHeart className="text-red-500" />
                      ) : (
                        <FaRegHeart className="text-gray-500 dark:text-gray-400" />
                      )}
                      <span>{String(post.likes || 0)}</span>
                    </button>
                    <button
                      onClick={() => toggleComments(post.id)}
                      className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                    >
                      <FaComment />
                      <span>{String(post.comments || 0)}</span>
                    </button>
                  </div>

                  {showComments[post.id] && (
                    <div className="space-y-4">
                      {comments[post.id]?.map((comment) => (
                        <div key={comment.id} className="flex gap-3">
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-700">
                            {comment.userPhotoURL ? (
                              <img
                                src={comment.userPhotoURL}
                                alt={comment.userDisplayName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="h-full w-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                                <FaUser className="h-3 w-3 text-primary-600 dark:text-primary-400" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="bg-gray-100 dark:bg-dark-300 rounded-lg p-3">
                              <p className="text-gray-900 dark:text-white font-semibold text-sm">
                                {comment.userDisplayName}
                              </p>
                              <p className="text-gray-700 dark:text-gray-300 text-sm">
                                {comment.content}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}

                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-700">
                          {user?.photoURL ? (
                            <img
                              src={user.photoURL}
                              alt={user.displayName || 'You'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                              <FaUser className="h-3 w-3 text-primary-600 dark:text-primary-400" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 flex gap-2">
                          <input
                            type="text"
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleAddComment(post.id);
                              }
                            }}
                            placeholder="Add a comment..."
                            className="flex-1 bg-gray-100 dark:bg-dark-300 text-gray-900 dark:text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          <button
                            onClick={() => handleAddComment(post.id)}
                            disabled={!newComment.trim()}
                            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Post
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Logout Button */}
      <div className="max-w-md mx-auto px-4 mb-20">
        <button
          onClick={handleLogout}
          className="w-full py-3 flex items-center justify-center text-red-600 dark:text-red-400 bg-white dark:bg-dark-200 rounded-lg shadow-md"
        >
          <FaSignOutAlt className="mr-2" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Profile; 