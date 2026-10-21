import React from 'react';
import { ROOMS } from '../../data';
import { BookingFormState } from '../../types';
import { formatMoney } from '../../pms';
import { Photo } from '../ui/Photo';
import { Counter } from './Counter';
import { isDorm, roomNightly, unitSleeps } from './options';
import { MAX_GUESTS, MAX_ROOMS, coveredGuests, privateRoomCount } from './validation';

interface RoomStepProps {
  guests: number;
  rooms: BookingFormState['rooms'];
  nights: number;
  onGuests: (guests: number) => void;
  onRoom: (id: string, count: number) => void;
}

/** Guest count first, then the dorm beds and private rooms that sleep them, each with its own counter. */
export const RoomStep: React.FC<RoomStepProps> = ({ guests, rooms, nights, onGuests, onRoom }) => {
  const covered = coveredGuests(rooms);
  const privates = privateRoomCount(rooms);
  const full = covered >= guests;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#DCE2D8] p-4">
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-[#18271E]">Guests</p>
          <p className="text-xs text-[#637265] mt-0.5">Then pick the beds or rooms that cover them · up to {MAX_ROOMS} private rooms</p>
        </div>
        <Counter value={guests} min={1} max={MAX_GUESTS} label="guests" onChange={onGuests} />
      </div>

      <p className="text-xs text-[#637265]">
        Priced for your {nights} {nights === 1 ? 'night' : 'nights'}. Your exact bed is assigned by reception at check-in.
      </p>

      <ul className="space-y-2.5">
        {ROOMS.map((room) => {
          const count = rooms[room.id] ?? 0;
          const dorm = isDorm(room);
          const roomMax = dorm ? MAX_GUESTS : MAX_ROOMS;
          // No more units once everyone has a bed, and no more privates past the room cap.
          const canAdd = !full && count < roomMax && (dorm || privates < MAX_ROOMS);
          return (
            <li
              key={room.id}
              className={`flex items-center gap-3 rounded-2xl border p-2.5 pr-3 transition-colors ${
                count ? 'border-[#2A4E38] bg-[#F7FAF5]' : 'border-[#DCE2D8] bg-white'
              }`}
            >
              <span className="w-16 h-16 sm:w-20 sm:h-16 rounded-xl overflow-hidden shrink-0 bg-[#EBF0E8]">
                <Photo src={room.image} alt={room.title} sizes="80px" className="w-full h-full object-cover" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-[#18271E] leading-snug">{room.title}</span>
                <span className="block text-[11px] text-[#637265] mt-0.5 truncate">{room.capacity}</span>
                <span className="block text-xs font-semibold text-[#2A4E38] mt-0.5">
                  {formatMoney(roomNightly(room))} / {dorm ? 'bed' : 'room'} / night
                  {!dorm && <span className="font-normal text-[#637265]"> · sleeps {unitSleeps(room)}</span>}
                </span>
              </span>
              {count ? (
                <Counter
                  value={count}
                  min={0}
                  max={canAdd ? count + 1 : count}
                  label={dorm ? 'beds' : 'rooms'}
                  onChange={(n) => onRoom(room.id, n)}
                />
              ) : (
                <button
                  type="button"
                  disabled={!canAdd}
                  onClick={() => onRoom(room.id, 1)}
                  className="shrink-0 rounded-full bg-[#2A4E38] hover:bg-[#1E3A28] text-white text-xs font-semibold px-4 py-2 transition-colors cursor-pointer disabled:bg-[#E4EAE0] disabled:text-[#9AA79C] disabled:cursor-not-allowed"
                >
                  Add
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <p className={`text-xs font-medium ${full ? 'text-[#2A4E38]' : 'text-[#A0522D]'}`} role="status">
        {full
          ? `Everyone has a bed (${guests} of ${guests}).`
          : `${covered} of ${guests} ${guests === 1 ? 'guest' : 'guests'} covered. Add ${guests - covered === 1 ? 'a bed or room' : 'beds or rooms'} for the rest.`}
      </p>
    </div>
  );
};
