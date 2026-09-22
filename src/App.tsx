import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import HomePage from './pages/HomePage';
import { normalizePath } from './seo';

// Everything but the home page is split into its own chunk. Each route is still prerendered to
// static HTML at build time, so lazy loading only affects the client-side JavaScript download.
const PAGES = {
  '/experience': () => import('./pages/ExperiencePage'),
  '/rooms': () => import('./pages/RoomsPage'),
  '/surf-camp': () => import('./pages/SurfCampPage'),
  '/coworking-coliving': () => import('./pages/CoworkingPage'),
  '/services': () => import('./pages/ServicesPage'),
  '/gallery': () => import('./pages/GalleryPage'),
  '/about': () => import('./pages/AboutPage'),
  '/contact': () => import('./pages/ContactPage'),
  '/book': () => import('./pages/BookingPage'),
  '/detail': () => import('./pages/DetailPage'),
  '*': () => import('./pages/NotFoundPage'),
};

/** Loads the chunk for a path so hydration finds it ready instead of suspending on it. */
export const preloadRoute = (pathname: string) => {
  const path = normalizePath(pathname);
  if (path === '/') return Promise.resolve();
  const key = /^\/(rooms|surf-camp)\/[^/]+$/.test(path) ? '/detail' : path;
  return (PAGES[key as keyof typeof PAGES] ?? PAGES['*'])();
};

const ExperiencePage = lazy(PAGES['/experience']);
const RoomsPage = lazy(PAGES['/rooms']);
const SurfCampPage = lazy(PAGES['/surf-camp']);
const CoworkingPage = lazy(PAGES['/coworking-coliving']);
const ServicesPage = lazy(PAGES['/services']);
const GalleryPage = lazy(PAGES['/gallery']);
const AboutPage = lazy(PAGES['/about']);
const ContactPage = lazy(PAGES['/contact']);
const NotFoundPage = lazy(PAGES['*']);
const BookingPage = lazy(PAGES['/book']);
const DetailPage = lazy(PAGES['/detail']);

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="book" element={<BookingPage />} />
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="experience" element={<ExperiencePage />} />
          <Route path="rooms" element={<RoomsPage />} />
          <Route path="rooms/:id" element={<DetailPage kind="room" />} />
          <Route path="surf-camp" element={<SurfCampPage />} />
          <Route path="surf-camp/:id" element={<DetailPage kind="surf" />} />
          <Route path="coworking-coliving" element={<CoworkingPage />} />
          {/* Old anchor-era URLs */}
          <Route path="surf" element={<Navigate to="/surf-camp" replace />} />
          <Route path="coworking" element={<Navigate to="/coworking-coliving" replace />} />
          <Route path="services" element={<ServicesPage />} />
          <Route path="gallery" element={<GalleryPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
