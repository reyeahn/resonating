import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  updateDoc,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { getLastResetTime, getPacificTime } from './timeUtils';

// intelligent user matching and compatibility scoring

// interfaces for the matching algorithm
interface UserProfile {
  uid: string;
  questionnaire: {
    weekendSoundtrack: string;
    moodGenre: string;
    discoveryFrequency: string;
    favoriteSongMemory: string;
    preferredMoodTag: string;
  };
  musicPreferences?: {
    genres: string[];
    audioFeatures: {
      valence: number;      // happiness/positivity
      energy: number;       // intensity/power
      danceability: number; // how danceable
      acousticness: number; // acoustic vs electric
      tempo: number;        // BPM
    };
    moodTags: string[];
  };
  engagementHistory?: {
    likedPosts: string[];
    matchedUsers: string[];
    friendUsers: string[];
    postedMoods: string[];
  };
  friends?: string[];
}

interface PostWithMetadata {
  id: string;
  userId: string;
  song: {
    title: string;
    artist: string;
    album?: string;
    coverArtUrl?: string;
    spotifyId?: string;
    previewUrl?: string;
    audioFeatures?: {
      valence: number;
      energy: number;
      danceability: number;
      acousticness: number;
      tempo: number;
    };
    genres?: string[];
  };
  mood: string;
  moodTags?: string[];
  caption?: string;
  mediaUrl?: string; 
  mediaUrls?: string[]; 
  createdAt: Date;
  matchScore?: number; // calculated by algorithm
}

/**
 * calculates compatibility score between two users based on questionnaire responses
 */
const calculateQuestionnaireCompatibility = (user1: UserProfile, user2: UserProfile): number => {
  let score = 0;
  let totalQuestions = 0;

  // compare questionnaire responses with weighted scoring
  const questionnaire1 = user1.questionnaire;
  const questionnaire2 = user2.questionnaire;

  // 3eekend soundtrack similarity (high weight)
  if (questionnaire1.weekendSoundtrack && questionnaire2.weekendSoundtrack) {
    const similarity = calculateTextSimilarity(
      questionnaire1.weekendSoundtrack.toLowerCase(),
      questionnaire2.weekendSoundtrack.toLowerCase()
    );
    score += similarity * 25; // 25% weight
    totalQuestions += 25;
  }

  // mood genre preference (high weight)
  if (questionnaire1.moodGenre && questionnaire2.moodGenre) {
    const similarity = questionnaire1.moodGenre.toLowerCase() === questionnaire2.moodGenre.toLowerCase() ? 1 : 
                      calculateTextSimilarity(questionnaire1.moodGenre.toLowerCase(), questionnaire2.moodGenre.toLowerCase());
    score += similarity * 25; // 25% weight
    totalQuestions += 25;
  }

  // discovery frequency (medium weight)
  if (questionnaire1.discoveryFrequency && questionnaire2.discoveryFrequency) {
    const similarity = questionnaire1.discoveryFrequency === questionnaire2.discoveryFrequency ? 1 : 0.5;
    score += similarity * 20; // 20% weight
    totalQuestions += 20;
  }

  // preferred mood tag (medium weight)
  if (questionnaire1.preferredMoodTag && questionnaire2.preferredMoodTag) {
    const similarity = questionnaire1.preferredMoodTag.toLowerCase() === questionnaire2.preferredMoodTag.toLowerCase() ? 1 : 
                      calculateTextSimilarity(questionnaire1.preferredMoodTag.toLowerCase(), questionnaire2.preferredMoodTag.toLowerCase());
    score += similarity * 20; // 20% weight
    totalQuestions += 20;
  }

  // memory similarity (lower weight)
  if (questionnaire1.favoriteSongMemory && questionnaire2.favoriteSongMemory) {
    const similarity = calculateTextSimilarity(
      questionnaire1.favoriteSongMemory.toLowerCase(),
      questionnaire2.favoriteSongMemory.toLowerCase()
    );
    score += similarity * 10; // 10% weight
    totalQuestions += 10;
  }

  return totalQuestions > 0 ? score / totalQuestions : 0;
};

/**
 * calculates audio feature compatibility between user preferences and a post
 */
const calculateAudioFeatureCompatibility = (userPreferences: UserProfile['musicPreferences'], postAudioFeatures: any): number => {
  if (!userPreferences?.audioFeatures || !postAudioFeatures) return 0.5; // neutral score

  const userFeatures = userPreferences.audioFeatures;
  let score = 0;

  // compare each audio feature with appropriate weighting
  const features = [
    { name: 'valence', weight: 0.25 },      // Mood compatibility
    { name: 'energy', weight: 0.25 },       // Energy level compatibility  
    { name: 'danceability', weight: 0.20 }, // Activity level compatibility
    { name: 'acousticness', weight: 0.15 }, // Style preference
    { name: 'tempo', weight: 0.15 }         // Rhythm preference
  ];

  features.forEach(feature => {
    const userValue = userFeatures[feature.name as keyof typeof userFeatures];
    const postValue = postAudioFeatures[feature.name];
    
    if (userValue !== undefined && postValue !== undefined) {
      let similarity: number;
      
      if (feature.name === 'tempo') {
        // for tempo, calculate percentage difference
        const diff = Math.abs(userValue - postValue) / Math.max(userValue, postValue);
        similarity = Math.max(0, 1 - diff);
      } else {
        // for other features (0-1 scale), calculate absolute difference
        similarity = 1 - Math.abs(userValue - postValue);
      }
      
      score += similarity * feature.weight;
    }
  });

  return Math.max(0, Math.min(1, score));
};

/**
 * simple text similarity calculation using Jaccard similarity
 */
const calculateTextSimilarity = (text1: string, text2: string): number => {
  const words1 = new Set(text1.split(/\s+/).filter(word => word.length > 2));
  const words2 = new Set(text2.split(/\s+/).filter(word => word.length > 2));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return union.size === 0 ? 0 : intersection.size / union.size;
};

/**
 * updates user music preferences based on their engagement patterns
 */
export const updateUserMusicPreferences = async (userId: string): Promise<void> => {
  try {
    console.log(` Starting music preference update for user: ${userId}`);
    
    const swipesQuery = query(
      collection(db, 'swipes'),
      where('swiperId', '==', userId),
      where('direction', '==', 'right')
    );
    
    const likedSwipes = await getDocs(swipesQuery);
    const likedPostIds: string[] = [];
    
    likedSwipes.forEach(doc => {
      likedPostIds.push(doc.data().postId);
    });

    console.log(` Found ${likedPostIds.length} liked posts for preference analysis`);
    
    if (likedPostIds.length === 0) {
      console.log(' No liked posts found - skipping preference update');
      return;
    }

    // fetch full post data for liked posts
    const audioFeatures: any[] = [];
    const genres: string[] = [];
    const moodTags: string[] = [];
    let processedPosts = 0;

    for (const postId of likedPostIds.slice(-20)) { // Last 20 liked posts
      try {
        const postDoc = await getDoc(doc(db, 'posts', postId));
        if (postDoc.exists()) {
          const postData = postDoc.data();
          
          console.log(` Analyzing post ${postId}:`, {
            hasAudioFeatures: !!postData.song?.audioFeatures,
            hasGenres: !!postData.song?.genres,
            genres: postData.song?.genres || [],
            hasMoodTags: !!postData.moodTags,
            moodTags: postData.moodTags || [],
            mood: postData.mood
          });
          
          if (postData.song?.audioFeatures) {
            audioFeatures.push(postData.song.audioFeatures);
          }
          
          if (postData.song?.genres) {
            genres.push(...postData.song.genres);
          }
          
          if (postData.moodTags) {
            moodTags.push(...postData.moodTags);
          }
          
          processedPosts++;
        }
      } catch (error) {
        console.error(`Error fetching post ${postId}:`, error);
      }
    }

    console.log(` Processed ${processedPosts} posts for preference calculation`);
    console.log(` Found ${audioFeatures.length} audio features, ${genres.length} genres, ${moodTags.length} mood tags`);

    const preferences = {
      genres: [...new Set(genres)],
      audioFeatures: calculateAverageAudioFeatures(audioFeatures),
      moodTags: [...new Set(moodTags)]
    };

    console.log(` Calculated preferences:`, {
      uniqueGenres: preferences.genres.length,
      audioFeatures: preferences.audioFeatures,
      uniqueMoodTags: preferences.moodTags.length
    });

    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      musicPreferences: preferences,
      lastPreferencesUpdate: getPacificTime()
    });

    console.log(` Successfully updated music preferences for user: ${userId}`);

  } catch (error: any) {
    if (error.message?.includes('ERR_BLOCKED_BY_CLIENT') || 
        error.code === 'ERR_BLOCKED_BY_CLIENT' ||
        error.toString().includes('blocked')) {
      console.warn(' User preference update blocked by ad blocker - this is non-critical and will be retried later');
    } else {
      console.error(' Error updating user music preferences:', error);
    }
    // don't throw the error 
  }
};

/**
 * get current user music preferences for testing/debugging
 */
export const getUserMusicPreferences = async (userId: string): Promise<any> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return null;
    
    const userData = userDoc.data();
    return {
      musicPreferences: userData.musicPreferences || null,
      lastPreferencesUpdate: userData.lastPreferencesUpdate?.toDate?.() || userData.lastPreferencesUpdate || null,
      hasPreferences: !!userData.musicPreferences
    };
  } catch (error) {
    console.error('Error getting user music preferences:', error);
    return null;
  }
};

/**
 * nanually trigger preference update
 */
export const triggerPreferenceUpdate = async (userId: string): Promise<boolean> => {
  try {
    console.log(` Manually triggering preference update for user: ${userId}`);
    await updateUserMusicPreferences(userId);
    return true;
  } catch (error) {
    console.error('Error manually triggering preference update:', error);
    return false;
  }
};

/**
 * calculates average audio features from an array of feature objects
 */
const calculateAverageAudioFeatures = (features: any[]): any => {
  if (features.length === 0) return {};

  const sums = {
    valence: 0,
    energy: 0,
    danceability: 0,
    acousticness: 0,
    tempo: 0
  };

  let validFeatureCount = 0;

  features.forEach(feature => {
    if (feature && typeof feature === 'object') {
      Object.keys(sums).forEach(key => {
        if (feature[key] !== undefined && !isNaN(feature[key])) {
          sums[key as keyof typeof sums] += feature[key];
        }
      });
      validFeatureCount++;
    }
  });

  if (validFeatureCount === 0) return {};

  return {
    valence: sums.valence / validFeatureCount,
    energy: sums.energy / validFeatureCount,
    danceability: sums.danceability / validFeatureCount,
    acousticness: sums.acousticness / validFeatureCount,
    tempo: sums.tempo / validFeatureCount
  };
};

/**
 * main function to get intelligently matched posts for a user 
 */
export const getIntelligentMatches = async (userId: string): Promise<PostWithMetadata[]> => {
  try {
    // first, try to update user preferences 
    try {
      await updateUserMusicPreferences(userId);
    } catch (error: any) {
      // silently handle preference update failures 
      if (error.message?.includes('ERR_BLOCKED_BY_CLIENT') || error.toString().includes('blocked')) {
        console.warn(' Background preference update blocked - continuing with existing preferences');
      } else {
        console.warn(' Background preference update failed - continuing with existing preferences:', error);
      }
    }

    // get current user profile
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) throw new Error('User not found');
    
    const currentUser: UserProfile = {
      uid: userId,
      ...userDoc.data()
    } as UserProfile;

    const userFriends = currentUser.friends || [];
    
    const matchesQuery = query(
      collection(db, 'matches'),
      where('userIds', 'array-contains', userId)
    );
    const matchesSnapshot = await getDocs(matchesQuery);
    const matchedUserIds: string[] = [];
    
    matchesSnapshot.forEach(doc => {
      const matchData = doc.data();
      const otherUserId = matchData.userIds.find((id: string) => id !== userId);
      if (otherUserId) {
        matchedUserIds.push(otherUserId);
      }
    });

    // combine friends and matched users to exclude from discover
    const excludedUserIds = [...new Set([...userFriends, ...matchedUserIds])];
    console.log(`Excluding ${excludedUserIds.length} users from discover (friends + matches)`);

    // get posts that haven't been swiped yet
    const swipesQuery = query(
      collection(db, 'swipes'),
      where('swiperId', '==', userId)
    );
    
    const swipesSnapshot = await getDocs(swipesQuery);
    const swipedPostIds: string[] = [];
    
    swipesSnapshot.forEach(doc => {
      swipedPostIds.push(doc.data().postId);
    });

    // get all recent posts
    const lastReset = getLastResetTime();
    const postsQuery = query(
      collection(db, 'posts'),
      where('userId', '!=', userId),
      where('createdAt', '>', Timestamp.fromDate(lastReset)),
      orderBy('userId'),
      orderBy('createdAt', 'desc'),
      limit(100) 
    );

    const postsSnapshot = await getDocs(postsQuery);
    const candidatePosts: PostWithMetadata[] = [];

    console.log(` Found ${postsSnapshot.docs.length} posts from database query`);
    console.log(` Already swiped on ${swipedPostIds.length} posts`);

    // filter and score posts
    let processedCount = 0;
    let skippedAlreadySwiped = 0;
    let skippedExcludedUsers = 0;
    let skippedMissingAuthor = 0;
    
    for (const postDoc of postsSnapshot.docs) {
      if (swipedPostIds.includes(postDoc.id)) {
        skippedAlreadySwiped++;
        continue; // skip already swiped
      }

      const postData = postDoc.data();
      
      // EXCLUDE posts from friends and matched users
      if (excludedUserIds.includes(postData.userId)) {
        console.log(`Excluding post from ${postData.userId} (friend/match)`);
        skippedExcludedUsers++;
        continue;
      }

      // get the post author's profile for compatibility scoring
      const authorDoc = await getDoc(doc(db, 'users', postData.userId));
      if (!authorDoc.exists()) {
        skippedMissingAuthor++;
        continue;
      }

      const authorProfile: UserProfile = {
        uid: postData.userId,
        ...authorDoc.data()
      } as UserProfile;

      let matchScore = 0;

      // questionnaire compatibility (40% weight)
      const questionnaireScore = calculateQuestionnaireCompatibility(currentUser, authorProfile);
      matchScore += questionnaireScore * 0.4;

      // audio feature compatibility (30% weight)
      const audioScore = calculateAudioFeatureCompatibility(currentUser.musicPreferences, postData.song?.audioFeatures);
      matchScore += audioScore * 0.3;

      // mood tag compatibility (20% weight)
      const moodScore = calculateMoodCompatibility(currentUser, postData);
      matchScore += moodScore * 0.2;

      // engagement pattern bonus (10% weight)
      const engagementScore = calculateEngagementBonus(currentUser, authorProfile);
      matchScore += engagementScore * 0.1;

      candidatePosts.push({
        id: postDoc.id,
        userId: postData.userId,
        song: postData.song ? {
          title: postData.song.title || postData.songTitle || '',
          artist: postData.song.artist || postData.songArtist || '',
          album: postData.song.album || '',
          coverArtUrl: postData.song.coverArtUrl || postData.songAlbumArt || '',
          spotifyId: postData.song.spotifyId || postData.spotifyId || '',
          previewUrl: postData.song.previewUrl || postData.previewUrl || '',
          audioFeatures: postData.song.audioFeatures || postData.audioFeatures,
          genres: postData.song.genres || []
        } : {
          title: postData.songTitle || '',
          artist: postData.songArtist || '',
          album: '',
          coverArtUrl: postData.songAlbumArt || '',
          spotifyId: postData.spotifyId || '',
          previewUrl: postData.previewUrl || '',
          audioFeatures: postData.audioFeatures,
          genres: []
        },
        mood: postData.mood,
        moodTags: postData.moodTags,
        caption: postData.caption,
        mediaUrl: postData.mediaUrl,
        mediaUrls: postData.mediaUrls,
        createdAt: postData.createdAt?.toDate() || new Date(),
        matchScore
      });
      
      processedCount++;
    }

    console.log(` Processing summary:`);
    console.log(`  - Posts processed: ${processedCount}`);
    console.log(`  - Skipped (already swiped): ${skippedAlreadySwiped}`);
    console.log(`  - Skipped (excluded users): ${skippedExcludedUsers}`);
    console.log(`  - Skipped (missing author): ${skippedMissingAuthor}`);
    console.log(`  - Final candidate posts: ${candidatePosts.length}`);

 
    candidatePosts.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
    
    const finalPosts = candidatePosts.slice(0, 15);
    console.log(` Returning ${finalPosts.length} posts for discover feed`);
    
    return finalPosts;

  } catch (error: any) {
    console.error('Error getting intelligent matches:', error);
    
    // check if this is a blocking error and provide helpful info
    if (error.message?.includes('ERR_BLOCKED_BY_CLIENT') || error.toString().includes('blocked')) {
      console.warn(' Intelligent matching blocked by ad blocker - falling back to basic posts');
    }
    
    // return empty array instead of throwing - let the discover page handle fallback
    return [];
  }
};

/**
 * calculate mood compatibility between user and post
 */
const calculateMoodCompatibility = (user: UserProfile, postData: any): number => {
  const userMoodTags = user.musicPreferences?.moodTags || [];
  const postMoodTags = postData.moodTags || [postData.mood];
  
  if (userMoodTags.length === 0 || postMoodTags.length === 0) return 0.5;
  
  const commonMoods = userMoodTags.filter(mood => 
    postMoodTags.some(postMood => 
      mood.toLowerCase() === postMood.toLowerCase()
    )
  );
  
  return commonMoods.length / Math.max(userMoodTags.length, postMoodTags.length);
};

/**
 * calculate bonus score based on engagement patterns
 */
const calculateEngagementBonus = (user: UserProfile, author: UserProfile): number => {
  let bonus = 0;
  
  // bonus if user has previously matched with similar users
  if (user.engagementHistory?.matchedUsers && author.engagementHistory?.matchedUsers) {
    const commonMatches = user.engagementHistory.matchedUsers.filter(id =>
      author.engagementHistory?.matchedUsers?.includes(id)
    );
    bonus += commonMatches.length * 0.1; 
  }
  
  // bonus for similar posting patterns
  if (user.engagementHistory?.postedMoods && author.engagementHistory?.postedMoods) {
    const moodSimilarity = calculateTextSimilarity(
      user.engagementHistory.postedMoods.join(' '),
      author.engagementHistory.postedMoods.join(' ')
    );
    bonus += moodSimilarity * 0.2;
  }
  
  return Math.min(bonus, 1); 
}; 