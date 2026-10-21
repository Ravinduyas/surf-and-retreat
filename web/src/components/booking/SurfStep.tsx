import React from 'react';
import { Check } from 'lucide-react';
import { SURF_PACKAGES } from '../../data';
import { BookingFormState, TravellerSurf } from '../../types';
import { formatMoney } from '../../pms';
import { SURF_LEVELS, addonAmount } from './options';
import { travellerRooms, travellerSurf } from './quote';

interface SurfStepProps {
  form: Pick<BookingFormState, 'surf' | 'rooms' | 'guests'>;
  onChange: (index: number, pick: TravellerSurf) => void;
}

/**
 * One card per traveller (with the room they sleep in): package tiles, then a level switch that only
 * appears once a package is picked. "No surf" is a tile of its own.
 */
export const SurfStep: React.FC<SurfStepProps> = ({ form, onChange }) => {
  const rooms = travellerRooms(form);

  const choose = (i: number, pick: TravellerSurf, packageId: string) => {
    const pkg = SURF_PACKAGES.find((p) => p.id === packageId);
    // A package made for one level starts on that level; the guest can still change it.
    const level = pkg && SURF_LEVELS.includes(pkg.level) ? pkg.level : pick.level;
    onChange(i, { packageId, level });
  };

  return (
    <div className="space-y-2.5">
      {rooms.map((room, i) => {
        const pick = travellerSurf(form, i);
        const options = [
          ...SURF_PACKAGES.map((pkg) => ({
            id: pkg.id,
            title: pkg.title,
            price: `${pkg.from ? 'from ' : ''}${formatMoney(addonAmount(pkg.id, pkg.amount))}${pkg.unit}`,
          })),
          { id: '', title: 'No surf', price: 'Just the stay' },
        ];
        return (
          <div key={i} className="rounded-2xl border border-[#DCE2D8] bg-white p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-3">
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                  pick.packageId ? 'bg-[#2A4E38] text-[#D8E95E]' : 'bg-[#F2F6F0] text-[#2A4E38]'
                }`}
              >
                {i + 1}
              </span>
              <p className="text-sm font-bold text-[#18271E]">
                Traveller {i + 1}
                <span className="font-normal text-[#637265]"> · {room || 'Room not picked yet'}</span>
              </p>
              {pick.packageId && (
                <div className="ml-auto flex items-center gap-2 step-in">
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8B9A8D]">Level</span>
                  <div role="radiogroup" aria-label={`Surf level for traveller ${i + 1}`} className="inline-flex rounded-full bg-[#F2F6F0] p-0.5">
                    {SURF_LEVELS.map((level) => {
                      const active = pick.level === level;
                      return (
                        <button
                          key={level}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => onChange(i, { ...pick, level })}
                          className={`px-2.5 sm:px-3 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                            active ? 'bg-white text-[#2A4E38] shadow-sm' : 'text-[#637265] hover:text-[#18271E]'
                          }`}
                        >
                          {level}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div role="radiogroup" aria-label={`Surf package for traveller ${i + 1}`} className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {options.map((opt) => {
                const active = pick.packageId === opt.id;
                return (
                  <button
                    key={opt.id || 'none'}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => choose(i, pick, opt.id)}
                    className={`relative text-left rounded-xl border px-2.5 py-2 transition-all cursor-pointer ${
                      active ? 'border-[#2A4E38] bg-[#2A4E38] text-white' : 'border-[#DCE2D8] bg-[#FAFBF9] hover:border-[#9DB09A]'
                    }`}
                  >
                    <span className={`block text-xs font-semibold leading-snug pr-4 ${active ? '' : 'text-[#18271E]'}`}>{opt.title}</span>
                    <span className={`block text-[11px] mt-0.5 ${active ? 'text-white/75' : 'text-[#637265]'}`}>{opt.price}</span>
                    {active && <Check className="absolute top-2 right-2 w-3.5 h-3.5 text-[#D8E95E]" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
