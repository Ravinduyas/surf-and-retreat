import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BedDouble, Waves, Laptop, Sparkles } from 'lucide-react';
import { HIGHLIGHTS } from '../../data';
import { HighlightItem } from '../../types';
import { Eyebrow } from '../ui/Eyebrow';
import { Button } from '../ui/Button';

const renderIcon = (type: HighlightItem['iconType']) => {
  switch (type) {
    case 'bed':
      return <BedDouble className="w-4 h-4 text-[#264D35]" />;
    case 'wave':
      return <Waves className="w-4 h-4 text-[#264D35]" />;
    case 'laptop':
      return <Laptop className="w-4 h-4 text-[#264D35]" />;
    default:
      return <Sparkles className="w-4 h-4 text-[#264D35]" />;
  }
};

export const HighlightsSection: React.FC = () => {
  return (
    <section className="mt-6 sm:mt-10">
      <div className="bg-white border border-[#E3E8DE] rounded-[32px] sm:rounded-[36px] p-6 sm:p-10 lg:p-14 shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left Column: Heading & Text */}
          <div className="lg:col-span-5 space-y-6">
            <Eyebrow>The Retreat Life</Eyebrow>

            <h2 className="text-4xl sm:text-5xl font-bold text-[#18261E] tracking-tight leading-[1.12]">
              Stay. <span className="text-[#2A593B]">Surf,</span>
              <br />
              Work &amp; Repeat —
              <br />
              by the Bay.
            </h2>

            <p className="text-[#59695C] text-sm sm:text-base leading-relaxed max-w-md">
              One home for your whole trip: comfy beds, sunrise surf sessions and a
              coworking space that actually works. Pick your rhythm — we&apos;ll handle
              the rest.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button id="highlights-rooms-btn" to="/experience#rooms" variant="primary">
                <span>Explore Rooms</span>
                <ArrowRight className="w-4 h-4" />
              </Button>

              <Button id="highlights-about-btn" to="/about" variant="outline">
                About Us
              </Button>
            </div>
          </div>

          {/* Right Column: 3 Vertical Photographic Link Cards */}
          <div className="lg:col-span-7">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-5">
              {HIGHLIGHTS.map((item) => (
                <Link
                  key={item.id}
                  id={`highlight-card-${item.id}`}
                  to={item.to}
                  className="group relative h-[380px] sm:h-[420px] rounded-[26px] overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 block"
                >
                  {/* Background Photo */}
                  <img
                    src={item.image}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                  />

                  {/* Gentle Dark Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

                  {/* Card Content pinned to bottom */}
                  <div className="absolute inset-0 p-5 flex flex-col justify-end">
                    <div className="w-9 h-9 rounded-full bg-white/95 backdrop-blur-xs flex items-center justify-center shadow-md mb-3 transition-transform duration-300 group-hover:scale-110">
                      {renderIcon(item.iconType)}
                    </div>

                    <h3 className="text-white text-[17px] font-semibold tracking-tight leading-tight">
                      {item.title}
                    </h3>
                    <p className="text-white/80 text-[12px] leading-snug mt-1 font-normal">
                      {item.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
