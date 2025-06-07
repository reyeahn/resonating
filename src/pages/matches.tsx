import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import { FaUser, FaUserFriends, FaUserPlus, FaComment, FaHeart, FaMusic, FaRegHeart } from 'react-icons/fa';
import { getUserMatches, Match as MatchType } from '@/services/matches';
import { getMatchFeedPosts, likePost, addComment, getPostComments } from '@/services/posts';
import { 
  sendFriendRequest, 
  getUserFriends, 
  getPendingFriendRequests
} from '@/services/friends';
import ClickableAlbumCover from '@/components/spotify/ClickableAlbumCover';
import PhotoCarousel from '@/components/PhotoCarousel';
import SpotifyConnect from '@/components/spotify/SpotifyConnect';
import { formatPostDate } from '@/services/timeUtils';

// matched users display and conversation access

type FriendStatus = 'not_friend' | 'pending_sent' | 'pending_received' | 'friends';

interface MatchedUser {
  uid: string;
  displayName: string;
  photoURL: string | null;
  bio?: string;
  matchId: string;
  matchDate: Date;
  friendStatus: FriendStatus;
}

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

const Matches: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'feed' | 'matches'>('feed');
  const [matchedUsers, setMatchedUsers] = useState<MatchedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  
  // feed tab state
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<{[key: string]: any[]}>({});
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState<{[key: string]: boolean}>({});
  
  const router = useRouter();
  const { user, userData } = useAuth();

  // fetch matches and determine friend status
  useEffect(() => {
    if (!user) return;
    
    const fetchMatches = async () => {
      setIsLoading(true);
      
      try {
        const matches = await getUserMatches(user.uid);
        console.log('Found matches:', matches.length);
        
        // get friend requests and friends for status checking
        const [pendingRequests, userFriends] = await Promise.all([
          getPendingFriendRequests(user.uid),
          getUserFriends(user.uid)
        ]);
        
        setFriendRequests(pendingRequests);
        setFriends(userFriends);
        
        //  matches to MatchedUser format
        const matchedUsersData: MatchedUser[] = [];
        
        for (const match of matches) {
          // find the other user 
          const otherUserId = match.userIds.find(id => id !== user.uid);
          
          if (!otherUserId || !match.users[otherUserId]) {
            continue;
          }
          
          const otherUser = match.users[otherUserId];
          
          let friendStatus: FriendStatus = 'not_friend';
          
          if (userFriends.some(friend => friend.id === otherUserId)) {
            friendStatus = 'friends';
          } else {
            // check pending requests
            const sentRequest = pendingRequests.find(req => 
              req.toUserId === otherUserId && req.fromUserId === user.uid
            );
            const receivedRequest = pendingRequests.find(req => 
              req.fromUserId === otherUserId && req.toUserId === user.uid
            );
            
            if (sentRequest) {
              friendStatus = 'pending_sent';
            } else if (receivedRequest) {
              friendStatus = 'pending_received';
            }
          }
          
          matchedUsersData.push({
            uid: otherUserId,
            displayName: otherUser.displayName || 'Unknown User',
            photoURL: otherUser.photoURL || null,
            bio: otherUser.bio || '',
            matchId: match.id,
            matchDate: match.createdAt,
            friendStatus
          });
        }
        
        // sort by most recent matches first
        matchedUsersData.sort((a, b) => 
          new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime()
        );
        
        setMatchedUsers(matchedUsersData);
        console.log(' Processed matched users:', matchedUsersData.length);
        
      } catch (error) {
        console.error('Error fetching matches:', error);
        setMatchedUsers([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchMatches();
  }, [user]);

  // fetch posts for feed tab
  useEffect(() => {
    if (user && activeTab === 'feed') {
      fetchPosts();
    }
  }, [user, activeTab]);

  const fetchPosts = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // et posts from matched users 
      const posts = await getMatchFeedPosts(user.uid);
      
      // transform posts to match expected format
      const formattedPosts = posts.map(post => ({
        id: post.id,
        userId: post.userId,
        userDisplayName: post.userDisplayName,
        userPhotoURL: post.userPhotoURL,
        songTitle: post.songTitle,
        songArtist: post.songArtist,
        songAlbumArt: post.songAlbumArt,
        spotifyId: post.spotifyId,
        previewUrl: post.previewUrl,
        mood: post.mood,
        caption: post.caption,
        likes: post.likes,
        comments: post.comments,
        createdAt: post.createdAt,
        likedBy: post.likedBy || [],
        mediaUrl: post.mediaUrl,
        mediaUrls: post.mediaUrls
      }));
      
      setPosts(formattedPosts);
    } catch (error) {
      console.error('Error fetching posts:', error);
      setPosts([]);
    } finally {
      setLoading(false);
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
      fetchPosts();
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
      
      // get the user's display name and photo URL for the new comment
      const userDisplayName = userData?.displayName || user.displayName || 'You';
      const userPhotoURL = userData?.photoURL || user.photoURL;
      
      // create a new comment object
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

  const fetchComments = async (postId: string) => {
    try {
      // get real comments using the service
      const postComments = await getPostComments(postId);
      
      setComments(prev => ({ 
        ...prev, 
        [postId]: postComments 
      }));
    } catch (error) {
      console.error('Error fetching comments:', error);
      
      setComments(prev => ({ 
        ...prev, 
        [postId]: [{
          id: `error-${Date.now()}`,
          userId: 'system',
          userDisplayName: 'System',
          userPhotoURL: '',
          content: 'Unable to load comments. Please try again later.',
          createdAt: new Date()
        }]
      }));
    }
  };

  const toggleComments = async (postId: string) => {
    if (!showComments[postId]) {
      await fetchComments(postId);
    }
    setShowComments(prev => ({ ...prev, [postId]: !prev[postId] }));
  };

  const handleSendFriendRequest = async (targetUserId: string) => {
    if (!user) return;
    
    try {
      await sendFriendRequest(user.uid, targetUserId, userData?.displayName || 'User');
      
      setMatchedUsers(prev => 
        prev.map(matchedUser => 
          matchedUser.uid === targetUserId
            ? { ...matchedUser, friendStatus: 'pending_sent' }
            : matchedUser
        )
      );
      
      console.log(' Friend request sent successfully');
      
      // refresh both matches and posts to reflect any changes
      if (activeTab === 'feed') {
        fetchPosts();
      }
      
    } catch (error) {
      console.error('Error sending friend request:', error);
    }
  };

  // add a function to refresh matches when friend status changes
  const refreshMatches = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      
      const matches = await getUserMatches(user.uid);
      console.log(' Refreshed matches:', matches.length);
      
      const [pendingRequests, userFriends] = await Promise.all([
        getPendingFriendRequests(user.uid),
        getUserFriends(user.uid)
      ]);
      
      setFriendRequests(pendingRequests);
      setFriends(userFriends);
      
      const matchedUsersData: MatchedUser[] = [];
      
      for (const match of matches) {
        const otherUserId = match.userIds.find(id => id !== user.uid);
        
        if (!otherUserId || !match.users[otherUserId]) {
          continue;
        }
        
        const otherUser = match.users[otherUserId];
        
        let friendStatus: FriendStatus = 'not_friend';
        
        if (userFriends.some(friend => friend.id === otherUserId)) {
          friendStatus = 'friends';
        } else {
          const sentRequest = pendingRequests.find(req => 
            req.toUserId === otherUserId && req.fromUserId === user.uid
          );
          const receivedRequest = pendingRequests.find(req => 
            req.fromUserId === otherUserId && req.toUserId === user.uid
          );
          
          if (sentRequest) {
            friendStatus = 'pending_sent';
          } else if (receivedRequest) {
            friendStatus = 'pending_received';
          }
        }
        
        matchedUsersData.push({
          uid: otherUserId,
          displayName: otherUser.displayName || 'Unknown User',
          photoURL: otherUser.photoURL || null,
          bio: otherUser.bio || '',
          matchId: match.id,
          matchDate: match.createdAt,
          friendStatus
        });
      }
      
      // sort by most recent matches first
      matchedUsersData.sort((a, b) => 
        new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime()
      );
      
      setMatchedUsers(matchedUsersData);
      
      // also refresh posts if we're on the feed tab
      if (activeTab === 'feed') {
        fetchPosts();
      }
      
    } catch (error) {
      console.error('Error refreshing matches:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // refresh matches when the component becomes visible or when tab changes
  useEffect(() => {
    if (user && activeTab === 'matches') {
      refreshMatches();
    }
  }, [user, activeTab]);

  // listen for visibility changes to refresh when user comes back to the page
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user) {
        console.log(' Page became visible, refreshing matches...');
        refreshMatches();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user]);

  const handleStartChat = (matchId: string, userId: string) => {
    router.push(`/chat/${matchId}`);
  };

  const handleViewProfile = (userId: string) => {
    router.push(`/profile/${userId}`);
  };

  const getFriendStatusButton = (matchedUser: MatchedUser) => {
    switch (matchedUser.friendStatus) {
      case 'friends':
        return (
          <div className="flex items-center text-green-600 dark:text-green-400 text-sm">
            <FaUserFriends className="mr-1" />
            Friends
          </div>
        );
      case 'pending_sent':
        return (
          <div className="flex items-center text-yellow-600 dark:text-yellow-400 text-sm">
            <FaUserPlus className="mr-1" />
            Request Sent
          </div>
        );
      case 'pending_received':
        return (
          <button 
            className="flex items-center text-blue-600 dark:text-blue-400 text-sm hover:text-blue-700 dark:hover:text-blue-300"
            onClick={() => router.push('/friends?tab=requests')}
          >
            <FaUserPlus className="mr-1" />
            Accept Request
          </button>
        );
      default:
        return (
          <button
            onClick={() => handleSendFriendRequest(matchedUser.uid)}
            className="flex items-center text-primary-600 dark:text-primary-400 text-sm hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
          >
            <FaUserPlus className="mr-1" />
            Add Friend
          </button>
        );
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">Please log in to view your matches.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-light-100 dark:bg-dark-100 pt-16 pb-20 px-4">
      <div className="max-w-lg mx-auto">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-dark-300 mb-6">
          <button
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'feed'
                ? 'border-b-2 border-primary-600 text-primary-600 dark:text-primary-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
            onClick={() => setActiveTab('feed')}
          >
            Feed
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'matches'
                ? 'border-b-2 border-primary-600 text-primary-600 dark:text-primary-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
            onClick={() => setActiveTab('matches')}
          >
            Matches ({matchedUsers.length})
          </button>
        </div>

        {/* Feed Tab Content */}
        {activeTab === 'feed' && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Your Feed</h2>
            
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Loading posts...</p>
              </div>
            ) : posts.length === 0 ? (
              <div className="bg-white dark:bg-dark-200 rounded-lg shadow-md p-6 text-center">
                <div className="mx-auto h-16 w-16 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center mb-4">
                  <FaUserFriends className="h-8 w-8 text-primary-600 dark:text-primary-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No posts yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  When your matches post songs today, they'll appear here!
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className="bg-white dark:bg-dark-200 rounded-lg shadow-md overflow-hidden"
                  >
                    <div className="p-4">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-700">
                          {post.userPhotoURL ? (
                            <img
                              src={post.userPhotoURL}
                              alt={post.userDisplayName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                              <FaUser className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                            </div>
                          )}
                        </div>
                        <div>
                          <h3 className="text-gray-900 dark:text-white font-semibold">
                            {post.userDisplayName}
                          </h3>
                          <p className="text-gray-500 dark:text-gray-400 text-sm">
                            {new Date(post.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-4 mb-4">
                        <ClickableAlbumCover
                          coverArtUrl={post.songAlbumArt}
                          previewUrl={post.previewUrl}
                          songTitle={post.songTitle}
                          songArtist={post.songArtist}
                          size="large"
                        />
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

                      <div className="flex items-center gap-6">
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
                        <div className="mt-4 space-y-4">
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
                                <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                                  {new Date(comment.createdAt).toLocaleDateString()}
                                </p>
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
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Matches Tab Content */}
        {activeTab === 'matches' && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Your Matches</h2>
            
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Loading your matches...</p>
              </div>
            ) : matchedUsers.length === 0 ? (
              <div className="bg-white dark:bg-dark-200 rounded-lg shadow-md p-6 text-center">
                <div className="mx-auto h-16 w-16 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center mb-4">
                  <FaMusic className="h-8 w-8 text-primary-600 dark:text-primary-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No matches yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Start swiping on posts to find people with similar music taste!
                </p>
                <button
                  onClick={() => router.push('/discover')}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                >
                  Go to Discover
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {matchedUsers.length} {matchedUsers.length === 1 ? 'match' : 'matches'} found
                </p>
                
                {matchedUsers.map((matchedUser) => (
                  <div
                    key={matchedUser.uid}
                    className="bg-white dark:bg-dark-200 rounded-lg shadow-md p-4"
                  >
                    <div className="flex items-center gap-4">
                      {/* User Avatar */}
                      <div className="h-14 w-14 rounded-full overflow-hidden flex-shrink-0">
                        {matchedUser.photoURL ? (
                          <img 
                            src={matchedUser.photoURL} 
                            alt={matchedUser.displayName} 
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                            <FaUser className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                          </div>
                        )}
                      </div>
                      
                      {/* User Info */}
                      <div className="flex-grow min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {matchedUser.displayName}
                        </h3>
                        {matchedUser.bio && (
                          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1 truncate">
                            {matchedUser.bio}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2">
                          <p className="text-xs text-gray-500 dark:text-gray-500">
                            Matched {new Date(matchedUser.matchDate).toLocaleDateString()}
                          </p>
                          {getFriendStatusButton(matchedUser)}
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleViewProfile(matchedUser.uid)}
                          className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-dark-500 rounded hover:bg-gray-100 dark:hover:bg-dark-400 transition-colors"
                        >
                          Profile
                        </button>
                        <button
                          onClick={() => handleStartChat(matchedUser.matchId, matchedUser.uid)}
                          className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors flex items-center gap-1"
                        >
                          <FaComment className="h-3 w-3" />
                          Chat
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Matches; 