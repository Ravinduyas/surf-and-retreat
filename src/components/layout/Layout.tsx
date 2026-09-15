import React, { useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { ScrollToTop } from './ScrollToTop';
import { Preloader } from '../Preloader';
import { Footer } from '../Footer';
import { VideoModal } from '../VideoModal';
import { BookingModal } from '../BookingModal';
import { DetailModal } from '../DetailModal';
import { ModalContext, ModalContextValue } from '../../context/ModalContext';
import { BookingTab, DetailItem } from '../../types';

export const Layout: React.FC = () => {
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [bookingTab, setBookingTab] = useState<BookingTab | null>(null);
  const [detail, setDetail] = useState<{ item: DetailItem; bookingTab: BookingTab } | null>(null);

  const modals = useMemo<ModalContextValue>(
    () => ({
      openBooking: (tab: BookingTab = 'stay') => setBookingTab(tab),
      openVideo: () => setIsVideoOpen(true),
      openDetail: (item: DetailItem, tab: BookingTab = 'stay') =>
        setDetail({ item, bookingTab: tab }),
    }),
    []
  );

  return (
    <ModalContext.Provider value={modals}>
      <div className="min-h-screen bg-[#F6F7F4] text-[#1E2721] antialiased">
        <Preloader />
        <ScrollToTop />
        <main className="max-w-[1280px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          <Outlet />
          <Footer />
        </main>

        {isVideoOpen && <VideoModal onClose={() => setIsVideoOpen(false)} />}

        {bookingTab !== null && (
          <BookingModal initialTab={bookingTab} onClose={() => setBookingTab(null)} />
        )}

        {detail !== null && (
          <DetailModal
            item={detail.item}
            onClose={() => setDetail(null)}
            onBook={() => {
              const tab = detail.bookingTab;
              setDetail(null);
              setBookingTab(tab);
            }}
          />
        )}
      </div>
    </ModalContext.Provider>
  );
};
