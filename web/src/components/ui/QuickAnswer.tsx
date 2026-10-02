import React from 'react';

interface QuickAnswerProps {
  question: string;
  children: React.ReactNode;
}

/** A question heading with a direct, self-contained answer — easy for search and AI answers to quote. */
export const QuickAnswer: React.FC<QuickAnswerProps> = ({ question, children }) => (
  <section className="mt-6 sm:mt-10">
    <div className="bg-white rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 lg:p-10 shadow-xs">
      <h2 className="text-xl sm:text-2xl font-bold text-[#18261E] tracking-tight leading-snug">{question}</h2>
      <div className="mt-3 max-w-3xl text-[#4F5F52] text-sm sm:text-[15px] leading-relaxed space-y-3">{children}</div>
    </div>
  </section>
);
