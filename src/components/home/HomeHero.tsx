import React from 'react';
import { Play } from 'lucide-react';
import { STATS, HERO_IMAGE } from '../../data';
import { Photo } from '../ui/Photo';
import { useModals } from '../../context/ModalContext';

const StatTile: React.FC<{
  stat: (typeof STATS)[number];
  highlight: boolean;
  className?: string;
  style?: React.CSSProperties;
}> = ({ stat, highlight, className = '', style }) => (
  <div
    className={`rounded-2xl p-4 sm:p-5 border transition-all duration-200 shadow-xs hover:shadow-sm ${
      highlight
        ? 'bg-[#E9EDD6] border-[#D7DFBC] hover:bg-[#E4E9CC]'
        : 'bg-[#F7F8F4] hover:bg-white border-[#E1E7DE]'
    } ${className}`}
    style={style}
  >
    <div className="text-2xl sm:text-[26px] font-bold text-[#18271E] tracking-tight whitespace-nowrap">
      {stat.value}
    </div>
    <div className="text-[12px] text-[#637265] font-medium mt-1 leading-tight">{stat.label}</div>
  </div>
);

export const HomeHero: React.FC = () => {
  const { openVideo } = useModals();

  return (
    <div className="pt-6 sm:pt-10 pb-8 px-4 sm:px-8 lg:pt-6 lg:pb-6 lg:flex lg:flex-col lg:h-[clamp(490px,100vh-124px,900px)]">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center lg:flex-1">
        {/* Left Column: Typography, Form, Social Proof, Stats */}
        <div className="lg:col-span-4 lg:relative lg:z-20 lg:pb-16 flex flex-col justify-between space-y-7 lg:space-y-6">
          <div className="space-y-5">
            {/* Pill Eyebrow */}
            <div
              className="surface-in inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#D5DDD1] bg-[#F2F6F0] text-[#34593E] text-[11px] font-semibold tracking-wider uppercase"
              style={{ '--d': '150ms' } as React.CSSProperties}
            >
              <span aria-hidden>🏄</span>
              <span>Coliving &amp; Coworking · Weligama, Sri Lanka</span>
            </div>

            {/* Main Headline */}
            <h1
              className="surface-in text-5xl sm:text-6xl xl:text-[70px] font-bold text-[#18261E] tracking-tight leading-[1.05] lg:whitespace-nowrap"
              style={{ '--d': '300ms' } as React.CSSProperties}
            >
              Surf{' '}
              <span className="text-[#2C573A] underline-offset-8">
                Sunrise,
              </span>
              <br />
              Work by the Bay.
            </h1>

          </div>

        </div>

        {/* Right Column: Split Image (Surf vs Work) & Floating Link Cards — bleeds to the card edge on desktop */}
        {/* Pulled up by the navbar height so the photo runs to the card's top edge */}
        <div className="lg:col-span-8 relative lg:-mr-8 lg:-mt-[108px] lg:self-stretch">
          <div className="relative w-full h-[520px] sm:h-[580px] lg:h-[calc(100%+108px)] rounded-[32px] lg:rounded-none overflow-hidden border border-[#DFE5DC] lg:border-0 shadow-md lg:shadow-none bg-[#EBF0E8]">
            {/* Hero Image */}
            <Photo
              src={HERO_IMAGE}
              alt="A scooter with a surfboard rack outside the hostel at dusk"
              sizes="(max-width: 1024px) 100vw, 60vw"
              loading="eager"
              fetchPriority="high"
              className="hero-img-in absolute inset-0 w-full h-full object-cover object-center filter brightness-[0.98] contrast-[1.06] saturate-[1.1]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/15 via-transparent to-black/10 pointer-events-none" />

            {/* Morning fog that burns off as the page loads */}
            <div className="fog-clear absolute inset-0 bg-white pointer-events-none z-30" />

            {/* Fog fade blending the image into the white card behind the headline */}
            <div className="hidden lg:block absolute inset-y-0 left-0 w-80 bg-gradient-to-r from-white via-white/60 to-transparent pointer-events-none z-10" />

            {/* "Watch the Surf" play control */}
            <div className="absolute top-1/2 left-1/2 lg:left-[58%] -translate-x-1/2 -translate-y-1/2 z-20">
              <button
                id="watch-surf-btn"
                onClick={openVideo}
                className="group flex items-center gap-3 cursor-pointer"
                title="Watch surfing at Weligama Bay"
              >
                <span className="ripple relative w-11 h-11 rounded-full bg-white shadow-lg flex items-center justify-center text-[#18271E] transition-transform duration-200 group-hover:scale-110 group-active:scale-95">
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </span>
                <span className="text-[13px] font-semibold text-white tracking-tight whitespace-nowrap [text-shadow:0_1px_3px_rgba(0,0,0,0.55),0_2px_12px_rgba(0,0,0,0.65)]">
                  Watch the Surf
                </span>
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* Narrow screens: the stat tiles glide sideways in a single row */}
      <div className="lg:hidden marquee marquee-mask relative overflow-hidden -mx-4 sm:-mx-8 mt-8">
        <div className="marquee-track flex w-max pl-4 sm:pl-8">
          {[false, true].map((dup) => (
            <div key={String(dup)} className="flex gap-3 pr-3" aria-hidden={dup || undefined}>
              {STATS.map((stat, idx) => (
                <StatTile key={stat.id} stat={stat} highlight={idx === STATS.length - 1} className="w-[172px] shrink-0" />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Wide screens: tiles overlap the bottom of the photo, last one highlighted */}
      <div className="hidden lg:grid relative z-20 grid-cols-4 gap-4 lg:-mt-20 lg:shrink-0 lg:w-[88%] xl:w-[70%]">
        {STATS.map((stat, idx) => (
          <StatTile
            key={stat.id}
            stat={stat}
            highlight={idx === STATS.length - 1}
            className="surface-in"
            style={{ '--d': `${900 + idx * 130}ms` } as React.CSSProperties}
          />
        ))}
      </div>
    </div>
  );
};
