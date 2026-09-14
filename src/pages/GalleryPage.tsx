import React from 'react';
import { Camera, ArrowRight } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { PageHero } from '../components/layout/PageHero';
import { GalleryGrid } from '../components/gallery/GalleryGrid';
import { Button } from '../components/ui/Button';
import { usePageMeta } from '../hooks/usePageMeta';
import { useModals } from '../context/ModalContext';

export default function GalleryPage() {
  usePageMeta(
    'Gallery | Surf & Retreat Hostel Weligama',
    'Rooms, waves, workspaces and family dinners — see what a week at Surf & Retreat Hostel Weligama actually looks like.'
  );
  const { openBooking } = useModals();

  return (
    <>
      <PageHeader>
        <PageHero
          eyebrow="Gallery"
          eyebrowIcon={Camera}
          title={
            <>
              See It Before
              <br />
              You <span className="text-[#2C573A]">Sleep</span> In It.
            </>
          }
          subtitle="The dorms, the bay, the desks and the dinner table — a look around the hostel and the corner of Sri Lanka we call home."
        >
          <Button variant="primary" onClick={() => openBooking()}>
            <span>Book Your Stay</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </PageHero>
      </PageHeader>

      <GalleryGrid />
    </>
  );
}
