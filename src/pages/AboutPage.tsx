import React from 'react';
import { Heart, ArrowRight } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { PageHero } from '../components/layout/PageHero';
import { StorySection } from '../components/about/StorySection';
import { ValuesGrid } from '../components/about/ValuesGrid';
import { TestimonialsSection } from '../components/about/TestimonialsSection';
import { TrustedBySection } from '../components/TrustedBySection';
import { Button } from '../components/ui/Button';
import { Reveal } from '../components/ui/Reveal';
import { usePageMeta } from '../hooks/usePageMeta';
import { ABOUT_IMAGES } from '../data';

export default function AboutPage() {
  usePageMeta();

  return (
    <>
      <PageHeader>
        <PageHero
          eyebrow="Our Story"
          eyebrowIcon={Heart}
          title={
            <>
              A Home for Surfers
              <br />
              &amp; <span className="text-[#2C573A]">Remote Workers.</span>
            </>
          }
          subtitle="What started as three friends renting out spare beds after surf trips is now Weligama's favourite base for travellers who want to surf hard and work well."
          image={ABOUT_IMAGES.story}
          imageAlt="Stilt fishermen on the Sri Lankan coast at sunset"
        >
          <Button variant="primary" to="/contact">
            <span>Come Say Hello</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </PageHero>
      </PageHeader>

      <Reveal>
        <StorySection />
      </Reveal>
      <ValuesGrid />
      <TestimonialsSection />
      <Reveal>
        <TrustedBySection />
      </Reveal>
    </>
  );
}
