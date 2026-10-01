import React from 'react';
import { LucideIcon } from 'lucide-react';

interface PanelProps {
  icon: LucideIcon;
  title: string;
  hint?: string;
  /** Right side of the header, e.g. a "Clear" link. */
  aside?: React.ReactNode;
  children: React.ReactNode;
}

/** The main white card each step's content sits in. */
export const Panel: React.FC<PanelProps> = ({ icon: Icon, title, hint, aside, children }) => (
  <section className="bg-white rounded-[24px] border border-[#E4EAE0] shadow-xs p-4 sm:p-6">
    <header className="flex items-start justify-between gap-3 mb-5">
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-10 h-10 rounded-full bg-[#2A4E38] text-[#D8E95E] flex items-center justify-center shrink-0">
          <Icon className="w-[18px] h-[18px]" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold text-[#18271E] leading-tight">{title}</h3>
          {hint && <p className="text-xs text-[#637265] mt-0.5">{hint}</p>}
        </div>
      </div>
      {aside}
    </header>
    {children}
  </section>
);
