import React from 'react';
import { Link } from 'react-router-dom';
import { Waves } from 'lucide-react';

export const Logo: React.FC = () => (
  <Link
    to="/"
    className="flex items-center gap-2.5 text-[#192A1F] font-bold text-xl tracking-tight group focus:outline-hidden"
  >
    <div className="w-6 h-6 text-[#244E33] flex items-center justify-center transition-transform group-hover:scale-105">
      <Waves className="w-5 h-5 text-[#2B543A]" strokeWidth={2.4} />
    </div>
    <span className="text-[20px] font-bold tracking-tight text-[#1C2C20]">
      Surf &amp; Retreat
    </span>
  </Link>
);
