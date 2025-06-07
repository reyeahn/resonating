// social login integration buttons
import React from 'react';
import { FaGoogle, FaSpotify } from 'react-icons/fa';
import Button from '../common/Button';

interface OAuthButtonsProps {
  onGoogleSignIn: () => Promise<void>;
  onSpotifySignIn?: () => Promise<void>; 
  isLoading?: boolean;
}

const OAuthButtons: React.FC<OAuthButtonsProps> = ({
  onGoogleSignIn,
  onSpotifySignIn,
  isLoading = false,
}) => {
  return (
    <div className="flex flex-col space-y-3 w-full">
      <Button
        type="button"
        variant="outline"
        fullWidth
        onClick={onGoogleSignIn}
        leftIcon={<FaGoogle className="h-5 w-5 text-red-500" />}
        disabled={isLoading}
      >
        Continue with Google
      </Button>

      <Button
        type="button"
        variant="outline"
        fullWidth
        onClick={onSpotifySignIn}
        leftIcon={<FaSpotify className="h-5 w-5 text-green-500" />}
        disabled={isLoading || !onSpotifySignIn}
      >
        Continue with Spotify
      </Button>

      <div className="relative mt-3">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white dark:bg-dark-100 text-gray-500 dark:text-gray-400">
            or
          </span>
        </div>
      </div>
    </div>
  );
};

export default OAuthButtons; 