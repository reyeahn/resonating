// debugging interface for music matching
import React, { useState, useEffect } from 'react';
import { getUserMusicPreferences, triggerPreferenceUpdate } from '@/services/matchingAlgorithm';
import { useAuth } from '@/hooks/useAuth';

interface MusicPreferences {
  musicPreferences: {
    genres: string[];
    audioFeatures: {
      valence: number;
      energy: number;
      danceability: number;
      acousticness: number;
      tempo: number;
    };
    moodTags: string[];
  } | null;
  lastPreferencesUpdate: Date | null;
  hasPreferences: boolean;
}

const MusicPreferencesDebug: React.FC = () => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<MusicPreferences | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  const loadPreferences = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const prefs = await getUserMusicPreferences(user.uid);
      setPreferences(prefs);
      console.log('Current music preferences:', prefs);
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePreferences = async () => {
    if (!user) return;
    
    setUpdating(true);
    try {
      const success = await triggerPreferenceUpdate(user.uid);
      if (success) {
        // reload preferences after update
        await loadPreferences();
        alert('Preferences updated successfully! Check console for details.');
      } else {
        alert('Failed to update preferences. Check console for errors.');
      }
    } catch (error) {
      console.error('Error updating preferences:', error);
      alert('Error updating preferences. Check console for details.');
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    loadPreferences();
  }, [user]);

  if (!user) return null;

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 mb-4">
      <h3 className="text-lg font-bold text-yellow-800 dark:text-yellow-200 mb-3">
        🐛 Music Preferences Debug
      </h3>
      
      <div className="space-y-3">
        <div className="flex gap-2">
          <button
            onClick={loadPreferences}
            disabled={loading}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Reload Preferences'}
          </button>
          
          <button
            onClick={handleUpdatePreferences}
            disabled={updating}
            className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 disabled:opacity-50"
          >
            {updating ? 'Updating...' : 'Update Preferences'}
          </button>
        </div>

        {preferences && (
          <div className="text-sm">
            <div className="mb-2">
              <strong>Has Preferences:</strong>{' '}
              <span className={preferences.hasPreferences ? 'text-green-600' : 'text-red-600'}>
                {preferences.hasPreferences ? 'Yes' : 'No'}
              </span>
            </div>
            
            {preferences.lastPreferencesUpdate && (
              <div className="mb-2">
                <strong>Last Updated:</strong>{' '}
                {preferences.lastPreferencesUpdate.toLocaleString()}
              </div>
            )}

            {preferences.musicPreferences && (
              <div className="space-y-2">
                <div>
                  <strong>Genres ({preferences.musicPreferences.genres.length}):</strong>{' '}
                  {preferences.musicPreferences.genres.length > 0 
                    ? preferences.musicPreferences.genres.join(', ')
                    : 'None'
                  }
                </div>

                <div>
                  <strong>Mood Tags ({preferences.musicPreferences.moodTags.length}):</strong>{' '}
                  {preferences.musicPreferences.moodTags.length > 0
                    ? preferences.musicPreferences.moodTags.join(', ')
                    : 'None'
                  }
                </div>

                <div>
                  <strong>Audio Features:</strong>
                  <div className="ml-4 mt-1">
                    <div>Valence (happiness): {(preferences.musicPreferences.audioFeatures.valence || 0).toFixed(2)}</div>
                    <div>Energy: {(preferences.musicPreferences.audioFeatures.energy || 0).toFixed(2)}</div>
                    <div>Danceability: {(preferences.musicPreferences.audioFeatures.danceability || 0).toFixed(2)}</div>
                    <div>Acousticness: {(preferences.musicPreferences.audioFeatures.acousticness || 0).toFixed(2)}</div>
                    <div>Tempo: {Math.round(preferences.musicPreferences.audioFeatures.tempo || 0)} BPM</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-gray-600 dark:text-gray-400">
           This component helps test music preference updates. Check the browser console for detailed logs.
          <br />
           To test: Like some posts in Discover, then click "Update Preferences"
        </div>
      </div>
    </div>
  );
};

export default MusicPreferencesDebug; 