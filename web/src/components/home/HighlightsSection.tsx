import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BedDouble, Waves, Laptop, Flower2, Sparkles } from 'lucide-react';
import { HIGHLIGHTS } from '../../data';
import { HighlightItem } from '../../types';
import { Eyebrow } from '../ui/Eyebrow';
import { Button } from '../ui/Button';
import { useReveal } from '../ui/Reveal';
import { Photo } from '../ui/Photo';
import { SkateIcon } from '../ui/SkateIcon';

const renderIcon = (type: HighlightItem['iconType']) => {
  switch (type) {
    case 'bed':
      return <BedDouble className="w-4 h-4 text-[#264D35]" />;
    case 'wave':
      return <Waves className="w-4 h-4 text-[#264D35]" />;
    case 'laptop':
      return <Laptop className="w-4 h-4 text-[#264D35]" />;
    case 'skate':
      return <SkateIcon className="w-4 h-4 text-[#264D35]" />;
    case 'yoga':
      return <Flower2 className="w-4 h-4 text-[#264D35]" />;
    default:
      return <Sparkles className="w-4 h-4 text-[#264D35]" />;
  }
};

export const HighlightsSection: React.FC = () => {
  const gridRef = useReveal<HTMLDivElement>();
  return (
    <section className="mt-6 sm:mt-10">
      <div className="bg-white rounded-[32px] sm:rounded-[36px] p-6 sm:p-10 lg:p-14 shadow-xs">
        {/* Heading row: title on the left, intro and buttons on the right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-end mb-8 sm:mb-10">
          <div className="lg:col-span-7 space-y-6">
            <Eyebrow>The Retreat Life</Eyebrow>

            <h2 className="text-4xl sm:text-5xl font-bold text-[#18261E] tracking-tight leading-[1.12]">
              Stay. <span className="text-[#2A593B]">Surf,</span>
              <br />
              Work &amp; Repeat,
              <br />
              by the Bay.
            </h2>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <p className="text-[#59695C] text-sm sm:text-base leading-relaxed max-w-md">
              One home for your whole trip: comfy beds, sunrise surf sessions and a
              coworking space that actually works. Pick your rhythm — we&apos;ll handle
              the rest.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button id="highlights-rooms-btn" to="/rooms" variant="primary">
                <span>Explore Rooms</span>
                <ArrowRight className="w-4 h-4" />
              </Button>

              <Button id="highlights-about-btn" to="/about" variant="outline">
                About Us
              </Button>
            </div>
          </div>
        </div>

        {/* Vertical photo cards: a swipeable row on phones and tablets, five across on desktop */}
        <div
          ref={gridRef}
          className="stagger flex gap-3 lg:gap-4 overflow-x-auto snap-x snap-mandatory -mx-6 px-6 sm:-mx-10 sm:px-10 pt-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-5 lg:mx-0 lg:px-0 lg:overflow-visible"
        >
          {HIGHLIGHTS.map((item, idx) => (
            <Link
              key={item.id}
              id={`highlight-card-${item.id}`}
              to={item.to}
              className="group relative shrink-0 w-[62%] sm:w-[36%] lg:w-auto snap-start h-[340px] sm:h-[380px] lg:h-[420px] rounded-[26px] overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 block"
              style={{ '--i': idx } as React.CSSProperties}
            >
              {/* Background Photo */}
              <Photo
                src={item.image}
                alt={item.title}
                // Tall cards crop landscape photos to their height, so they need more pixels than their width suggests.
                sizes="(max-width: 640px) 90vw, (max-width: 1024px) 60vw, 40vw"
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
              />

              {/* Gentle Dark Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

              {/* Card Content pinned to bottom */}
              <div className="absolute inset-0 p-4 lg:p-5 flex flex-col justify-end">
                <div className="w-9 h-9 rounded-full bg-white/95 backdrop-blur-xs flex items-center justify-center shadow-md mb-3 transition-transform duration-300 group-hover:scale-110">
                  {renderIcon(item.iconType)}
                </div>

                <h3 className="text-white text-[17px] font-semibold tracking-tight leading-tight">
                  {item.title}
                </h3>
                {/* Three lines reserved on every card so titles and icons line up across the row */}
                <p className="text-white/80 text-[12px] leading-snug mt-1 font-normal min-h-[3lh]">
                  {item.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};
