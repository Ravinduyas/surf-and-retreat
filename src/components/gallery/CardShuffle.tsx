import React, { useEffect, useRef, useState } from 'react';
import { GALLERY_IMAGES } from '../../data';
import { Photo } from '../ui/Photo';

/** Real hostel photos, alternating surf / rooms / food / place so the deck feels varied. */
const DECK_IDS = ['g28', 'g1', 'g11', 'g33', 'g23', 'g5', 'g32', 'g14', 'g9', 'g29', 'g26', 'g13', 'g6', 'g34', 'g19', 'g16'];
const DECK = DECK_IDS.map((id) => GALLERY_IMAGES.find((g) => g.id === id)).filter(
  (g): g is (typeof GALLERY_IMAGES)[number] => Boolean(g)
);

const VISIBLE = 3;
const INTERVAL_MS = 2200;
const FLICK_MS = 480;
const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

/**
 * Back cards peek out above and slightly right. They shrink rather than
 * shift, so the full-width front card never pushes the stack past its column.
 */
const depthStyle = (depth: number): React.CSSProperties => ({
  transform: `translate(${depth * 12}px, ${-depth * 16}px) rotate(${depth * 1.5}deg) scale(${1 - depth * 0.05})`,
  opacity: depth < VISIBLE ? 1 : 0,
  zIndex: 10 - depth,
});

const FLICKED: React.CSSProperties = {
  transform: 'translate(-60%, 28px) rotate(-9deg)',
  opacity: 0,
  zIndex: 11,
};

/**
 * A self-dealing stack of photo cards. The front card slides away on a timer;
 * hover or focus pauses it, and clicking deals the next card by hand.
 */
export const CardShuffle: React.FC = () => {
  const [order, setOrder] = useState(() => DECK.map((_, i) => i));
  const [flicking, setFlicking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const busy = useRef(false);

  const next = () => {
    if (busy.current) return;
    busy.current = true;
    setFlicking(true);
    window.setTimeout(() => {
      setOrder((o) => [...o.slice(1), o[0]]);
      setFlicking(false);
      busy.current = false;
    }, FLICK_MS);
  };

  // One timer per card, restarted after every deal.
  useEffect(() => {
    if (paused || reduced) return;
    const t = window.setTimeout(next, INTERVAL_MS);
    return () => window.clearTimeout(t);
  }, [order, paused, reduced]);

  const shown = order.slice(0, VISIBLE + 1);

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* The stack — cards fan out to the right, so inset them to stay in bounds */}
      <div
        className="relative h-[296px] sm:h-[376px] select-none cursor-pointer"
        aria-live="polite"
        role="button"
        tabIndex={0}
        aria-label="Show next photo"
        onClick={next}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            next();
          }
        }}
      >
        {shown
          .map((idx, depth) => ({ idx, depth }))
          .reverse()
          .map(({ idx, depth }) => {
            const img = DECK[idx];
            const isFront = depth === 0;
            return (
              <figure
                key={img.id}
                className="absolute left-0 bottom-0 m-0 w-[calc(100%-28px)] h-[260px] sm:h-[340px] rounded-[28px] overflow-hidden bg-[#E9EEE5] ring-1 ring-black/5 shadow-[0_1px_2px_rgba(16,24,20,0.06),0_22px_44px_-16px_rgba(16,24,20,0.38)]"
                style={{
                  ...(isFront && flicking ? FLICKED : depthStyle(depth)),
                  transformOrigin: 'center bottom',
                  transition: `transform ${FLICK_MS}ms ${EASE}, opacity ${FLICK_MS}ms ease`,
                }}
                aria-hidden={!isFront}
              >
                <Photo
                  src={img.src}
                  alt={isFront ? img.alt : ''}
                  loading={depth < 2 ? 'eager' : 'lazy'}
                  sizes="(max-width: 1024px) 90vw, 45vw"
                  className="absolute inset-0 w-full h-full object-cover"
                />

                {/* Back cards sit slightly veiled so the front one owns attention */}
                {!isFront && <span className="absolute inset-0 bg-white/25" />}

              </figure>
            );
          })}
      </div>

    </div>
  );
};
