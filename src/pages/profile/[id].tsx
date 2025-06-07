// other users' profile viewing
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/hooks/useAuth';
import { FaUser, FaUserPlus, FaUserMinus, FaHeart, FaRegHeart, FaComment } from 'react-icons/fa';
import { getUserProfilePosts, likePost, addComment, getPostComments } from '@/services/posts';
import { sendFriendRequest, removeFriend, getUserFriends } from '@/services/friends';
import ClickableAlbumCover from '@/components/spotify/ClickableAlbumCover';
import PhotoCarousel from '@/components/PhotoCarousel';
import { formatPostDate } from '@/services/timeUtils';

interface Post {
  id: string;
  userId: string;
  userDisplayName: string;
  userPhotoURL: string;
  songTitle: string;
  songArtist: string;
  songAlbumArt: string;
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

interface UserData {
  displayName: string;
  email: string;
  photoURL: string;
  bio: string;
  stats?: {
    totalPosts: number;
    totalMatches: number;
  };
  settings?: {
    postsVisibility?: 'public' | 'private';
  };
}

const UserProfile: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  const { user, userData: currentUserData } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<{[key: string]: any[]}>({});
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState<{[key: string]: boolean}>({});
  const [friendship, setFriendship] = useState<'not_friend' | 'pending' | 'friends'>('not_friend');
  const [selectedPost, setSelectedPost] = useState<string | null>(null);

  useEffect(() => {
    if (id && typeof id === 'string') {
      fetchUserData(id);
      fetchUserPosts(id);
      if (user) {
        checkFriendshipStatus(id);
      }
    }
  }, [id, user]);

  const fetchUserData = async (userId: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        setUserData(userDoc.data() as UserData);
      } else {
        console.error('User not found');
        router.push('/friends');
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const fetchUserPosts = async (userId: string) => {
    try {
      setLoading(true);
      const userPosts = await getUserProfilePosts(userId);
      
      if (userPosts.length > 0) {
        setPosts(userPosts);
      } else {
        console.log('No posts found for this user');
        setPosts([]);
      }
    } catch (error) {
      console.error('Error fetching user posts:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const checkFriendshipStatus = async (userId: string) => {
    if (!user) return;
    
    try {
      const friends = await getUserFriends(user.uid);
      
      const isFriend = friends.some(friend => friend.id === userId);
      
      if (isFriend) {
        setFriendship('friends');
        return;
      }
      
      const requestsQuery = await getDoc(doc(db, 'friendRequests', `${user.uid}_${userId}`));
      
      if (requestsQuery.exists()) {
        setFriendship('pending');
        return;
      }
      
      setFriendship('not_friend');
    } catch (error) {
      console.error('Error checking friendship status:', error);
      setFriendship('not_friend');
    }
  };

  const handleSendFriendRequest = async () => {
    if (!user || !id || typeof id !== 'string') return;
    
    try {
      const displayName = currentUserData?.displayName || user.displayName || 'User';
      await sendFriendRequest(user.uid, id, displayName);
      setFriendship('pending');
      alert('Friend request sent!');
    } catch (error) {
      console.error('Error sending friend request:', error);
      alert('Failed to send friend request. Please try again.');
    }
  };

  const handleRemoveFriend = async () => {
    if (!user || !id || typeof id !== 'string') return;
    
    try {
      await removeFriend(user.uid, id);
      setFriendship('not_friend');
      alert('Friend removed.');
    } catch (error) {
      console.error('Error removing friend:', error);
      alert('Failed to remove friend. Please try again.');
    }
  };

  const handleLikePost = async (postId: string) => {
    if (!user) return;

    try {
      const post = posts.find(p => p.id === postId);
      
      if (!post) return;
      
      const userLiked = post.likedBy?.includes(user.uid);
      
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
    }
  };

  const fetchComments = async (postId: string) => {
    try {
      const postComments = await getPostComments(postId);
      
      setComments(prev => ({ 
        ...prev, 
        [postId]: postComments 
      }));
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleAddComment = async (postId: string) => {
    if (!user || !newComment.trim()) return;

    try {
      const commentId = await addComment(
        postId,
        user.uid,
        newComment.trim()
      );
      
      const userDisplayName = currentUserData?.displayName || user.displayName || 'You';
      const userPhotoURL = currentUserData?.photoURL || user.photoURL;
      
      const newCommentObj = {
        id: commentId || `temp-${Date.now()}`,
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
      alert('Failed to add comment. Please try again.');
    }
  };

  const toggleComments = async (postId: string) => {
    if (!showComments[postId]) {
      await fetchComments(postId);
    }
    setShowComments(prev => ({ ...prev, [postId]: !prev[postId] }));
  };

  if (loading || !userData) {
    return (
      <div className="min-h-screen bg-light-100 dark:bg-dark-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-light-100 dark:bg-dark-100 pt-16 pb-20 px-4">
      <div className="max-w-lg mx-auto">
        {/* Profile Header */}
        <div className="bg-white dark:bg-dark-200 rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <button 
              onClick={() => router.back()}
              className="p-2 text-primary-600 hover:text-primary-700"
            >
              Back
            </button>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">User Profile</h1>
            {user && id !== user.uid && (
              <div>
                {friendship === 'not_friend' && (
                  <button 
                    onClick={handleSendFriendRequest}
                    className="p-2 text-primary-600 hover:text-primary-700"
                  >
                    <FaUserPlus className="h-5 w-5" />
                  </button>
                )}
                {friendship === 'pending' && (
                  <span className="text-yellow-500 text-sm">Request Pending</span>
                )}
                {friendship === 'friends' && (
                  <button 
                    onClick={handleRemoveFriend}
                    className="p-2 text-red-500 hover:text-red-700"
                  >
                    <FaUserMinus className="h-5 w-5" />
                  </button>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center mb-4">
            <div className="relative mr-4">
              {userData.photoURL ? (
                <img
                  src={userData.photoURL} 
                  alt={userData.displayName || 'User'} 
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                  <FaUser className="h-10 w-10 text-primary-600 dark:text-primary-400" />
                </div>
              )}
            </div>
            
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {userData.displayName || 'User'}
              </h2>
              {userData.email && (
                <p className="text-sm text-gray-600 dark:text-gray-400">{userData.email}</p>
              )}
            </div>
          </div>
          
          {/* Bio */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Bio</h3>
            <p className="text-gray-600 dark:text-gray-400">
              {userData.bio || 'No bio available.'}
            </p>
          </div>
          
          {/* Stats Card */}
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Stats</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-light-100 dark:bg-dark-100 rounded-lg">
                <p className="text-2xl font-bold text-primary-600">{userData.stats?.totalPosts || 0}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Posts</p>
              </div>
              <div className="text-center p-3 bg-light-100 dark:bg-dark-100 rounded-lg">
                <p className="text-2xl font-bold text-primary-600">{userData.stats?.totalMatches || 0}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Matches</p>
              </div>
            </div>
          </div>
        </div>

        {/* User's Posts */}
        <div className="bg-white dark:bg-dark-200 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Posts</h2>
          
          {/* Check if posts are private and user is not the owner or a friend */}
          {userData.settings?.postsVisibility === 'private' && 
           user?.uid !== id && 
           friendship !== 'friends' ? (
            <div className="text-center py-8">
              <div className="mx-auto h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
                <FaUser className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Posts are Private
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                This user's posts gallery is hidden. You need to be friends to view their posts.
              </p>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-8">
              <div className="mx-auto h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
                <FaUser className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No posts yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                This user hasn't shared any songs yet.
              </p>
            </div>
          ) : (
            <>
              {/* Gallery Grid */}
              <div className="grid grid-cols-3 gap-2 mb-6">
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
                    <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="text-white text-center">
                        <p className="text-xs font-medium truncate px-2">{post.songTitle}</p>
                        <p className="text-xs text-gray-300 truncate px-2">{post.songArtist}</p>
                        <p className="text-xs text-gray-300 px-2 mt-1">{formatPostDate(post.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Expanded Post View */}
              {selectedPost && posts.find(p => p.id === selectedPost) && (
                <div className="border-t border-gray-200 dark:border-dark-300 pt-6">
                  {(() => {
                    const post = posts.find(p => p.id === selectedPost)!;
                    return (
                      <div>
                        <div className="flex gap-4 mb-4">
                          <ClickableAlbumCover
                            coverArtUrl={post.songAlbumArt}
                            previewUrl={post.previewUrl}
                            songTitle={post.songTitle}
                            songArtist={post.songArtist}
                            size="large"
                          />
                          <div className="flex-1">
                            <h3 className="text-gray-900 dark:text-white font-semibold text-lg">
                              {post.songTitle}
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400">
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
                          {user && (
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
                          )}
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
                            {comments[post.id]?.length > 0 ? (
                              comments[post.id].map((comment) => (
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
                                    <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                                      {formatPostDate(comment.createdAt)}
                                    </p>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-gray-500 dark:text-gray-400 text-sm">No comments yet</p>
                            )}

                            {user && (
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
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile; 