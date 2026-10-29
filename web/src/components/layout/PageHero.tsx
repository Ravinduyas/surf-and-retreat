import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Eyebrow } from '../ui/Eyebrow';
import { Photo } from '../ui/Photo';

const d = (ms: number) => ({ '--d': `${ms}ms` }) as React.CSSProperties;

interface PageHeroProps {
  eyebrow: string;
  eyebrowIcon?: LucideIcon;
  title: React.ReactNode;
  subtitle: string;
  image?: string;
  imageAlt?: string;
  /** Custom right-hand visual, used instead of a single image. */
  media?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * Compact hero for inner pages - rendered inside PageHeader.
 * Frame maintains a static size across tabs while inner content loads smoothly.
 */
export const PageHero: React.FC<PageHeroProps> = ({
  eyebrow,
  eyebrowIcon,
  title,
  subtitle,
  image,
  imageAlt = '',
  media,
  children,
}) => (
  <div className="pt-4 sm:pt-6 pb-6 sm:pb-8 px-4 sm:px-8 lg:h-[440px] lg:min-h-[440px] flex flex-col justify-center">
    <div className={`grid grid-cols-1 ${image || media ? 'lg:grid-cols-12' : ''} gap-8 items-center w-full`}>
      <div className={`${image || media ? 'lg:col-span-6' : 'lg:col-span-8 lg:mx-auto'} space-y-4 sm:space-y-5 flex flex-col justify-center`}>
        <div className="surface-in" style={d(120)}>
          <Eyebrow icon={eyebrowIcon}>{eyebrow}</Eyebrow>
        </div>
        <h1
          className="surface-in text-4xl sm:text-5xl xl:text-[54px] font-bold text-[#18261E] tracking-tight leading-[1.08]"
          style={d(280)}
        >
          {title}
        </h1>
        <p
          className="surface-in text-[#59695C] text-base sm:text-lg max-w-lg leading-relaxed"
          style={d(440)}
        >
          {subtitle}
        </p>
        {children && (
          <div className="surface-in flex flex-wrap items-center gap-3 pt-1" style={d(580)}>
            {children}
          </div>
        )}
      </div>
      {media && !image && (
        <div className="lg:col-span-6 flex items-center justify-center lg:justify-end">
          <div className="w-full h-[260px] sm:h-[320px] lg:h-[340px] flex items-center justify-center">
            {media}
          </div>
        </div>
      )}
      {image && (
        <div className="lg:col-span-6 flex items-center justify-center lg:justify-end">
          <div className="relative w-full h-[260px] sm:h-[320px] lg:h-[340px] rounded-[28px] overflow-hidden border border-[#DFE5DC] shadow-md bg-[#EBF0E8]">
            <Photo
              src={image}
              alt={imageAlt}
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="hero-img-in absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent pointer-events-none" />
            <div className="fog-clear absolute inset-0 bg-white pointer-events-none z-10" />
          </div>
        </div>
      )}
    </div>
  </div>
);
