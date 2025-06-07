// swipe-based user discovery feed
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useAuth } from '@/hooks/useAuth';
import { FaHeart, FaTimes, FaPlay, FaPause, FaUser } from 'react-icons/fa';
import { getUnswiped, recordSwipe } from '@/services/swipes';
import { getIntelligentMatches } from '@/services/matchingAlgorithm';
import ClickableAlbumCover from '@/components/spotify/ClickableAlbumCover';
import PhotoCarousel from '@/components/PhotoCarousel';

interface Post {
  id: string;
  userId: string;
  userName?: string;
  userPhotoURL?: string;
  song: {
    title: string;
    artist: string;
    album: string;
    coverArtUrl: string;
    spotifyId?: string;
    previewUrl?: string;
  };
  caption: string;
  mediaUrl?: string; 
  mediaUrls?: string[]; 
  audioFeatures?: {
    valence: number;
    energy: number;
    tempo: number;
    danceability: number;
  };
  moodTags?: string[];
}

const Discover: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [matchFound, setMatchFound] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const router = useRouter();
  const { user, userData, refreshUserData } = useAuth();

  // if user is not logged in, redirect to home
  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }
    
    // if userData hasn't loaded yet, wait for it
    if (userData === undefined) {
      return;
    }
    
    // simple check: if user hasn't posted today, redirect to post-song
    if (userData && userData.hasPostedToday === false) {
      router.push('/post-song');
    }
  }, [user, userData, router]);

  // fetch posts from Firestore 
  useEffect(() => {
    const fetchPosts = async () => {
      if (!user) return;
      
      setIsLoading(true);
      
      try {
        console.log('Starting intelligent matching for user:', user.uid);
        
        const intelligentMatches = await getIntelligentMatches(user.uid);
        
        console.log(` Intelligent matching returned ${intelligentMatches.length} matches`);
        
        if (intelligentMatches.length > 0) {
          // convert to the format expected by the UI
          const fetchedPosts: Post[] = [];
          
          for (const match of intelligentMatches) {
            try {
              const userDoc = await getDoc(doc(db, 'users', match.userId));
              const userData = userDoc.exists() ? userDoc.data() : null;
              
              fetchedPosts.push({
                id: match.id,
                userId: match.userId,
                userName: userData?.displayName || 'User',
                userPhotoURL: userData?.photoURL || undefined,
                song: {
                  title: match.song.title,
                  artist: match.song.artist,
                  album: '',
                  coverArtUrl: match.song.coverArtUrl || '',
                  spotifyId: match.song.spotifyId || '',
                  previewUrl: match.song.previewUrl || ''
                },
                caption: match.caption || '',
                mediaUrl: match.mediaUrl,
                mediaUrls: match.mediaUrls,
                audioFeatures: match.song.audioFeatures,
                moodTags: match.moodTags || [match.mood]
              });
            } catch (err: any) {
              // handle individual post processing errors gracefully
              if (err.message?.includes('ERR_BLOCKED_BY_CLIENT') || err.toString().includes('blocked')) {
                console.warn(` Post ${match.id} blocked by ad blocker - skipping`);
              } else {
                console.error(`Error processing intelligent match ${match.id}:`, err);
              }
            }
          }
          
          setPosts(fetchedPosts);
          setIsLoading(false);
          return;
        }
        
        // fallback to original method
        console.log('No intelligent matches found, falling back to original method');
        
        // get IDs of posts that haven't been swiped yet
        const unswipedPostIds = await getUnswiped(user.uid);
        
        if (unswipedPostIds.length === 0) {
          setPosts([]);
          setIsLoading(false);
          return;
        }
        
        // limit to 15 posts maximum per day
        const limitedPostIds = unswipedPostIds.slice(0, 15);
        
        // fetch full post data for each unswiped post
        const fetchedPosts: Post[] = [];
        
        for (const postId of limitedPostIds) {
          try {
            const postDoc = await getDoc(doc(db, 'posts', postId));
            
            if (postDoc.exists()) {
              const postData = postDoc.data();
              
              const userDoc = await getDoc(doc(db, 'users', postData.userId));
              const userData = userDoc.exists() ? userDoc.data() : null;
              
              fetchedPosts.push({
                id: postDoc.id,
                userId: postData.userId,
                userName: userData?.displayName || 'User',
                userPhotoURL: userData?.photoURL || undefined,
                song: postData.song ? {
                  title: postData.song.title || postData.songTitle || '',
                  artist: postData.song.artist || postData.songArtist || '',
                  album: postData.song.album || '',
                  coverArtUrl: postData.song.coverArtUrl || postData.songAlbumArt || '',
                  spotifyId: postData.song.spotifyId || postData.spotifyId || '',
                  previewUrl: postData.song.previewUrl || postData.previewUrl || ''
                } : {
                  title: postData.songTitle || '',
                  artist: postData.songArtist || '',
                  album: '',
                  coverArtUrl: postData.songAlbumArt || '',
                  spotifyId: postData.spotifyId || '',
                  previewUrl: postData.previewUrl || ''
                },
                caption: postData.caption || '',
                mediaUrl: postData.mediaUrl,
                audioFeatures: postData.audioFeatures,
                moodTags: postData.moodTags || []
              });
            }
          } catch (err: any) {
            // handle individual post fetch errors 
            if (err.message?.includes('ERR_BLOCKED_BY_CLIENT') || err.toString().includes('blocked')) {
              console.warn(` Post ${postId} blocked by ad blocker - skipping`);
            } else {
              console.error(`Error fetching post ${postId}:`, err);
            }
          }
        }
        
        setPosts(fetchedPosts);
      } catch (error: any) {
        if (error.message?.includes('ERR_BLOCKED_BY_CLIENT') || error.toString().includes('blocked')) {
          console.warn(' Discover feed blocked by ad blocker - showing empty state');
          console.info(' To fix this: Try disabling ad blockers or use an incognito window');
        } else {
          console.error('Error fetching posts:', error);
        }
        setPosts([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPosts();
  }, [user]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [currentIndex]);

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // swipe handlers
  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    setIsDragging(true);
    if ('touches' in e) {
      setStartX(e.touches[0].clientX);
    } else {
      setStartX(e.clientX);
    }
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;
    
    let currentX;
    if ('touches' in e) {
      currentX = e.touches[0].clientX;
    } else {
      currentX = e.clientX;
    }
    
    const diff = currentX - startX;
    setOffsetX(diff);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    
    if (offsetX > 100) {
      handleLike();
    } else if (offsetX < -100) {
      handleDislike();
    }
    
    setOffsetX(0);
  };

  const handleLike = async () => {
    if (currentIndex >= posts.length || !user) return;
    
    try {
      const post = posts[currentIndex];
      
      const matchId = await recordSwipe(
        user.uid,
        post.id,
        post.userId,
        'right'
      );
      
      if (matchId) {
        setMatchFound(matchId);
        
        // store this match in local storage to ensure we can recover if navigation fails
        try {
          localStorage.setItem('lastMatchId', matchId);
          localStorage.setItem('lastMatchTime', new Date().toISOString());
        } catch (storageError) {
          console.error('Failed to store match in localStorage:', storageError);
        }
        
        setTimeout(() => {
          setMatchFound(null);
          setCurrentIndex(currentIndex + 1);
        }, 3000);
      } else {
        setCurrentIndex(currentIndex + 1);
      }
    } catch (error) {
      console.error('Error recording like:', error);
      // still move to next post even if there's an error
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleDislike = async () => {
    if (currentIndex >= posts.length || !user) return;
    
    try {
      const post = posts[currentIndex];
      
      // record the swipe in Firestore
      await recordSwipe(
        user.uid,
        post.id,
        post.userId,
        'left'
      );
      
      // move to next post
      setCurrentIndex(currentIndex + 1);
    } catch (error) {
      console.error('Error recording dislike:', error);
      // still move to next post even if there's an error
      setCurrentIndex(currentIndex + 1);
    }
  };

  // calculate card styles based on drag position
  const cardStyle = {
    transform: `translateX(${offsetX}px) rotate(${offsetX * 0.05}deg)`,
    opacity: offsetX !== 0 ? 1 - Math.min(Math.abs(offsetX) / 500, 0.5) : 1,
  };

  if (!user) return null;

  // display loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-light-100 dark:bg-dark-100 flex flex-col justify-center items-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
        <p className="mt-4 text-gray-700 dark:text-gray-300">Loading posts...</p>
      </div>
    );
  }

  // match found overlay
  if (matchFound) {
    return (
      <div className="min-h-screen bg-light-100 dark:bg-dark-100 flex flex-col justify-center items-center p-4 text-center">
        <div className="max-w-sm bg-white dark:bg-dark-200 p-8 rounded-xl shadow-lg animate-bounce">
          <div className="h-20 w-20 mx-auto bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center mb-4">
            <FaHeart className="h-10 w-10 text-primary-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            It's a Match!
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-6">
            You both liked each other's music taste. Start a conversation and connect through music!
          </p>
        </div>
      </div>
    );
  }

  // all cards viewed
  if (currentIndex >= posts.length) {
    return (
      <div className="min-h-screen bg-light-100 dark:bg-dark-100 flex flex-col justify-center items-center p-4 text-center">
        <div className="w-20 h-20 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center mb-4">
          <FaHeart className="h-10 w-10 text-primary-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {posts.length === 0 ? "No new posts available" : "You've seen all posts for today!"}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-sm">
          {posts.length === 0 
            ? "You've already interacted with all available posts. Check back later for new music from the community!"
            : "Come back tomorrow to discover more music connections."
          }
        </p>
        <div className="space-y-3">
          <button
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 block"
            onClick={() => router.push('/matches')}
          >
            Go to Matches
          </button>
          {posts.length === 0 && (
            <button
              className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 block"
              onClick={() => window.location.reload()}
            >
              Refresh Feed
            </button>
          )}
        </div>
      </div>
    );
  }

  const currentPost = posts[currentIndex];

  return (
    <div className="min-h-screen bg-light-100 dark:bg-dark-100 flex flex-col pt-16 pb-8 px-4">
      {/* Song card */}
      <div className="relative flex-grow flex justify-center items-center">
        <div
          ref={cardRef}
          className="max-w-sm w-full bg-white dark:bg-dark-200 rounded-xl shadow-lg overflow-hidden touch-none"
          style={cardStyle}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleTouchStart}
          onMouseMove={handleTouchMove}
          onMouseUp={handleTouchEnd}
          onMouseLeave={handleTouchEnd}
        >
          {/* Cover art */}
          <div className="relative w-full aspect-square">
            <ClickableAlbumCover
              coverArtUrl={currentPost.song.coverArtUrl}
              previewUrl={currentPost.song.previewUrl}
              songTitle={currentPost.song.title}
              songArtist={currentPost.song.artist}
              size="large"
              className="w-full h-full object-cover rounded-lg"
            />
            
            {/* Play button overlay */}
            {currentPost.song.previewUrl && (
              <button
                className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 transition-opacity hover:bg-opacity-40"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlayPause();
                }}
              >
                {isPlaying ? (
                  <FaPause className="h-16 w-16 text-white opacity-80" />
                ) : (
                  <FaPlay className="h-16 w-16 text-white opacity-80" />
                )}
              </button>
            )}
            
            {/* Audio element */}
            {currentPost.song.previewUrl && (
              <audio
                ref={audioRef}
                src={currentPost.song.previewUrl}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
              />
            )}
          </div>
          
          {/* Song info */}
          <div className="p-4">
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-300 dark:bg-gray-600">
                {currentPost.userPhotoURL ? (
                  <img
                    src={currentPost.userPhotoURL}
                    alt={currentPost.userName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FaUser className="h-5 w-5 text-gray-500" />
                  </div>
                )}
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  {currentPost.userName}
                </h3>
              </div>
            </div>
            
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
              {currentPost.song.title}
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              {currentPost.song.artist}
            </p>
            
            {currentPost.caption && (
              <p className="text-gray-600 dark:text-gray-400 italic mb-3">
                "{currentPost.caption}"
              </p>
            )}
            
            {/* Mood tags */}
            {currentPost.moodTags && currentPost.moodTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {currentPost.moodTags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-100 text-xs rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            
            {/* Photo carousel or single photo */}
            {(currentPost.mediaUrls && currentPost.mediaUrls.length > 0) ? (
              <div className="mt-3 rounded-lg overflow-hidden h-48">
                <PhotoCarousel
                  mediaUrls={currentPost.mediaUrls}
                  className="w-full h-full rounded-lg"
                  showCounter={true}
                  counterPosition="top-right"
                  showNavigation={true}
                />
              </div>
            ) : currentPost.mediaUrl ? (
              <div className="mt-3 rounded-lg overflow-hidden">
                <img
                  src={currentPost.mediaUrl}
                  alt="Attached media"
                  className="w-full h-auto"
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
      
      {/* Action buttons */}
      <div className="flex justify-center items-center gap-8 mt-6">
        <button
          className="w-16 h-16 flex items-center justify-center bg-white dark:bg-dark-200 text-red-500 rounded-full shadow-lg transform transition-transform hover:scale-110"
          onClick={handleDislike}
        >
          <FaTimes className="h-8 w-8" />
        </button>
        
        <button
          className="w-16 h-16 flex items-center justify-center bg-white dark:bg-dark-200 text-green-500 rounded-full shadow-lg transform transition-transform hover:scale-110"
          onClick={handleLike}
        >
          <FaHeart className="h-8 w-8" />
        </button>
      </div>
      
      {/* Card counter */}
      <div className="text-center mt-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {currentIndex + 1} of {posts.length}
        </p>
      </div>
    </div>
  );
};

export default Discover; 