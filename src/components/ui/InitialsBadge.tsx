import React from 'react';

/** "Jonas W." -> "JW", "Priya S." -> "PS" */
const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

/**
 * Stands in for a guest photo. We don't use stock portraits of people who
 * never stayed here, so reviewers are shown by their initials instead.
 */
export const InitialsBadge: React.FC<{ name: string }> = ({ name }) => (
  <span
    aria-hidden="true"
    className="w-9 h-9 shrink-0 rounded-full bg-[#DEEBDB] text-[#2E583A] text-[12px] font-bold tracking-tight flex items-center justify-center ring-2 ring-white shadow-xs"
  >
    {initialsOf(name)}
  </span>
);
