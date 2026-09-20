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
  <div className="bg-white rounded-[32px] sm:rounded-[40px] border border-[#DADB54] shadow-xs overflow-hidden">
    <Navbar />
    {children}
  </div>
);
