import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { FAQS } from '../../data';
import { Eyebrow } from '../ui/Eyebrow';

export const FaqAccordion: React.FC = () => {
  const [openId, setOpenId] = useState<string | null>(FAQS[0]?.id ?? null);

  return (
    <section id="faq" className="mt-8 sm:mt-12">
      <div className="bg-white rounded-[32px] sm:rounded-[36px] p-6 sm:p-10 lg:p-12 shadow-xs">
        <div className="text-center max-w-xl mx-auto space-y-4 mb-10">
          <Eyebrow icon={HelpCircle}>FAQs</Eyebrow>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#18261E] tracking-tight leading-tight">
            The Questions Everyone Asks
          </h2>
        </div>

        <div className="max-w-2xl mx-auto space-y-3">
          {FAQS.map((faq) => {
            const isOpen = openId === faq.id;
            return (
              <div
                key={faq.id}
                id={faq.id}
                className={`border rounded-2xl transition-all duration-200 ${
                  isOpen
                    ? 'bg-white border-[#C9D6C6] shadow-sm'
                    : 'bg-[#F4F6F2]/90 border-[#E1E7DE] hover:bg-white'
                }`}
              >
                <button
                  onClick={() => setOpenId(isOpen ? null : faq.id)}
                  className="w-full flex items-center justify-between gap-4 p-5 text-left cursor-pointer"
                  aria-expanded={isOpen}
                >
                  <span className="text-[15px] font-bold text-[#18271E] tracking-tight">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`w-4.5 h-4.5 text-[#2C573A] shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {/* Always rendered so the answer is in the page's HTML; `hidden` only collapses it visually. */}
                <div className={`px-5 pb-5 -mt-1 ${isOpen ? '' : 'hidden'}`}>
                  <p className="text-[13px] text-[#5A695D] leading-relaxed">{faq.answer}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
