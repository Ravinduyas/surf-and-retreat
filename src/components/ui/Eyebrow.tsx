import React from 'react';
import { Waves, LucideIcon } from 'lucide-react';

interface EyebrowProps {
  children: React.ReactNode;
  icon?: LucideIcon;
}

export const Eyebrow: React.FC<EyebrowProps> = ({ children, icon: Icon = Waves }) => (
  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#D5DDD1] bg-[#F2F6F0] text-[#34593E] text-[11px] font-semibold tracking-wider uppercase">
    <Icon className="w-3.5 h-3.5 text-[#2E583A]" />
    <span>{children}</span>
  </div>
);
