// spotify api integration for music search and playback
import { db, auth } from './firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

// types
export interface SpotifyToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  expiresAt: number;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  album: {
    id: string;
    name: string;
    images: Array<{
      height: number;
      width: number;
      url: string;
    }>;
  };
  artists: Array<{
    id: string;
    name: string;
  }>;
  preview_url: string | null;
  external_urls: {
    spotify: string;
  };
  duration_ms: number;
}

export interface SpotifyAudioFeatures {
  id: string;
  danceability: number;
  energy: number;
  key: number;
  loudness: number;
  mode: number;
  speechiness: number;
  acousticness: number;
  instrumentalness: number;
  liveness: number;
  valence: number;
  tempo: number;
  duration_ms: number;
  time_signature: number;
}

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

let clientCredentialsToken = {
  access_token: '',
  expires_at: 0
};


export const getClientCredentialsToken = async (): Promise<string> => {
  try {
    if (clientCredentialsToken.access_token && Date.now() < clientCredentialsToken.expires_at) {
      return clientCredentialsToken.access_token;
    }
    
    const response = await fetch('/api/spotify/client-token', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to get Spotify client token');
    }
    
    const data = await response.json();
    
    const expiresAt = Date.now() + (data.expires_in - 60) * 1000;
    
    clientCredentialsToken = {
      access_token: data.access_token,
      expires_at: expiresAt
    };
    
    return data.access_token;
  } catch (error) {
    console.error('Error getting client credentials token:', error);
    throw error;
  }
};

/**
 * get Spotify tokens from user document in Firestore
 */
export const getSpotifyTokens = async (): Promise<SpotifyToken | null> => {
  if (!auth.currentUser) return null;
  
  try {
    const userDocRef = doc(db, 'users', auth.currentUser.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists() && userDoc.data().spotify?.tokens) {
      const tokens = userDoc.data().spotify.tokens as SpotifyToken;
      
      // check if token is expired
      if (Date.now() > tokens.expiresAt) {
        // token is expired, refresh it
        return refreshSpotifyToken(tokens.refresh_token);
      }
      
      return tokens;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting Spotify tokens:', error);
    return null;
  }
};

/**
 * refresh the Spotify access token
 */
export const refreshSpotifyToken = async (refreshToken: string): Promise<SpotifyToken | null> => {
  if (!auth.currentUser) return null;
  
  try {

    
    const response = await fetch('/api/spotify/refresh-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to refresh Spotify token');
    }
    
    const data = await response.json();
    
    // calculate expiration time
    const expiresAt = Date.now() + data.expires_in * 1000;
    const tokens: SpotifyToken = {
      ...data,
      expiresAt,
    };
    
    // update tokens in Firestore
    const userDocRef = doc(db, 'users', auth.currentUser.uid);
    await updateDoc(userDocRef, {
      'spotify.tokens': tokens,
      'spotifyConnected': true,
    });
    
    return tokens;
  } catch (error) {
    console.error('Error refreshing Spotify token:', error);
    return null;
  }
};

/**
 * make authenticated request to Spotify API 
 */
export const spotifyFetch = async (endpoint: string, options: RequestInit = {}, useClientCredentials = false): Promise<any> => {
  let accessToken = '';
  
  if (useClientCredentials) {
    accessToken = await getClientCredentialsToken();
  } else {
    const tokens = await getSpotifyTokens();
    if (!tokens) {
      accessToken = await getClientCredentialsToken();
    } else {
      accessToken = tokens.access_token;
    }
  }
  
  const url = endpoint.startsWith('http') ? endpoint : `${SPOTIFY_API_BASE}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    console.error('Spotify API error:', data);
    throw new Error(data.error?.message || 'Error from Spotify API');
  }
  
  return data;
};


export const searchTracks = async (query: string, limit = 10): Promise<SpotifyTrack[]> => {
  try {
    const data = await spotifyFetch(
      `/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`,
      {},
      true 
    );
    
    return data.tracks.items;
  } catch (error) {
    console.error('Error searching tracks:', error);
    return [];
  }
};


export const getAudioFeatures = async (trackId: string, mood?: string, genre?: string): Promise<SpotifyAudioFeatures | null> => {
  try {
    console.log(' Getting audio features for track:', trackId);
    
    const placeholderFeatures = generatePlaceholderAudioFeatures(trackId, mood, genre);
    
    console.log(' Using placeholder audio features:', placeholderFeatures);
    return placeholderFeatures;
    
  } catch (error) {
    console.error('Error getting audio features:', error);
    return null;
  }
};


const generatePlaceholderAudioFeatures = (trackId: string, mood?: string, genre?: string): SpotifyAudioFeatures => {

  const seed = hashString(trackId);
  const random = createSeededRandom(seed);
  

  let valence = 0.5;  // happiness/positivity
  let energy = 0.6;   // intensity/power
  let danceability = 0.6; // how danceable
  let acousticness = 0.3; // acoustic vs electric
  let tempo = 120;    // BPM
  
  if (mood) {
    const moodAdjustments = getMoodAdjustments(mood.toLowerCase());
    valence = Math.max(0, Math.min(1, valence + moodAdjustments.valence + (random() - 0.5) * 0.3));
    energy = Math.max(0, Math.min(1, energy + moodAdjustments.energy + (random() - 0.5) * 0.3));
    danceability = Math.max(0, Math.min(1, danceability + moodAdjustments.danceability + (random() - 0.5) * 0.3));
    acousticness = Math.max(0, Math.min(1, acousticness + moodAdjustments.acousticness + (random() - 0.5) * 0.3));
    tempo = Math.max(60, Math.min(200, tempo + moodAdjustments.tempo + (random() - 0.5) * 40));
  }
  
  valence += (random() - 0.5) * 0.2;
  energy += (random() - 0.5) * 0.2;
  danceability += (random() - 0.5) * 0.2;
  acousticness += (random() - 0.5) * 0.2;
  tempo += (random() - 0.5) * 20;
  
  return {
    valence: Math.max(0, Math.min(1, valence)),
    energy: Math.max(0, Math.min(1, energy)),
    danceability: Math.max(0, Math.min(1, danceability)),
    acousticness: Math.max(0, Math.min(1, acousticness)),
    tempo: Math.max(60, Math.min(200, tempo)),
    
    // Additional Spotify audio features (reasonable defaults)
    key: Math.floor(random() * 12), // 0-11 (C, C#, D, etc.)
    loudness: -8 + (random() - 0.5) * 10, // dB, typically -60 to 0
    mode: random() > 0.5 ? 1 : 0, // 1 = major, 0 = minor
    speechiness: random() * 0.3, // 0-1, most music is low
    instrumentalness: random() * 0.8, // 0-1, most songs have vocals
    liveness: 0.1 + random() * 0.3, // 0-1, most songs are studio recorded
    time_signature: random() > 0.8 ? 3 : 4 // 3/4 or 4/4 time
  };
};

/**
 * get mood-based adjustments for audio features
 */
const getMoodAdjustments = (mood: string): {
  valence: number;
  energy: number;
  danceability: number;
  acousticness: number;
  tempo: number;
} => {
  const adjustments: { [key: string]: any } = {
    'happy': { valence: 0.3, energy: 0.2, danceability: 0.2, acousticness: -0.1, tempo: 10 },
    'energetic': { valence: 0.2, energy: 0.4, danceability: 0.3, acousticness: -0.2, tempo: 20 },
    'chill': { valence: 0.1, energy: -0.3, danceability: -0.2, acousticness: 0.2, tempo: -20 },
    'sad': { valence: -0.4, energy: -0.2, danceability: -0.3, acousticness: 0.1, tempo: -15 },
    'nostalgic': { valence: -0.1, energy: -0.1, danceability: -0.1, acousticness: 0.2, tempo: -10 },
    'romantic': { valence: 0.2, energy: -0.1, danceability: 0.1, acousticness: 0.1, tempo: -5 },
    'angry': { valence: -0.3, energy: 0.3, danceability: 0.1, acousticness: -0.2, tempo: 15 },
    'peaceful': { valence: 0.1, energy: -0.4, danceability: -0.3, acousticness: 0.3, tempo: -25 },
    'excited': { valence: 0.3, energy: 0.3, danceability: 0.3, acousticness: -0.1, tempo: 15 },
    'reflective': { valence: -0.1, energy: -0.2, danceability: -0.2, acousticness: 0.2, tempo: -10 }
  };
  
  return adjustments[mood] || { valence: 0, energy: 0, danceability: 0, acousticness: 0, tempo: 0 };
};

/**
 * create a simple hash from a string for deterministic randomness
 */
const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; 
  }
  return Math.abs(hash);
};

/**
 * create a seeded random number generator
 */
const createSeededRandom = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % Math.pow(2, 32);
    return state / Math.pow(2, 32);
  };
};

/**
 * get track details
 */
export const getTrack = async (trackId: string): Promise<SpotifyTrack | null> => {
  try {
    // use client credentials by default 
    return await spotifyFetch(`/tracks/${trackId}`, {}, true);
  } catch (error) {
    console.error('Error getting track:', error);
    return null;
  }
};

/**
 * connect user to Spotify
 */
export const connectToSpotify = (): void => {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:3000/api/auth/callback/spotify';
  
  // define scopes needed for the application
  const scopes = [
    'user-read-private',
    'user-read-email',
    'user-top-read',
    'user-library-read',
  ].join(' ');
  
  // create the authorization URL
  const authUrl = new URL('https://accounts.spotify.com/authorize');
  authUrl.searchParams.append('client_id', clientId as string);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('redirect_uri', redirectUri);
  authUrl.searchParams.append('scope', scopes);
  
  window.location.href = authUrl.toString();
};


export const searchTracksWithPreviews = async (query: string, limit = 10): Promise<SpotifyTrack[]> => {
  try {
    console.log(' Starting enhanced search for:', query);
    
    const standardTracks = await searchTracks(query, limit);
    console.log('Standard Spotify API returned:', standardTracks.length, 'tracks');
    
    if (!standardTracks || standardTracks.length === 0) {
      console.log(' No tracks from standard API, trying preview finder...');
      
      try {
        const spotifyPreviewFinder = require('spotify-preview-finder');
        const previewResult = await spotifyPreviewFinder(query, limit);
        
        if (previewResult.success && previewResult.results.length > 0) {
          console.log(' Preview finder returned:', previewResult.results.length, 'results');
          
          const enhancedTracks: SpotifyTrack[] = previewResult.results.map((result: any) => {
            const nameParts = result.name.split(' - ');
            const trackName = nameParts[0] || result.name;
            const artistName = nameParts[1] || 'Unknown Artist';
            
            return {
              id: result.spotifyUrl.split('/').pop() || `preview_${Date.now()}`,
              name: trackName,
              album: {
                id: '',
                name: 'Unknown Album',
                images: []
              },
              artists: [{
                id: '',
                name: artistName
              }],
              preview_url: result.previewUrls[0] || null,
              external_urls: {
                spotify: result.spotifyUrl
              },
              duration_ms: 30000 // Default to 30 seconds for previews
            };
          });
          
          return enhancedTracks;
        }
      } catch (previewError) {
        console.log(' Preview finder failed:', previewError);
      }
      
      return [];
    }
    
    // enhance existing tracks with preview finder if they don't have preview URLs
    console.log(' Enhancing tracks with preview finder...');
    const enhancedTracks = await Promise.all(
      standardTracks.map(async (track) => {
        // if track already has a preview URL, return as is
        if (track.preview_url) {
          console.log(` Track "${track.name}" already has preview URL`);
          return track;
        }
        
        try {
          // try to find preview URL for this specific track
          const spotifyPreviewFinder = require('spotify-preview-finder');
          const searchQuery = `${track.name} ${track.artists[0]?.name || ''}`.trim();
          const previewResult = await spotifyPreviewFinder(searchQuery, 1);
          
          if (previewResult.success && previewResult.results.length > 0) {
            const previewUrl = previewResult.results[0].previewUrls[0];
            console.log(` Found preview URL for "${track.name}":`, previewUrl);
            
            return {
              ...track,
              preview_url: previewUrl
            };
          } else {
            console.log(` No preview found for "${track.name}"`);
            return track;
          }
        } catch (error) {
          console.log(` Error finding preview for "${track.name}":`, error);
          return track;
        }
      })
    );
    
    console.log(' Enhanced search complete. Tracks with previews:', 
      enhancedTracks.filter(t => t.preview_url).length, 'out of', enhancedTracks.length);
    
    return enhancedTracks;
  } catch (error) {
    console.error(' Error in enhanced search:', error);
    return searchTracks(query, limit);
  }
}; 