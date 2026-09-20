import React from 'react';
import { BookOpen } from 'lucide-react';
import { Eyebrow } from '../ui/Eyebrow';
import { STATS } from '../../data';

const StoryStat: React.FC<{ stat: (typeof STATS)[number]; className?: string }> = ({
  stat,
  className = '',
}) => (
  <div
    className={`bg-[#F4F6F2]/90 hover:bg-white border border-[#E1E7DE] rounded-2xl p-6 sm:p-8 transition-all duration-200 shadow-xs hover:shadow-sm text-center ${className}`}
  >
    <div className="text-3xl sm:text-4xl font-bold text-[#18271E] tracking-tight whitespace-nowrap">
      {stat.value}
    </div>
    <div className="text-[13px] text-[#637265] font-medium mt-1.5 leading-tight">{stat.label}</div>
  </div>
);

export const StorySection: React.FC = () => {
  return (
    <section className="mt-6 sm:mt-10">
      <div className="bg-white rounded-[32px] sm:rounded-[36px] p-6 sm:p-10 lg:p-14 shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          <div className="lg:col-span-5 space-y-6">
            <Eyebrow icon={BookOpen}>How It Started</Eyebrow>
            <h2 className="text-4xl sm:text-5xl font-bold text-[#18261E] tracking-tight leading-[1.12]">
              Built by{' '}
              <span className="font-serif italic font-normal text-[#2A593B]">
                Surfers,
              </span>
              <br />
              Run Like a
              <br />
              Family.
            </h2>
            <p className="text-[#59695C] text-sm sm:text-base leading-relaxed max-w-md">
              In 2019 we came to Weligama for two weeks of waves and never really left.
              We opened with six dorm beds and a single long table; today we host
              surfers and remote workers from forty countries — but dinner is still
              cooked together, and the 6 AM surf crew still leaves as one.
            </p>
            <p className="text-[#59695C] text-sm sm:text-base leading-relaxed max-w-md">
              Our team is Weligama born and raised: local instructors who know every
              sandbank in the bay, and staff who&apos;ll treat you like a returning
              cousin by day two.
            </p>
          </div>

          <div className="lg:col-span-7">
            {/* Phones: the four stats glide sideways in one row instead of squeezing */}
            <div className="sm:hidden marquee marquee-mask relative overflow-hidden -mx-6">
              <div className="marquee-track flex w-max pl-6">
                {[false, true].map((dup) => (
                  <div key={String(dup)} className="flex gap-3 pr-3" aria-hidden={dup || undefined}>
                    {STATS.map((stat) => (
                      <StoryStat key={stat.id} stat={stat} className="w-[180px] shrink-0" />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="hidden sm:grid grid-cols-2 gap-4">
              {STATS.map((stat) => (
                <StoryStat key={stat.id} stat={stat} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
