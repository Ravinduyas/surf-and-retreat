import React from 'react';
import { Camera, ArrowRight } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { PageHero } from '../components/layout/PageHero';
import { GalleryGrid } from '../components/gallery/GalleryGrid';
import { CardShuffle } from '../components/gallery/CardShuffle';
import { Button } from '../components/ui/Button';
import { QuickAnswer } from '../components/ui/QuickAnswer';
import { usePageMeta } from '../hooks/usePageMeta';
import { GALLERY_IMAGES } from '../data';

export default function GalleryPage() {
  usePageMeta();
  const categories = [...new Set(GALLERY_IMAGES.map((image) => image.category))];

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
          media={<CardShuffle />}
        >
          <Button variant="primary" book>
            <span>Book Your Stay</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </PageHero>
      </PageHeader>

      <QuickAnswer question="What does Surf & Retreat Hostel Weligama look like?">
        <p>
          The gallery has {GALLERY_IMAGES.length} photos across {categories.length} areas of the hostel: {categories.join(', ')}.
          You will find, among others: {GALLERY_IMAGES.slice(0, 5).map((image) => image.alt.toLowerCase()).join('; ')}.
        </p>
      </QuickAnswer>

      <GalleryGrid />
    </>
  );
}
