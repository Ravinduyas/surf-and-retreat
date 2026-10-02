import React from 'react';
import { ArrowRight, Waves } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { PageHero } from '../components/layout/PageHero';
import { SurfPackages } from '../components/surf/SurfPackages';
import { SurfSpots } from '../components/surf/SurfSpots';
import { Button } from '../components/ui/Button';
import { QuickAnswer } from '../components/ui/QuickAnswer';
import { usePageMeta } from '../hooks/usePageMeta';
import { FAQS, SURF_PACKAGES } from '../data';

export default function SurfCampPage() {
  usePageMeta();
  const season = FAQS.find((f) => f.id === 'faq-season');

  return (
    <>
      <PageHeader>
        <PageHero
          eyebrow="Surf School"
          eyebrowIcon={Waves}
          title={
            <>
              Surf Camp &amp; Lessons
              <br />
              on <span className="text-[#2C573A]">Weligama Bay.</span>
            </>
          }
          subtitle="Weekly beginner and intermediate packages, video coaching and board rental — with the bay a five-minute walk from your bed."
          image={SURF_PACKAGES[0].image}
          imageAlt="Walking into the water at Weligama Bay with a surfboard"
        >
          <Button variant="primary" book="surf">
            <span>Book a Surf Package</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" to="/rooms">
            Add a bed to your week
          </Button>
        </PageHero>
      </PageHeader>

      <QuickAnswer question="How much are surf lessons and packages in Weligama?">
        <p>{SURF_PACKAGES.map((pkg) => `${pkg.title} is ${pkg.price} (${pkg.includes[0]})`).join('. ')}.</p>
        {season && (
          <p>
            <strong className="text-[#18261E]">{season.question}</strong> {season.answer}
          </p>
        )}
      </QuickAnswer>

      <SurfPackages />
      <SurfSpots />
    </>
  );
}
