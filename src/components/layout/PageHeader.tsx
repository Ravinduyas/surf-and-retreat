import React from 'react';
import { Navbar } from '../Navbar';

interface PageHeaderProps {
  children: React.ReactNode;
}

/**
 * The signature white hero card that encloses the Navbar plus a hero area,
 * used at the top of every page.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({ children }) => (
  // No overflow-hidden here: it would trap the sticky navbar inside the card.
  // Anything that bleeds to the card edge rounds its own corners instead.
  <div className="bg-white rounded-[32px] sm:rounded-[40px] border border-[#DADB54] shadow-xs">
    <Navbar />
    {children}
  </div>
);
