import React from 'react';
import manifest from '../../image-manifest.json';

type Manifest = Record<string, { w: number; h: number; variants: number[] }>;
const IMAGES = manifest as Manifest;

/** Local photos live at <base>/images/<name>.webp and have sized variants. */
const LOCAL = /^(.*\/images\/)([a-z0-9-]+)\.webp$/;

interface PhotoProps {
  src: string;
  alt: string;
  className?: string;
  /** Layout hint so the browser picks the smallest adequate file. */
  sizes?: string;
  loading?: 'lazy' | 'eager';
  fetchPriority?: 'high' | 'low' | 'auto';
}

/**
 * Renders an <img> with a responsive srcset for our own photography, so a
 * phone downloads a 400px file instead of the full desktop image. Remote
 * images (stock placeholders) pass straight through.
 */
export const Photo: React.FC<PhotoProps> = ({
  src,
  alt,
  className,
  sizes = '100vw',
  loading = 'lazy',
  fetchPriority,
}) => {
  const match = src.match(LOCAL);
  const entry = match ? IMAGES[match[2]] : undefined;

  if (!match || !entry) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        loading={loading}
        fetchPriority={fetchPriority}
        referrerPolicy="no-referrer"
      />
    );
  }

  const [, base, name] = match;
  const srcSet = entry.variants
    .map((w) => `${base}${w === entry.w ? name : `${name}-${w}`}.webp ${w}w`)
    .join(', ');

  return (
    <img
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      className={className}
      loading={loading}
      fetchPriority={fetchPriority}
      decoding="async"
    />
  );
};
