import React from 'react';
import { Link } from 'react-router-dom';
import { Camera, ArrowRight } from 'lucide-react';
import { GALLERY_IMAGES } from '../../data';
import { Eyebrow } from '../ui/Eyebrow';
import { Button } from '../ui/Button';
import { useReveal } from '../ui/Reveal';
import { Photo } from '../ui/Photo';

const PREVIEW_IDS = ['g1', 'g11', 'g9', 'g23', 'g14'];

export const GallerySection: React.FC = () => {
  const gridRef = useReveal<HTMLDivElement>();
  const preview = GALLERY_IMAGES.filter((img) => PREVIEW_IDS.includes(img.id));

  return (
    <section className="mt-8 sm:mt-12">
      <div className="bg-white rounded-[32px] sm:rounded-[36px] p-6 sm:p-10 lg:p-12 shadow-xs">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div className="space-y-4">
            <Eyebrow icon={Camera}>Life at the Hostel</Eyebrow>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#18261E] tracking-tight leading-tight">
              A Week Here, in Pictures
            </h2>
          </div>
          <Button variant="outline" to="/gallery">
            <span>View Full Gallery</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Asymmetric preview: one large feature + four small tiles */}
        <div
          ref={gridRef}
          className="stagger grid grid-cols-2 lg:grid-cols-4 auto-rows-[130px] sm:auto-rows-[150px] gap-4"
        >
          {preview.map((img, idx) => (
            <Link
              key={img.id}
              to="/gallery"
              id={`home-gallery-${img.id}`}
              className={`relative rounded-2xl overflow-hidden group bg-[#EAF0E7] block ${
                idx === 0 ? 'col-span-2 row-span-2' : 'col-span-1 row-span-1'
              }`}
              style={{ '--i': idx } as React.CSSProperties}
              aria-label={`Open gallery: ${img.alt}`}
            >
              <Photo
                src={img.src}
                alt={img.alt}
                loading="lazy"
                sizes="(max-width: 1024px) 50vw, 25vw"
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
              />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};
