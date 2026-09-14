import React from 'react';
import { MapPin, Phone, Mail, ExternalLink, Plane } from 'lucide-react';
import { Eyebrow } from '../ui/Eyebrow';
import { ABOUT_IMAGES, CONTACT_INFO } from '../../data';

export const LocationCard: React.FC = () => {
  return (
    <div className="bg-white border border-[#E3E8DE] rounded-[32px] sm:rounded-[36px] overflow-hidden shadow-xs">
      {/* Photo */}
      <div className="relative h-[200px] sm:h-[240px] w-full overflow-hidden bg-[#EAF0E7]">
        <img
          src={ABOUT_IMAGES.location}
          alt="Palm trees on the beach at sunset in Weligama"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <div className="absolute bottom-4 left-6">
          <span className="inline-block bg-[#D7E95C] text-[#16301F] text-xs font-bold px-3.5 py-1 rounded-full uppercase tracking-wider">
            Weligama, Sri Lanka
          </span>
        </div>
      </div>

      <div className="p-6 sm:p-8 space-y-5">
        <div className="space-y-4">
          <Eyebrow icon={MapPin}>Find Us</Eyebrow>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#18261E] tracking-tight leading-tight">
            Five Minutes from the Bay
          </h2>
        </div>

        <ul className="space-y-3">
          <li className="flex items-start gap-3 text-sm text-[#3D4F42]">
            <MapPin className="w-4 h-4 text-[#2C573A] shrink-0 mt-0.5" />
            <span>{CONTACT_INFO.address}</span>
          </li>
          <li className="flex items-start gap-3 text-sm text-[#3D4F42]">
            <Phone className="w-4 h-4 text-[#2C573A] shrink-0 mt-0.5" />
            <span>{CONTACT_INFO.phone} (calls &amp; WhatsApp)</span>
          </li>
          <li className="flex items-start gap-3 text-sm text-[#3D4F42]">
            <Mail className="w-4 h-4 text-[#2C573A] shrink-0 mt-0.5" />
            <span>{CONTACT_INFO.email}</span>
          </li>
        </ul>

        <div className="bg-[#F4F7F2] p-4 rounded-2xl border border-[#DFE6DB] flex items-start gap-3">
          <Plane className="w-5 h-5 text-[#2C573A] shrink-0 mt-0.5" />
          <div>
            <span className="text-xs font-bold text-[#1C3A27] block">Getting Here:</span>
            <span className="text-xs text-[#526456] mt-0.5 block leading-relaxed">
              2.5 hours from Colombo Airport by highway taxi (~$55, we can arrange it),
              or the highway bus to Matara plus a 15-minute tuk-tuk.
            </span>
          </div>
        </div>

        <a
          href={CONTACT_INFO.mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="w-full bg-[#2A4E38] hover:bg-[#1E3A28] text-white font-semibold py-3 rounded-full text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-98"
        >
          <span>Open in Google Maps</span>
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
};
