import React from 'react';
import { X, Sparkles } from 'lucide-react';
import { ModalShell } from './ui/ModalShell';

interface VideoModalProps {
  onClose: () => void;
}

export const VideoModal: React.FC<VideoModalProps> = ({ onClose }) => {
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
        <iframe
          className="w-full h-full"
          src="https://www.youtube-nocookie.com/embed/CwD6k-JfS1o?autoplay=1&mute=0&controls=1&rel=0"
          title="Weligama surfers — Sri Lanka surf video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
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
