import React from 'react';
import { Waves, Users2, Sprout, Sparkles, LucideIcon } from 'lucide-react';
import { VALUES } from '../../data';
import { ValueItem } from '../../types';
import { Eyebrow } from '../ui/Eyebrow';
import { useReveal } from '../ui/Reveal';

const ICONS: Record<ValueItem['iconType'], LucideIcon> = {
  wave: Waves,
  community: Users2,
  leaf: Sprout,
};

export const ValuesGrid: React.FC = () => {
  const gridRef = useReveal<HTMLDivElement>();
  return (
    <section className="mt-8 sm:mt-12">
      <div className="bg-white border border-[#E3E8DE] rounded-[32px] sm:rounded-[36px] p-6 sm:p-10 lg:p-12 shadow-xs">
        <div className="text-center max-w-xl mx-auto space-y-4 mb-10">
          <Eyebrow icon={Sparkles}>What We Care About</Eyebrow>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#18261E] tracking-tight leading-tight">
            The Things We Don&apos;t Compromise On
          </h2>
        </div>

        <div ref={gridRef} className="stagger grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
          {VALUES.map((value) => {
            const Icon = ICONS[value.iconType] ?? Sparkles;
            return (
              <div
                key={value.id}
                id={`value-${value.id}`}
                className="bg-[#F4F6F2]/90 hover:bg-white border border-[#E1E7DE] rounded-3xl p-7 transition-all duration-200 shadow-xs hover:shadow-sm hover:-translate-y-1 text-center"
              >
                <div className="w-11 h-11 rounded-full bg-white border border-[#E1E7DE] flex items-center justify-center mx-auto shadow-xs mb-4">
                  <Icon className="w-5 h-5 text-[#264D35]" />
                </div>
                <h3 className="text-[16px] font-bold text-[#18271E] tracking-tight">
                  {value.title}
                </h3>
                <p className="text-[13px] text-[#5A695D] leading-relaxed mt-2">
                  {value.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
