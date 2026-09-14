import React from 'react';
import { Quote, Star } from 'lucide-react';
import { TESTIMONIALS } from '../../data';
import { Eyebrow } from '../ui/Eyebrow';

export const TestimonialsSection: React.FC = () => {
  return (
    <section className="mt-8 sm:mt-12">
      <div className="bg-white border border-[#E3E8DE] rounded-[32px] sm:rounded-[36px] p-6 sm:p-10 lg:p-12 shadow-xs">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div className="space-y-4">
            <Eyebrow icon={Quote}>Guest Stories</Eyebrow>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#18261E] tracking-tight leading-tight">
              Don&apos;t Take Our Word for It
            </h2>
          </div>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-[#18271E]">
            <Star className="w-4 h-4 text-[#D7A93C] fill-current" />
            <span>4.9 average from 600+ reviews</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.id}
              id={`testimonial-${t.id}`}
              className="bg-[#F4F6F2]/90 hover:bg-white border border-[#E1E7DE] rounded-3xl p-6 sm:p-7 transition-all duration-200 shadow-xs hover:shadow-sm flex flex-col justify-between gap-5"
            >
              <p className="text-[14px] text-[#3D4F42] leading-relaxed">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <img
                  src={t.avatar}
                  alt={t.name}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-full ring-2 ring-white object-cover shadow-xs"
                />
                <div>
                  <div className="text-[13px] font-bold text-[#18271E]">{t.name}</div>
                  <div className="text-[11px] text-[#637265] font-medium">{t.origin}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
