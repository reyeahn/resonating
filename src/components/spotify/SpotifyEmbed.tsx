// embedded spotify player widget
import React, { useState } from 'react';
import { FaSpotify, FaPlay, FaPause } from 'react-icons/fa';
import SpotifyPlayer from './SpotifyPlayer';

interface SpotifyEmbedProps {
  spotifyId?: string;
  previewUrl?: string | null;
  coverArtUrl: string;
  title: string;
  artist: string;
  className?: string;
}

const SpotifyEmbed: React.FC<SpotifyEmbedProps> = ({
  spotifyId,
  previewUrl,
  coverArtUrl,
  title,
  artist,
  className = '',
}) => {
  const [expanded, setExpanded] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // generate Spotify embed URL
  const spotifyEmbedUrl = spotifyId 
    ? `https://open.spotify.com/embed/track/${spotifyId}` 
    : null;
  
  // handle opening in Spotify
  const openInSpotify = () => {
    if (spotifyId) {
      window.open(`https://open.spotify.com/track/${spotifyId}`, '_blank');
    }
  };

  // simple play/pause 
  const togglePlay = () => {
    if (!previewUrl) return;
    
    if (!audio) {
      const newAudio = new Audio(previewUrl);
      newAudio.addEventListener('ended', () => {
        setIsPlaying(false);
      });
      setAudio(newAudio);
      newAudio.play();
      setIsPlaying(true);
    } else {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        audio.play();
        setIsPlaying(true);
      }
    }
  };
  
  // clean up audio when component unmounts
  React.useEffect(() => {
    return () => {
      if (audio) {
        audio.pause();
        audio.src = '';
      }
    };
  }, [audio]);
  
  return (
    <div className={`${className} rounded-lg overflow-hidden`}>
      {expanded ? (
        <>
          {/* Show the SpotifyPlayer if preview URL is available */}
          {previewUrl ? (
            <SpotifyPlayer
              previewUrl={previewUrl}
              coverImage={coverArtUrl}
              songName={title}
              artistName={artist}
            />
          ) : spotifyEmbedUrl ? (
            // fall back to iframe embed if available
            <div className="bg-white dark:bg-dark-300 rounded-lg p-2">
              <iframe
                src={spotifyEmbedUrl}
                width="100%"
                height="80"
                frameBorder="0"
                allow="encrypted-media"
                className="rounded"
              ></iframe>
            </div>
          ) : (
            // no playback options available
            <div className="p-3 bg-gray-100 dark:bg-dark-300 rounded-lg flex items-center">
              <img
                src={coverArtUrl}
                alt={title}
                className="w-12 h-12 object-cover rounded"
              />
              <div className="ml-3">
                <p className="font-medium text-gray-800 dark:text-white text-sm">{title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{artist}</p>
              </div>
            </div>
          )}
          
          {/* Collapse button */}
          <button
            onClick={() => {
              setExpanded(false);
              if (audio && isPlaying) {
                audio.pause();
                setIsPlaying(false);
              }
            }}
            className="w-full text-xs text-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 py-1"
          >
            Collapse player
          </button>
        </>
      ) : (
        // collapsed view
        <div className="p-3 bg-gray-100 dark:bg-dark-300 rounded-lg flex items-center">
          <img
            src={coverArtUrl}
            alt={title}
            className="w-12 h-12 object-cover rounded"
          />
          <div className="ml-3 flex-grow">
            <p className="font-medium text-gray-800 dark:text-white text-sm">{title}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{artist}</p>
            
            {previewUrl ? (
              <button 
                className="flex items-center text-xs text-primary-600 dark:text-primary-400 mt-1"
                onClick={(e) => {
                  e.stopPropagation();
                  if (previewUrl) {
                    if (isPlaying) {
                      togglePlay(); 
                    } else {
                      setExpanded(true); 
                    }
                  }
                }}
              >
                {isPlaying ? (
                  <>
                    <FaPause size={10} className="mr-1" /> Pause
                  </>
                ) : (
                  <>
                    <FaPlay size={10} className="mr-1" /> Play preview
                  </>
                )}
              </button>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                No preview available
              </p>
            )}
          </div>
          {spotifyId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                openInSpotify();
              }}
              className="ml-2 p-2 text-[#1DB954] hover:text-[#1ed760] transition-colors"
              title="Open in Spotify"
            >
              <FaSpotify size={20} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SpotifyEmbed; 