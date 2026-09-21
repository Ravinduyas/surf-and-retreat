import React from 'react';
import { ArrowRight, BedDouble } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { PageHero } from '../components/layout/PageHero';
import { RoomsGrid } from '../components/rooms/RoomsGrid';
import { Button } from '../components/ui/Button';
import { QuickAnswer } from '../components/ui/QuickAnswer';
import { usePageMeta } from '../hooks/usePageMeta';
import { FAQS, ROOMS } from '../data';

export default function RoomsPage() {
  usePageMeta();
  const checkIn = FAQS.find((f) => f.id === 'faq-checkin');
  const family = FAQS.find((f) => f.id === 'faq-private');

  return (
    <>
      <PageHeader>
        <PageHero
          eyebrow="Rooms & Stay"
          eyebrowIcon={BedDouble}
          title={
            <>
              Surf Hostel Rooms
              <br />
              in <span className="text-[#2C573A]">Weligama.</span>
            </>
          }
          subtitle="Curtain-pod dorms and private rooms with lockers, hot showers and air-con — a five-minute walk from Weligama Bay."
          image={ROOMS[0].image}
          imageAlt="The 8-bed surfer dorm with curtain-pod bunks"
        >
          <Button variant="primary" book="stay">
            <span>Check Availability</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" to="/coworking-coliving">
            Staying a month? See coliving
          </Button>
        </PageHero>
      </PageHeader>

      <QuickAnswer question="How much is a bed at Surf & Retreat Hostel Weligama?">
        <p>{ROOMS.map((room) => `${room.title}: ${room.price} (${room.capacity})`).join('. ')}.</p>
        {checkIn && <p>{checkIn.answer}</p>}
      </QuickAnswer>

      <RoomsGrid />

      {family && (
        <QuickAnswer question={family.question}>
          <p>{family.answer}</p>
        </QuickAnswer>
      )}
    </>
  );
}
