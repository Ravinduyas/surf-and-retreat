import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '../components/ui/Logo';
import { BookingFlow } from '../components/booking/BookingFlow';
import { usePageMeta } from '../hooks/usePageMeta';
import { BookingTab } from '../types';

const TABS: BookingTab[] = ['stay', 'surf', 'coworking'];

/**
 * The booking page, opened in a new browser tab from the "Book" links. It shows only the booking form:
 * a slim bar with the logo and a way back, then the steps, with no site menu, hero or footer.
 */
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
    <div className="min-h-dvh bg-[#F6F7F4] text-[#1E2721] antialiased">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-[#E4EAE0]">
        <div className="max-w-7xl mx-auto h-12 sm:h-13 px-4 sm:px-8 flex items-center justify-between gap-3">
          <Logo />
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs sm:text-[13px] font-semibold text-[#2A4E38] hover:underline py-1.5">
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Back to website
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-3 sm:pt-4 pb-6">
        <h1 className="sr-only">Book your stay</h1>
        <div className="min-h-[480px]">
          {mounted && <BookingFlow initialTab={tab ?? 'stay'} initialItemId={itemId} />}
        </div>
      </main>
    </div>
  );
}
