import React, { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Logo } from './ui/Logo';
import { BookLink } from './ui/BookLink';

export const NAV_LINKS = [
  { name: 'Home', to: '/' },
  { name: 'Stay, Surf & Work', to: '/experience' },
  { name: 'Services', to: '/services' },
  { name: 'Gallery', to: '/gallery' },
  { name: 'About', to: '/about' },
  { name: 'Contact', to: '/contact' },
];

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stuck, setStuck] = useState(false);
  const [navHeight, setNavHeight] = useState(0);
  const headerRef = useRef<HTMLElement>(null);

  /*
   * It starts inside the hero card, then detaches and rides along the whole
   * page. `position: sticky` can't do that — it would stop at the card's
   * bottom edge — so past a small threshold it becomes fixed, with a spacer
   * holding its place so nothing jumps.
   */
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const scrolled = window.scrollY;
      if (scrolled <= 28) setNavHeight(el.offsetHeight);
      setStuck(scrolled > 28);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      {stuck && <div style={{ height: navHeight }} aria-hidden="true" />}
      <header
        id="site-navbar"
        ref={headerRef}
        className={`z-40 w-full transition-[background-color,box-shadow,padding] duration-300 ${
          stuck ? 'py-2' : 'pt-4 pb-4'
        } ${
          stuck
            ? 'fixed top-0 inset-x-0 bg-white/85 backdrop-blur-md shadow-sm'
            : 'relative px-4 sm:px-8 rounded-t-[32px] sm:rounded-t-[40px]'
        }`}
      >
        {/* While fixed, match the hero card's inner edges (page + card padding) */}
        <div className={stuck ? 'max-w-[1280px] mx-auto px-7 sm:px-14 lg:px-16' : ''}>
      <div className="flex items-center justify-between">
        <Logo />

        {/* Desktop Navigation Links */}
        {/* Solid pill keeps the links legible when the home hero photo runs underneath */}
        <nav
          className={`hidden lg:flex items-center gap-0.5 bg-white rounded-full border border-[#E3E8DE] shadow-sm ${stuck ? 'p-1' : 'p-1.5'}`}
          aria-label="Main Navigation"
        >
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.name}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                `font-medium rounded-full whitespace-nowrap transition-colors cursor-pointer focus:outline-hidden ${
                  stuck ? 'text-[13px] px-3 xl:px-3.5 py-1.5' : 'text-[14px] px-3.5 xl:px-4 py-2'
                } ${
                  isActive
                    ? 'bg-[#1B3223] text-white font-semibold'
                    : 'text-[#3E4F43] hover:text-[#192B1E] hover:bg-[#F1F5EF]'
                }`
              }
            >
              {link.name}
            </NavLink>
          ))}
        </nav>

        {/* Right CTA Button */}
        <div className="hidden lg:flex items-center shrink-0">
          <BookLink
            id="nav-book-btn"
            className={`bg-[#D8E95E] hover:bg-[#CFE24D] active:scale-98 transition-all duration-200 text-[#193B26] font-semibold rounded-full shadow-xs cursor-pointer focus:outline-hidden ${stuck ? 'text-[13px] px-5 py-2' : 'text-[14px] px-6 py-2.5'}`}
          >
            Book Your Stay
          </BookLink>
        </div>

        {/* Mobile Hamburger Toggle */}
        <div className="flex lg:hidden items-center gap-2">
          <BookLink
            id="nav-book-mobile-btn"
            className={`bg-[#D8E95E] hover:bg-[#CFE24D] active:scale-98 transition-all text-[#193B26] text-[13px] font-semibold rounded-full shadow-xs cursor-pointer ${stuck ? 'px-5 py-2.5' : 'px-5 py-3'}`}
          >
            Book
          </BookLink>
          <button
            id="mobile-menu-toggle-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`flex items-center justify-center text-[#24422E] hover:bg-[#EDF2EB] rounded-full transition-colors focus:outline-hidden ${stuck ? 'w-10 h-10' : 'w-11 h-11'}`}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden mt-3 p-5 bg-white/95 backdrop-blur-md rounded-2xl border border-[#E1E7DE] shadow-lg flex flex-col gap-4 modal-fade">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.name}
              to={link.to}
              end={link.to === '/'}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `text-left text-[15px] font-medium py-1.5 border-b border-gray-100 last:border-0 ${
                  isActive ? 'text-[#193B26] font-semibold' : 'text-[#293B2F] hover:text-[#193B26]'
                }`
              }
            >
              {link.name}
            </NavLink>
          ))}
          <BookLink
            className="w-full bg-[#D8E95E] text-[#193B26] text-center font-semibold py-3 rounded-full mt-2"
          >
            Book Your Stay
          </BookLink>
        </div>
      )}
        </div>
      </header>
    </>
  );
};
