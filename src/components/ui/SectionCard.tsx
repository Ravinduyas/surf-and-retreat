import React from 'react';

interface SectionCardProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export const SectionCard: React.FC<SectionCardProps> = ({ children, className = '', id }) => (
  <div
    id={id}
    className={`bg-white rounded-[32px] sm:rounded-[36px] p-6 sm:p-10 shadow-xs ${className}`.trim()}
  >
    {children}
  </div>
);
