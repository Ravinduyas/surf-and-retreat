import React from 'react';

/** Shown on the add-ons screen when the guest has no bed and nothing else booked yet, so skipping isn't an option. */
export const ExtraRequiredNote: React.FC = () => (
  <p className="text-xs font-medium text-[#A0522D]" role="note">
    You chose no bed, so tick at least one add-on to have something to book.
  </p>
);
