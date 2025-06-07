// daily song posting interface with media upload
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { doc, setDoc, updateDoc, serverTimestamp, getDoc, arrayUnion } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/services/firebase';
import { useAuth } from '@/hooks/useAuth';
import { FaMusic, FaSearch, FaCamera, FaSpotify, FaTimes, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { createPost } from '@/services/posts';
import { getAudioFeatures, SpotifyAudioFeatures } from '@/services/spotify';
import SpotifyPlayer from '@/components/spotify/SpotifyPlayer';
import SpotifyConnect from '@/components/spotify/SpotifyConnect';

interface SongData {
  title: string;
  artist: string;
  album: string;
  coverArtUrl: string;
  spotifyId?: string;
  previewUrl?: string;
}

const PostSong: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SongData[]>([]);
  const [selectedSong, setSelectedSong] = useState<SongData | null>(null);
  const [caption, setCaption] = useState('');
  const [mood, setMood] = useState('');
  const [moodCategory, setMoodCategory] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingAudioFeatures, setIsFetchingAudioFeatures] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { user, userData, refreshUserData } = useAuth();

  // if user is not logged in, redirect to home
  useEffect(() => {
    if (!user) {
      router.push('/');
    } else if (userData && userData.hasPostedToday) {
      router.push('/matches');
    }
  }, [user, userData, router]);

  // search for songs using hybrid approach: standard API + preview enhancement
  const searchSongs = async (query: string) => {
    setIsSearching(true);
    setSearchResults([]);
    
    try {
      console.log(' Searching with standard Spotify API for:', query);
      
      const response = await fetch(`/api/spotify/search?q=${encodeURIComponent(query)}&limit=10`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(' Standard API response:', data);
        
        if (data.tracks && data.tracks.items && data.tracks.items.length > 0) {
          const standardResults: SongData[] = data.tracks.items.map((track: any) => {
            console.log(` Track "${track.name}" album images:`, track.album.images.length);
            console.log(` Track "${track.name}" preview URL:`, track.preview_url || 'NONE');
            
            return {
              title: track.name,
              artist: track.artists.map((artist: any) => artist.name).join(', '),
              album: track.album.name || 'Unknown Album',
              coverArtUrl: track.album.images[0]?.url || '',
              spotifyId: track.id,
              previewUrl: track.preview_url || '',
            };
          });
          
          console.log(' Standard results:', standardResults.length, 'tracks');
          const tracksWithPreviews = standardResults.filter(r => r.previewUrl).length;
          console.log(' Tracks with preview URLs:', tracksWithPreviews, 'out of', standardResults.length);
          
          if (tracksWithPreviews < standardResults.length) {
            console.log(' Enhancing tracks without preview URLs...');
            
            const enhancedResults = await Promise.all(
              standardResults.map(async (song) => {
                if (song.previewUrl) {
                  return song;
                }
                
                // try to find preview URL using preview finder
                try {
                  console.log(` Looking for preview for "${song.title}" by ${song.artist}...`);
                  
                  // call  preview finder API (but only use it for preview URLs)
                  const previewResponse = await fetch(
                    `/api/spotify/search-with-previews?query=${encodeURIComponent(`${song.title} ${song.artist}`)}&limit=1`
                  );
                  
                  if (previewResponse.ok) {
                    const previewData = await previewResponse.json();
                    const previewTrack = previewData.tracks?.items?.[0];
                    
                    if (previewTrack?.preview_url) {
                      console.log(` Found preview URL for "${song.title}":`, previewTrack.preview_url);
                      return {
                        ...song, // keep all original metadata (album artwork, etc.)
                        previewUrl: previewTrack.preview_url 
                      };
                    }
                  }
                } catch (previewError) {
                  console.log(` Could not enhance "${song.title}":`, previewError);
                }
                
                console.log(` No preview found for "${song.title}"`);
                return song;
              })
            );
            
            const finalTracksWithPreviews = enhancedResults.filter(r => r.previewUrl).length;
            console.log(' Final enhanced results:', finalTracksWithPreviews, 'out of', enhancedResults.length, 'tracks have previews');
            
            setSearchResults(enhancedResults);
          } else {
            // all tracks already have previews, no enhancement needed
            console.log(' All tracks already have preview URLs, no enhancement needed');
            setSearchResults(standardResults);
          }
          
          setIsSearching(false);
          return;
        }
      } else {
        console.log(' Standard API failed with status:', response.status);
        const errorText = await response.text();
        console.log(' Error details:', errorText);
      }
      
      // fallback to mock data if the API fails
      console.log('Using mock data for song search');
      
      // mock data with popular songs
      const mockData: SongData[] = [
        {
          title: 'Blinding Lights',
          artist: 'The Weeknd',
          album: 'After Hours',
          coverArtUrl: 'https://i.scdn.co/image/ab67616d0000b273c5649add07ed3720be9d5526',
          spotifyId: '0VjIjW4GlUZAMYd2vXMi3b',
          previewUrl: 'https://p.scdn.co/mp3-preview/7dde872ae66f74a37a5a6d0afd93d7529cf99ee1',
        },
        {
          title: 'Starboy',
          artist: 'The Weeknd, Daft Punk',
          album: 'Starboy',
          coverArtUrl: 'https://i.scdn.co/image/ab67616d0000b2734718e2b124f79258be7bc452',
          spotifyId: '7MXVkk9YMctZqd1Srtv4MB',
          previewUrl: 'https://p.scdn.co/mp3-preview/e7671d5b84028c218e4a345db1a8e1f9343cb308',
        },
        {
          title: 'Save Your Tears',
          artist: 'The Weeknd',
          album: 'After Hours',
          coverArtUrl: 'https://i.scdn.co/image/ab67616d0000b273c5649add07ed3720be9d5526',
          spotifyId: '2MRxDbNBPQEOlS7mncOQ5j',
          previewUrl: 'https://p.scdn.co/mp3-preview/4b0b99a0da7e5e92f9a1ae3976a4f7b097eea89e',
        },
        {
          title: 'Stay',
          artist: 'The Kid LAROI, Justin Bieber',
          album: 'Stay',
          coverArtUrl: 'https://i.scdn.co/image/ab67616d0000b273bd3e451a0b8d821c8daa0b96',
          spotifyId: '5PjdY0CKGZdEuoNab3yDmX',
          previewUrl: 'https://p.scdn.co/mp3-preview/dd4df8940382a74e73e3bfa38a1a8733c9eb8561',
        }
      ];
      
      // filter based on query
      const filteredResults = mockData.filter(song => 
        song.title.toLowerCase().includes(query.toLowerCase()) || 
        song.artist.toLowerCase().includes(query.toLowerCase())
      );
      
      // simulate network delay 
      setTimeout(() => {
        setSearchResults(filteredResults);
        setIsSearching(false);
      }, 800);
      
    } catch (error) {
      console.error('Error searching songs:', error);
      setIsSearching(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      searchSongs(searchQuery);
    }
  };

  const handleSongSelect = (song: SongData) => {
    setSelectedSong(song);
    setSearchResults([]);
  };

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      
      if (mediaFiles.length + files.length > 5) {
        alert('You can only upload up to 5 photos');
        return;
      }
      
      if (!files.every(file => file.type.startsWith('image/'))) {
        alert('Please upload image files only');
        return;
      }
      
      if (files.some(file => file.size > 5 * 1024 * 1024)) {
        alert('One or more files exceed 5MB');
        return;
      }
      
      const newMediaFiles = [...mediaFiles, ...files];
      const newMediaPreviews = [...mediaPreviews, ...files.map(file => URL.createObjectURL(file))];
      
      setMediaFiles(newMediaFiles);
      setMediaPreviews(newMediaPreviews);
    }
  };

  const handleRemoveMedia = (index: number) => {
    const newMediaFiles = mediaFiles.filter((_, i) => i !== index);
    const newMediaPreviews = mediaPreviews.filter((_, i) => i !== index);
    
    URL.revokeObjectURL(mediaPreviews[index]);
    
    setMediaFiles(newMediaFiles);
    setMediaPreviews(newMediaPreviews);
    
    if (currentPhotoIndex >= newMediaFiles.length && newMediaFiles.length > 0) {
      setCurrentPhotoIndex(newMediaFiles.length - 1);
    } else if (newMediaFiles.length === 0) {
      setCurrentPhotoIndex(0);
    }
  };

  const handleSubmit = async () => {
    if (!user || !selectedSong) return;
    
    if (!mood) {
      setError('Please select a mood for your song');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    let mediaUrls = [];
    let audioFeatures: SpotifyAudioFeatures | null = null;
    
    try {
      console.log('Starting song submission process');
      
      if (selectedSong.spotifyId) {
        try {
          console.log(' Fetching audio features for Spotify ID:', selectedSong.spotifyId);
          setIsFetchingAudioFeatures(true);
          audioFeatures = await getAudioFeatures(selectedSong.spotifyId, mood, selectedSong.artist);
          
          if (audioFeatures) {
            console.log(' Audio features generated successfully:', {
              valence: audioFeatures.valence,
              energy: audioFeatures.energy,
              danceability: audioFeatures.danceability,
              tempo: audioFeatures.tempo
            });
          } else {
            console.log(' No audio features available for this track');
          }
        } catch (audioError) {
          console.error(' Error fetching audio features:', audioError);
          // continue with post creation even if audio features fail
          audioFeatures = null;
        } finally {
          setIsFetchingAudioFeatures(false);
        }
      } else {
        console.log(' No Spotify ID available, skipping audio features');
      }
      
      // upload media files if exists
      if (mediaFiles.length > 0) {
        console.log('Uploading media files...');
        
        for (let i = 0; i < mediaFiles.length; i++) {
          const file = mediaFiles[i];
          const storageRef = ref(storage, `posts/${user.uid}/${Date.now()}_${file.name}_${i}`);
          const uploadTask = uploadBytesResumable(storageRef, file);
          
          // set up upload progress monitoring
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress = ((i + (snapshot.bytesTransferred / snapshot.totalBytes)) / mediaFiles.length) * 100;
              setUploadProgress(progress);
            },
            (error) => {
              console.error('Upload error:', error);
              setError('Failed to upload media');
              setIsSubmitting(false);
              return;
            }
          );
          
          // wait for upload to complete
          await uploadTask;
          const downloadURL = await getDownloadURL(storageRef);
          mediaUrls.push(downloadURL);
        }
        
        console.log('Media uploaded successfully:', mediaUrls);
      }
      
      // create the song object with all available data
      const songObject: any = {
        title: selectedSong.title,
        artist: selectedSong.artist,
        album: selectedSong.album || selectedSong.artist,
        coverArtUrl: selectedSong.coverArtUrl,
        genres: [] 
      };
      

      if (selectedSong.spotifyId) {
        songObject.spotifyId = selectedSong.spotifyId;
      }
      
      if (selectedSong.previewUrl) {
        songObject.previewUrl = selectedSong.previewUrl;
      }
      
      if (audioFeatures) {
        songObject.audioFeatures = audioFeatures;
      }
      
      console.log('Creating post with enhanced song data:', {
        hasAudioFeatures: !!audioFeatures,
        hasSpotifyId: !!selectedSong.spotifyId,
        hasPreviewUrl: !!selectedSong.previewUrl
      });
      
      // create post with audio features
      const postRef = await createPost(
        user.uid, 
        user.displayName || 'Anonymous', 
        user.photoURL || '', 
        selectedSong.title,
        selectedSong.artist,
        selectedSong.coverArtUrl,
        selectedSong.spotifyId || '',
        selectedSong.previewUrl || '',
        mood,
        caption,
        audioFeatures, 
        songObject, 
        mediaUrls 
      );
      
      console.log('Post created successfully with ID:', postRef);
      
      // update user document to indicate they've posted today
      const userRef = doc(db, 'users', user.uid);
      
      const currentUserDoc = await getDoc(userRef);
      
      const now = new Date();
      
      // now update the user document with the hasPostedToday flag set to true
      await updateDoc(userRef, {
        hasPostedToday: true,
        lastPostDate: serverTimestamp(),
        lastPostDateManual: now, // Backup manual timestamp
        posts: arrayUnion(postRef)
      });
      
      console.log(' User document updated with hasPostedToday: true');
      
      // refresh user data
      await refreshUserData();
      
      console.log(' User data refreshed');
      
      // reset form
      setSelectedSong(null);
      setSearchResults([]);
      setSearchQuery('');
      setCaption('');
      setMood('');
      setMoodCategory('');
      setMediaFiles([]);
      setMediaPreviews([]);
      setCurrentPhotoIndex(0);
      setUploadProgress(0);
      
      // force navigation with page refresh to ensure state sync
      console.log('🔄 Navigating to matches with fresh data load...');
      window.location.href = '/matches';
      
    } catch (error) {
      console.error('Error submitting post:', error);
      setError('Failed to submit post. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-light-100 dark:bg-dark-100 pt-16 pb-8 px-4">
      <div className="max-w-md mx-auto bg-white dark:bg-dark-200 rounded-lg shadow-lg overflow-hidden">
        <div className="p-5 border-b border-gray-200 dark:border-dark-300">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Share Today's Song</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">What are you listening to today?</p>
        </div>
        
        <div className="p-5">
          {/* Selected Song Display */}
          {selectedSong && (
            <div className="mb-6">
              <div className="flex items-center">
                <img 
                  src={selectedSong.coverArtUrl || '/images/default-album.svg'} 
                  alt={selectedSong.album}
                  className="w-24 h-24 object-cover rounded"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/images/default-album.svg';
                  }}
                />
                <div className="ml-4">
                  <p className="text-lg font-medium text-gray-900 dark:text-white">{selectedSong.title}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{selectedSong.artist}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Album: {selectedSong.album}</p>
                  
                  <button
                    className="mt-2 text-xs text-primary-600 hover:text-primary-500 dark:text-primary-400 flex items-center"
                    onClick={() => setSelectedSong(null)}
                  >
                    Change song
                  </button>
                </div>
              </div>
              
              {/* Audio Preview with SpotifyPlayer */}
              {selectedSong.previewUrl ? (
                <div className="mt-4">
                  <SpotifyPlayer 
                    previewUrl={selectedSong.previewUrl}
                    coverImage={selectedSong.coverArtUrl}
                    songName={selectedSong.title}
                    artistName={selectedSong.artist}
                  />
                </div>
              ) : (
                <div className="mt-4 p-3 bg-gray-100 dark:bg-dark-300 rounded-lg text-center text-sm text-gray-500 dark:text-gray-400">
                  <p>No audio preview available for this song</p>
                </div>
              )}
            </div>
          )}
          
          {/* Song Search Section */}
          {!selectedSong && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Search for a song
              </label>
              
              <form onSubmit={handleSearch} className="flex">
                <div className="relative flex-grow">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaSearch className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-dark-400 rounded-l-md bg-white dark:bg-dark-100 text-gray-900 dark:text-white"
                    placeholder="Search by song or artist"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="ml-2 px-4 py-2 border border-transparent rounded-r-md bg-primary-600 text-white hover:bg-primary-700 focus:outline-none"
                  disabled={isSearching || !searchQuery.trim()}
                >
                  {isSearching ? 'Searching...' : 'Search'}
                </button>
              </form>
              
              {/* Search Results */}
              {isSearching ? (
                <div className="mt-4 py-4 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                  <p className="text-sm text-gray-500 mt-2">Searching for songs...</p>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Search Results
                  </h3>
                  <div className="max-h-60 overflow-y-auto">
                    {searchResults.map((song, index) => (
                      <div
                        key={`${song.spotifyId || index}`}
                        className="flex items-center p-2 hover:bg-gray-100 dark:hover:bg-dark-300 rounded-md cursor-pointer"
                        onClick={() => handleSongSelect(song)}
                      >
                        <img
                          src={song.coverArtUrl || '/images/default-album.svg'}
                          alt={`${song.album} cover`}
                          className="h-12 w-12 object-cover rounded"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = '/images/default-album.svg';
                          }}
                        />
                        <div className="ml-3 flex-grow">
                          <h4 className="font-medium text-gray-900 dark:text-white">{song.title}</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{song.artist}</p>
                        </div>
                        {song.previewUrl && (
                          <FaMusic className="text-primary-500 mr-2" title="Preview available" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : searchQuery && !isSearching ? (
                <div className="mt-4 py-4 text-center text-gray-500 dark:text-gray-400">
                  <FaMusic className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p>No songs found. Try a different search term.</p>
                </div>
              ) : null}
            </div>
          )}
          
          {/* Caption Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Add a caption (max 200 characters)
            </label>
            <textarea
              className="w-full p-3 border border-gray-300 dark:border-dark-400 rounded-md bg-white dark:bg-dark-100 text-gray-900 dark:text-white"
              placeholder="Share your thoughts about this song..."
              maxLength={200}
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            ></textarea>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-right">
              {caption.length}/200 characters
            </p>
          </div>
          
          {/* Mood Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              How does this song make you feel?
            </label>
            <select
              className="w-full p-3 border border-gray-300 dark:border-dark-400 rounded-md bg-white dark:bg-dark-100 text-gray-900 dark:text-white"
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              required
            >
              <option value="">Select a mood</option>
              <option value="Happy">Happy</option>
              <option value="Energetic">Energetic</option>
              <option value="Chill">Chill</option>
              <option value="Sad">Sad</option>
              <option value="Nostalgic">Nostalgic</option>
              <option value="Romantic">Romantic</option>
              <option value="Angry">Angry</option>
              <option value="Peaceful">Peaceful</option>
              <option value="Excited">Excited</option>
              <option value="Reflective">Reflective</option>
            </select>
          </div>
          
          {/* Media Upload */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Add photos (max 5 photos)
            </label>
            
            <div className="flex items-center justify-center p-6 border-2 border-dashed border-gray-300 dark:border-dark-400 rounded-md">
              <label className="flex flex-col items-center cursor-pointer">
                <FaCamera className="h-8 w-8 text-gray-400" />
                <span className="mt-2 text-sm text-gray-500 dark:text-gray-400">Add photos</span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  multiple
                  onChange={handleMediaChange}
                />
              </label>
            </div>
          </div>
          
          {/* Media Preview */}
          {mediaPreviews.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Selected Photos ({currentPhotoIndex + 1}/{mediaPreviews.length})
              </h3>
              <div className="relative">
                <img
                  src={mediaPreviews[currentPhotoIndex] || '/images/default-album.svg'}
                  alt={`Photo ${currentPhotoIndex + 1}`}
                  className="w-full h-48 object-cover rounded-md"
                />
                
                {/* Navigation arrows */}
                {mediaPreviews.length > 1 && (
                  <>
                    <button
                      className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full"
                      onClick={() => setCurrentPhotoIndex(Math.max(0, currentPhotoIndex - 1))}
                      disabled={currentPhotoIndex === 0}
                    >
                      <FaChevronLeft className="h-3 w-3" />
                    </button>
                    <button
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full"
                      onClick={() => setCurrentPhotoIndex(Math.min(mediaPreviews.length - 1, currentPhotoIndex + 1))}
                      disabled={currentPhotoIndex === mediaPreviews.length - 1}
                    >
                      <FaChevronRight className="h-3 w-3" />
                    </button>
                  </>
                )}
                
                {/* Remove button */}
                <button
                  className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-1 rounded-full"
                  onClick={() => handleRemoveMedia(currentPhotoIndex)}
                >
                  <FaTimes className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
          
          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
              {error}
            </div>
          )}
          
          {/* Submit Button */}
          <button
            className={`w-full py-3 px-4 rounded-md text-white font-medium transition-colors ${
              selectedSong && !isSubmitting
                ? 'bg-primary-600 hover:bg-primary-700'
                : 'bg-gray-300 dark:bg-dark-400 cursor-not-allowed'
            }`}
            disabled={!selectedSong || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? (
              <>
                <span className="inline-block animate-spin mr-2">⟳</span>
                {isFetchingAudioFeatures 
                  ? 'Analyzing song...'
                  : uploadProgress > 0 && uploadProgress < 100 
                    ? `Uploading... ${Math.round(uploadProgress)}%` 
                    : 'Posting...'}
              </>
            ) : (
              'Post Song of the Day'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PostSong; 