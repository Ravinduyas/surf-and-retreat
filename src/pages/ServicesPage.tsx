import React from 'react';
import { ConciergeBell, ArrowRight } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { PageHero } from '../components/layout/PageHero';
import { ServicesGrid } from '../components/services/ServicesGrid';
import { Button } from '../components/ui/Button';
import { usePageMeta } from '../hooks/usePageMeta';
import { useModals } from '../context/ModalContext';
import { SERVICES_HERO_IMAGE } from '../data';

export default function ServicesPage() {
  usePageMeta(
    'Guest Services | Surf & Retreat Hostel Weligama',
    'Rooms, co-working, surfing, skating, yoga, airport pick-up and drop, and laundry — every service at Surf & Retreat Hostel Weligama, bookable at the front desk.'
  );
  const { openBooking } = useModals();

  return (
    <>
      <PageHeader>
        <PageHero
          eyebrow="Guest Services"
          eyebrowIcon={ConciergeBell}
          title={
            <>
              We Handle the Boring Bits,
              <br />
              You Catch the <span className="text-[#2C573A]">Waves.</span>
            </>
          }
          subtitle="From your airport pickup to your last load of laundry — beds, desks, boards, skate sessions and sunrise yoga are all one ask away at the front desk."
          image={SERVICES_HERO_IMAGE}
          imageAlt="The hostel dog keeping watch out front"
        >
          <Button variant="primary" onClick={() => openBooking()}>
            <span>Book Your Stay</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" to="/contact">
            Ask About a Service
          </Button>
        </PageHero>
      </PageHeader>

      <ServicesGrid />
    </>
  );
}
