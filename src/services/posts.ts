// daily song posts with 24-hour lifecycle management
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  deleteDoc,
  writeBatch,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { getLastResetTime, isAfterLastReset, getPacificTime } from './timeUtils';

export interface Post {
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
  song?: {
    title: string;
    artist: string;
    album?: string;
    coverArtUrl?: string;
    spotifyId?: string;
    previewUrl?: string;
    audioFeatures?: any;
    genres?: string[];
  };
  audioFeatures?: any;
  moodTags?: string[];
}

export interface Comment {
  id: string;
  userId: string;
  userDisplayName: string;
  userPhotoURL: string;
  content: string;
  createdAt: Date;
}

/**
 * Check if a post is still active
 */
export const isPostActive = (postCreatedAt: any): boolean => {
  return isAfterLastReset(postCreatedAt);
};

/**
 * Filter out expired posts from an array
 */
export const filterActivePosts = (posts: Post[]): Post[] => {
  return posts.filter(post => isPostActive(post.createdAt));
};

/**
 * Get all active posts 
 */
export const getActivePosts = async (): Promise<Post[]> => {
  try {
    const lastReset = getLastResetTime();
    
    const postsQuery = query(
      collection(db, 'posts'),
      where('createdAt', '>', Timestamp.fromDate(lastReset)),
      orderBy('createdAt', 'desc'),
      limit(100) 
    );

    const snapshot = await getDocs(postsQuery);
    const posts: Post[] = [];

    snapshot.forEach((doc) => {
      posts.push({
        id: doc.id,
        ...doc.data()
      } as Post);
    });

    return posts;
  } catch (error) {
    console.error('Error fetching active posts:', error);
    return [];
  }
};

/**
 * get user's active posts only
 */
export const getUserPosts = async (userId: string): Promise<Post[]> => {
  try {
    const lastReset = getLastResetTime();
    
    const postsQuery = query(
      collection(db, 'posts'),
      where('userId', '==', userId),
      where('createdAt', '>', Timestamp.fromDate(lastReset)),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(postsQuery);
    const posts: Post[] = [];

    snapshot.forEach((doc) => {
      posts.push({
        id: doc.id,
        ...doc.data()
      } as Post);
    });

    return posts;
  } catch (error) {
    console.error('Error fetching user posts:', error);
    return [];
  }
};

/**
 * clean up expired posts 
 */
export const cleanupExpiredPosts = async (): Promise<void> => {
  try {
    const lastReset = getLastResetTime();
    
    // get all posts older than last reset
    const expiredPostsQuery = query(
      collection(db, 'posts'),
      where('createdAt', '<', Timestamp.fromDate(lastReset))
    );

    const snapshot = await getDocs(expiredPostsQuery);
    
    if (snapshot.empty) {
      console.log('No expired posts to clean up');
      return;
    }

    // use batch to delete expired posts efficiently
    const batch = writeBatch(db);
    let deleteCount = 0;

    snapshot.forEach((postDoc) => {
      batch.delete(postDoc.ref);
      deleteCount++;
    });

    await batch.commit();
    console.log(`Cleaned up ${deleteCount} expired posts`);

    // also clean up related swipes and comments for expired posts
    await cleanupRelatedData(snapshot.docs.map(doc => doc.id));

  } catch (error) {
    console.error('Error cleaning up expired posts:', error);
  }
};

/**
 * clean up swipes and comments for expired posts
 */
const cleanupRelatedData = async (expiredPostIds: string[]): Promise<void> => {
  try {
    const batch = writeBatch(db);
    let cleanupCount = 0;


    for (const postId of expiredPostIds) {
      const swipesQuery = query(
        collection(db, 'swipes'),
        where('postId', '==', postId)
      );
      
      const swipesSnapshot = await getDocs(swipesQuery);
      swipesSnapshot.forEach((swipeDoc) => {
        batch.delete(swipeDoc.ref);
        cleanupCount++;
      });

      const commentsQuery = query(
        collection(db, 'comments'),
        where('postId', '==', postId)
      );
      
      const commentsSnapshot = await getDocs(commentsQuery);
      commentsSnapshot.forEach((commentDoc) => {
        batch.delete(commentDoc.ref);
        cleanupCount++;
      });
    }

    if (cleanupCount > 0) {
      await batch.commit();
      console.log(`Cleaned up ${cleanupCount} related swipes and comments`);
    }

  } catch (error) {
    console.error('Error cleaning up related data:', error);
  }
};

/**
 * create a new post with optional audio features
 */
export const createPost = async (
  userId: string,
  userDisplayName: string,
  userPhotoURL: string,
  songTitle: string,
  songArtist: string,
  songAlbumArt: string,
  spotifyId: string = '',
  previewUrl: string = '',
  mood: string,
  caption: string,
  audioFeatures?: any,
  songObject?: {
    title: string;
    artist: string;
    album?: string;
    coverArtUrl?: string;
    spotifyId?: string;
    previewUrl?: string;
    audioFeatures?: any;
    genres?: string[];
  },
  mediaUrls?: string[] 
): Promise<string> => {
  try {
    const postData: any = {
      userId,
      userDisplayName,
      userPhotoURL,
      songTitle,
      songArtist,
      songAlbumArt,
      mood,
      caption,
      likes: 0,
      comments: 0,
      createdAt: Timestamp.fromDate(getPacificTime()),
      updatedAt: Timestamp.fromDate(getPacificTime()),
      moodTags: [mood] 
    };
    
    // add optional Spotify fields if they exist
    if (spotifyId) {
      postData.spotifyId = spotifyId;
    }
    
    if (previewUrl) {
      postData.previewUrl = previewUrl;
    }
    
 
    if (mediaUrls && mediaUrls.length > 0) {
      postData.mediaUrls = mediaUrls;

      postData.mediaUrl = mediaUrls[0];
    }
    
    if (audioFeatures) {
      postData.audioFeatures = audioFeatures;
    }
    
    if (songObject) {
      postData.song = songObject;
    } else {
      const songData: any = {
        title: songTitle,
        artist: songArtist,
        album: songArtist, 
        coverArtUrl: songAlbumArt,
        genres: [] 
      };
      
      // only add optional fields if they have values
      if (spotifyId) {
        songData.spotifyId = spotifyId;
      }
      
      if (previewUrl) {
        songData.previewUrl = previewUrl;
      }
      
      if (audioFeatures) {
        songData.audioFeatures = audioFeatures;
      }
      
      postData.song = songData;
    }
    
    console.log('Creating post with audio features:', !!audioFeatures);
    const postRef = await addDoc(collection(db, 'posts'), postData);

    return postRef.id;
  } catch (error) {
    console.error('Error creating post:', error);
    throw error;
  }
};

export const getFeedPosts = async (userId: string): Promise<Post[]> => {
  try {
    const lastReset = getLastResetTime();
    
    // get user's friends
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();
    const friendIds = userData?.friends || [];

    if (friendIds.length === 0) {
      return [];
    }

    // query ACTIVE posts only from friends 
    const postsQuery = query(
      collection(db, 'posts'),
      where('userId', 'in', friendIds),
      where('createdAt', '>', Timestamp.fromDate(lastReset)),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const postsSnapshot = await getDocs(postsQuery);
    const posts = postsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate()
    })) as Post[];
    
    // get the actual comment counts for each post
    // by querying the comments collection
    for (let post of posts) {
      const commentsQuery = query(
        collection(db, 'comments'),
        where('postId', '==', post.id)
      );
      
      const commentsSnapshot = await getDocs(commentsQuery);
      (post as any).comments = commentsSnapshot.size;
    }

    return posts;
  } catch (error) {
    console.error('Error fetching feed posts:', error);
    throw error;
  }
};

/**
 * like/Unlike a post
 */
export const likePost = async (postId: string, userId: string): Promise<void> => {
  try {
    const postRef = doc(db, 'posts', postId);
    const postDoc = await getDoc(postRef);
    
    if (!postDoc.exists()) {
      throw new Error('Post not found');
    }

    const postData = postDoc.data();
    const likedBy = postData.likedBy || [];
    const userLiked = likedBy.includes(userId);

    if (userLiked) {
      // unlike the post
      const updatedLikedBy = likedBy.filter((id: string) => id !== userId);
      await updateDoc(postRef, {
        likes: Math.max(0, (postData.likes || 0) - 1),
        likedBy: updatedLikedBy
      });
    } else {
      // like the post
      await updateDoc(postRef, {
        likes: (postData.likes || 0) + 1,
        likedBy: [...likedBy, userId]
      });
    }
  } catch (error) {
    console.error('Error liking post:', error);
    throw error;
  }
};

/**
 * add a comment to a post
 */
export const addComment = async (
  postId: string,
  userId: string,
  content: string
): Promise<string> => {
  try {
    // add comment document
    const commentRef = await addDoc(collection(db, 'comments'), {
      postId,
      userId,
      content,
      createdAt: Timestamp.fromDate(getPacificTime())
    });

    // update post comment count
    const postRef = doc(db, 'posts', postId);
    const postDoc = await getDoc(postRef);
    
    if (postDoc.exists()) {
      const currentComments = postDoc.data().comments || 0;
      await updateDoc(postRef, {
        comments: currentComments + 1
      });
    }

    return commentRef.id;
  } catch (error) {
    console.error('Error adding comment:', error);
    throw error;
  }
};

/**
 * get comments for a post
 */
export const getPostComments = async (postId: string): Promise<Comment[]> => {
  try {
    const commentsQuery = query(
      collection(db, 'comments'),
      where('postId', '==', postId),
      orderBy('createdAt', 'asc')
    );

    const commentsSnapshot = await getDocs(commentsQuery);
    const comments = await Promise.all(
      commentsSnapshot.docs.map(async (docSnapshot) => {
        const commentData = docSnapshot.data();
        const userRef = doc(db, 'users', commentData.userId);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data();

        return {
          id: docSnapshot.id,
          userId: commentData.userId,
          userDisplayName: userData?.displayName || 'Anonymous',
          userPhotoURL: userData?.photoURL || '',
          content: commentData.content,
          createdAt: commentData.createdAt?.toDate()
        };
      })
    );

    return comments;
  } catch (error) {
    console.error('Error fetching comments:', error);
    throw error;
  }
};

// get a specific post by ID
export const getPostById = async (postId: string): Promise<Post | null> => {
  try {
    const postDoc = await getDoc(doc(db, 'posts', postId));
    
    if (!postDoc.exists()) {
      return null;
    }
    
    return {
      id: postDoc.id,
      ...postDoc.data(),
      createdAt: postDoc.data().createdAt?.toDate()
    } as Post;
  } catch (error) {
    console.error('Error fetching post:', error);
    throw error;
  }
};

/**
 * get recent posts for discover feed 
 */
export const getDiscoverPosts = async (userId: string, limitCount: number = 15): Promise<Post[]> => {
  try {
    const lastReset = getLastResetTime();
    
    // get active posts excluding user's own posts
    const postsQuery = query(
      collection(db, 'posts'),
      where('userId', '!=', userId),
      where('createdAt', '>', Timestamp.fromDate(lastReset)),
      orderBy('userId'), // Required for inequality filter
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(postsQuery);
    const posts: Post[] = [];

    snapshot.forEach((doc) => {
      posts.push({
        id: doc.id,
        ...doc.data()
      } as Post);
    });

    return posts;
  } catch (error) {
    console.error('Error fetching discover posts:', error);
    return [];
  }
};

// get posts from users that the current user has matched with (ACTIVE POSTS ONLY)

export const getMatchFeedPosts = async (userId: string): Promise<Post[]> => {
  try {
    console.log(`Getting match feed posts for user: ${userId}`);
    

    const { getMatchedUsersPosts } = await import('./matches');
    const matchedPosts = await getMatchedUsersPosts(userId);
    
    console.log(`Found ${matchedPosts.length} active posts from matched users (excluding friends)`);
    
    const posts: Post[] = matchedPosts.map(matchedPost => ({
      id: matchedPost.id,
      userId: matchedPost.userId,
      userDisplayName: matchedPost.userDisplayName,
      userPhotoURL: matchedPost.userPhotoURL || '',
      songTitle: matchedPost.songTitle,
      songArtist: matchedPost.songArtist,
      songAlbumArt: matchedPost.songAlbumArt,
      spotifyId: matchedPost.spotifyId,
      previewUrl: matchedPost.previewUrl,
      mood: matchedPost.mood,
      caption: matchedPost.caption,
      likes: matchedPost.likes,
      comments: matchedPost.comments,
      createdAt: matchedPost.createdAt,
      likedBy: [],
      mediaUrl: matchedPost.mediaUrl, 
      mediaUrls: matchedPost.mediaUrls 
    }));
    
    return posts;
  } catch (error) {
    console.error('Error getting match feed posts:', error);
    return [];
  }
};

/**
 * get user's posts for profile gallery (shows current month's posts)
 */
export const getUserProfilePosts = async (userId: string): Promise<Post[]> => {
  try {
    // get start of current month (Pacific Time)
    const pacificNow = getPacificTime();
    const currentMonthStart = new Date(pacificNow.getFullYear(), pacificNow.getMonth(), 1);
    
    const postsQuery = query(
      collection(db, 'posts'),
      where('userId', '==', userId),
      where('createdAt', '>', Timestamp.fromDate(currentMonthStart)),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(postsQuery);
    const posts: Post[] = [];

    snapshot.forEach((doc) => {
      posts.push({
        id: doc.id,
        ...doc.data()
      } as Post);
    });

    return posts;
  } catch (error) {
    console.error('Error fetching user profile posts:', error);
    return [];
  }
};


export const getUserArchivedPosts = async (userId: string): Promise<{
  [monthYear: string]: Post[]
}> => {
  try {
    const pacificNow = getPacificTime();
    const currentMonthStart = new Date(pacificNow.getFullYear(), pacificNow.getMonth(), 1);
    
    const postsQuery = query(
      collection(db, 'posts'),
      where('userId', '==', userId),
      where('createdAt', '<', Timestamp.fromDate(currentMonthStart)),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(postsQuery);
    const archivedPosts: { [monthYear: string]: Post[] } = {};

    snapshot.forEach((doc) => {
      const post = {
        id: doc.id,
        ...doc.data()
      } as Post;
      
      const postDate = post.createdAt instanceof Date ? post.createdAt : post.createdAt.toDate();
      const monthYear = `${postDate.getFullYear()}-${String(postDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (!archivedPosts[monthYear]) {
        archivedPosts[monthYear] = [];
      }
      archivedPosts[monthYear].push(post);
    });

    return archivedPosts;
  } catch (error) {
    console.error('Error fetching user archived posts:', error);
    return {};
  }
};


export const getUserPostsByMonth = async (
  userId: string, 
  year: number, 
  month: number 
): Promise<Post[]> => {
  try {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
    
    const postsQuery = query(
      collection(db, 'posts'),
      where('userId', '==', userId),
      where('createdAt', '>=', Timestamp.fromDate(monthStart)),
      where('createdAt', '<=', Timestamp.fromDate(monthEnd)),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(postsQuery);
    const posts: Post[] = [];

    snapshot.forEach((doc) => {
      posts.push({
        id: doc.id,
        ...doc.data()
      } as Post);
    });

    return posts;
  } catch (error) {
    console.error('Error fetching user posts by month:', error);
    return [];
  }
}; 