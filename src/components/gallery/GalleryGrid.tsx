import React, { useState } from 'react';
import { X, ArrowLeft, ArrowRight } from 'lucide-react';
import { GALLERY_IMAGES } from '../../data';
import { GalleryCategory } from '../../types';

const FILTERS: { id: GalleryCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'rooms', label: 'Rooms & Stay' },
  { id: 'surf', label: 'Surf' },
  { id: 'coworking', label: 'Coworking' },
  { id: 'social', label: 'Social & Food' },
  { id: 'around', label: 'Around Weligama' },
];

export const GalleryGrid: React.FC = () => {
  const [filter, setFilter] = useState<GalleryCategory | 'all'>('all');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const images =
    filter === 'all'
      ? GALLERY_IMAGES
      : GALLERY_IMAGES.filter((img) => img.category === filter);

  const showPrev = () =>
    setLightboxIndex((i) => (i === null ? null : (i - 1 + images.length) % images.length));
  const showNext = () =>
    setLightboxIndex((i) => (i === null ? null : (i + 1) % images.length));

  return (
    <section className="mt-6 sm:mt-10">
      <div className="bg-white border border-[#E3E8DE] rounded-[32px] sm:rounded-[36px] p-6 sm:p-10 lg:p-12 shadow-xs">
        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              id={`gallery-filter-${f.id}`}
              onClick={() => {
                setFilter(f.id);
                setLightboxIndex(null);
              }}
              className={`text-[12px] font-semibold px-4 py-2 rounded-full border transition-colors cursor-pointer ${
                filter === f.id
                  ? 'bg-[#2A4E38] border-[#2A4E38] text-white'
                  : 'bg-white border-[#E1E7DE] text-[#3D4F42] hover:border-[#B9C9B6]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Masonry Grid */}
        <div className="columns-2 sm:columns-3 gap-4">
          {images.map((img, idx) => (
            <button
              key={img.id}
              id={`gallery-img-${img.id}`}
              onClick={() => setLightboxIndex(idx)}
              className="block w-full mb-4 rounded-2xl overflow-hidden break-inside-avoid group cursor-pointer bg-[#EAF0E7] focus:outline-hidden"
              aria-label={`View larger: ${img.alt}`}
            >
              <img
                src={img.src}
                alt={img.alt}
                referrerPolicy="no-referrer"
                loading="lazy"
                className="w-full group-hover:scale-105 transition-transform duration-500 ease-out"
              />
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && images[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 sm:p-10 modal-fade"
          onClick={() => setLightboxIndex(null)}
          role="dialog"
          aria-modal="true"
          aria-label={images[lightboxIndex].alt}
        >
          <button
            onClick={() => setLightboxIndex(null)}
            aria-label="Close gallery"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              showPrev();
            }}
            aria-label="Previous image"
            className="absolute left-3 sm:left-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div
            className="max-w-4xl w-full flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={images[lightboxIndex].src}
              alt={images[lightboxIndex].alt}
              referrerPolicy="no-referrer"
              className="max-h-[75vh] w-auto max-w-full rounded-2xl object-contain shadow-lg"
            />
            <p className="text-white/80 text-sm text-center">{images[lightboxIndex].alt}</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              showNext();
            }}
            aria-label="Next image"
            className="absolute right-3 sm:right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </section>
  );
};
