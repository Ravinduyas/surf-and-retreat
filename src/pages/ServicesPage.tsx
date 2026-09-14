import React from 'react';
import { ConciergeBell, ArrowRight } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { PageHero } from '../components/layout/PageHero';
import { ServicesGrid } from '../components/services/ServicesGrid';
import { Button } from '../components/ui/Button';
import { usePageMeta } from '../hooks/usePageMeta';
import { useModals } from '../context/ModalContext';

export default function ServicesPage() {
  usePageMeta(
    'Guest Services | Surf & Retreat Hostel Weligama',
    'Airport pickup, scooter rental, laundry, day trips, rooftop yoga and free board storage — every service bookable at the front desk.'
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
          subtitle="From the moment you land at Colombo airport to your last load of laundry — transfers, scooters, tours and storage are all one ask away at the front desk."
          image="https://images.unsplash.com/photo-1558981403-c5f9899a28bc?q=80&w=1200&auto=format&fit=crop"
          imageAlt="Scooter parked by the beach road"
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
