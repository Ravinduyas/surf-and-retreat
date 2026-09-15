import React from 'react';
import { Wifi, Snowflake, Armchair, PhoneCall, Coffee, Printer, Sparkles, LucideIcon } from 'lucide-react';
import { AMENITIES } from '../../data';
import { Amenity } from '../../types';
import { Eyebrow } from '../ui/Eyebrow';
import { useReveal } from '../ui/Reveal';

const ICONS: Record<Amenity['iconType'], LucideIcon> = {
  wifi: Wifi,
  ac: Snowflake,
  desk: Armchair,
  booth: PhoneCall,
  coffee: Coffee,
  printer: Printer,
};

export const AmenitiesGrid: React.FC = () => {
  const gridRef = useReveal<HTMLDivElement>();
  return (
    <section className="mt-6 sm:mt-10">
      <div className="bg-white border border-[#E3E8DE] rounded-[32px] sm:rounded-[36px] p-6 sm:p-10 lg:p-12 shadow-xs">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div className="space-y-4">
            <Eyebrow icon={Sparkles}>Everything You Need</Eyebrow>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#18261E] tracking-tight leading-tight">
              Built for Actual Work
            </h2>
          </div>
          <p className="text-[#59695C] text-sm max-w-sm leading-relaxed">
            Open 8 AM – 10 PM daily (24/7 for month passes), with the ocean a
            five-minute walk away when you need a reset.
          </p>
        </div>

        <div ref={gridRef} className="stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {AMENITIES.map((amenity) => {
            const Icon = ICONS[amenity.iconType] ?? Sparkles;
            return (
              <div
                key={amenity.id}
                id={`amenity-${amenity.id}`}
                className="bg-[#F4F6F2]/90 hover:bg-white border border-[#E1E7DE] rounded-2xl p-5 transition-all duration-200 shadow-xs hover:shadow-sm hover:-translate-y-0.5 flex items-start gap-4"
              >
                <div className="w-10 h-10 rounded-full bg-white border border-[#E1E7DE] flex items-center justify-center shrink-0 shadow-xs">
                  <Icon className="w-4.5 h-4.5 text-[#264D35]" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#18271E] tracking-tight">
                    {amenity.label}
                  </h3>
                  <p className="text-[12px] text-[#5A695D] leading-snug mt-1">
                    {amenity.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
