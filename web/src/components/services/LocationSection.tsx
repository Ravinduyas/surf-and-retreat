import React from 'react';
import { MapPin, Plane, ExternalLink, Navigation } from 'lucide-react';
import { Eyebrow } from '../ui/Eyebrow';
import { CONTACT_INFO, SURF_SPOTS } from '../../data';

/**
 * Google's keyless map embed, centred on Weligama town (searching "Weligama Bay" drops the pin in
 * the sea). Swap the query for the hostel's exact address or Google listing once it's confirmed.
 */
const MAP_EMBED = `https://www.google.com/maps?q=${encodeURIComponent('Weligama, Sri Lanka')}&z=15&output=embed`;

export const LocationSection: React.FC = () => (
  <section className="mt-6 sm:mt-10">
    <div className="bg-white rounded-[32px] sm:rounded-[36px] p-6 sm:p-10 lg:p-12 shadow-xs">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="space-y-4">
            <Eyebrow icon={MapPin}>Find Us</Eyebrow>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#18261E] tracking-tight leading-tight">
              Five Minutes from the Bay
            </h2>
            <p className="text-[#59695C] text-sm leading-relaxed max-w-md">
              Every service starts at our front desk in Weligama, a short barefoot walk from the beach.
            </p>
          </div>

          <div className="flex items-start gap-3 text-sm text-[#3D4F42]">
            <MapPin className="w-4 h-4 text-[#2C573A] shrink-0 mt-0.5" />
            <span>{CONTACT_INFO.address}</span>
          </div>

          <ul className="divide-y divide-[#E6EBE3] border-y border-[#E6EBE3]">
            {SURF_SPOTS.map((spot) => (
              <li key={spot.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                <span className="flex items-center gap-2 text-[#18271E] font-semibold">
                  <Navigation className="w-3.5 h-3.5 text-[#2C573A]" />
                  {spot.name}
                </span>
                <span className="text-[#637265] text-xs text-right">{spot.distance}</span>
              </li>
            ))}
          </ul>

          <div className="bg-[#F4F7F2] p-4 rounded-2xl border border-[#DFE6DB] flex items-start gap-3">
            <Plane className="w-5 h-5 text-[#2C573A] shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-bold text-[#1C3A27] block">Getting here</span>
              <span className="text-xs text-[#526456] mt-0.5 block leading-relaxed">
                2.5 hours from Colombo Airport by highway taxi (~$55, we can arrange it), or the highway bus to Matara
                plus a 15-minute tuk-tuk.
              </span>
            </div>
          </div>

          <a
            href={CONTACT_INFO.mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-auto self-start bg-[#2A4E38] hover:bg-[#1E3A28] text-white font-semibold px-6 py-3 rounded-full text-sm inline-flex items-center gap-2 transition-all shadow-xs active:scale-98"
          >
            <span>Open in Google Maps</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        <div className="lg:col-span-7">
          <div className="relative h-[300px] sm:h-[380px] lg:h-full lg:min-h-[440px] rounded-[28px] overflow-hidden border border-[#DFE5DC] bg-[#EBF0E8]">
            <iframe
              title="Map of Surf & Retreat Hostel, Weligama"
              src={MAP_EMBED}
              className="absolute inset-0 w-full h-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    </div>
  </section>
);
