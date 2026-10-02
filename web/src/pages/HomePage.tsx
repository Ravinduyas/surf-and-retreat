import React from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { HomeHero } from '../components/home/HomeHero';
import { HighlightsSection } from '../components/home/HighlightsSection';
import { TrustedBySection } from '../components/TrustedBySection';
import { ReviewsSection } from '../components/home/ReviewsSection';
import { ExploreSection } from '../components/home/ExploreSection';
import { GallerySection } from '../components/home/GallerySection';
import { ServicesGrid } from '../components/services/ServicesGrid';
import { Reveal } from '../components/ui/Reveal';
import { usePageMeta } from '../hooks/usePageMeta';

export default function HomePage() {
  usePageMeta();

  return (
    <>
      <PageHeader>
        <HomeHero />
      </PageHeader>
      <HighlightsSection />
      <Reveal>
        <TrustedBySection />
      </Reveal>
      <Reveal>
        <ExploreSection />
      </Reveal>
      <ServicesGrid showCta />
      <GallerySection />
      <ReviewsSection />
    </>
  );
}
