import React from 'react';
import {
  Car,
  Bike,
  Shirt,
  Map,
  Flower2,
  Package,
  ConciergeBell,
  ArrowRight,
  LucideIcon,
} from 'lucide-react';
import { SERVICES } from '../../data';
import { Eyebrow } from '../ui/Eyebrow';
import { Button } from '../ui/Button';

const SERVICE_ICONS: Record<string, LucideIcon> = {
  pickup: Car,
  scooter: Bike,
  laundry: Shirt,
  tours: Map,
  yoga: Flower2,
  storage: Package,
};

interface ServicesGridProps {
  showCta?: boolean;
}

export const ServicesGrid: React.FC<ServicesGridProps> = ({ showCta = false }) => {
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
            Transfers, wheels, laundry and day trips — book any of these on arrival
            or message us before you land.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {SERVICES.map((s) => {
            const Icon = SERVICE_ICONS[s.iconType];
            return (
              <div
                key={s.id}
                id={`service-${s.id}`}
                className="bg-[#F4F6F2]/90 hover:bg-white border border-[#E1E7DE] rounded-3xl p-6 sm:p-7 transition-all duration-200 shadow-xs hover:shadow-sm flex flex-col gap-4"
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-full bg-[#DEEBDB] flex items-center justify-center">
                    <Icon className="w-5 h-5 text-[#2E583A]" />
                  </div>
                  <span className="inline-block bg-white text-[#1D3624] text-[11px] font-semibold px-3 py-1 rounded-full border border-[#E1E7DE]">
                    {s.price}
                  </span>
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-[#18271E] tracking-tight">
                    {s.title}
                  </h3>
                  <p className="text-[13px] text-[#5A695D] leading-relaxed mt-1.5">
                    {s.description}
                  </p>
                </div>
              </div>
            );
          })}
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
