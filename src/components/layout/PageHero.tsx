import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Eyebrow } from '../ui/Eyebrow';

interface PageHeroProps {
  eyebrow: string;
  eyebrowIcon?: LucideIcon;
  title: React.ReactNode;
  subtitle: string;
  image?: string;
  imageAlt?: string;
  children?: React.ReactNode;
}

/**
 * Compact hero for inner pages — rendered inside PageHeader.
 */
export const PageHero: React.FC<PageHeroProps> = ({
  eyebrow,
  eyebrowIcon,
  title,
  subtitle,
  image,
  imageAlt = '',
  children,
}) => (
  <div className="pt-4 sm:pt-6 pb-8 px-4 sm:px-8">
    <div className={`grid grid-cols-1 ${image ? 'lg:grid-cols-12' : ''} gap-8 items-center`}>
      <div className={`${image ? 'lg:col-span-6' : ''} space-y-5`}>
        <Eyebrow icon={eyebrowIcon}>{eyebrow}</Eyebrow>
        <h1 className="text-4xl sm:text-5xl xl:text-[56px] font-bold text-[#18261E] tracking-tight leading-[1.08]">
          {title}
        </h1>
        <p className="text-[#59695C] text-base sm:text-lg max-w-lg leading-relaxed">{subtitle}</p>
        {children && <div className="flex flex-wrap items-center gap-3 pt-2">{children}</div>}
      </div>
      {image && (
        <div className="lg:col-span-6">
          <div className="relative w-full h-[260px] sm:h-[340px] rounded-[28px] overflow-hidden border border-[#DFE5DC] shadow-md bg-[#EBF0E8]">
            <img
              src={image}
              alt={imageAlt}
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent pointer-events-none" />
          </div>
        </div>
      )}
    </div>
  </div>
);
