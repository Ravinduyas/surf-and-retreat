import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Logo } from './ui/Logo';
import { useModals } from '../context/ModalContext';

const NAV_LINKS = [
  { name: 'Home', to: '/' },
  { name: 'Rooms & Stay', to: '/rooms' },
  { name: 'Surf', to: '/surf' },
  { name: 'Coworking', to: '/coworking' },
  { name: 'About', to: '/about' },
  { name: 'Contact', to: '/contact' },
];

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { openBooking } = useModals();

  return (
    <header className="relative z-30 w-full pt-4 pb-4 px-4 sm:px-8">
      <div className="flex items-center justify-between">
        <Logo />

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 lg:gap-9" aria-label="Main Navigation">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.name}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                `text-[14px] font-medium transition-colors cursor-pointer focus:outline-hidden ${
                  isActive
                    ? 'text-[#192B1E] font-semibold'
                    : 'text-[#4A594E] hover:text-[#192B1E]'
                }`
              }
            >
              {link.name}
            </NavLink>
          ))}
        </nav>

        {/* Right CTA Button */}
        <div className="hidden sm:flex items-center">
          <button
            id="nav-book-btn"
            onClick={() => openBooking()}
            className="bg-[#D8E95E] hover:bg-[#CFE24D] active:scale-98 transition-all duration-200 text-[#193B26] text-[14px] font-semibold px-6 py-2.5 rounded-full shadow-xs cursor-pointer focus:outline-hidden"
          >
            Book Your Stay
          </button>
        </div>

        {/* Mobile Hamburger Toggle */}
        <div className="flex md:hidden items-center gap-2">
          <button
            id="nav-book-mobile-btn"
            onClick={() => openBooking()}
            className="bg-[#D8E95E] text-[#193B26] text-[12px] font-semibold px-3.5 py-1.5 rounded-full"
          >
            Book
          </button>
          <button
            id="mobile-menu-toggle-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-[#24422E] hover:bg-[#EDF2EB] rounded-full transition-colors focus:outline-hidden"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-3 p-5 bg-white/95 backdrop-blur-md rounded-2xl border border-[#E1E7DE] shadow-lg flex flex-col gap-4 modal-fade">
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
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              openBooking();
            }}
            className="w-full bg-[#D8E95E] text-[#193B26] text-center font-semibold py-2.5 rounded-full mt-2"
          >
            Book Your Stay
          </button>
        </div>
      )}
    </header>
  );
};
