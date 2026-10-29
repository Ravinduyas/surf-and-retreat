import React from 'react';
import { Star } from 'lucide-react';
import { REVIEWS } from '../../data';
import { Eyebrow } from '../ui/Eyebrow';
import { useReveal } from '../ui/Reveal';
import { InitialsBadge } from '../ui/InitialsBadge';

const StarRow: React.FC<{ rating: number }> = ({ rating }) => (
  <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Star
        key={i}
        className={`w-3.5 h-3.5 ${
          i <= rating ? 'text-[#D7A93C] fill-current' : 'text-[#D8DFD4]'
        }`}
      />
    ))}
  </div>
);

export const ReviewsSection: React.FC = () => {
  const gridRef = useReveal<HTMLDivElement>();
  return (
    <section className="mt-8 sm:mt-12">
      <div className="bg-white rounded-[32px] sm:rounded-[36px] p-6 sm:p-10 lg:p-12 shadow-xs">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div className="space-y-4">
            <Eyebrow icon={Star}>Guest Reviews</Eyebrow>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#18261E] tracking-tight leading-tight">
              Rated 4.9 by the People
              <br className="hidden sm:block" /> Who Slept Here
            </h2>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-[#18271E]">
              <Star className="w-4 h-4 text-[#D7A93C] fill-current" />
              <span>4.9 average from 600+ reviews</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {['Hostelworld 9.4', 'Google 4.9', 'Booking.com 9.2'].map((p) => (
                <span
                  key={p}
                  className="inline-block bg-[#F3F6F1] border border-[#E1E7DE] text-[#3D4F42] text-[11px] font-semibold px-3 py-1 rounded-full"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div
          ref={gridRef}
          className="stagger flex gap-3 lg:gap-4 overflow-x-auto snap-x snap-mandatory -mx-6 px-6 sm:-mx-10 sm:px-10 lg:mx-0 lg:px-0 pt-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-5 lg:overflow-visible"
        >
          {REVIEWS.map((r, idx) => (
            <div
              key={r.id}
              id={`review-${r.id}`}
              className={`shrink-0 w-[82%] sm:w-[46%] md:w-[32%] lg:w-auto snap-start bg-[#F4F6F2]/90 hover:bg-white border border-[#E1E7DE] rounded-3xl p-5 lg:p-4.5 xl:p-6 transition-all duration-200 shadow-xs hover:shadow-sm flex flex-col justify-between gap-4 h-full ${
                idx >= 5 ? 'hidden' : ''
              }`}
              style={{ '--i': idx } as React.CSSProperties}
              {...(idx >= 5 ? { 'aria-hidden': 'true' } : {})}
            >
              <div className="flex items-center justify-between gap-1 flex-wrap sm:flex-nowrap">
                <StarRow rating={r.rating} />
                <span className="inline-block bg-white text-[#1D3624] text-[10px] xl:text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-[#E1E7DE] shrink-0">
                  {r.stayType}
                </span>
              </div>
              <p className="text-[13px] xl:text-[14px] text-[#3D4F42] leading-relaxed flex-1">
                &ldquo;{r.quote}&rdquo;
              </p>
              <div className="flex items-center gap-2.5 sm:gap-3 pt-1">
                <InitialsBadge name={r.name} />
                <div className="min-w-0">
                  <div className="text-[12px] xl:text-[13px] font-bold text-[#18271E] truncate">{r.name}</div>
                  <div className="text-[10px] xl:text-[11px] text-[#637265] font-medium truncate">
                    {r.origin} · {r.date}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
