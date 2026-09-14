import React from 'react';
import { Laptop, ArrowRight } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { PageHero } from '../components/layout/PageHero';
import { AmenitiesGrid } from '../components/coworking/AmenitiesGrid';
import { PlansPricing } from '../components/coworking/PlansPricing';
import { Button } from '../components/ui/Button';
import { usePageMeta } from '../hooks/usePageMeta';
import { useModals } from '../context/ModalContext';

export default function CoworkingPage() {
  usePageMeta(
    'Coworking & Coliving | Surf & Retreat Hostel Weligama',
    'Work remotely from Weligama with 300 Mbps fiber wifi, AC focus room, call booths and day/week/month passes from $8.'
  );
  const { openBooking } = useModals();

  return (
    <>
      <PageHeader>
        <PageHero
          eyebrow="Coworking & Coliving"
          eyebrowIcon={Laptop}
          title={
            <>
              Deep Work, Then
              <br />
              <span className="text-[#2C573A]">Sunset</span> Sessions.
            </>
          }
          subtitle="A real workspace, not a wobbly café table: 300 Mbps fiber with 4G backup, an AC focus room, call booths and desks that don't hurt your back."
          image="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1200&auto=format&fit=crop"
          imageAlt="People working on laptops in a bright coworking space"
        >
          <Button variant="primary" onClick={() => openBooking('coworking')}>
            <span>Get a Desk Pass</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" to="/rooms">
            See Coliving Rooms
          </Button>
        </PageHero>
      </PageHeader>

      <AmenitiesGrid />
      <PlansPricing />
    </>
  );
}
