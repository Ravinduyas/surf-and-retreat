import React from 'react';
import { Users } from 'lucide-react';
import { SURF_PACKAGES } from '../../data';
import { BookingFormState, TravellerSurf } from '../../types';
import { formatMoney } from '../../pms';
import { SURF_LEVELS, addonAmount } from './options';
import { travellerRooms, travellerSurf } from './quote';

interface SurfStepProps {
  form: Pick<BookingFormState, 'surf' | 'rooms' | 'guests'>;
  onChange: (index: number, pick: TravellerSurf) => void;
}

const select =
  'w-full bg-white border border-[#DCE2D8] rounded-xl px-3 py-2.5 text-sm text-[#18271E] focus:outline-hidden focus:ring-2 focus:ring-[#2C573A]/20 cursor-pointer';

/** A package and a level for each traveller, listed with the room they sleep in. */
export const SurfStep: React.FC<SurfStepProps> = ({ form, onChange }) => {
  const rooms = travellerRooms(form);

  return (
    <div className="rounded-2xl border border-[#DCE2D8]">
      <div className="flex items-center justify-between gap-3 p-4 border-b border-[#E5ECE2]">
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-[#18271E]">Surf packages</p>
          <p className="text-xs text-[#637265] mt-0.5">A package and level for each traveller, in the room they are in.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F2F6F0] px-2.5 py-1 text-xs font-semibold text-[#2A4E38] shrink-0">
          <Users className="w-3.5 h-3.5" />
          {form.guests} {form.guests === 1 ? 'traveller' : 'travellers'}
        </span>
      </div>

      <ul>
        {rooms.map((room, i) => {
          const pick = travellerSurf(form, i);
          return (
            <li key={i} className="p-4 border-b border-[#E5ECE2] last:border-b-0">
              <p className="text-sm font-semibold text-[#18271E]">
                Traveller {i + 1}
                {room && <span className="font-normal text-[#637265]"> · {room}</span>}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-2.5 mt-2.5">
                <label className="block">
                  <span className="sr-only">Surf package for traveller {i + 1}</span>
                  <select
                    className={select}
                    value={pick.packageId}
                    onChange={(e) => {
                      const pkg = SURF_PACKAGES.find((p) => p.id === e.target.value);
                      // A package made for one level starts on that level; the guest can still change it.
                      const level = pkg && SURF_LEVELS.includes(pkg.level) ? pkg.level : pick.level;
                      onChange(i, { packageId: e.target.value, level });
                    }}
                  >
                    <option value="">No surf for this traveller</option>
                    {SURF_PACKAGES.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.title} · {pkg.from ? 'from ' : ''}
                        {formatMoney(addonAmount(pkg.id, pkg.amount))}
                        {pkg.unit}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="sr-only">Surf level for traveller {i + 1}</span>
                  <select
                    className={select}
                    value={pick.level}
                    disabled={!pick.packageId}
                    onChange={(e) => onChange(i, { ...pick, level: e.target.value })}
                  >
                    {SURF_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
