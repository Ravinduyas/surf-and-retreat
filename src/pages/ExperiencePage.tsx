import React from 'react';
import { Sparkles, Play, ArrowRight, BedDouble, Waves, Laptop } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { PageHero } from '../components/layout/PageHero';
import { RoomsGrid } from '../components/rooms/RoomsGrid';
import { ColivingCard } from '../components/rooms/ColivingCard';
import { SurfPackages } from '../components/surf/SurfPackages';
import { SurfSpots } from '../components/surf/SurfSpots';
import { AmenitiesGrid } from '../components/coworking/AmenitiesGrid';
import { PlansPricing } from '../components/coworking/PlansPricing';
import { Button } from '../components/ui/Button';
import { Reveal } from '../components/ui/Reveal';
import { usePageMeta } from '../hooks/usePageMeta';
import { useModals } from '../context/ModalContext';
import { ROOMS } from '../data';

const JUMP_LINKS = [
  { id: 'rooms', label: 'Rooms & Stay', icon: BedDouble },
  { id: 'surf', label: 'Surf School', icon: Waves },
  { id: 'coworking', label: 'Coworking', icon: Laptop },
];

export default function ExperiencePage() {
  usePageMeta(
    'Stay, Surf & Work | Surf & Retreat Hostel Weligama',
    'Dorms from $12, daily surf lessons on Weligama Bay and a coworking space with 300 Mbps fiber — everything under one roof, five minutes from the beach.'
  );
  const { openBooking, openVideo } = useModals();

  return (
    <>
      <PageHeader>
        <PageHero
          eyebrow="Stay · Surf · Work"
          eyebrowIcon={Sparkles}
          title={
            <>
              Sleep, Surf &amp; Work —
              <br />
              All Under <span className="text-[#2C573A]">One Roof.</span>
            </>
          }
          subtitle="Curtain-pod dorms and private rooms, morning surf lessons on Weligama Bay and a real workspace with 300 Mbps fiber — one booking covers it all."
          image={ROOMS[0].image}
          imageAlt="Hostel dorm room with bunk beds"
        >
          <Button variant="primary" onClick={() => openBooking()}>
            <span>Check Availability</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={openVideo}>
            <Play className="w-4 h-4" />
            <span>Watch the Surf</span>
          </Button>
        </PageHero>
      </PageHeader>

      {/* Section jump links */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {JUMP_LINKS.map(({ id, label, icon: Icon }, idx) => (
          <a
            key={id}
            href={`#${id}`}
            className="surface-in inline-flex items-center gap-1.5 bg-white border border-[#E1E7DE] hover:border-[#B9C9B6] text-[#254A32] text-[12px] font-semibold px-4 py-2 rounded-full shadow-xs transition-colors cursor-pointer"
            style={{ '--d': `${650 + idx * 120}ms` } as React.CSSProperties}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </a>
        ))}
      </div>

      <div id="rooms" className="scroll-mt-6">
        <RoomsGrid />
        <Reveal>
          <ColivingCard />
        </Reveal>
      </div>

      <div id="surf" className="scroll-mt-6">
        <SurfPackages />
        <SurfSpots />
      </div>

      <div id="coworking" className="scroll-mt-6">
        <AmenitiesGrid />
        <PlansPricing />
      </div>
    </>
  );
}
