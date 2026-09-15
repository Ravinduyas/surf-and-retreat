import React from 'react';
import { Link } from 'react-router-dom';
import {
  Twitter,
  Instagram,
  Facebook,
  Linkedin,
  ArrowRight,
  ArrowUp,
  MapPin,
  Mail,
  Phone,
} from 'lucide-react';
import { Logo } from './ui/Logo';
import { Reveal } from './ui/Reveal';
import { useModals } from '../context/ModalContext';
import { BookingTab } from '../types';

export const Footer: React.FC = () => {
  const { openBooking } = useModals();

  const exploreLinks = [
    { name: 'Rooms & Stay', to: '/experience#rooms' },
    { name: 'Surf', to: '/experience#surf' },
    { name: 'Coworking', to: '/experience#coworking' },
    { name: 'Services', to: '/services' },
    { name: 'Gallery', to: '/gallery' },
    { name: 'About Us', to: '/about' },
  ];

  const bookLinks: { name: string; tab: BookingTab }[] = [
    { name: 'Book a Bed', tab: 'stay' },
    { name: 'Surf Packages', tab: 'surf' },
    { name: 'Desk Pass', tab: 'coworking' },
  ];

  const supportLinks = [
    { name: 'FAQs', to: '/contact' },
    { name: 'Contact Us', to: '/contact' },
    { name: 'How to Get Here', to: '/contact' },
  ];

  const socialLinks = [
    { name: 'Twitter', icon: Twitter, href: 'https://twitter.com' },
    { name: 'Instagram', icon: Instagram, href: 'https://instagram.com' },
    { name: 'Facebook', icon: Facebook, href: 'https://facebook.com' },
    { name: 'LinkedIn', icon: Linkedin, href: 'https://linkedin.com' },
  ];

  return (
    <footer className="mt-4 sm:mt-6">
      <Reveal>
        <div className="relative overflow-hidden bg-[#1B3223] shadow-md">
          {/* Decorative wave lines, top right */}
          <svg
            className="absolute -top-6 right-8 w-56 text-[#D8E95E]/12 pointer-events-none"
            viewBox="0 0 220 80"
            fill="none"
            aria-hidden="true"
          >
            {[0, 22, 44].map((y) => (
              <path
                key={y}
                d={`M0 ${20 + y} Q 27 ${4 + y} 55 ${20 + y} T 110 ${20 + y} T 165 ${20 + y} T 220 ${20 + y}`}
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            ))}
          </svg>

          {/* Giant watermark wordmark, clipped at the bottom */}
          <div
            className="absolute -bottom-7 left-0 right-0 text-center font-bold tracking-tight text-white/[0.04] text-[17vw] sm:text-[11vw] leading-none whitespace-nowrap select-none pointer-events-none"
            aria-hidden="true"
          >
            Surf &amp; Retreat
          </div>

          <div className="relative max-w-[1280px] mx-auto px-6 sm:px-10 lg:px-14 pt-10 sm:pt-14 pb-8">
            {/* Closing CTA */}
            <div className="flex flex-wrap items-end justify-between gap-6 pb-10 sm:pb-12 border-b border-white/10">
              <div className="space-y-3 max-w-xl">
                <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-bold text-[#F4F7F2] tracking-tight leading-[1.1]">
                  The Waves Are Warm.
                  <br />
                  Your <span className="text-[#D8E95E]">Bed Is Ready.</span>
                </h2>
                <p className="text-[#A8BCA9] text-sm sm:text-base leading-relaxed">
                  Dorms from $12 a night, lessons at sunrise, wifi that never drops.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  id="footer-book-btn"
                  onClick={() => openBooking()}
                  className="bg-[#D8E95E] hover:bg-[#CFE24D] active:scale-98 transition-all duration-200 text-[#193B26] text-[14px] font-semibold px-7 py-3 rounded-full shadow-xs cursor-pointer inline-flex items-center gap-2"
                >
                  <span>Book Your Stay</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <Link
                  to="/contact"
                  className="border border-white/25 hover:border-[#D8E95E]/70 hover:bg-white/5 text-[#E8EFE6] text-sm font-medium px-7 py-3 rounded-full inline-flex items-center gap-2 transition-all duration-200 cursor-pointer"
                >
                  Ask a Question
                </Link>
              </div>
            </div>

            {/* Link columns */}
            <div className="grid grid-cols-2 md:grid-cols-12 gap-8 lg:gap-10 py-10 sm:py-12">
              <div className="col-span-2 md:col-span-4 space-y-4">
                <Logo light />
                <p className="text-[13px] text-[#A8BCA9] max-w-xs leading-relaxed">
                  Surf at sunrise, work by the bay, and find your people — a coliving
                  &amp; coworking surf hostel five minutes from Weligama Bay, Sri Lanka.
                </p>
                <ul className="space-y-2 pt-1 text-[13px] text-[#C4D3C4]">
                  <li className="flex items-center gap-2.5">
                    <MapPin className="w-3.5 h-3.5 text-[#D8E95E] shrink-0" />
                    <span>New Matara Rd, Weligama, Sri Lanka</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Phone className="w-3.5 h-3.5 text-[#D8E95E] shrink-0" />
                    <span>+94 76 123 4567</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Mail className="w-3.5 h-3.5 text-[#D8E95E] shrink-0" />
                    <span>hello@surfandretreat.lk</span>
                  </li>
                </ul>
              </div>

              <div className="col-span-1 md:col-span-2 space-y-3">
                <h4 className="text-[12px] font-bold text-[#D8E95E] tracking-[0.14em] uppercase">
                  Explore
                </h4>
                <ul className="space-y-2.5">
                  {exploreLinks.map((link) => (
                    <li key={link.name}>
                      <Link
                        to={link.to}
                        className="text-[13px] text-[#C4D3C4] hover:text-white transition-colors cursor-pointer"
                      >
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="col-span-1 md:col-span-2 space-y-3">
                <h4 className="text-[12px] font-bold text-[#D8E95E] tracking-[0.14em] uppercase">
                  Book
                </h4>
                <ul className="space-y-2.5">
                  {bookLinks.map((link) => (
                    <li key={link.name}>
                      <button
                        onClick={() => openBooking(link.tab)}
                        className="text-[13px] text-[#C4D3C4] hover:text-white transition-colors cursor-pointer"
                      >
                        {link.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="col-span-1 md:col-span-2 space-y-3">
                <h4 className="text-[12px] font-bold text-[#D8E95E] tracking-[0.14em] uppercase">
                  Support
                </h4>
                <ul className="space-y-2.5">
                  {supportLinks.map((link) => (
                    <li key={link.name}>
                      <Link
                        to={link.to}
                        className="text-[13px] text-[#C4D3C4] hover:text-white transition-colors cursor-pointer"
                      >
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="col-span-1 md:col-span-2 space-y-3">
                <h4 className="text-[12px] font-bold text-[#D8E95E] tracking-[0.14em] uppercase">
                  Follow Us
                </h4>
                <div className="flex items-center gap-2 pt-0.5">
                  {socialLinks.map((social) => {
                    const Icon = social.icon;
                    return (
                      <a
                        key={social.name}
                        href={social.href}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={social.name}
                        className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center text-[#C4D3C4] hover:text-[#193B26] hover:bg-[#D8E95E] hover:border-[#D8E95E] transition-colors cursor-pointer"
                      >
                        <Icon className="w-4 h-4" />
                      </a>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-white/10">
              <p className="text-[12px] text-[#8CA18D]">
                &copy; 2026 Surf &amp; Retreat Hostel Weligama. All rights reserved.
              </p>
              <div className="flex items-center gap-4">
                <span className="text-[12px] text-[#8CA18D]">
                  Made with 🌊 in Weligama
                </span>
                <button
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  aria-label="Back to top"
                  className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center text-[#C4D3C4] hover:text-[#193B26] hover:bg-[#D8E95E] hover:border-[#D8E95E] transition-colors cursor-pointer"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </footer>
  );
};
