import React, { useEffect, useState } from 'react';

/**
 * Branded first-load overlay: a wave line draws itself while bobbing,
 * the wordmark surfaces beneath it, then the whole thing fades away.
 * Hidden entirely for prefers-reduced-motion (see index.css).
 */
export const Preloader: React.FC = () => {
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const fade = setTimeout(() => setLeaving(true), 1400);
    const remove = setTimeout(() => setGone(true), 2000);
    return () => {
      clearTimeout(fade);
      clearTimeout(remove);
    };
  }, []);

  if (gone) return null;

  return (
    <div className={`preloader ${leaving ? 'preloader-out' : ''}`} aria-hidden="true">
      <svg
        className="preloader-wave"
        width="120"
        height="34"
        viewBox="0 0 120 34"
        fill="none"
      >
        <path
          d="M4 17 Q14 5 24 17 T44 17 T64 17 T84 17 T104 17 T116 17"
          stroke="#2C573A"
          strokeWidth="3"
          strokeLinecap="round"
          pathLength={100}
        />
      </svg>
      <span className="preloader-word text-[15px] font-bold text-[#18261E] tracking-tight">
        Surf &amp; Retreat
      </span>
    </div>
  );
};
