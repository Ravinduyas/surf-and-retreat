import React from 'react';
import { Sparkles, Play, ArrowRight } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { PageHero } from '../components/layout/PageHero';
import { HighlightsSection } from '../components/home/HighlightsSection';
import { Button } from '../components/ui/Button';
import { QuickAnswer } from '../components/ui/QuickAnswer';
import { usePageMeta } from '../hooks/usePageMeta';
import { useModals } from '../context/ModalContext';
import { COWORKING_PLANS, ROOMS, SURF_PACKAGES } from '../data';
import { Link } from 'react-router-dom';

export default function ExperiencePage() {
  usePageMeta();
  const { openVideo } = useModals();

  return (
    <>
      <PageHeader>
        <PageHero
          eyebrow="Stay · Surf · Work"
          eyebrowIcon={Sparkles}
          title={
            <>
              Sleep, Surf &amp; Work —
              <br />
              All Under <span className="text-[#2C573A]">One Roof.</span>
            </>
          }
          subtitle="Curtain-pod dorms and private rooms, morning surf lessons on Weligama Bay and a real workspace with 300 Mbps fiber — one booking covers it all."
          image={ROOMS[0].image}
          imageAlt="Hostel dorm room with bunk beds"
        >
          <Button variant="primary" book>
            <span>Check Availability</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={openVideo}>
            <Play className="w-4 h-4" />
            <span>Watch the Surf</span>
          </Button>
        </PageHero>
      </PageHeader>

      <HighlightsSection />

      <QuickAnswer question="What can I book at Surf & Retreat Hostel Weligama?">
        <p>
          <Link to="/rooms" className="font-semibold text-[#2A4E38] underline underline-offset-2">
            Rooms
          </Link>
          : dorm beds and private rooms, {ROOMS[0].price} to {ROOMS[ROOMS.length - 1].price}.{' '}
          <Link to="/surf-camp" className="font-semibold text-[#2A4E38] underline underline-offset-2">
            Surf camp
          </Link>
          : lessons and coaching from {SURF_PACKAGES[0].price}, plus board rental.{' '}
          <Link to="/coworking-coliving" className="font-semibold text-[#2A4E38] underline underline-offset-2">
            Coworking &amp; coliving
          </Link>
          : desk passes from {COWORKING_PLANS[0].price} {COWORKING_PLANS[0].period}, and a bed-plus-desk coliving bundle for
          longer stays. All three are a five-minute walk from Weligama Bay, and you can combine them in one booking.
        </p>
      </QuickAnswer>
    </>
  );
}
