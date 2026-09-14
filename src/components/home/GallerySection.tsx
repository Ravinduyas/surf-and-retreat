import React from 'react';
import { Link } from 'react-router-dom';
import { Camera, ArrowRight } from 'lucide-react';
import { GALLERY_IMAGES } from '../../data';
import { Eyebrow } from '../ui/Eyebrow';
import { Button } from '../ui/Button';

const PREVIEW_IDS = ['g4', 'g1', 'g9', 'g11'];

export const GallerySection: React.FC = () => {
  const preview = GALLERY_IMAGES.filter((img) => PREVIEW_IDS.includes(img.id));

  return (
    <section className="mt-8 sm:mt-12">
      <div className="bg-white border border-[#E3E8DE] rounded-[32px] sm:rounded-[36px] p-6 sm:p-10 lg:p-12 shadow-xs">
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

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {preview.map((img, idx) => (
            <Link
              key={img.id}
              to="/gallery"
              id={`home-gallery-${img.id}`}
              className={`relative rounded-2xl overflow-hidden group bg-[#EAF0E7] block ${
                idx === 0 ? 'h-[240px] sm:h-[300px] col-span-2 lg:col-span-1' : 'h-[240px] sm:h-[300px]'
              }`}
              aria-label={`Open gallery: ${img.alt}`}
            >
              <img
                src={img.src}
                alt={img.alt}
                referrerPolicy="no-referrer"
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
              />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};
