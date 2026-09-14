import React from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { AVATARS } from '../../data';
import { useModals } from '../../context/ModalContext';

const PERKS = [
  'Bed + dedicated desk bundle',
  'Weekly rate from $99 (dorm) or $199 (private)',
  'Breakfast, laundry & community dinners included',
  '2 free surf lessons per month of stay',
];

export const ColivingCard: React.FC = () => {
  const { openBooking } = useModals();

  return (
    <section className="mt-8 sm:mt-12">
      <div className="bg-[#D7E95C] rounded-[32px] sm:rounded-[36px] p-6 sm:p-10 lg:p-12 shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-4">
            <span className="inline-block bg-white/80 text-[#16301F] text-[11px] font-bold px-3.5 py-1.5 rounded-full uppercase tracking-wider">
              Coliving — Stay Longer, Pay Less
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#193623] tracking-tight leading-tight">
              Make Weligama Your Base for a Month (or Three).
            </h2>
            <p className="text-[13px] sm:text-sm text-[#2F4A37] leading-relaxed max-w-xl">
              Our coliving bundle pairs a bed with a dedicated desk in the coworking
              space — plus the little things that make a long stay feel like home.
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 pt-1">
              {PERKS.map((perk) => (
                <li key={perk} className="flex items-start gap-2 text-[13px] text-[#243E2C] font-medium leading-snug">
                  <Check className="w-4 h-4 text-[#1E3E2A] shrink-0 mt-0.5" />
                  <span>{perk}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-5 flex flex-col items-start lg:items-end gap-4">
            <div className="flex items-center gap-2.5">
              <div className="flex -space-x-2">
                {AVATARS.map((avatar, idx) => (
                  <img
                    key={idx}
                    src={avatar}
                    alt="Coliving guest"
                    referrerPolicy="no-referrer"
                    className="w-8 h-8 rounded-full ring-2 ring-[#D7E95C] object-cover"
                  />
                ))}
              </div>
              <span className="text-[12px] text-[#243E2C] font-medium">
                40+ long-stayers hosted this season
              </span>
            </div>
            <button
              id="coliving-book-btn"
              onClick={() => openBooking('stay')}
              className="bg-[#234530] hover:bg-[#183422] text-white text-sm font-semibold px-7 py-3.5 rounded-full flex items-center gap-2 transition-all duration-200 cursor-pointer shadow-xs active:scale-98"
            >
              <span>Request Coliving Rates</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
