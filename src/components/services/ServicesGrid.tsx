import React from 'react';
import { Link } from 'react-router-dom';
import {
  BedDouble,
  Laptop,
  Waves,
  Flower2,
  Car,
  Shirt,
  ConciergeBell,
  ArrowRight,
  LucideIcon,
} from 'lucide-react';
import { SERVICES } from '../../data';
import { ServiceItem } from '../../types';
import { Eyebrow } from '../ui/Eyebrow';
import { Button } from '../ui/Button';
import { useReveal } from '../ui/Reveal';

/** Lucide has no skateboard, so this is drawn to match its stroke style. */
const SkateIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M2.8 10.9c1-2.1 2.6-1.4 4.2-1.4h10c1.6 0 3.2-.7 4.2 1.4" />
    <path d="M7.8 12.4v1.4M16.2 12.4v1.4" />
    <circle cx="7.8" cy="15.6" r="1.6" />
    <circle cx="16.2" cy="15.6" r="1.6" />
  </svg>
);

const SERVICE_ICONS: Record<ServiceItem['iconType'], LucideIcon | React.FC<{ className?: string }>> = {
  rooms: BedDouble,
  coworking: Laptop,
  surfing: Waves,
  skating: SkateIcon,
  yoga: Flower2,
  transfer: Car,
  laundry: Shirt,
};

const ServiceCard: React.FC<{ service: ServiceItem; large?: boolean }> = ({ service, large }) => {
  const Icon = SERVICE_ICONS[service.iconType];
  const body = (
    <>
      <div className="flex items-center justify-between">
        <div
          className={`${large ? 'w-11 h-11' : 'w-10 h-10'} rounded-full bg-[#DEEBDB] flex items-center justify-center`}
        >
          <Icon className={large ? 'w-5 h-5 text-[#2E583A]' : 'w-[18px] h-[18px] text-[#2E583A]'} />
        </div>
        <span className="inline-block bg-white text-[#1D3624] text-[11px] font-semibold px-3 py-1 rounded-full border border-[#E1E7DE]">
          {service.price}
        </span>
      </div>
      <div>
        <h3
          className={`${large ? 'text-[17px]' : 'text-[15px]'} font-bold text-[#18271E] tracking-tight ${
            service.to ? 'group-hover:text-[#265337] transition-colors' : ''
          }`}
        >
          {service.title}
        </h3>
        <p className="text-[13px] text-[#5A695D] leading-relaxed mt-1.5">{service.description}</p>
      </div>
      {service.to && (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#254A32] transition-all group-hover:gap-2.5">
          <span>See details</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </span>
      )}
    </>
  );

  const shell = `bg-[#F4F6F2]/90 hover:bg-white border border-[#E1E7DE] rounded-3xl ${
    large ? 'p-6 sm:p-7' : 'p-5 sm:p-6'
  } transition-all duration-200 shadow-xs hover:shadow-sm flex flex-col gap-4`;

  return service.to ? (
    <Link to={service.to} id={`service-${service.id}`} className={`group ${shell} cursor-pointer`}>
      {body}
    </Link>
  ) : (
    <div id={`service-${service.id}`} className={shell}>
      {body}
    </div>
  );
};

interface ServicesGridProps {
  showCta?: boolean;
}

export const ServicesGrid: React.FC<ServicesGridProps> = ({ showCta = false }) => {
  const coreRef = useReveal<HTMLDivElement>();
  const extraRef = useReveal<HTMLDivElement>();

  const core = SERVICES.filter((s) => s.group === 'core');
  const extras = SERVICES.filter((s) => s.group === 'extra');

  return (
    <section className="mt-6 sm:mt-10">
      <div className="bg-white border border-[#E3E8DE] rounded-[32px] sm:rounded-[36px] p-6 sm:p-10 lg:p-12 shadow-xs">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div className="space-y-4">
            <Eyebrow icon={ConciergeBell}>Guest Services</Eyebrow>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#18261E] tracking-tight leading-tight">
              Everything Sorted at the Front Desk
            </h2>
          </div>
          <p className="text-[#59695C] text-sm max-w-sm leading-relaxed">
            Sleep, work, surf and skate under one roof — plus the small things that
            make a long stay easy. Book any of it on arrival or before you land.
          </p>
        </div>

        {/* The three you come for */}
        <div ref={coreRef} className="stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {core.map((s) => (
            <ServiceCard key={s.id} service={s} large />
          ))}
        </div>

        {/* Everything else at the desk */}
        <div
          ref={extraRef}
          className="stagger grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mt-4 sm:mt-5"
        >
          {extras.map((s) => (
            <ServiceCard key={s.id} service={s} />
          ))}
        </div>

        {showCta && (
          <div className="mt-8 flex justify-center">
            <Button variant="outline" to="/services">
              <span>See All Services</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </section>
  );
};
