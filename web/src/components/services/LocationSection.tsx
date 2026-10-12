import React from 'react';
import { MapPin, Plane, ExternalLink, Navigation } from 'lucide-react';
import { Eyebrow } from '../ui/Eyebrow';
import { CONTACT_INFO, SURF_SPOTS } from '../../data';

/** The hostel's own Google Maps listing, as embedded from Google Maps → Share → Embed a map. */
const MAP_EMBED =
  'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3270.600059591031!2d80.43565559999999!3d5.9780168!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3ae115248223e667%3A0x9e3b5514eef09b52!2sSurf%20%26%20Retreat%20Weligama%20Sri%20Lanka%20%7C%20Surf%20Hostel%20%2CCo%20Living%20%7CCowork%7C%20Yoga%20Retreat%20%C2%B7%20Skatepark%20%C2%B7%20Outdoor%20Gym!5e1!3m2!1sen!2slk!4v1791806745006!5m2!1sen!2slk';

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
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    </div>
  </section>
);
