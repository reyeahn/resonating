// spotify account connection interface
import React from 'react';
import { FaSpotify } from 'react-icons/fa';
import { connectToSpotify } from '@/services/spotify';
import { useAuth } from '@/hooks/useAuth';

interface SpotifyConnectProps {
  className?: string;
}

const SpotifyConnect: React.FC<SpotifyConnectProps> = ({ className = '' }) => {
  const { userData } = useAuth();
  
  const isConnected = userData?.spotifyConnected;
  
  const handleConnect = () => {
    connectToSpotify();
  };
  
  return (
    <div className={`${className}`}>
      {isConnected ? (
        <div className="flex items-center p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <FaSpotify className="text-green-500 text-xl mr-2" />
          <div>
            <p className="text-sm font-medium text-green-800 dark:text-green-300">Spotify Connected</p>
            <p className="text-xs text-green-600 dark:text-green-400">Your Spotify account is linked</p>
          </div>
        </div>
      ) : (
        <button
          onClick={handleConnect}
          className="flex items-center justify-center w-full py-3 px-4 bg-[#1DB954] hover:bg-[#1ed760] text-white font-medium rounded-lg transition-colors"
        >
          <FaSpotify className="mr-2 text-lg" />
          Connect to Spotify
        </button>
      )}
    </div>
  );
};

export default SpotifyConnect; 