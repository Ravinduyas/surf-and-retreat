import React from 'react';
import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import { STATS, HERO_CARDS, HERO_IMAGE } from '../../data';
import { useModals } from '../../context/ModalContext';

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

            {/* Description Subtitle */}
            <p
              className="surface-in text-[#59695C] text-base sm:text-lg max-w-lg leading-relaxed"
              style={{ '--d': '480ms' } as React.CSSProperties}
            >
              A surf hostel, coliving home and coworking space five minutes from
              Weligama Bay — learn to surf, get real work done, and find your people.
            </p>
          </div>

        </div>

        {/* Right Column: Split Image (Surf vs Work) & Floating Link Cards — bleeds to the card edge on desktop */}
        <div className="lg:col-span-8 relative lg:-mr-8 lg:-mt-10 lg:self-stretch">
          <div className="relative w-full h-[520px] sm:h-[580px] lg:h-[calc(100%+2.5rem)] rounded-[32px] lg:rounded-none overflow-hidden border border-[#DFE5DC] lg:border-0 shadow-md lg:shadow-none bg-[#EBF0E8]">
            {/* Hero Image */}
            <img
              src={HERO_IMAGE}
              alt="Surfer riding a wave at Weligama Bay"
              referrerPolicy="no-referrer"
              className="hero-img-in absolute inset-0 w-full h-full object-cover object-center filter brightness-[0.98] contrast-[1.06] saturate-[1.1]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/15 via-transparent to-black/10 pointer-events-none" />

            {/* Morning fog that burns off as the page loads */}
            <div className="fog-clear absolute inset-0 bg-white pointer-events-none z-30" />

            {/* Fog fades blending the image into the white card on every inner edge (desktop) */}
            <div className="hidden lg:block absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white via-white/55 to-transparent pointer-events-none z-10" />
            <div className="hidden lg:block absolute inset-y-0 left-0 w-80 bg-gradient-to-r from-white via-white/60 to-transparent pointer-events-none z-10" />
            <div className="hidden lg:block absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white via-white/40 to-transparent pointer-events-none z-10" />

            {/* "Watch the Surf" Play Pill — offset left so it clears the floating cards */}
            <div className="absolute top-1/2 left-[32%] lg:left-[48%] -translate-x-1/2 -translate-y-1/2 z-20">
              <button
                id="watch-surf-btn"
                onClick={openVideo}
                className="group flex items-center gap-3 cursor-pointer"
                title="Watch surfing at Weligama Bay"
              >
                <span className="ripple relative w-11 h-11 rounded-full bg-white shadow-lg flex items-center justify-center text-[#18271E] transition-transform duration-200 group-hover:scale-110 group-active:scale-95">
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </span>
                <span className="text-[13px] font-semibold text-white tracking-tight whitespace-nowrap drop-shadow-md">
                  Watch the Surf
                </span>
              </button>
            </div>

            {/* Overlaid Floating Link Cards on the right */}
            <div className="absolute right-4 sm:right-6 top-16 bottom-16 lg:bottom-36 flex flex-col justify-between z-20 max-w-[220px] sm:max-w-[240px] pointer-events-auto">
              {HERO_CARDS.map((card, idx) => (
                <Link
                  key={card.id}
                  id={`hero-card-${card.id}`}
                  to={card.to}
                  className="hero-card-in group bg-white/92 hover:bg-white backdrop-blur-md rounded-2xl p-2.5 pr-3.5 shadow-lg border border-white/70 flex items-center gap-3 transition-all duration-200 hover:translate-x-[-4px] hover:shadow-xl cursor-pointer"
                  style={
                    {
                      marginTop: idx === 1 ? '10px' : '0px',
                      marginBottom: idx === 1 ? '10px' : '0px',
                      '--d': `${700 + idx * 200}ms`,
                    } as React.CSSProperties
                  }
                >
                  <img
                    src={card.image}
                    alt={card.title}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-xl object-cover shrink-0 ring-1 ring-black/5"
                  />
                  <div className="min-w-0">
                    <h3 className="text-[13px] font-bold text-[#18271E] leading-tight truncate group-hover:text-[#265337] transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-[11px] text-[#637265] mt-0.5 leading-snug line-clamp-2">
                      {card.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Full-width Metric Tiles row overlapping the image bottom, last one highlighted */}
      <div className="relative z-20 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-8 lg:-mt-20 lg:shrink-0">
        {STATS.map((stat, idx) => (
          <div
            key={stat.id}
            id={`hero-stat-${stat.id}`}
            className={`surface-in rounded-2xl p-4 sm:p-5 border transition-all duration-200 shadow-xs hover:shadow-sm ${
              idx === STATS.length - 1
                ? 'bg-[#E9EDD6] border-[#D7DFBC] hover:bg-[#E4E9CC]'
                : 'bg-[#F7F8F4] hover:bg-white border-[#E1E7DE]'
            }`}
            style={{ '--d': `${900 + idx * 130}ms` } as React.CSSProperties}
          >
            <div className="text-2xl sm:text-[26px] font-bold text-[#18271E] tracking-tight">
              {stat.value}
            </div>
            <div className="text-[12px] text-[#637265] font-medium mt-1 leading-tight">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
