// analytics dashboard with charts
import React, { useState, useEffect } from 'react';
import { FaChartLine, FaMusic, FaHeart, FaUsers, FaSpinner, FaRedo } from 'react-icons/fa';
import { 
  WeeklyReport, 
  generateWeeklyAnalytics, 
  getLatestWeeklyReport, 
  hasCurrentWeekReport 
} from '@/services/analytics';
import { useAuth } from '@/hooks/useAuth';

interface WeeklyInsightsProps {
  userId?: string;
}

const WeeklyInsights: React.FC<WeeklyInsightsProps> = ({ userId }) => {
  const { user } = useAuth();
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [hasReport, setHasReport] = useState(false);

  const targetUserId = userId || user?.uid;

  useEffect(() => {
    if (targetUserId) {
      loadWeeklyReport();
    }
  }, [targetUserId]);

  const loadWeeklyReport = async () => {
    if (!targetUserId) return;

    setLoading(true);
    try {
      // check if user has report for current week
      const hasCurrentReport = await hasCurrentWeekReport(targetUserId);
      setHasReport(hasCurrentReport);

      // latest report
      const latestReport = await getLatestWeeklyReport(targetUserId);
      setReport(latestReport);
    } catch (error) {
      console.error('Error loading weekly report:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateNewReport = async () => {
    if (!targetUserId) return;

    setGenerating(true);
    try {
      const newReport = await generateWeeklyAnalytics(targetUserId);
      setReport(newReport);
      setHasReport(true);
    } catch (error) {
      console.error('Error generating weekly report:', error);
    } finally {
      setGenerating(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-dark-200 rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center">
          <FaSpinner className="animate-spin h-6 w-6 text-primary-600 mr-2" />
          <span className="text-gray-700 dark:text-gray-300">Loading insights...</span>
        </div>
      </div>
    );
  }

  if (!report && !hasReport) {
    return (
      <div className="bg-white dark:bg-dark-200 rounded-lg shadow-md p-6">
        <div className="text-center">
          <FaChartLine className="h-12 w-12 text-primary-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Generate Your Weekly Music Insights
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Get personalized analytics about your music preferences, mood patterns, and engagement.
          </p>
          <button
            onClick={generateNewReport}
            disabled={generating}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center mx-auto"
          >
            {generating ? (
              <>
                <FaSpinner className="animate-spin mr-2" />
                Generating...
              </>
            ) : (
              <>
                <FaChartLine className="mr-2" />
                Generate Report
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="bg-white dark:bg-dark-200 rounded-lg shadow-md p-6">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">No weekly report available yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-dark-200 rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Weekly Music Insights
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {formatDate(report.weekStart)} - {formatDate(report.weekEnd)}
            </p>
          </div>
          <button
            onClick={generateNewReport}
            disabled={generating}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {generating ? (
              <FaSpinner className="animate-spin h-4 w-4" />
            ) : (
              <FaRedo className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Engagement Metrics */}
      <div className="bg-white dark:bg-dark-200 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <FaUsers className="mr-2 text-primary-600" />
          Engagement Summary
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary-600">
              {report.engagementMetrics.postsLiked}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Posts Liked</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {report.engagementMetrics.commentsGiven}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Comments</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-pink-600">
              {report.engagementMetrics.matchesReceived}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Matches</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {Math.round(report.engagementMetrics.avgEngagementScore)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Engagement Score</div>
          </div>
        </div>
      </div>

      {/* Mood Analysis */}
      {report.moodAnalysis.length > 0 && (
        <div className="bg-white dark:bg-dark-200 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <FaHeart className="mr-2 text-primary-600" />
            Mood Patterns
          </h3>
          <div className="space-y-3">
            {report.moodAnalysis.slice(0, 5).map((mood, index) => (
              <div key={mood.mood} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div 
                    className={`w-4 h-4 rounded-full mr-3`}
                    style={{ 
                      backgroundColor: getMoodColor(mood.mood, index)
                    }}
                  />
                  <span className="text-gray-900 dark:text-white font-medium">
                    {mood.mood}
                  </span>
                </div>
                <div className="flex items-center">
                  <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mr-3">
                    <div 
                      className="h-2 rounded-full"
                      style={{ 
                        width: `${mood.percentage}%`,
                        backgroundColor: getMoodColor(mood.mood, index)
                      }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400 w-12 text-right">
                    {mood.percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Music Insights */}
      <div className="bg-white dark:bg-dark-200 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <FaMusic className="mr-2 text-primary-600" />
          Music Preferences
        </h3>
        
        {/* Audio Features */}
        <div className="mb-6">
          <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
            Audio Characteristics
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600 dark:text-gray-400">Happiness</span>
                <span className="text-sm text-gray-900 dark:text-white">
                  {Math.round(report.musicInsights.avgAudioFeatures.valence * 100)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-yellow-500 h-2 rounded-full" 
                  style={{ width: `${report.musicInsights.avgAudioFeatures.valence * 100}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600 dark:text-gray-400">Energy</span>
                <span className="text-sm text-gray-900 dark:text-white">
                  {Math.round(report.musicInsights.avgAudioFeatures.energy * 100)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-red-500 h-2 rounded-full" 
                  style={{ width: `${report.musicInsights.avgAudioFeatures.energy * 100}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600 dark:text-gray-400">Danceability</span>
                <span className="text-sm text-gray-900 dark:text-white">
                  {Math.round(report.musicInsights.avgAudioFeatures.danceability * 100)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full" 
                  style={{ width: `${report.musicInsights.avgAudioFeatures.danceability * 100}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600 dark:text-gray-400">Tempo</span>
                <span className="text-sm text-gray-900 dark:text-white">
                  {Math.round(report.musicInsights.avgAudioFeatures.tempo)} BPM
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full" 
                  style={{ width: `${Math.min(report.musicInsights.avgAudioFeatures.tempo / 200 * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Top Genres */}
        {report.musicInsights.topGenres.length > 0 && (
          <div>
            <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
              Favorite Genres
            </h4>
            <div className="flex flex-wrap gap-2">
              {report.musicInsights.topGenres.map((genre, index) => (
                <span 
                  key={genre.genre}
                  className="px-3 py-1 bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-100 text-sm rounded-full"
                >
                  {genre.genre} ({genre.count})
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI Insights */}
      {report.insights.length > 0 && (
        <div className="bg-white dark:bg-dark-200 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            AI Insights
          </h3>
          <div className="space-y-3">
            {report.insights.map((insight, index) => (
              <div key={index} className="flex items-start">
                <div className="w-2 h-2 bg-primary-600 rounded-full mt-2 mr-3 flex-shrink-0" />
                <p className="text-gray-700 dark:text-gray-300">{insight}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <div className="bg-white dark:bg-dark-200 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Personalized Recommendations
          </h3>
          <div className="space-y-3">
            {report.recommendations.map((recommendation, index) => (
              <div key={index} className="flex items-start">
                <div className="w-2 h-2 bg-green-600 rounded-full mt-2 mr-3 flex-shrink-0" />
                <p className="text-gray-700 dark:text-gray-300">{recommendation}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// helper function to get color
const getMoodColor = (mood: string, index: number): string => {
  const colors = [
    '#8B5CF6', // purple
    '#06B6D4', // cyan
    '#F59E0B', // amber
    '#EF4444', // red
    '#10B981', // emerald
    '#F97316', // orange
    '#6366F1', // indigo
    '#EC4899'  // pink
  ];
  
  // match mood to color based on sentiment
  const moodLower = mood.toLowerCase();
  if (moodLower.includes('happy') || moodLower.includes('joy')) return '#F59E0B';
  if (moodLower.includes('sad') || moodLower.includes('melanchol')) return '#6366F1';
  if (moodLower.includes('energetic') || moodLower.includes('excited')) return '#EF4444';
  if (moodLower.includes('calm') || moodLower.includes('peaceful')) return '#10B981';
  if (moodLower.includes('romantic') || moodLower.includes('love')) return '#EC4899';
  
  return colors[index % colors.length];
};

export default WeeklyInsights; 