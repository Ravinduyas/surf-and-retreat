import React, { useRef, useState } from 'react';
import { X, Sparkles, Play, Pause } from 'lucide-react';
import { ModalShell } from './ui/ModalShell';

interface VideoModalProps {
  onClose: () => void;
}

const VIDEO_ID = 'CwD6k-JfS1o';

/**
 * Clean, chrome-free player: a thumbnail facade with only our play button,
 * then a controls-less embed driven via postMessage so the only visible
 * control is our own play/pause overlay.
 */
export const VideoModal: React.FC<VideoModalProps> = ({ onClose }) => {
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const sendCommand = (func: 'playVideo' | 'pauseVideo') => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func, args: [] }),
      '*'
    );
  };

  const togglePlay = () => {
    if (paused) {
      sendCommand('playVideo');
      setPaused(false);
    } else {
      sendCommand('pauseVideo');
      setPaused(true);
    }
  };

  return (
    <ModalShell
      onClose={onClose}
      overlayClassName="bg-black/75 backdrop-blur-sm"
      cardClassName="relative w-full max-w-3xl bg-[#142319] rounded-[28px] overflow-hidden border border-white/20 shadow-2xl"
    >
      {/* Modal Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-2 text-white">
          <Sparkles className="w-4 h-4 text-[#D7E95C]" />
          <span className="text-sm font-semibold tracking-wide">A Morning on Weligama Bay</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Close video"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Surf Video */}
      <div className="relative aspect-video w-full bg-black">
        {!started ? (
          <button
            onClick={() => setStarted(true)}
            className="group absolute inset-0 w-full h-full cursor-pointer"
            aria-label="Play video"
          >
            <img
              src={`https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`}
              alt="Surfers on Weligama Bay"
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <span className="absolute inset-0 bg-black/25 group-hover:bg-black/15 transition-colors" />
            <span className="ripple absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-white shadow-xl flex items-center justify-center text-[#18271E] transition-transform duration-200 group-hover:scale-110">
              <Play className="w-6 h-6 fill-current ml-1" />
            </span>
          </button>
        ) : (
          <>
            <iframe
              ref={iframeRef}
              className="w-full h-full"
              src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&controls=0&rel=0&iv_load_policy=3&fs=0&disablekb=1&playsinline=1&enablejsapi=1&modestbranding=1`}
              title="Weligama surfers — Sri Lanka surf video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
            />
            {/* Our only control: click anywhere to toggle, icon shows on hover or pause */}
            <button
              onClick={togglePlay}
              className="group absolute inset-0 w-full h-full cursor-pointer"
              aria-label={paused ? 'Play video' : 'Pause video'}
            >
              <span
                className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white/90 shadow-xl flex items-center justify-center text-[#18271E] transition-all duration-200 ${
                  paused ? 'opacity-100 scale-100' : 'opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100'
                }`}
              >
                {paused ? (
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                ) : (
                  <Pause className="w-5 h-5 fill-current" />
                )}
              </span>
            </button>
          </>
        )}
      </div>

      {/* Modal Footer Note */}
      <div className="p-6 bg-[#16271C] text-white/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-base font-bold text-white">This Could Be Your Morning</h4>
          <p className="text-xs text-white/70 mt-0.5 max-w-lg">
            Gentle, sandy-bottom waves five minutes from your bed. Sunrise sessions, then
            breakfast and a full day of work or play — every single day.
          </p>
        </div>
        <button
          onClick={onClose}
          className="bg-[#D7E95C] text-[#142319] text-xs font-bold px-5 py-2.5 rounded-full hover:bg-[#CFE348] transition-colors whitespace-nowrap cursor-pointer"
        >
          Plan Your Trip
        </button>
      </div>
    </ModalShell>
  );
};
