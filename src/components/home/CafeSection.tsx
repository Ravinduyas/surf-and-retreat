import React from 'react';
import { UtensilsCrossed, ArrowRight } from 'lucide-react';
import { CAFE_DISHES } from '../../data';
import { Eyebrow } from '../ui/Eyebrow';
import { Button } from '../ui/Button';
import { useReveal } from '../ui/Reveal';
import { Photo } from '../ui/Photo';

export const CafeSection: React.FC = () => {
  const gridRef = useReveal<HTMLDivElement>();

  return (
    <section className="mt-8 sm:mt-12">
      <div className="bg-white rounded-[32px] sm:rounded-[36px] p-6 sm:p-10 lg:p-12 shadow-xs">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div className="space-y-4">
            <Eyebrow icon={UtensilsCrossed}>The Kitchen</Eyebrow>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#18261E] tracking-tight leading-tight">
              Breakfast Worth
              <br className="hidden sm:block" /> Getting Out for.
            </h2>
          </div>
          <p className="text-[#59695C] text-sm max-w-sm leading-relaxed">
            Our own café serves all day — smoothie bowls after the dawn session,
            Sri Lankan curries at sunset, and cold brew in between.
          </p>
        </div>

        <div
          ref={gridRef}
          className="stagger grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5"
        >
          {CAFE_DISHES.map((dish) => (
            <div key={dish.id} id={`dish-${dish.id}`} className="group">
              <div className="relative h-[180px] sm:h-[230px] rounded-2xl overflow-hidden bg-[#EAF0E7] shadow-xs">
                <Photo
                  src={dish.image}
                  alt={dish.name}
                  loading="lazy"
                  sizes="(max-width: 640px) 50vw, 33vw"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                />
              </div>
              <h3 className="text-[15px] font-bold text-[#18271E] tracking-tight mt-3">
                {dish.name}
              </h3>
              <p className="text-[12px] text-[#5A695D] leading-relaxed mt-1">{dish.note}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <Button variant="outline" to="/gallery">
            <span>See the Full Menu Gallery</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </section>
  );
};
