import React from 'react';
import { X, ShieldCheck, MapPin, ArrowRight } from 'lucide-react';
import { ModalShell } from './ui/ModalShell';
import { DetailItem } from '../types';
import { Photo } from './ui/Photo';

interface DetailModalProps {
  item: DetailItem;
  onClose: () => void;
  onBook: () => void;
}

export const DetailModal: React.FC<DetailModalProps> = ({ item, onClose, onBook }) => {
  return (
    <ModalShell
      onClose={onClose}
      cardClassName="relative w-full max-w-2xl bg-white rounded-[32px] overflow-hidden border border-[#DCE2D8] shadow-2xl"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/80 backdrop-blur-md text-[#18271E] hover:bg-white shadow-md transition-all cursor-pointer"
        aria-label="Close details"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Hero Image */}
      <div className="relative h-64 sm:h-72 w-full overflow-hidden bg-gray-100">
        <Photo
          src={item.image}
          alt={item.title}
          sizes="(max-width: 768px) 100vw, 640px"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-4 left-6">
          <span className="inline-block bg-[#D7E95C] text-[#16301F] text-xs font-bold px-3.5 py-1 rounded-full uppercase tracking-wider mb-2">
            {item.tag}
          </span>
          <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {item.title}
          </h3>
        </div>
      </div>

      {/* Modal Content */}
      <div className="p-6 sm:p-8 space-y-5">
        <div>
          <h4 className="text-xs font-bold text-[#355B40] uppercase tracking-wider">
            {item.category}
          </h4>
          <p className="text-[#556558] text-sm leading-relaxed mt-1">{item.description}</p>
        </div>

        {item.highlight && (
          <div className="bg-[#F4F7F2] p-4 rounded-2xl border border-[#DFE6DB] flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[#2C573A] shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-bold text-[#1C3A27] block">Good to Know:</span>
              <span className="text-xs text-[#526456] mt-0.5 block leading-relaxed">
                {item.highlight}
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-[#E5ECE2]">
          <div className="flex items-center gap-1.5 text-xs text-[#6B7C6E]">
            <MapPin className="w-3.5 h-3.5 text-[#2C573A]" />
            <span>{item.price ? `${item.price} · Weligama, Sri Lanka` : 'Weligama, Sri Lanka'}</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none border border-[#D5DDD2] px-5 py-2.5 rounded-full text-xs font-semibold text-[#243E2C] hover:bg-[#F3F6F1] transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={onBook}
              className="flex-1 sm:flex-none bg-[#2A4E38] hover:bg-[#1E3A28] text-white px-5 py-2.5 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <span>Request to Book</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
};
