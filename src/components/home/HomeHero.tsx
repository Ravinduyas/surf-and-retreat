import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Play, Check } from 'lucide-react';
import { STATS, HERO_CARDS, AVATARS, HERO_IMAGES } from '../../data';
import { useModals } from '../../context/ModalContext';

export const HomeHero: React.FC = () => {
  const { openVideo } = useModals();
  const [email, setEmail] = useState('');
  const [joined, setJoined] = useState(false);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;
    setJoined(true);
    setTimeout(() => {
      setEmail('');
      setJoined(false);
    }, 4000);
  };

  return (
    <div className="pt-6 sm:pt-10 pb-8 px-4 sm:px-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
        {/* Left Column: Typography, Form, Social Proof, Stats */}
        <div className="lg:col-span-6 flex flex-col justify-between space-y-7 lg:space-y-9">
          <div className="space-y-5">
            {/* Pill Eyebrow */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#D5DDD1] bg-[#F2F6F0] text-[#34593E] text-[11px] font-semibold tracking-wider uppercase">
              <span aria-hidden>🏄</span>
              <span>Coliving &amp; Coworking · Weligama, Sri Lanka</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-5xl sm:text-6xl xl:text-[70px] font-bold text-[#18261E] tracking-tight leading-[1.05]">
              Surf{' '}
              <span className="text-[#2C573A] underline-offset-8">
                Sunrise,
              </span>
              <br />
              Work by the Bay.
            </h1>

            {/* Description Subtitle */}
            <p className="text-[#59695C] text-base sm:text-lg max-w-lg leading-relaxed">
              A surf hostel, coliving home and coworking space five minutes from
              Weligama Bay — learn to surf, get real work done, and find your people.
            </p>
          </div>

          {/* Email Subscription Bar */}
          <div className="max-w-md">
            <form
              onSubmit={handleJoin}
              className="relative flex items-center bg-white border border-[#D5DDD2] rounded-full p-1.5 shadow-xs focus-within:ring-2 focus-within:ring-[#2C573A]/20 transition-all"
            >
              <input
                id="hero-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full bg-transparent pl-4 pr-3 py-2 text-sm text-[#1A2E21] placeholder-[#87968A] focus:outline-hidden"
                disabled={joined}
                required
              />
              <button
                id="hero-join-btn"
                type="submit"
                disabled={joined}
                className={`shrink-0 flex items-center gap-1.5 text-xs sm:text-sm font-medium px-5 py-2.5 rounded-full transition-all duration-200 cursor-pointer ${
                  joined
                    ? 'bg-[#2A573B] text-white'
                    : 'bg-[#2A4E38] hover:bg-[#1E3B29] text-white'
                }`}
              >
                {joined ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Welcome!</span>
                  </>
                ) : (
                  <>
                    <span>Get Updates</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
            {joined && (
              <p className="text-xs text-[#2A573B] font-medium mt-2 pl-4">
                Thanks! Surf reports and hostel news, coming your way.
              </p>
            )}
          </div>

          {/* Social Proof */}
          <div className="flex items-center gap-3 pt-1">
            <div className="flex -space-x-2.5 overflow-hidden">
              {AVATARS.map((avatar, idx) => (
                <img
                  key={idx}
                  src={avatar}
                  alt={`Guest ${idx + 1}`}
                  referrerPolicy="no-referrer"
                  className="inline-block h-8 w-8 rounded-full ring-2 ring-white object-cover shadow-xs"
                />
              ))}
            </div>
            <div className="flex items-center gap-1.5 text-xs sm:text-sm text-[#46594B] font-medium">
              <span className="text-[#325A3D]">🌊</span>
              <span>Join 5,000+ surfers &amp; remote workers who stayed with us</span>
            </div>
          </div>

          {/* Bottom 4 Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
            {STATS.map((stat) => (
              <div
                key={stat.id}
                id={`hero-stat-${stat.id}`}
                className="bg-[#F4F6F2]/90 hover:bg-white border border-[#E1E7DE] rounded-2xl p-4 transition-all duration-200 shadow-xs hover:shadow-sm"
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

        {/* Right Column: Split Image (Surf vs Work) & Floating Link Cards */}
        <div className="lg:col-span-6 relative">
          <div className="relative w-full h-[520px] sm:h-[580px] lg:h-[620px] rounded-[32px] overflow-hidden border border-[#DFE5DC] shadow-md bg-[#EBF0E8]">
            {/* Split Imagery Container */}
            <div className="absolute inset-0 flex">
              {/* Left Side: Surfing */}
              <div className="w-1/2 h-full relative overflow-hidden">
                <img
                  src={HERO_IMAGES.left}
                  alt="Surfer riding a wave at Weligama Bay"
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover object-center transform scale-110 filter brightness-[0.98] contrast-[1.08] saturate-[1.15]"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-black/10 pointer-events-none" />
              </div>

              {/* Seam Divider */}
              <div className="relative w-0 z-10 flex items-center justify-center">
                <div className="absolute top-0 bottom-0 w-[2px] bg-white/40 shadow-xs pointer-events-none" />
              </div>

              {/* Right Side: Coworking */}
              <div className="w-1/2 h-full relative overflow-hidden">
                <img
                  src={HERO_IMAGES.right}
                  alt="Remote workers with laptops at the coworking space"
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover object-center transform scale-110 filter contrast-[1.05] brightness-[0.95]"
                />
                <div className="absolute inset-0 bg-gradient-to-l from-black/15 via-transparent to-transparent pointer-events-none" />
              </div>
            </div>

            {/* "Watch the Surf" Play Pill — offset left so it clears the floating cards */}
            <div className="absolute top-1/2 left-[32%] -translate-x-1/2 -translate-y-1/2 z-20">
              <button
                id="watch-surf-btn"
                onClick={openVideo}
                className="group flex items-center gap-2.5 bg-white/90 hover:bg-white backdrop-blur-md pl-1.5 pr-4 py-1.5 rounded-full shadow-lg border border-white/70 transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
                title="Watch surfing at Weligama Bay"
              >
                <span className="w-8 h-8 rounded-full bg-[#1C3624] group-hover:bg-[#254A32] flex items-center justify-center text-white transition-colors">
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                </span>
                <span className="text-[13px] font-semibold text-[#182B1F] tracking-tight whitespace-nowrap">
                  Watch the Surf
                </span>
              </button>
            </div>

            {/* Overlaid Floating Link Cards on the right */}
            <div className="absolute right-4 sm:right-6 top-16 bottom-16 flex flex-col justify-between z-20 max-w-[220px] sm:max-w-[240px] pointer-events-auto">
              {HERO_CARDS.map((card, idx) => (
                <Link
                  key={card.id}
                  id={`hero-card-${card.id}`}
                  to={card.to}
                  className="group bg-white/92 hover:bg-white backdrop-blur-md rounded-2xl p-2.5 pr-3.5 shadow-lg border border-white/70 flex items-center gap-3 transition-all duration-200 hover:translate-x-[-4px] hover:shadow-xl cursor-pointer"
                  style={{
                    marginTop: idx === 1 ? '10px' : '0px',
                    marginBottom: idx === 1 ? '10px' : '0px',
                  }}
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
    </div>
  );
};
