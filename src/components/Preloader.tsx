import React, { useEffect, useState } from 'react';

/**
 * Branded first-load overlay: a wave line draws itself while bobbing,
 * the wordmark surfaces beneath it, then the whole thing fades away.
 * Hidden entirely for prefers-reduced-motion (see index.css).
 */
export const Preloader: React.FC = () => {
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  /**
   * Leave as soon as the page is actually ready — a fixed timer made the
   * hero look slow to load. A short floor stops it flashing on fast loads,
   * a ceiling stops a stalled asset holding the page hostage.
   */
  useEffect(() => {
    const MIN = 350;
    const MAX = 1200;
    const mountedAt = performance.now();
    let fade: number;
    let remove: number;

    const dismiss = () => {
      const waited = performance.now() - mountedAt;
      fade = window.setTimeout(() => {
        setLeaving(true);
        remove = window.setTimeout(() => setGone(true), 320);
      }, Math.max(0, MIN - waited));
    };

    if (document.readyState === 'complete') {
      dismiss();
    } else {
      window.addEventListener('load', dismiss, { once: true });
    }
    const cap = window.setTimeout(dismiss, MAX);

    return () => {
      window.removeEventListener('load', dismiss);
      clearTimeout(cap);
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
