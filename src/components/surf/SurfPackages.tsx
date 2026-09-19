import React from 'react';
import { ArrowRight, Check, Waves } from 'lucide-react';
import { SURF_PACKAGES } from '../../data';
import { Eyebrow } from '../ui/Eyebrow';
import { useModals } from '../../context/ModalContext';
import { useReveal } from '../ui/Reveal';

export const SurfPackages: React.FC = () => {
  const { openDetail } = useModals();
  const gridRef = useReveal<HTMLDivElement>();

  return (
    <section className="mt-6 sm:mt-10">
      <div className="bg-white border border-[#E3E8DE] rounded-[32px] sm:rounded-[36px] p-6 sm:p-10 lg:p-12 shadow-xs">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div className="space-y-4">
            <Eyebrow icon={Waves}>Surf Packages</Eyebrow>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#18261E] tracking-tight leading-tight">
              Lessons, Coaching &amp; Boards
            </h2>
          </div>
          <p className="text-[#59695C] text-sm max-w-sm leading-relaxed">
            ISA-certified local instructors, small groups and boards for every level —
            hostel guests get 20% off everything.
          </p>
        </div>

        <div ref={gridRef} className="stagger grid grid-cols-1 sm:grid-cols-3 gap-5">
          {SURF_PACKAGES.map((pkg) => (
            <div key={pkg.id} id={`surf-package-${pkg.id}`} className="group flex flex-col">
              <button
                onClick={() => openDetail(pkg, 'surf')}
                className="relative h-[220px] rounded-2xl overflow-hidden mb-4 shadow-xs bg-[#EAF0E7] block w-full cursor-pointer"
              >
                <img
                  src={pkg.image}
                  alt={pkg.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                />
                <div className="absolute bottom-3 left-3">
                  <span className="inline-block bg-white/95 backdrop-blur-xs text-[#1D3624] text-[11px] font-semibold px-3 py-1 rounded-full shadow-xs">
                    {pkg.level}
                  </span>
                </div>
                <div className="absolute top-3 right-3">
                  <span className="inline-block bg-[#D7E95C] text-[#16301F] text-[11px] font-bold px-3 py-1 rounded-full shadow-xs">
                    {pkg.price}
                  </span>
                </div>
              </button>

              <div className="flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <h3 className="text-[17px] font-bold text-[#18271E] tracking-tight leading-snug group-hover:text-[#255235] transition-colors">
                    {pkg.title}
                  </h3>
                  <p className="text-[13px] text-[#5A695D] leading-relaxed mt-1">
                    {pkg.description}
                  </p>
                  <ul className="mt-3 space-y-1.5">
                    {pkg.includes.map((inc) => (
                      <li key={inc} className="flex items-start gap-1.5 text-[12px] text-[#5A695D] leading-snug">
                        <Check className="w-3.5 h-3.5 text-[#2C573A] shrink-0 mt-0.5" />
                        <span>{inc}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => openDetail(pkg, 'surf')}
                  className="inline-flex items-center gap-1.5 py-1.5 text-xs font-semibold text-[#254A32] hover:text-[#183321] transition-all cursor-pointer group-hover:gap-2"
                >
                  <span>View Package</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
