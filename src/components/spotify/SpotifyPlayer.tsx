// custom music player interface
import React, { useState, useEffect } from 'react';
import { FaPlay, FaPause, FaVolumeUp, FaVolumeMute } from 'react-icons/fa';

interface SpotifyPlayerProps {
  previewUrl: string | null;
  coverImage: string;
  songName: string;
  artistName: string;
  className?: string;
}

const SpotifyPlayer: React.FC<SpotifyPlayerProps> = ({
  previewUrl,
  coverImage,
  songName,
  artistName,
  className = '',
}) => {
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);

  // initialize audio element
  useEffect(() => {
    if (!previewUrl) return;

    const audioElement = new Audio(previewUrl);
    audioElement.volume = volume;
    
    // set up event listeners
    audioElement.addEventListener('loadedmetadata', () => {
      setDuration(audioElement.duration);
    });
    
    audioElement.addEventListener('timeupdate', () => {
      setCurrentTime(audioElement.currentTime);
    });
    
    audioElement.addEventListener('ended', () => {
      setIsPlaying(false);
      setCurrentTime(0);
      audioElement.currentTime = 0;
    });
    
    setAudio(audioElement);
    
    // clean up event listeners on unmount
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
        audioElement.remove();
      }
    };
  }, [previewUrl]);

  // handle play/pause
  const togglePlay = () => {
    if (!audio) return;
    
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    
    setIsPlaying(!isPlaying);
  };

  // handle volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    
    if (audio) {
      audio.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  };

  // handle seeking
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    
    if (audio) {
      audio.currentTime = newTime;
    }
  };

  // handle mute toggle
  const toggleMute = () => {
    if (!audio) return;
    
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    
    if (newMutedState) {
      audio.volume = 0;
    } else {
      audio.volume = volume;
    }
  };

  // format time 
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  if (!previewUrl) {
    return (
      <div className={`flex items-center ${className} p-3 bg-gray-100 dark:bg-dark-300 rounded-lg`}>
        <img 
          src={coverImage || '/images/default-album.jpg'} 
          alt={songName}
          className="w-12 h-12 object-cover rounded-md"
        />
        <div className="ml-3 flex-grow">
          <p className="font-medium text-gray-800 dark:text-white text-sm">{songName}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{artistName}</p>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 italic">
          No preview available
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} p-3 bg-gray-100 dark:bg-dark-300 rounded-lg`}>
      <div className="flex items-center mb-3">
        <img 
          src={coverImage || '/images/default-album.jpg'} 
          alt={songName}
          className="w-12 h-12 object-cover rounded-md"
        />
        <div className="ml-3 flex-grow">
          <p className="font-medium text-gray-800 dark:text-white text-sm">{songName}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{artistName}</p>
        </div>
        <button 
          onClick={togglePlay}
          className="p-2 bg-primary-600 text-white rounded-full hover:bg-primary-700 transition-colors"
        >
          {isPlaying ? <FaPause size={12} /> : <FaPlay size={12} className="ml-0.5" />}
        </button>
      </div>
      
      <div className="flex items-center space-x-2">
        <span className="text-xs text-gray-500 dark:text-gray-400 w-8">
          {formatTime(currentTime)}
        </span>
        <input
          type="range"
          min="0"
          max={duration || 30} 
          value={currentTime}
          onChange={handleSeek}
          className="flex-grow h-1 bg-gray-300 dark:bg-dark-400 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #6366f1 ${(currentTime / (duration || 30)) * 100}%, #d1d5db ${(currentTime / (duration || 30)) * 100}%)`,
          }}
        />
        <span className="text-xs text-gray-500 dark:text-gray-400 w-8">
          {formatTime(duration || 30)}
        </span>
        <button 
          onClick={toggleMute}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          {isMuted ? <FaVolumeMute size={16} /> : <FaVolumeUp size={16} />}
        </button>
      </div>
    </div>
  );
};

export default SpotifyPlayer; 