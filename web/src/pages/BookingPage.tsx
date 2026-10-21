import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarCheck } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { PageHero } from '../components/layout/PageHero';
import { BookingFlow } from '../components/booking/BookingFlow';
import { usePageMeta } from '../hooks/usePageMeta';
import { BookingTab } from '../types';

const TABS: BookingTab[] = ['stay', 'surf', 'coworking'];

/** The booking page, opened in a new browser tab from the "Book" links. */
export default function BookingPage() {
  usePageMeta();
  const [params] = useSearchParams();

  // The flow's starting point comes from the query string, which the prerendered HTML can't know,
  // so it only renders on the client. That keeps hydration consistent.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const tabParam = params.get('tab') as BookingTab | null;
  const tab = tabParam && TABS.includes(tabParam) ? tabParam : undefined;
  const itemId = params.get('item') ?? undefined;

  return (
    <>
      <PageHeader>
        <PageHero
          eyebrow="Booking"
          eyebrowIcon={CalendarCheck}
          title="Build your stay"
          subtitle="Pick a bed, add surf lessons or a desk, and see the price as you go. Nothing is charged here: you send us a quote and we come back within 24 hours to confirm."
          image={`${import.meta.env.BASE_URL}images/surf-walk-in.webp`}
          imageAlt="Guests walking into the surf at Weligama Bay"
        />
      </PageHeader>

      <section className="mt-6 sm:mt-10 min-h-[560px]">
        {mounted && <BookingFlow initialTab={tab ?? 'stay'} initialItemId={itemId} />}
      </section>
    </>
  );
}
