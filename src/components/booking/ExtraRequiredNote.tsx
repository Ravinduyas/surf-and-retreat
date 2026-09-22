import React from 'react';

/** Shown on an extras screen when the guest has no bed and nothing else booked yet, so skipping isn't an option. */
export const ExtraRequiredNote: React.FC = () => (
  <p className="text-xs font-medium text-[#A0522D]" role="note">
    You chose no bed, so pick at least a desk pass or surf lessons to have something to book.
  </p>
);
