import React from 'react';
import { BedDouble } from 'lucide-react';

/**
 * Brand marks are from simple-icons (CC0 icon data; the logos themselves are
 * trademarks of their owners). Shown muted, in brand colour on hover.
 */
const PLATFORMS: { name: string; color: string; path: string | null }[] = [
  // Hostelworld's mark isn't in the open simple-icons set, so it gets a neutral bed icon.
  { name: 'Hostelworld', color: '#F25621', path: null },
  { name: 'Booking.com', color: '#003A9A', path: 'M24 0H0v24h24ZM8.575 6.563h2.658c2.108 0 3.473 1.15 3.473 2.898 0 1.15-.575 1.82-.91 2.108l-.287.263.335.192c.815.479 1.318 1.389 1.318 2.395 0 1.988-1.51 3.257-3.857 3.257H7.449V7.713c0-.623.503-1.126 1.126-1.15zm1.7 1.868c-.479.024-.694.264-.694.79v1.893h1.676c.958 0 1.294-.743 1.294-1.365 0-.815-.503-1.318-1.318-1.318zm-.096 4.36c-.407.071-.598.31-.598.79v2.251h1.868c.934 0 1.509-.55 1.509-1.533 0-.934-.599-1.509-1.51-1.509zm7.737 2.394c.743 0 1.341.599 1.341 1.342a1.34 1.34 0 0 1-1.341 1.341 1.355 1.355 0 0 1-1.341-1.341c0-.743.598-1.342 1.34-1.342z' },
  { name: 'Airbnb', color: '#FF5A5F', path: 'M12.001 18.275c-1.353-1.697-2.148-3.184-2.413-4.457-.263-1.027-.16-1.848.291-2.465.477-.71 1.188-1.056 2.121-1.056s1.643.345 2.12 1.063c.446.61.558 1.432.286 2.465-.291 1.298-1.085 2.785-2.412 4.458zm9.601 1.14c-.185 1.246-1.034 2.28-2.2 2.783-2.253.98-4.483-.583-6.392-2.704 3.157-3.951 3.74-7.028 2.385-9.018-.795-1.14-1.933-1.695-3.394-1.695-2.944 0-4.563 2.49-3.927 5.382.37 1.565 1.352 3.343 2.917 5.332-.98 1.085-1.91 1.856-2.732 2.333-.636.344-1.245.558-1.828.609-2.679.399-4.778-2.2-3.825-4.88.132-.345.395-.98.845-1.961l.025-.053c1.464-3.178 3.242-6.79 5.285-10.795l.053-.132.58-1.116c.45-.822.635-1.19 1.351-1.643.346-.21.77-.315 1.246-.315.954 0 1.698.558 2.016 1.007.158.239.345.557.582.953l.558 1.089.08.159c2.041 4.004 3.821 7.608 5.279 10.794l.026.025.533 1.22.318.764c.243.613.294 1.222.213 1.858zm1.22-2.39c-.186-.583-.505-1.271-.9-2.094v-.03c-1.889-4.006-3.642-7.608-5.307-10.844l-.111-.163C15.317 1.461 14.468 0 12.001 0c-2.44 0-3.476 1.695-4.535 3.898l-.081.16c-1.669 3.236-3.421 6.843-5.303 10.847v.053l-.559 1.22c-.21.504-.317.768-.345.847C-.172 20.74 2.611 24 5.98 24c.027 0 .132 0 .265-.027h.372c1.75-.213 3.554-1.325 5.384-3.317 1.829 1.989 3.635 3.104 5.382 3.317h.372c.133.027.239.027.265.027 3.37.003 6.152-3.261 4.802-6.975z' },
  { name: 'Tripadvisor', color: '#34E0A1', path: 'M12.006 4.295c-2.67 0-5.338.784-7.645 2.353H0l1.963 2.135a5.997 5.997 0 0 0 4.04 10.43 5.976 5.976 0 0 0 4.075-1.6L12 19.705l1.922-2.09a5.972 5.972 0 0 0 4.072 1.598 6 6 0 0 0 6-5.998 5.982 5.982 0 0 0-1.957-4.432L24 6.648h-4.35a13.573 13.573 0 0 0-7.644-2.353zM12 6.255c1.531 0 3.063.303 4.504.903C13.943 8.138 12 10.43 12 13.1c0-2.671-1.942-4.962-4.504-5.942A11.72 11.72 0 0 1 12 6.256zM6.002 9.157a4.059 4.059 0 1 1 0 8.118 4.059 4.059 0 0 1 0-8.118zm11.992.002a4.057 4.057 0 1 1 .003 8.115 4.057 4.057 0 0 1-.003-8.115zm-11.992 1.93a2.128 2.128 0 0 0 0 4.256 2.128 2.128 0 0 0 0-4.256zm11.992 0a2.128 2.128 0 0 0 0 4.256 2.128 2.128 0 0 0 0-4.256z' },
  { name: 'Google', color: '#4285F4', path: 'M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z' },
];

const PlatformMark: React.FC<{ platform: (typeof PLATFORMS)[number] }> = ({ platform }) => (
  <span
    className="group/brand flex shrink-0 items-center gap-2 text-[#6D7D70] transition-colors"
    style={{ '--brand': platform.color } as React.CSSProperties}
  >
    {platform.path ? (
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5 fill-current transition-colors group-hover/brand:text-[var(--brand)]"
        aria-hidden="true"
      >
        <path d={platform.path} />
      </svg>
    ) : (
      <BedDouble className="w-5 h-5 transition-colors group-hover/brand:text-[var(--brand)]" aria-hidden="true" />
    )}
    <span className="text-[14px] font-semibold tracking-tight whitespace-nowrap group-hover/brand:text-[#18271E]">
      {platform.name}
    </span>
  </span>
);

export const TrustedBySection: React.FC = () => {
  const Row: React.FC<{ hidden?: boolean }> = ({ hidden }) => (
    <div className="flex items-center gap-10 pr-10" aria-hidden={hidden || undefined}>
      {PLATFORMS.map((p) => (
        <PlatformMark key={p.name} platform={p} />
      ))}
    </div>
  );

  return (
    <div className="py-10 px-4 sm:px-8 border-y border-[#E4EAE0]/80 my-8">
      <div className="flex flex-col xl:flex-row xl:items-center gap-5 xl:gap-8">
        <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.12em] sm:tracking-[0.2em] text-[#869588] uppercase xl:shrink-0">
          Find &amp; Book Us On
        </span>

        {/* Narrow screens: one line that drifts sideways instead of wrapping */}
        <div className="xl:hidden marquee marquee-mask relative overflow-hidden -mx-4 sm:-mx-8">
          <div className="marquee-track flex w-max pl-4 sm:pl-8">
            <Row />
            <Row hidden />
          </div>
        </div>

        {/* Wide screens: the platforms spread across the full width */}
        <div className="hidden xl:flex flex-1 items-center justify-between gap-8">
          {PLATFORMS.map((p) => (
            <PlatformMark key={p.name} platform={p} />
          ))}
        </div>
      </div>
    </div>
  );
};
