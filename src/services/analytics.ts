import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  setDoc,
  orderBy,
  Timestamp,
  limit
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { getPacificTime } from './timeUtils';

// user engagement tracking and insights generation

// OpenAI Integration for analytics
interface OpenAIAnalysisRequest {
  userData: {
    posts: any[];
    engagement: any;
    musicPreferences: any;
    questionnaire: any;
  };
  timeframe: string;
}

interface OpenAIInsights {
  personalizedInsights: string[];
  musicTasteAnalysis: string;
  moodPatternAnalysis: string;
  engagementAdvice: string[];
  weeklyHighlights: string[];
}

export interface MoodAnalysis {
  mood: string;
  count: number;
  percentage: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface EngagementMetrics {
  postsLiked: number;
  postsShared: number;
  commentsGiven: number;
  matchesReceived: number;
  avgEngagementScore: number;
}

export interface MusicPreferenceInsights {
  topGenres: { genre: string; count: number }[];
  avgAudioFeatures: {
    valence: number;    // happiness level
    energy: number;     // energy level
    danceability: number;
    tempo: number;
  };
  moodProgression: {
    date: string;
    averageMood: number; // 0-1 scale
    dominantMood: string;
  }[];
}

export interface WeeklyReport {
  weekStart: Date;
  weekEnd: Date;
  userId: string;
  moodAnalysis: MoodAnalysis[];
  engagementMetrics: EngagementMetrics;
  musicInsights: MusicPreferenceInsights;
  insights: string[];
  recommendations: string[];
  aiGeneratedInsights?: OpenAIInsights; 
  generatedAt: Date;
}

/**
 *  enhanced insights using OpenAI API
 */
const generateOpenAIInsights = async (analysisData: OpenAIAnalysisRequest): Promise<OpenAIInsights | null> => {
  try {

    const prompt = `
You are a music psychology expert analyzing a user's weekly music engagement data. 
Please provide personalized insights based on this data:

USER DATA:
Posts: ${JSON.stringify(analysisData.userData.posts.map(p => ({ 
  mood: p.mood, 
  songTitle: p.songTitle, 
  songArtist: p.songArtist, 
  audioFeatures: p.song?.audioFeatures,
  caption: p.caption 
})))}

Engagement: Liked ${analysisData.userData.engagement.likes?.length || 0} posts, 
Made ${analysisData.userData.engagement.comments?.length || 0} comments, 
Got ${analysisData.userData.engagement.matches?.length || 0} matches

Music Preferences: ${JSON.stringify(analysisData.userData.musicPreferences)}

Questionnaire Responses: ${JSON.stringify(analysisData.userData.questionnaire)}

Timeframe: ${analysisData.timeframe}

Please provide:
1. 3-5 personalized insights about their music behavior and psychology
2. A detailed music taste analysis (2-3 sentences)
3. A mood pattern analysis based on their posts (2-3 sentences) 
4. 3-4 specific actionable engagement tips
5. 2-3 weekly highlights or achievements

Format as JSON with fields: personalizedInsights, musicTasteAnalysis, moodPatternAnalysis, engagementAdvice, weeklyHighlights
Keep insights personal, encouraging, and music-focused. Be specific about their patterns.
`;

    const response = await fetch('/api/openai-insights', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      console.warn('OpenAI API request failed, falling back to rule-based insights');
      return null;
    }

    const data = await response.json();
    return data.insights as OpenAIInsights;
  } catch (error) {
    console.error('Error calling OpenAI for insights:', error);
    return null;
  }
};

/**
 * generate comprehensive weekly analytics for a user with AI enhancement
 * can generate reports for any week, supporting historical analysis from the 1st of each month
 */
export const generateWeeklyAnalytics = async (userId: string, weekStart?: Date): Promise<WeeklyReport> => {
  const startDate = weekStart || getWeekStart();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 7);
  endDate.setHours(23, 59, 59, 999); // End of day

  console.log(`Generating analytics for ${userId} from ${startDate.toISOString()} to ${endDate.toISOString()}`);

  try {
    const userPosts = await getUserWeeklyPosts(userId, startDate, endDate);
    console.log(`Found ${userPosts.length} posts for the week`);
    
    const userEngagement = await getUserWeeklyEngagement(userId, startDate, endDate);
    console.log(`Found engagement: ${userEngagement.likes?.length || 0} likes, ${userEngagement.comments?.length || 0} comments, ${userEngagement.matches?.length || 0} matches`);
    
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userProfile = userDoc.exists() ? userDoc.data() : {};
    
    const moodAnalysis = analyzeMoodPatterns(userPosts, userEngagement);
    
    const engagementMetrics = calculateEngagementMetrics(userEngagement);
    
    const musicInsights = await generateMusicInsights(userId, userPosts, userEngagement);
    
    // try to get AI-enhanced insights
    let aiGeneratedInsights: OpenAIInsights | null = null;
    try {
      const openAIResult = await generateOpenAIInsights({
        userData: {
          posts: userPosts,
          engagement: userEngagement,
          musicPreferences: userProfile.musicPreferences || {},
          questionnaire: userProfile.questionnaire || {}
        },
        timeframe: `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`
      });
      
      if (openAIResult) {
        aiGeneratedInsights = openAIResult;
        console.log(' AI insights generated successfully');
      }
    } catch (aiError) {
      console.warn('AI insights generation failed, using fallback:', aiError);
      aiGeneratedInsights = null;
    }
    
    const insights = aiGeneratedInsights?.personalizedInsights || 
                    generateInsights(moodAnalysis, engagementMetrics, musicInsights, startDate, endDate);
    
    const recommendations = aiGeneratedInsights?.engagementAdvice || 
                          generateRecommendations(moodAnalysis, engagementMetrics, musicInsights, startDate, endDate);

    const report: WeeklyReport = {
      weekStart: startDate,
      weekEnd: endDate,
      userId,
      moodAnalysis,
      engagementMetrics,
      musicInsights,
      insights,
      recommendations,
      generatedAt: getPacificTime()
    };

    if (aiGeneratedInsights) {
      report.aiGeneratedInsights = aiGeneratedInsights;
    }

    await saveWeeklyReport(userId, report);
    
    console.log(' Weekly analytics generated and saved successfully');
    return report;
  } catch (error) {
    console.error('Error generating weekly analytics:', error);
    throw error;
  }
};

/**
 * get the start of the current week (Monday) in Pacific Time
 */
const getWeekStart = (): Date => {
  const now = getPacificTime();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday = 0
  return new Date(now.setDate(diff));
};

/**
 * fetch user's posts for a specific week
 */
const getUserWeeklyPosts = async (userId: string, startDate: Date, endDate: Date) => {
  const postsQuery = query(
    collection(db, 'posts'),
    where('userId', '==', userId),
    where('createdAt', '>=', Timestamp.fromDate(startDate)),
    where('createdAt', '<=', Timestamp.fromDate(endDate)),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(postsQuery);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate()
  }));
};

/**
 * fetch user's engagement activities for a specific week
 */
const getUserWeeklyEngagement = async (userId: string, startDate: Date, endDate: Date) => {
  // get likes (swipes right)
  const likesQuery = query(
    collection(db, 'swipes'),
    where('swiperId', '==', userId),
    where('direction', '==', 'right'),
    where('timestamp', '>=', Timestamp.fromDate(startDate)),
    where('timestamp', '<=', Timestamp.fromDate(endDate))
  );

  // get comments
  const commentsQuery = query(
    collection(db, 'comments'),
    where('userId', '==', userId),
    where('createdAt', '>=', Timestamp.fromDate(startDate)),
    where('createdAt', '<=', Timestamp.fromDate(endDate))
  );

  // get matches
  const matchesQuery = query(
    collection(db, 'matches'),
    where('userIds', 'array-contains', userId),
    where('createdAt', '>=', Timestamp.fromDate(startDate)),
    where('createdAt', '<=', Timestamp.fromDate(endDate))
  );

  const [likesSnapshot, commentsSnapshot, matchesSnapshot] = await Promise.all([
    getDocs(likesQuery),
    getDocs(commentsQuery),
    getDocs(matchesQuery)
  ]);

  return {
    likes: likesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    comments: commentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    matches: matchesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  };
};

/**
 * analyze mood patterns from posts and engagement
 */
const analyzeMoodPatterns = (posts: any[], engagement: any): MoodAnalysis[] => {
  const moodCounts: { [key: string]: number } = {};
  
  // count moods from posts
  posts.forEach(post => {
    const mood = post.mood || 'Unknown';
    moodCounts[mood] = (moodCounts[mood] || 0) + 1;
  });

  
  const totalPosts = posts.length;
  const moodAnalysis: MoodAnalysis[] = [];

  Object.entries(moodCounts).forEach(([mood, count]) => {
    moodAnalysis.push({
      mood,
      count,
      percentage: totalPosts > 0 ? (count / totalPosts) * 100 : 0,
      trend: 'stable' 
    });
  });

  return moodAnalysis.sort((a, b) => b.count - a.count);
};

/**
 * calculate engagement metrics
 */
const calculateEngagementMetrics = (engagement: any): EngagementMetrics => {
  return {
    postsLiked: engagement.likes?.length || 0,
    postsShared: 0, 
    commentsGiven: engagement.comments?.length || 0,
    matchesReceived: engagement.matches?.length || 0,
    avgEngagementScore: calculateEngagementScore(engagement)
  };
};

/**
 * calculate overall engagement score
 */
const calculateEngagementScore = (engagement: any): number => {
  const likes = engagement.likes?.length || 0;
  const comments = engagement.comments?.length || 0;
  const matches = engagement.matches?.length || 0;

  const score = (likes * 1) + (comments * 3) + (matches * 10);
  
  return Math.min(100, score);
};

/**
 * generate music preference insights
 */
const generateMusicInsights = async (userId: string, posts: any[], engagement: any): Promise<MusicPreferenceInsights> => {
  const genres: string[] = [];
  const audioFeatures: any[] = [];
  const moodProgression: any[] = [];


  posts.forEach(post => {
    if (post.song?.genres) {
      genres.push(...post.song.genres);
    }
    if (post.song?.audioFeatures) {
      audioFeatures.push(post.song.audioFeatures);
    }
    
    // track mood progression
    moodProgression.push({
      date: post.createdAt?.toISOString().split('T')[0],
      mood: post.mood,
      valence: post.song?.audioFeatures?.valence || 0.5
    });
  });

  // count genre preferences
  const genreCounts: { [key: string]: number } = {};
  genres.forEach(genre => {
    genreCounts[genre] = (genreCounts[genre] || 0) + 1;
  });

  const topGenres = Object.entries(genreCounts)
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // calculate average audio features
  let avgAudioFeatures = {
    valence: 0.5,
    energy: 0.5,
    danceability: 0.5,
    tempo: 120
  };

  if (audioFeatures.length > 0) {
    const sums = audioFeatures.reduce((acc, feature) => ({
      valence: acc.valence + (feature.valence || 0),
      energy: acc.energy + (feature.energy || 0),
      danceability: acc.danceability + (feature.danceability || 0),
      tempo: acc.tempo + (feature.tempo || 0)
    }), { valence: 0, energy: 0, danceability: 0, tempo: 0 });

    avgAudioFeatures = {
      valence: sums.valence / audioFeatures.length,
      energy: sums.energy / audioFeatures.length,
      danceability: sums.danceability / audioFeatures.length,
      tempo: sums.tempo / audioFeatures.length
    };
  }

  return {
    topGenres,
    avgAudioFeatures,
    moodProgression: moodProgression.map(item => ({
      date: item.date,
      averageMood: item.valence,
      dominantMood: item.mood
    }))
  };
};

/**
 * generate time-relevant AI-powered insights
 */
const generateInsights = (
  moodAnalysis: MoodAnalysis[], 
  engagement: EngagementMetrics, 
  musicInsights: MusicPreferenceInsights,
  startDate: Date,
  endDate: Date
): string[] => {
  const insights: string[] = [];

  const weekNumber = getWeekNumber(startDate);
  const month = startDate.toLocaleDateString('en-US', { month: 'long' });
  const isCurrentWeek = isDateInCurrentWeek(startDate);
  const timeContext = isCurrentWeek ? 'this week' : `the week of ${startDate.toLocaleDateString()}`;

  if (moodAnalysis.length > 0) {
    const topMood = moodAnalysis[0];
    insights.push(`During ${timeContext}, your dominant mood was ${topMood.mood.toLowerCase()}, appearing in ${topMood.percentage.toFixed(1)}% of your posts.`);
    
    if (!isCurrentWeek) {
      insights.push(`Looking back at ${month}, you were exploring ${topMood.mood.toLowerCase()} music during this period.`);
    }
  }

  // engagement insights with temporal context
  if (engagement.postsLiked > 10) {
    insights.push(`You were very active during ${timeContext}, liking ${engagement.postsLiked} posts. ${isCurrentWeek ? "You're engaging well with the community!" : "You had strong engagement during this period!"}`);
  } else if (engagement.postsLiked < 3) {
    insights.push(`${isCurrentWeek ? "You liked fewer posts this week." : `You had lighter engagement during ${timeContext}.`} Consider exploring more music to discover new favorites!`);
  }

  // music insights with time relevance
  if (musicInsights.avgAudioFeatures.valence > 0.7) {
    insights.push(`Your music choices during ${timeContext} were very upbeat and positive, with high happiness levels. ${isCurrentWeek ? "Great for maintaining good vibes!" : "This was a particularly bright period in your music journey!"}`);
  } else if (musicInsights.avgAudioFeatures.valence < 0.3) {
    insights.push(`Your music during ${timeContext} had a more introspective, melancholic tone. ${isCurrentWeek ? "Sometimes we need those reflective moments." : "This period shows a more contemplative side of your musical taste."}`);
  }

  if (musicInsights.avgAudioFeatures.energy > 0.8) {
    insights.push(`You gravitated toward high-energy tracks during ${timeContext} - ${isCurrentWeek ? "perfect for staying motivated!" : "a high-energy period in your listening history!"}`);
  }

  // match insights with time context
  if (engagement.matchesReceived > 0) {
    insights.push(`You made ${engagement.matchesReceived} new connection${engagement.matchesReceived === 1 ? '' : 's'} during ${timeContext} through shared music taste!`);
  }

  // weekly progression insights for current week
  if (isCurrentWeek && moodAnalysis.length > 1) {
    insights.push(`You've shown good mood diversity this week, expressing ${moodAnalysis.length} different emotional states through music.`);
  }

  return insights;
};

/**
 * generate time-relevant personalized recommendations
 */
const generateRecommendations = (
  moodAnalysis: MoodAnalysis[], 
  engagement: EngagementMetrics, 
  musicInsights: MusicPreferenceInsights,
  startDate: Date,
  endDate: Date
): string[] => {
  const recommendations: string[] = [];
  const isCurrentWeek = isDateInCurrentWeek(startDate);
  const timeContext = isCurrentWeek ? 'this week' : 'going forward';

  // engagement recommendations with time awareness
  if (engagement.postsLiked < 5) {
    recommendations.push(`${isCurrentWeek ? "Try exploring more posts in the Discover feed" : "Consider increasing your exploration of"} new music to find songs that resonate with you.`);
  }

  if (engagement.commentsGiven < 2) {
    recommendations.push(`${isCurrentWeek ? "Consider leaving comments on posts you enjoy" : "Try engaging more with the community through comments"} - it's a great way to connect with others!`);
  }

  // mood diversity recommendations
  if (moodAnalysis.length === 1) {
    recommendations.push(`${isCurrentWeek ? "Try posting songs that represent different moods" : "Consider exploring a wider range of emotional expressions in your music"} to show your full emotional range.`);
  }

  // music discovery recommendations based on historical patterns
  if (musicInsights.topGenres.length < 3) {
    recommendations.push(`${isCurrentWeek ? "Experiment with different genres" : "Based on your patterns, try exploring new genres"} to expand your musical palette and find new matches.`);
  }

  // energy-based recommendations with seasonal awareness
  if (musicInsights.avgAudioFeatures.energy < 0.4) {
    const currentMonth = getPacificTime().getMonth();
    const isWinter = currentMonth === 11 || currentMonth === 0 || currentMonth === 1;
    
    if (isCurrentWeek && isWinter) {
      recommendations.push("Consider adding some higher-energy tracks to boost your mood during the winter months.");
    } else {
      recommendations.push("Consider adding some higher-energy tracks to boost your mood and discover new connections.");
    }
  }

  // weekly goal recommendations for current week
  if (isCurrentWeek) {
    recommendations.push("Set a goal to discover at least 3 new songs this week that match your current mood.");
  }

  return recommendations;
};


const isDateInCurrentWeek = (date: Date): boolean => {
  const now = getPacificTime();
  const currentWeekStart = getWeekStart();
  const currentWeekEnd = new Date(currentWeekStart);
  currentWeekEnd.setDate(currentWeekEnd.getDate() + 7);
  
  return date >= currentWeekStart && date < currentWeekEnd;
};


const getWeekNumber = (date: Date): number => {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - startOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
};

/**
 * save weekly report to Firestore
 */
const saveWeeklyReport = async (userId: string, report: WeeklyReport): Promise<void> => {
  const reportId = `${userId}_${report.weekStart.toISOString().split('T')[0]}`;
  const reportRef = doc(db, 'weeklyReports', reportId);
  
  await setDoc(reportRef, {
    ...report,
    weekStart: Timestamp.fromDate(report.weekStart),
    weekEnd: Timestamp.fromDate(report.weekEnd),
    generatedAt: Timestamp.fromDate(report.generatedAt)
  });
};

/**
 * get user's latest weekly report
 */
export const getLatestWeeklyReport = async (userId: string): Promise<WeeklyReport | null> => {
  try {
    const reportsQuery = query(
      collection(db, 'weeklyReports'),
      where('userId', '==', userId),
      orderBy('generatedAt', 'desc'),
      limit(1)
    );

    const snapshot = await getDocs(reportsQuery);
    
    if (snapshot.empty) {
      return null;
    }

    const reportData = snapshot.docs[0].data();
    return {
      ...reportData,
      weekStart: reportData.weekStart.toDate(),
      weekEnd: reportData.weekEnd.toDate(),
      generatedAt: reportData.generatedAt.toDate()
    } as WeeklyReport;
  } catch (error) {
    console.error('Error fetching latest weekly report:', error);
    return null;
  }
};

/**
 * check if user has a report for current week
 */
export const hasCurrentWeekReport = async (userId: string): Promise<boolean> => {
  const weekStart = getWeekStart();
  const reportId = `${userId}_${weekStart.toISOString().split('T')[0]}`;
  
  try {
    const reportRef = doc(db, 'weeklyReports', reportId);
    const reportDoc = await getDoc(reportRef);
    return reportDoc.exists();
  } catch (error) {
    console.error('Error checking for current week report:', error);
    return false;
  }
};

/**
 * generate analytics for a specific week by date
 */
export const generateAnalyticsForWeek = async (userId: string, weekStartDate: Date): Promise<WeeklyReport> => {
  const normalizedStartDate = new Date(weekStartDate);
  normalizedStartDate.setHours(0, 0, 0, 0);
  
  return await generateWeeklyAnalytics(userId, normalizedStartDate);
};


export const getAvailableWeeksForMonth = (year: number, month: number): Date[] => {
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  
  const weeks: Date[] = [];
  
  let currentDate = new Date(firstOfMonth);
  const firstDayOfWeek = currentDate.getDay();
  
  const daysToSubtract = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  currentDate.setDate(currentDate.getDate() - daysToSubtract);
  
  while (currentDate <= lastOfMonth) {
    const weekEnd = new Date(currentDate);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    if (weekEnd >= firstOfMonth && currentDate <= lastOfMonth) {
      weeks.push(new Date(currentDate));
    }
    
    currentDate.setDate(currentDate.getDate() + 7);
  }
  
  return weeks;
};


export const canGenerateAnalyticsForWeek = (weekStartDate: Date): boolean => {
  const now = getPacificTime();
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 7);
  
  return weekEndDate <= now || isDateInCurrentWeek(weekStartDate);
};


export const getWeekDisplayString = (weekStartDate: Date): string => {
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 6);
  
  const startMonth = weekStartDate.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = weekEndDate.toLocaleDateString('en-US', { month: 'short' });
  
  if (startMonth === endMonth) {
    return `${startMonth} ${weekStartDate.getDate()}-${weekEndDate.getDate()}, ${weekStartDate.getFullYear()}`;
  } else {
    return `${startMonth} ${weekStartDate.getDate()} - ${endMonth} ${weekEndDate.getDate()}, ${weekStartDate.getFullYear()}`;
  }
}; 