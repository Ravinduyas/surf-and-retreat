import React from 'react';
import { Link } from 'react-router-dom';
import { Twitter, Instagram, Facebook, Linkedin } from 'lucide-react';
import { Logo } from './ui/Logo';
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
    <footer className="pt-16 pb-12 px-4 sm:px-8 border-t border-[#E3E8DE] mt-12">
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-12 gap-8 lg:gap-10 pb-12">
        {/* Brand Column */}
        <div className="col-span-2 sm:col-span-2 md:col-span-4 space-y-3">
          <Logo />
          <p className="text-[13px] text-[#69796D] max-w-xs leading-relaxed">
            Surf at sunrise, work by the bay, and find your people — a coliving &amp;
            coworking surf hostel five minutes from Weligama Bay, Sri Lanka.
          </p>
        </div>

        {/* Column 1: Explore */}
        <div className="col-span-1 md:col-span-2 space-y-3">
          <h4 className="text-[13px] font-bold text-[#18271E] tracking-tight">Explore</h4>
          <ul className="space-y-2">
            {exploreLinks.map((link) => (
              <li key={link.name}>
                <Link
                  to={link.to}
                  className="text-[13px] text-[#5C6E61] hover:text-[#1F3D2A] transition-colors cursor-pointer"
                >
                  {link.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Column 2: Book */}
        <div className="col-span-1 md:col-span-2 space-y-3">
          <h4 className="text-[13px] font-bold text-[#18271E] tracking-tight">Book</h4>
          <ul className="space-y-2">
            {bookLinks.map((link) => (
              <li key={link.name}>
                <button
                  onClick={() => openBooking(link.tab)}
                  className="text-[13px] text-[#5C6E61] hover:text-[#1F3D2A] transition-colors cursor-pointer"
                >
                  {link.name}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Column 3: Support */}
        <div className="col-span-1 md:col-span-2 space-y-3">
          <h4 className="text-[13px] font-bold text-[#18271E] tracking-tight">Support</h4>
          <ul className="space-y-2">
            {supportLinks.map((link) => (
              <li key={link.name}>
                <Link
                  to={link.to}
                  className="text-[13px] text-[#5C6E61] hover:text-[#1F3D2A] transition-colors cursor-pointer"
                >
                  {link.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Column 4: Follow Us */}
        <div className="col-span-1 md:col-span-2 space-y-3">
          <h4 className="text-[13px] font-bold text-[#18271E] tracking-tight">Follow Us</h4>
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
                  className="w-8 h-8 rounded-full border border-[#D5DDD2] flex items-center justify-center text-[#55675A] hover:text-[#1C3B27] hover:border-[#1C3B27] hover:bg-[#F2F5F0] transition-colors cursor-pointer"
                >
                  <Icon className="w-4 h-4" />
                </a>
              );
            })}
          </div>
          <div className="pt-3">
            <p className="text-[12px] text-[#869588]">
              &copy; 2026 Surf &amp; Retreat Hostel Weligama. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};
