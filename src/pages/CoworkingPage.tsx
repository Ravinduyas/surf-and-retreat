import React from 'react';
import { ArrowRight, Laptop } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { PageHero } from '../components/layout/PageHero';
import { AmenitiesGrid } from '../components/coworking/AmenitiesGrid';
import { PlansPricing } from '../components/coworking/PlansPricing';
import { ColivingCard } from '../components/rooms/ColivingCard';
import { Button } from '../components/ui/Button';
import { QuickAnswer } from '../components/ui/QuickAnswer';
import { Reveal } from '../components/ui/Reveal';
import { usePageMeta } from '../hooks/usePageMeta';
import { COWORKING_PLANS, FAQS, GALLERY_IMAGES } from '../data';

export default function CoworkingPage() {
  usePageMeta();
  const hours = FAQS.find((f) => f.id === 'faq-hours');
  const wifi = FAQS.find((f) => f.id === 'faq-wifi');
  const workspace = GALLERY_IMAGES.find((g) => g.category === 'coworking');

  return (
    <>
      <PageHeader>
        <PageHero
          eyebrow="Coworking & Coliving"
          eyebrowIcon={Laptop}
          title={
            <>
              Coworking Hostel
              <br />
              with <span className="text-[#2C573A]">300 Mbps Fiber.</span>
            </>
          }
          subtitle="Desks, call booths and an AC focus room in a Sri Lanka surf hostel — book a day, a week or a month, and surf before work."
          image={workspace?.src}
          imageAlt={workspace?.alt}
        >
          <Button variant="primary" book="coworking">
            <span>Get a Desk Pass</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" to="/rooms">
            See rooms
          </Button>
        </PageHero>
      </PageHeader>

      <QuickAnswer question="How much is a coworking pass in Weligama, Sri Lanka?">
        <p>{COWORKING_PLANS.map((plan) => `${plan.name}: ${plan.price} ${plan.period}`).join('. ')}.</p>
        {hours && <p>{hours.answer}</p>}
        {wifi && <p>{wifi.answer}</p>}
      </QuickAnswer>

      <AmenitiesGrid />
      <PlansPricing />
      <Reveal>
        <ColivingCard />
      </Reveal>
    </>
  );
}
