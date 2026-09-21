import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { BookingModal } from '../components/booking/BookingModal';
import { Logo } from '../components/ui/Logo';
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
      <header className="shrink-0 h-14 px-4 sm:px-8 flex items-center justify-between gap-4">
        <Logo />
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs sm:text-[13px] font-semibold text-[#2A4E38] hover:underline py-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to website</span>
        </Link>
      </header>

      {mounted && (
        <BookingModal initialTab={tab ?? 'stay'} initialItemId={itemId} onClose={handleClose} />
      )}
    </div>
  );
}
