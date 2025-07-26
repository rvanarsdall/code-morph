import React from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';

interface PlaybackControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSpeedChange: (speed: number) => void;
  playbackSpeed: number;
  canPlay: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  isAnimating: boolean;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  isPlaying,
  onPlayPause,
  onPrevious,
  onNext,
  onSpeedChange,
  playbackSpeed,
  canPlay,
  canGoBack,
  canGoForward,
  isAnimating
}) => {
  return (
    <div className="flex items-center space-x-3">
      <button
        onClick={onPrevious}
        disabled={!canGoBack || isAnimating}
        className="p-2 text-gray-400 hover:text-yellow-400 disabled:text-gray-600 transition-colors"
        title="Previous state"
      >
        <SkipBack className="w-5 h-5" />
      </button>
      
      <button
        onClick={onPlayPause}
        disabled={!canPlay || isAnimating}
        className="p-3 bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white rounded-full transition-all disabled:from-gray-600 disabled:to-gray-700"
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
      </button>
      
      <button
        onClick={onNext}
        disabled={!canGoForward || isAnimating}
        className="p-2 text-gray-400 hover:text-yellow-400 disabled:text-gray-600 transition-colors"
        title="Next state"
      >
        <SkipForward className="w-5 h-5" />
      </button>
      
      <select
        value={playbackSpeed}
        onChange={(e) => onSpeedChange(Number(e.target.value))}
        className="bg-gray-700/50 text-white px-3 py-2 rounded-lg text-sm border border-gray-600 focus:border-yellow-500 focus:outline-none"
        title="Playback speed"
      >
        <option value={500}>Very Fast (0.5s)</option>
        <option value={750}>Faster (0.75s)</option>
        <option value={1000}>Normal (1s)</option>
        <option value={1500}>Fast (1.5s)</option>
        <option value={2500}>Normal (2.5s)</option>
        <option value={4000}>Slow (4s)</option>
      </select>
    </div>
  );
};