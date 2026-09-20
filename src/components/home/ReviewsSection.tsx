import React from 'react';
import { Star } from 'lucide-react';
import { REVIEWS } from '../../data';
import { Eyebrow } from '../ui/Eyebrow';
import { useReveal } from '../ui/Reveal';

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

        <div ref={gridRef} className="stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {REVIEWS.map((r, idx) => (
            <div
              key={r.id}
              id={`review-${r.id}`}
              className="bg-[#F4F6F2]/90 hover:bg-white border border-[#E1E7DE] rounded-3xl p-6 sm:p-7 transition-all duration-200 shadow-xs hover:shadow-sm flex flex-col gap-4"
              style={{ '--i': idx } as React.CSSProperties}
            >
              <div className="flex items-center justify-between">
                <StarRow rating={r.rating} />
                <span className="inline-block bg-white text-[#1D3624] text-[11px] font-semibold px-3 py-1 rounded-full border border-[#E1E7DE]">
                  {r.stayType}
                </span>
              </div>
              <p className="text-[14px] text-[#3D4F42] leading-relaxed flex-1">
                &ldquo;{r.quote}&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <img
                  src={r.avatar}
                  alt={r.name}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-full ring-2 ring-white object-cover shadow-xs"
                />
                <div>
                  <div className="text-[13px] font-bold text-[#18271E]">{r.name}</div>
                  <div className="text-[11px] text-[#637265] font-medium">
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
