// image gallery carousel for posts
import React, { useState, useRef } from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';

interface PhotoCarouselProps {
  mediaUrls: string[];
  className?: string;
  showCounter?: boolean;
  counterPosition?: 'top-right' | 'bottom-center';
  showNavigation?: boolean;
  autoHeight?: boolean;
}

const PhotoCarousel: React.FC<PhotoCarouselProps> = ({
  mediaUrls,
  className = '',
  showCounter = true,
  counterPosition = 'top-right',
  showNavigation = true,
  autoHeight = false
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  // if no media URLs, don't render 
  if (!mediaUrls || mediaUrls.length === 0) {
    return null;
  }

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) => (prevIndex === 0 ? mediaUrls.length - 1 : prevIndex - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex === mediaUrls.length - 1 ? 0 : prevIndex + 1));
  };

  const goToIndex = (index: number) => {
    setCurrentIndex(index);
  };

  // handle touch events 
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && mediaUrls.length > 1) {
      goToNext();
    }
    if (isRightSwipe && mediaUrls.length > 1) {
      goToPrevious();
    }
  };

  return (
    <div 
      ref={carouselRef}
      className={`relative ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Main Image */}
      <img
        src={mediaUrls[currentIndex]}
        alt={`Photo ${currentIndex + 1}`}
        className={`w-full ${autoHeight ? 'h-auto' : 'h-full'} object-cover transition-opacity duration-300`}
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.src = '/images/default-album.svg';
        }}
        draggable={false}
      />

      {/* Counter */}
      {showCounter && mediaUrls.length > 1 && (
        <div
          className={`absolute text-white text-xs font-medium px-2 py-1 bg-black bg-opacity-60 rounded-md backdrop-blur-sm ${
            counterPosition === 'top-right'
              ? 'top-2 right-2'
              : 'bottom-2 left-1/2 transform -translate-x-1/2'
          }`}
        >
          {currentIndex + 1}/{mediaUrls.length}
        </div>
      )}

      {/* Navigation Arrows */}
      {showNavigation && mediaUrls.length > 1 && (
        <>
          <button
            className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-60 text-white p-1.5 rounded-full hover:bg-opacity-80 transition-all duration-200 backdrop-blur-sm"
            onClick={goToPrevious}
            aria-label="Previous photo"
          >
            <FaChevronLeft className="h-3 w-3" />
          </button>
          <button
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-60 text-white p-1.5 rounded-full hover:bg-opacity-80 transition-all duration-200 backdrop-blur-sm"
            onClick={goToNext}
            aria-label="Next photo"
          >
            <FaChevronRight className="h-3 w-3" />
          </button>
        </>
      )}

      {/* Dot Indicators  */}
      {mediaUrls.length > 1 && mediaUrls.length <= 5 && (
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1.5">
          {mediaUrls.map((_, index) => (
            <button
              key={index}
              className={`w-2 h-2 rounded-full transition-all duration-200 ${
                index === currentIndex 
                  ? 'bg-white shadow-lg' 
                  : 'bg-white bg-opacity-50 hover:bg-opacity-75'
              }`}
              onClick={() => goToIndex(index)}
              aria-label={`Go to photo ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Swipe indicator for mobile  */}
      {mediaUrls.length > 1 && (
        <div className="absolute top-2 left-2 opacity-50 pointer-events-none">
          <div className="text-white text-xs bg-black bg-opacity-40 px-2 py-1 rounded-md backdrop-blur-sm">
            Swipe
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoCarousel; 