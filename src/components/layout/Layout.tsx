import React, { useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { ScrollToTop } from './ScrollToTop';
import { Preloader } from '../Preloader';
import { Footer } from '../Footer';
import { VideoModal } from '../VideoModal';
import { ModalContext, ModalContextValue } from '../../context/ModalContext';

export const Layout: React.FC = () => {
  const [isVideoOpen, setIsVideoOpen] = useState(false);

  const modals = useMemo<ModalContextValue>(
    () => ({
      openVideo: () => setIsVideoOpen(true),
    }),
    []
  );

  return (
    <ModalContext.Provider value={modals}>
      <div className="min-h-screen flex flex-col bg-[#F6F7F4] text-[#1E2721] antialiased">
        <Preloader />
        <ScrollToTop />
        <main className="w-full max-w-[1280px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 flex-1">
          <Outlet />
        </main>
        <Footer />

        {isVideoOpen && <VideoModal onClose={() => setIsVideoOpen(false)} />}

      </div>
    </ModalContext.Provider>
  );
};
