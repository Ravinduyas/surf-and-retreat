import React from 'react';
import { Waves, Play, ArrowRight } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { PageHero } from '../components/layout/PageHero';
import { SurfPackages } from '../components/surf/SurfPackages';
import { SurfSpots } from '../components/surf/SurfSpots';
import { Button } from '../components/ui/Button';
import { usePageMeta } from '../hooks/usePageMeta';
import { useModals } from '../context/ModalContext';

export default function SurfPage() {
  usePageMeta(
    'Surf School & Packages | Surf & Retreat Hostel Weligama',
    'Daily surf lessons on Weligama Bay, video-analysis coaching and board rental from $5 — with ISA-certified local instructors.'
  );
  const { openVideo, openBooking } = useModals();

  return (
    <>
      <PageHeader>
        <PageHero
          eyebrow="Surf School"
          eyebrowIcon={Waves}
          title={
            <>
              Your First Wave
              <br />
              Starts <span className="text-[#2C573A]">Here.</span>
            </>
          }
          subtitle="Weligama Bay is the easiest learning wave in Sri Lanka — a 2 km sandy-bottom beach break right on our doorstep. Lessons run every morning at 6:30 AM."
          image="https://images.unsplash.com/photo-1502680390469-be75c86b636f?q=80&w=1200&auto=format&fit=crop"
          imageAlt="Surfer riding a gentle wave"
        >
          <Button variant="primary" onClick={() => openBooking('surf')}>
            <span>Book a Lesson</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={openVideo}>
            <Play className="w-4 h-4" />
            <span>Watch the Surf</span>
          </Button>
        </PageHero>
      </PageHeader>

      <SurfPackages />
      <SurfSpots />
    </>
  );
}
