import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Compass } from 'lucide-react';
import { EXPLORE_CARDS } from '../../data';
import { Eyebrow } from '../ui/Eyebrow';
import { Photo } from '../ui/Photo';

export const ExploreSection: React.FC = () => {
  const [startIndex, setStartIndex] = useState(0);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const visibleCount = 3;
  const maxStart = Math.max(0, EXPLORE_CARDS.length - visibleCount);

  const handlePrev = () => {
    setStartIndex((prev) => (prev > 0 ? prev - 1 : maxStart));
  };

  const handleNext = () => {
    setStartIndex((prev) => (prev < maxStart ? prev + 1 : 0));
  };

  const displayedCards = EXPLORE_CARDS.slice(startIndex, startIndex + visibleCount);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail || !newsletterEmail.includes('@')) return;
    setSubscribed(true);
    setTimeout(() => {
      setNewsletterEmail('');
      setSubscribed(false);
    }, 4000);
  };

  return (
    <section className="mt-8 sm:mt-12">
      <div className="bg-white rounded-[32px] sm:rounded-[36px] p-6 sm:p-10 lg:p-12 shadow-xs">
        {/* Header Bar: Badge on left, Navigation Arrows on right */}
        <div className="flex items-center justify-between mb-8">
          <Eyebrow icon={Compass}>Explore the Hostel</Eyebrow>

          <div className="flex items-center gap-2">
            <button
              id="explore-prev-btn"
              onClick={handlePrev}
              aria-label="Previous cards"
              className="w-11 h-11 sm:w-9 sm:h-9 rounded-full border border-[#D7E0D5] flex items-center justify-center text-[#233829] hover:bg-[#F3F6F1] transition-colors cursor-pointer active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              id="explore-next-btn"
              onClick={handleNext}
              aria-label="Next cards"
              className="w-11 h-11 sm:w-9 sm:h-9 rounded-full border border-[#D7E0D5] flex items-center justify-center text-[#233829] hover:bg-[#F3F6F1] transition-colors cursor-pointer active:scale-95"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Layout: 3 Cards on the left (8 cols), Narrative + Lime Card on right (4 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-8 items-start">
          {/* Explore Cards Grid */}
          <div className="lg:col-span-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {displayedCards.map((item) => (
                <div
                  key={item.id}
                  id={`explore-card-${item.id}`}
                  className="group flex flex-col justify-between"
                >
                  {/* Card Image Container */}
                  <Link to={item.to} className="relative h-[220px] rounded-2xl overflow-hidden mb-4 shadow-xs bg-[#EAF0E7] block">
                    <Photo
                      src={item.image}
                      alt={item.title}
                      sizes="(max-width: 640px) 100vw, 30vw"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                    />
                    {/* Category Pill Tag inside image */}
                    <div className="absolute bottom-3 left-3">
                      <span className="inline-block bg-white/95 backdrop-blur-xs text-[#1D3624] text-[11px] font-semibold px-3 py-1 rounded-full shadow-xs">
                        {item.tag}
                      </span>
                    </div>
                  </Link>

                  {/* Card Body & Typography */}
                  <div className="space-y-1.5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-[17px] font-bold text-[#18271E] tracking-tight leading-snug group-hover:text-[#255235] transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-[13px] text-[#5A695D] leading-relaxed mt-1 line-clamp-2">
                        {item.description}
                      </p>
                    </div>

                    <div className="pt-3">
                      <Link
                        to={item.to}
                        className="inline-flex items-center gap-1.5 py-1.5 text-xs font-semibold text-[#254A32] hover:text-[#183321] transition-all cursor-pointer group-hover:gap-2"
                      >
                        <span>Learn More</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Narrative & Chartreuse Subscription Card */}
          <div className="lg:col-span-4 flex flex-col justify-between space-y-6">
            <div>
              <h2 className="text-3xl sm:text-[34px] font-bold text-[#18261E] tracking-tight leading-[1.15]">
                One Booking.
                <br />
                Your Whole Trip, Sorted.
              </h2>
              <Link
                id="explore-contact-link"
                to="/contact"
                className="mt-4 inline-flex items-center gap-1.5 py-1.5 text-xs font-bold text-[#234530] hover:underline cursor-pointer"
              >
                <span>Questions? Get in Touch</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Chartreuse/Lime Newsletter Card */}
            <div className="bg-[#D7E95C] rounded-3xl p-6 sm:p-7 shadow-xs">
              <h3 className="text-xl font-bold text-[#193623] tracking-tight">
                Surf Reports &amp; Deals, Monthly.
              </h3>
              <p className="text-[12px] text-[#2F4A37] mt-1.5 leading-relaxed">
                Join the newsletter for season updates, coliving offers and what&apos;s
                happening at the hostel.
              </p>

              {/* Newsletter Form */}
              <form onSubmit={handleSubscribe} className="mt-5 space-y-2.5">
                <div className="flex items-center bg-white/95 rounded-full p-1 pl-4 shadow-xs focus-within:ring-2 focus-within:ring-[#1E3E2A]/30">
                  <input
                    id="newsletter-email-input"
                    type="email"
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    placeholder="Enter your email"
                    disabled={subscribed}
                    className="w-full bg-transparent py-2.5 text-xs text-[#193623] placeholder-[#798C7E] focus:outline-hidden pr-2"
                    required
                  />
                  <button
                    id="newsletter-subscribe-btn"
                    type="submit"
                    disabled={subscribed}
                    className={`shrink-0 flex items-center gap-1 text-[11px] sm:text-xs font-semibold px-4 py-3 rounded-full text-white transition-all cursor-pointer ${
                      subscribed
                        ? 'bg-[#183622]'
                        : 'bg-[#234530] hover:bg-[#183422]'
                    }`}
                  >
                    {subscribed ? (
                      <>
                        <Check className="w-3 h-3" />
                        <span>Subscribed</span>
                      </>
                    ) : (
                      <>
                        <span>Subscribe</span>
                        <ArrowRight className="w-3 h-3" />
                      </>
                    )}
                  </button>
                </div>
              </form>

              <div className="flex items-center gap-2.5 mt-4 pt-1">
                <div className="flex items-center gap-1 text-[11px] text-[#243E2C] font-medium">
                  <span>🌊</span>
                  <span>Join thousands of wave chasers</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
