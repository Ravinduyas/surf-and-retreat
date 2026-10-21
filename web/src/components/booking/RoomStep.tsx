import React from 'react';
import { Users } from 'lucide-react';
import { ROOMS } from '../../data';
import { BookingFormState, RoomItem } from '../../types';
import { formatMoney } from '../../pms';
import { Photo } from '../ui/Photo';
import { Counter } from './Counter';
import { isDorm, roomNightly } from './options';
import { MAX_GUESTS, MAX_ROOMS, coveredGuests, privateRoomCount } from './validation';

interface RoomStepProps {
  guests: number;
  rooms: BookingFormState['rooms'];
  nights: number;
  onGuests: (guests: number) => void;
  onRoom: (id: string, count: number) => void;
}

/** Guest count with a "who has a bed" meter, then dorm beds and private rooms as compact two-column rows. */
export const RoomStep: React.FC<RoomStepProps> = ({ guests, rooms, nights, onGuests, onRoom }) => {
  const covered = Math.min(coveredGuests(rooms), guests);
  const privates = privateRoomCount(rooms);
  const full = covered >= guests;

  const card = (room: RoomItem) => {
    const count = rooms[room.id] ?? 0;
    const dorm = isDorm(room);
    const canAdd = !full && count < (dorm ? MAX_GUESTS : MAX_ROOMS) && (dorm || privates < MAX_ROOMS);
    return (
      <li
        key={room.id}
        className={`group flex items-center gap-3 rounded-2xl border p-2 transition-all duration-300 ${
          count ? 'border-[#2A4E38] bg-[#F7FAF5] ring-1 ring-[#2A4E38]' : 'border-[#DCE2D8] bg-white hover:border-[#9DB09A]'
        }`}
      >
        <span className="relative w-[72px] h-[64px] shrink-0 rounded-xl overflow-hidden bg-[#EBF0E8]">
          <Photo src={room.image} alt={room.title} sizes="72px" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-bold text-[#18271E] leading-snug truncate" title={room.title}>
            {room.title}
          </span>
          <span className="block text-[11px] text-[#637265] mt-0.5 truncate">{room.capacity}</span>
          <span className="block text-xs font-semibold text-[#2A4E38] mt-1 tabular-nums">
            {formatMoney(roomNightly(room))}
            <span className="font-normal text-[#637265]"> / {dorm ? 'bed' : 'room'} / night</span>
          </span>
        </span>
        <span className="shrink-0 pr-1">
          {count ? (
            <Counter value={count} min={0} max={canAdd ? count + 1 : count} label={dorm ? 'beds' : 'rooms'} onChange={(n) => onRoom(room.id, n)} />
          ) : (
            <button
              type="button"
              disabled={!canAdd}
              onClick={() => onRoom(room.id, 1)}
              className="rounded-full bg-[#2A4E38] hover:bg-[#1E3A28] text-white text-xs font-semibold px-3.5 py-2 transition-colors cursor-pointer disabled:bg-[#EEF2EB] disabled:text-[#A7B3A6] disabled:cursor-not-allowed"
            >
              Add
            </button>
          )}
        </span>
      </li>
    );
  };

  const groups = [
    { title: 'Dorm beds', note: 'By the bed · reception assigns your bunk', list: ROOMS.filter(isDorm) },
    { title: 'Private rooms', note: 'The whole room · sleeps 2', list: ROOMS.filter((r) => !isDorm(r)) },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#DCE2D8] bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-[#F2F6F0] text-[#2A4E38] flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#18271E]">Guests</p>
              <p className="text-[11px] text-[#637265]">Up to {MAX_GUESTS} per booking · {MAX_ROOMS} private rooms max</p>
            </div>
          </div>
          <Counter value={guests} min={1} max={MAX_GUESTS} label="guests" onChange={onGuests} />
        </div>
        <div className="mt-3 pt-3 border-t border-[#EEF2EB]">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className={`font-semibold ${full ? 'text-[#2A4E38]' : 'text-[#A0522D]'}`} role="status">
              {full ? 'Everyone has a bed' : `${guests - covered} still ${guests - covered === 1 ? 'needs' : 'need'} a bed`}
            </span>
            <span className="text-[#637265] tabular-nums">
              {covered}/{guests} · {nights} {nights === 1 ? 'night' : 'nights'}
            </span>
          </div>
          <div className="flex gap-1" aria-hidden="true">
            {Array.from({ length: guests }, (_, i) => (
              <span key={i} className={`flex-1 h-1 rounded-full transition-colors duration-300 ${i < covered ? 'bg-[#2A4E38]' : 'bg-[#E4EAE0]'}`} />
            ))}
          </div>
        </div>
      </div>

      {groups.map((group) => (
        <section key={group.title}>
          <div className="flex items-baseline justify-between gap-3 mb-2">
            <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-[#2A4E38]">{group.title}</h3>
            <span className="text-[11px] text-[#8B9A8D] text-right">{group.note}</span>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">{group.list.map(card)}</ul>
        </section>
      ))}
    </div>
  );
};
