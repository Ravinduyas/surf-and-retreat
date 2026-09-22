import React from 'react';
import { ArrowRight, Users, Check, BedDouble } from 'lucide-react';
import { ROOMS } from '../../data';
import { Eyebrow } from '../ui/Eyebrow';
import { Link } from 'react-router-dom';
import { useReveal } from '../ui/Reveal';
import { Photo } from '../ui/Photo';

export const RoomsGrid: React.FC = () => {
  const gridRef = useReveal<HTMLDivElement>();

  return (
    <section className="mt-6 sm:mt-10">
      <div className="bg-white rounded-[32px] sm:rounded-[36px] p-6 sm:p-10 lg:p-12 shadow-xs">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div className="space-y-4">
            <Eyebrow icon={BedDouble}>Pick Your Bed</Eyebrow>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#18261E] tracking-tight leading-tight">
              Dorms, Privates &amp; the Bungalow
            </h2>
          </div>
          <p className="text-[#59695C] text-sm max-w-sm leading-relaxed">
            All rates include breakfast, fast wifi, board rack storage and unlimited
            filter coffee in the coworking space.
          </p>
        </div>

        <div ref={gridRef} className="stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {ROOMS.map((room) => (
            <div key={room.id} id={`room-card-${room.id}`} className="group flex flex-col">
              {/* Image */}
              <Link
                to={`/rooms/${room.id}`}
                aria-label={`${room.title} — view details`}
                className="relative h-[220px] rounded-2xl overflow-hidden mb-4 shadow-xs bg-[#EAF0E7] block w-full cursor-pointer"
              >
                <Photo
                  src={room.image}
                  alt={room.title}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                />
                <div className="absolute bottom-3 left-3">
                  <span className="inline-block bg-white/95 backdrop-blur-xs text-[#1D3624] text-[11px] font-semibold px-3 py-1 rounded-full shadow-xs">
                    {room.tag}
                  </span>
                </div>
                <div className="absolute top-3 right-3">
                  <span className="inline-block bg-[#F3F45C] text-[#16301F] text-[11px] font-bold px-3 py-1 rounded-full shadow-xs">
                    {room.pricePerNight}
                  </span>
                </div>
              </Link>

              {/* Body */}
              <div className="flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <h3 className="text-[17px] font-bold text-[#18271E] tracking-tight leading-snug group-hover:text-[#255235] transition-colors">
                    {room.title}
                  </h3>
                  <div className="flex items-center gap-1.5 text-[12px] text-[#637265] font-medium mt-1">
                    <Users className="w-3.5 h-3.5 text-[#2C573A]" />
                    <span>{room.capacity}</span>
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {room.features.slice(0, 3).map((feature) => (
                      <li key={feature} className="flex items-start gap-1.5 text-[12px] text-[#5A695D] leading-snug">
                        <Check className="w-3.5 h-3.5 text-[#2C573A] shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link
                  to={`/rooms/${room.id}`}
                  className="inline-flex items-center gap-1.5 min-h-11 sm:min-h-0 py-1.5 text-xs font-semibold text-[#254A32] hover:text-[#183321] transition-all cursor-pointer group-hover:gap-2"
                >
                  <span>View Details</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
