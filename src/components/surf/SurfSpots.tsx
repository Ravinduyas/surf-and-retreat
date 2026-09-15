import React from 'react';
import { MapPin, ArrowRight } from 'lucide-react';
import { SURF_SPOTS } from '../../data';
import { Eyebrow } from '../ui/Eyebrow';
import { useModals } from '../../context/ModalContext';
import { useReveal } from '../ui/Reveal';

export const SurfSpots: React.FC = () => {
  const { openBooking } = useModals();
  const gridRef = useReveal<HTMLDivElement>();

  return (
    <section className="mt-8 sm:mt-12">
      <div className="bg-white border border-[#E3E8DE] rounded-[32px] sm:rounded-[36px] p-6 sm:p-10 lg:p-12 shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left: Narrative */}
          <div className="lg:col-span-4 space-y-5">
            <Eyebrow icon={MapPin}>Surf Spots Nearby</Eyebrow>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#18261E] tracking-tight leading-tight">
              A Wave for Every Level, Minutes Away.
            </h2>
            <p className="text-[#59695C] text-sm leading-relaxed">
              Weligama sits in the middle of Sri Lanka&apos;s south-coast surf strip.
              Progress from the bay to reef points as your surfing grows — our
              instructors will tell you when you&apos;re ready.
            </p>
            <button
              onClick={() => openBooking('surf')}
              className="bg-[#2A4E38] hover:bg-[#1E3B29] text-white text-sm font-medium px-6 py-3 rounded-full inline-flex items-center gap-2 transition-all duration-200 cursor-pointer shadow-xs active:scale-98"
            >
              <span>Plan a Guided Trip</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Right: Spot list */}
          <div className="lg:col-span-8">
            <div ref={gridRef} className="stagger grid grid-cols-1 sm:grid-cols-2 gap-4">
              {SURF_SPOTS.map((spot) => (
                <div
                  key={spot.id}
                  id={`surf-spot-${spot.id}`}
                  className="bg-[#F4F6F2]/90 hover:bg-white border border-[#E1E7DE] rounded-2xl p-5 transition-all duration-200 shadow-xs hover:shadow-sm hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[16px] font-bold text-[#18271E] tracking-tight">
                      {spot.name}
                    </h3>
                    <span className="inline-block bg-[#F2F6F0] border border-[#D5DDD1] text-[#34593E] text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0">
                      {spot.level}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[12px] text-[#637265] font-medium mt-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#2C573A]" />
                    <span>{spot.distance}</span>
                  </div>
                  <p className="text-[13px] text-[#5A695D] leading-relaxed mt-2">
                    {spot.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
