// friends list and social feed management
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  collection, 
  doc, 
  getDocs, 
  query, 
  where, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  serverTimestamp,
  addDoc,
  getDoc,
  orderBy,
  limit as firestoreLimit,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/hooks/useAuth';
import { FaUser, FaSearch, FaUserFriends, FaUserPlus, FaUserMinus, FaCheck, FaTimes, FaHeart, FaRegHeart, FaComment } from 'react-icons/fa';
import { getFeedPosts, likePost, addComment, getPostComments } from '@/services/posts';
import { 
  sendFriendRequest as sendFriendRequestService, 
  getUserFriends as getUserFriendsService, 
  getPendingFriendRequests, 
  acceptFriendRequest as acceptFriendRequestService, 
  rejectFriendRequest as rejectFriendRequestService,
  removeFriend as removeFriendService,
  findUsers,
  Friend,
  FriendRequest as FriendRequestType
} from '@/services/friends';
import ClickableAlbumCover from '@/components/spotify/ClickableAlbumCover';
import PhotoCarousel from '@/components/PhotoCarousel';

type FriendStatus = 'not_friend' | 'pending_sent' | 'pending_received' | 'friends';

interface User {
  uid: string;
  displayName: string;
  photoURL: string | null;
  status: FriendStatus;
}

// local interface for friend request display
interface LocalFriendRequest {
  id: string;
  senderId: string;
  senderName: string;
  senderPhoto: string | null;
  receiverId: string;
  createdAt: any;
}

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

const Friends: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'feed' | 'friends' | 'requests' | 'search'>('feed');
  const [friends, setFriends] = useState<User[]>([]);
  const [requests, setRequests] = useState<LocalFriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<string | null>(null);
  const [comments, setComments] = useState<{[key: string]: any[]}>({});
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState<{[key: string]: boolean}>({});
  const router = useRouter();
  const { user, userData } = useAuth();

  // fetch friends and requests when component mounts
  useEffect(() => {
    if (user) {
      fetchFriends();
      fetchRequests();
    }
  }, [user]);

  useEffect(() => {
    const { tab } = router.query;
    if (tab === 'requests') {
      setActiveTab('requests');
    } else if (tab === 'friends') {
      setActiveTab('friends');
    } else if (tab === 'search') {
      setActiveTab('search');
    }
  }, [router.query]);

  useEffect(() => {
    if (user && activeTab === 'feed') {
      fetchPosts();
    }
  }, [user, activeTab]);

  useEffect(() => {
    if (user && activeTab === 'requests') {
      fetchRequests();
    }
  }, [user, activeTab]);

  // fetch friends
  const fetchFriends = async () => {
    if (!user) return;
    
    setIsLoading(true);
    
    try {
      const friendsList = await getUserFriendsService(user.uid);
      
      const mappedFriends = friendsList.map(friend => ({
        uid: friend.id,
        displayName: friend.displayName,
        photoURL: friend.photoURL || null,
        status: 'friends' as FriendStatus
      }));
      
      setFriends(mappedFriends);
    } catch (error) {
      console.error('Error fetching friends:', error);
      
      setFriends([]);
    } finally {
      setIsLoading(false);
    }
  };

  // fetch friend requests
  const fetchRequests = async () => {
    if (!user) return;
    
    try {
      const pendingRequests = await getPendingFriendRequests(user.uid);
      
      const formattedRequests: LocalFriendRequest[] = pendingRequests.map((request: FriendRequestType) => ({
        id: request.id,
        senderId: request.fromUserId,
        senderName: request.fromUserName || 'Unknown User',
        senderPhoto: request.fromUserPhoto || null,
        receiverId: request.toUserId,
        createdAt: request.createdAt
      }));
      
      setRequests(formattedRequests);
    } catch (error) {
      console.error('Error fetching friend requests:', error);
      setRequests([]);
    }
  };

  // search for users
  const handleSearch = async () => {
    if (!searchQuery.trim() || !user) return;
    
    setIsSearching(true);
    setSearchResults([]);
    
    try {
      const foundUsers = await findUsers(searchQuery, user.uid);
      
      // for each user, determine their friendship status with the current user
      const resultsWithStatus = await Promise.all(
        foundUsers.map(async (foundUser) => {
          // check if they're already friends
          const isFriend = friends.some(friend => friend.uid === foundUser.id);
          if (isFriend) {
            return {
              uid: foundUser.id,
              displayName: foundUser.displayName,
              photoURL: foundUser.photoURL || null,
              status: 'friends' as FriendStatus
            };
          }
          
          // check if there's a pending request 
          const pendingSentQuery = query(
            collection(db, 'friendRequests'),
            where('fromUserId', '==', user.uid),
            where('toUserId', '==', foundUser.id),
            where('status', '==', 'pending')
          );
          const pendingSentSnapshot = await getDocs(pendingSentQuery);
          if (!pendingSentSnapshot.empty) {
            return {
              uid: foundUser.id,
              displayName: foundUser.displayName,
              photoURL: foundUser.photoURL || null,
              status: 'pending_sent' as FriendStatus
            };
          }
          
          // check if there's a pending request from this user to current user
          const pendingReceivedQuery = query(
            collection(db, 'friendRequests'),
            where('fromUserId', '==', foundUser.id),
            where('toUserId', '==', user.uid),
            where('status', '==', 'pending')
          );
          const pendingReceivedSnapshot = await getDocs(pendingReceivedQuery);
          if (!pendingReceivedSnapshot.empty) {
            return {
              uid: foundUser.id,
              displayName: foundUser.displayName,
              photoURL: foundUser.photoURL || null,
              status: 'pending_received' as FriendStatus
            };
          }
          
          // if none of the above, they're not friends
          return {
            uid: foundUser.id,
            displayName: foundUser.displayName,
            photoURL: foundUser.photoURL || null,
            status: 'not_friend' as FriendStatus
          };
        })
      );
      
      setSearchResults(resultsWithStatus);
    } catch (error) {
      console.error('Error searching for users:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // send friend request
  const sendFriendRequest = async (targetUserId: string) => {
    if (!user) return;
    
    try {
      const displayName = userData?.displayName || user.displayName || 'User';
      
      // send the friend request via service
      await sendFriendRequestService(
        user.uid,
        targetUserId,
        displayName
      );
      
      setSearchResults(
        searchResults.map((u) =>
          u.uid === targetUserId ? { ...u, status: 'pending_sent' } : u
        )
      );
      
      alert('Friend request sent!');
    } catch (error) {
      console.error('Error sending friend request:', error);
      alert('Failed to send friend request. Please try again.');
    }
  };

  // cancel friend request
  const cancelFriendRequest = async (targetUserId: string) => {
    if (!user) return;
    
    try {
      setSearchResults(
        searchResults.map((u) =>
          u.uid === targetUserId ? { ...u, status: 'not_friend' } : u
        )
      );
      
      alert('Friend request canceled');
    } catch (error) {
      console.error('Error canceling friend request:', error);
    }
  };

  const acceptFriendRequest = async (requestId: string, senderId: string) => {
    if (!user) return;
    
    try {
      await acceptFriendRequestService(requestId);
      
      setRequests(requests.filter((r) => r.id !== requestId));
      
      const senderRequest = requests.find((r) => r.id === requestId);
      if (senderRequest) {
        setFriends([
          ...friends,
          {
            uid: senderId,
            displayName: senderRequest.senderName,
            photoURL: senderRequest.senderPhoto,
            status: 'friends',
          },
        ]);
      }
      
      alert('Friend request accepted');
    } catch (error) {
      console.error('Error accepting friend request:', error);
    }
  };

  // reject friend request
  const rejectFriendRequest = async (requestId: string) => {
    if (!user) return;
    
    try {
      await rejectFriendRequestService(requestId);
      
      setRequests(requests.filter((r) => r.id !== requestId));
      
      alert('Friend request rejected');
    } catch (error) {
      console.error('Error rejecting friend request:', error);
    }
  };

  // remove friend
  const removeFriend = async (friendId: string) => {
    if (!user) return;
    
    try {
      setFriends(friends.filter((f) => f.uid !== friendId));
      
      alert('Friend removed');
    } catch (error) {
      console.error('Error removing friend:', error);
    }
  };

  const fetchPosts = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      const realPosts = await getFeedPosts(user.uid);
      
      if (realPosts.length > 0) {
        setPosts(realPosts);
      } else {
        console.log('No feed posts found');
        setPosts([]);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      // use mock data in case of an error
      const mockPosts: Post[] = [
        {
          id: 'post1',
          userId: 'friend1',
          userDisplayName: 'Alex Johnson',
          userPhotoURL: 'https://i.pravatar.cc/150?img=1',
          songTitle: 'Starboy',
          songArtist: 'The Weeknd, Daft Punk',
          songAlbumArt: 'https://i.scdn.co/image/ab67616d0000b2734718e2b124f79258be7bc452',
          mood: 'Confident',
          caption: 'This track is on another level ',
          likes: 15,
          comments: 4,
          createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
          likedBy: [],
          previewUrl: 'https://p.scdn.co/mp3-preview/e7671d5b84028c218e4a345db1a8e1f9343cb308'
        },
        {
          id: 'post2',
          userId: 'friend2',
          userDisplayName: 'Sarah Wilson',
          userPhotoURL: 'https://i.pravatar.cc/150?img=2',
          songTitle: 'Blinding Lights',
          songArtist: 'The Weeknd',
          songAlbumArt: 'https://i.scdn.co/image/ab67616d0000b273c5649add07ed3720be9d5526',
          mood: 'Energetic',
          caption: 'Perfect for my morning run! ',
          likes: 23,
          comments: 7,
          createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
          likedBy: [],
          previewUrl: 'https://p.scdn.co/mp3-preview/7dde872ae66f74a37a5a6d0afd93d7529cf99ee1'
        }
      ];
      
      if (posts.length === 0) {
        setPosts(mockPosts);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async (postId: string) => {
    try {
      // get real comments using the comments service
      const postComments = await getPostComments(postId);
      
      // update the comments state with the fetched comments
      setComments(prev => ({ 
        ...prev, 
        [postId]: postComments 
      }));
    } catch (error) {
      console.error('Error fetching comments:', error);
      
      // fallback to mock comments if necessary
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
      // optionally refresh posts to ensure UI is in sync with backend
      fetchPosts();
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
      
      const userDisplayName = userData?.displayName || user.displayName || 'You';
      const userPhotoURL = userData?.photoURL || user.photoURL;
      
      const newCommentObj = {
        id: commentId || `temp-${Date.now()}`,
        userId: user.uid,
        userDisplayName,
        userPhotoURL,
        content: newComment.trim(),
        createdAt: new Date(),
      };
      
      // add the comment to the local state
      setComments(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), newCommentObj]
      }));
      
      // update the post's comment count in the local state
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

  if (!user) return null;

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
              activeTab === 'friends'
                ? 'border-b-2 border-primary-600 text-primary-600 dark:text-primary-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
            onClick={() => setActiveTab('friends')}
          >
            Friends ({friends.length})
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium relative ${
              activeTab === 'requests'
                ? 'border-b-2 border-primary-600 text-primary-600 dark:text-primary-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
            onClick={() => setActiveTab('requests')}
          >
            Requests
            {requests.length > 0 && (
              <span className="absolute top-0 right-0 -mt-1 -mr-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
                {requests.length}
              </span>
            )}
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'search'
                ? 'border-b-2 border-primary-600 text-primary-600 dark:text-primary-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
            onClick={() => setActiveTab('search')}
          >
            Find Friends
          </button>
        </div>

        {/* Content based on active tab */}
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
                  When your friends post songs, they'll appear here!
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className="bg-white dark:bg-dark-200 rounded-lg shadow-md overflow-hidden mb-4"
                  >
                    <div className="p-4">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
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

                      {/* Photo carousel or single photo */}
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

        {activeTab === 'friends' && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Your Friends</h2>
            
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Loading friends...</p>
              </div>
            ) : friends.length === 0 ? (
              <div className="bg-white dark:bg-dark-200 rounded-lg shadow-md p-6 text-center">
                <div className="mx-auto h-16 w-16 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center mb-4">
                  <FaUserFriends className="h-8 w-8 text-primary-600 dark:text-primary-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No friends yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Search for users or accept friend requests to connect with others.
                </p>
                <button
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                  onClick={() => setActiveTab('search')}
                >
                  Find Friends
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {friends.map((friend) => (
                  <div
                    key={friend.uid}
                    className="bg-white dark:bg-dark-200 rounded-lg shadow-md p-4 flex items-center"
                  >
                    <div className="h-12 w-12 rounded-full overflow-hidden mr-4">
                      {friend.photoURL ? (
                        <img 
                          src={friend.photoURL} 
                          alt={friend.displayName} 
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                          <FaUser className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-grow">
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {friend.displayName}
                      </h3>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        onClick={() => router.push(`/profile/${friend.uid}`)}
                      >
                        View Profile
                      </button>
                      <button
                        className="p-2 text-primary-500 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                        onClick={() => router.push(`/chat/${friend.uid}`)}
                      >
                        Chat
                      </button>
                      <button
                        className="p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        onClick={() => removeFriend(friend.uid)}
                      >
                        <FaUserMinus />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'requests' && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Friend Requests</h2>
            
            {requests.length === 0 ? (
              <div className="bg-white dark:bg-dark-200 rounded-lg shadow-md p-6 text-center">
                <div className="mx-auto h-16 w-16 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center mb-4">
                  <FaUserFriends className="h-8 w-8 text-primary-600 dark:text-primary-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No pending requests
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  You don't have any pending friend requests at the moment.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((request) => (
                  <div
                    key={request.id}
                    className="bg-white dark:bg-dark-200 rounded-lg shadow-md p-4 flex items-center"
                  >
                    <div className="h-12 w-12 rounded-full overflow-hidden mr-4">
                      {request.senderPhoto ? (
                        <img 
                          src={request.senderPhoto} 
                          alt={request.senderName} 
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                          <FaUser className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-grow">
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {request.senderName}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Sent a friend request
                      </p>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        className="p-2 text-green-500 hover:text-green-700"
                        onClick={() => acceptFriendRequest(request.id, request.senderId)}
                      >
                        <FaCheck />
                      </button>
                      <button
                        className="p-2 text-red-500 hover:text-red-700"
                        onClick={() => rejectFriendRequest(request.id)}
                      >
                        <FaTimes />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'search' && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Find Friends</h2>
            
            <div className="mb-4">
              <div className="flex">
                <div className="relative flex-grow">
                  <input
                    type="text"
                    placeholder="Search by name"
                    className="w-full p-2 pl-10 bg-white dark:bg-dark-200 border border-gray-300 dark:border-dark-400 rounded-l-md"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaSearch className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
                <button
                  className="px-4 py-2 bg-primary-600 text-white rounded-r-md hover:bg-primary-700"
                  onClick={handleSearch}
                  disabled={!searchQuery.trim() || isSearching}
                >
                  Search
                </button>
              </div>
            </div>
            
            {isSearching ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Searching...</p>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-3">
                {searchResults.map((result) => (
                  <div
                    key={result.uid}
                    className="bg-white dark:bg-dark-200 rounded-lg shadow-md p-4 flex items-center"
                  >
                    <div className="h-12 w-12 rounded-full overflow-hidden mr-4">
                      {result.photoURL ? (
                        <img 
                          src={result.photoURL} 
                          alt={result.displayName} 
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                          <FaUser className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-grow">
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {result.displayName}
                      </h3>
                    </div>
                    
                    <div>
                      {result.status === 'not_friend' && (
                        <button
                          className="p-2 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                          onClick={() => sendFriendRequest(result.uid)}
                        >
                          <FaUserPlus />
                        </button>
                      )}
                      
                      {result.status === 'pending_sent' && (
                        <button
                          className="p-2 text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300"
                          onClick={() => cancelFriendRequest(result.uid)}
                        >
                          Cancel Request
                        </button>
                      )}
                      
                      {result.status === 'friends' && (
                        <span className="text-green-600 dark:text-green-400">
                          Friends
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : searchQuery && !isSearching ? (
              <div className="bg-white dark:bg-dark-200 rounded-lg shadow-md p-6 text-center">
                <p className="text-gray-600 dark:text-gray-400">
                  No users found matching "{searchQuery}"
                </p>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default Friends; 