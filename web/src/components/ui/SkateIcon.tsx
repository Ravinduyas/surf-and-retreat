import React from 'react';

/** Lucide has no skateboard, so this is drawn to match its stroke style. */
export const SkateIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M2.8 10.9c1-2.1 2.6-1.4 4.2-1.4h10c1.6 0 3.2-.7 4.2 1.4" />
    <path d="M7.8 12.4v1.4M16.2 12.4v1.4" />
    <circle cx="7.8" cy="15.6" r="1.6" />
    <circle cx="16.2" cy="15.6" r="1.6" />
  </svg>
);
