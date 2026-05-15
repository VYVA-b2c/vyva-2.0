import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Maximize, Minimize } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DeckProps {
  slides: React.ComponentType[];
}

export const Deck: React.FC<DeckProps> = ({ slides }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const nextSlide = () => {
    setCurrentSlide(curr => {
      if (curr < slides.length - 1) {
        return curr + 1;
      }
      return curr;
    });
  };

  const prevSlide = () => {
    setCurrentSlide(curr => {
      if (curr > 0) {
        return curr - 1;
      }
      return curr;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevSlide();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // Empty deps since nextSlide/prevSlide use functional updates

  const CurrentSlideComponent = slides[currentSlide];

  return (
    <div className={`w-full h-screen bg-gray-100 flex items-center justify-center overflow-hidden ${isFullscreen ? 'fixed inset-0 z-50' : 'relative'}`}>
      {/* Slide Container - Aspect Ratio 16:9 */}
      <div className="w-full max-w-[177.78vh] aspect-video bg-white shadow-2xl relative overflow-hidden flex flex-col">
        <CurrentSlideComponent />
        
        {/* Navigation Overlay (visible on hover or always at bottom right) */}
        <div className="absolute bottom-4 right-4 flex gap-2 print:hidden z-50">
           <div className="bg-black/50 backdrop-blur-sm text-white rounded-full px-4 py-1 flex items-center gap-4">
             <span className="text-sm font-medium">{currentSlide + 1} / {slides.length}</span>
             <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:text-white hover:bg-white/20" onClick={prevSlide} disabled={currentSlide === 0}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:text-white hover:bg-white/20" onClick={nextSlide} disabled={currentSlide === slides.length - 1}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
             </div>
           </div>
        </div>
      </div>

      {/* External Controls */}
      <div className="absolute bottom-4 left-4 flex gap-2 print:hidden">
         {/* Fullscreen button removed */}
      </div>
    </div>
  );
};