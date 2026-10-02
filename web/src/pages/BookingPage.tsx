import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookingFlow } from '../components/booking/BookingFlow';
import { BookingTopBar } from '../components/booking/BookingTopBar';
import { usePageMeta } from '../hooks/usePageMeta';
import { BookingTab } from '../types';

const TABS: BookingTab[] = ['stay', 'surf', 'coworking'];

/** Standalone booking flow, opened in a new browser tab from the "Book" links. */
export default function BookingPage() {
  usePageMeta();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  // The flow's starting point comes from the query string, which the prerendered HTML can't know,
  // so it only renders on the client. That keeps hydration consistent.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const tabParam = params.get('tab') as BookingTab | null;
  const tab = tabParam && TABS.includes(tabParam) ? tabParam : undefined;
  const itemId = params.get('item') ?? undefined;

  const handleClose = () => {
    window.close();
    // window.close() does nothing when the tab wasn't opened from the site (e.g. a direct visit).
    navigate('/', { replace: true });
  };

  return (
    <div className="h-dvh flex flex-col bg-[#F6F7F4]">
      {/* The flow brings its own top bar with the step title; this one only shows until it mounts. */}
      {mounted ? (
        <BookingFlow initialTab={tab ?? 'stay'} initialItemId={itemId} onClose={handleClose} />
      ) : (
        <BookingTopBar />
      )}
    </div>
  );
}
