import React from 'react';
import { BedDouble, ArrowRight } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { PageHero } from '../components/layout/PageHero';
import { RoomsGrid } from '../components/rooms/RoomsGrid';
import { ColivingCard } from '../components/rooms/ColivingCard';
import { Button } from '../components/ui/Button';
import { usePageMeta } from '../hooks/usePageMeta';
import { useModals } from '../context/ModalContext';
import { ROOMS } from '../data';

export default function RoomsPage() {
  usePageMeta(
    'Rooms & Stay | Surf & Retreat Hostel Weligama',
    'Curtain-pod dorms from $12/night, private AC doubles and a garden bungalow — five minutes from Weligama Bay, Sri Lanka.'
  );
  const { openBooking } = useModals();

  return (
    <>
      <PageHeader>
        <PageHero
          eyebrow="Rooms & Stay"
          eyebrowIcon={BedDouble}
          title={
            <>
              Sleep Well,
              <br />
              <span className="text-[#2C573A]">Steps</span> from the Surf.
            </>
          }
          subtitle="From social surfer dorms to a private garden bungalow — every bed comes with hot showers, fast wifi and a five-minute walk to the bay."
          image={ROOMS[0].image}
          imageAlt="Hostel dorm room with bunk beds"
        >
          <Button variant="primary" onClick={() => openBooking('stay')}>
            <span>Check Availability</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" to="/contact">
            Ask a Question
          </Button>
        </PageHero>
      </PageHeader>

      <RoomsGrid />
      <ColivingCard />
    </>
  );
}
