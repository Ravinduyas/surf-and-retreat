import React from 'react';

export const TrustedBySection: React.FC = () => {
  const logos = [
    {
      id: 'logo-1',
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
          <circle cx="9" cy="9" r="4" opacity="0.6" />
          <circle cx="15" cy="15" r="4" />
          <circle cx="15" cy="9" r="3" opacity="0.4" />
        </svg>
      ),
    },
    {
      id: 'logo-2',
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
          <path d="M12 2L4 7v10l8 5 8-5V7l-8-5zm0 2.5l5.5 3.5-5.5 3.5-5.5-3.5L12 4.5z" />
        </svg>
      ),
    },
    {
      id: 'logo-3',
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
          <rect x="5" y="5" width="6" height="6" rx="1.5" />
          <rect x="13" y="5" width="6" height="6" rx="1.5" opacity="0.5" />
          <rect x="5" y="13" width="6" height="6" rx="1.5" opacity="0.5" />
          <rect x="13" y="13" width="6" height="6" rx="1.5" />
        </svg>
      ),
    },
    {
      id: 'logo-4',
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2.5" fill="none" />
          <circle cx="12" cy="12" r="3" fill="currentColor" />
        </svg>
      ),
    },
    {
      id: 'logo-5',
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
          <path d="M12 3a9 9 0 00-9 9c0 4.97 4.03 9 9 9s9-4.03 9-9a9 9 0 00-9-9zm0 14a5 5 0 110-10 5 5 0 010 10z" />
        </svg>
      ),
    },
    {
      id: 'logo-6',
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" opacity="0.7" />
        </svg>
      ),
    },
  ];

  const LogoRow: React.FC<{ idPrefix?: string; hidden?: boolean }> = ({ idPrefix, hidden }) => (
    <div className="flex items-center gap-10 pr-10" aria-hidden={hidden || undefined}>
      {logos.map((logo, index) => (
        <div
          key={logo.id}
          id={idPrefix ? `${idPrefix}-${index}` : undefined}
          className="flex shrink-0 items-center gap-2 text-[#6D7D70] hover:text-[#234530] transition-colors"
        >
          {logo.icon}
          <span className="text-[14px] font-semibold tracking-tight whitespace-nowrap">
            Logoipsum
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="py-10 px-4 sm:px-8 border-y border-[#E4EAE0]/80 my-8">
      <div className="flex flex-col xl:flex-row xl:items-center gap-5 xl:gap-8">
        <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.12em] sm:tracking-[0.2em] text-[#869588] uppercase xl:shrink-0">
          Loved by Surfers &amp; Remote Workers
        </span>

        {/* Narrow screens: one line that drifts sideways instead of wrapping */}
        <div className="xl:hidden marquee marquee-mask relative overflow-hidden -mx-4 sm:-mx-8">
          <div className="marquee-track flex w-max opacity-70 pl-4 sm:pl-8">
            <LogoRow idPrefix="trusted-logo" />
            <LogoRow hidden />
          </div>
        </div>

        {/* Wide screens: the logos spread across the full width */}
        <div className="hidden xl:flex flex-1 items-center justify-between gap-8 opacity-70 hover:opacity-100 transition-opacity">
          {logos.map((logo, index) => (
            <div
              key={logo.id}
              id={`trusted-logo-lg-${index}`}
              className="flex items-center gap-2 text-[#6D7D70] hover:text-[#234530] transition-colors"
            >
              {logo.icon}
              <span className="text-[14px] font-semibold tracking-tight">Logoipsum</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
