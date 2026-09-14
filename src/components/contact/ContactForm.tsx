import React, { useState } from 'react';
import { CheckCircle2, ArrowRight, Send } from 'lucide-react';
import { Eyebrow } from '../ui/Eyebrow';

const TOPICS = ['Booking a Stay', 'Surf Lessons', 'Coworking & Coliving', 'Something Else'];

export const ContactForm: React.FC = () => {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', topic: TOPICS[0], message: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFormData({ name: '', email: '', topic: TOPICS[0], message: '' });
    }, 4000);
  };

  return (
    <div className="bg-white border border-[#E3E8DE] rounded-[32px] sm:rounded-[36px] p-6 sm:p-10 shadow-xs">
      <div className="space-y-4 mb-6">
        <Eyebrow icon={Send}>Send a Message</Eyebrow>
        <h2 className="text-2xl sm:text-3xl font-bold text-[#18261E] tracking-tight leading-tight">
          We&apos;d Love to Hear From You
        </h2>
      </div>

      {submitted ? (
        <div className="py-12 text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-[#2C573A] mx-auto animate-bounce" />
          <h4 className="text-lg font-bold text-[#18271E]">Message Sent!</h4>
          <p className="text-xs text-[#5D6D5F] max-w-xs mx-auto">
            Thanks for reaching out — we&apos;ll reply within 24 hours.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#18271E] mb-1">Your Full Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Jane Doe"
              className="w-full bg-[#F9FAF8] border border-[#DCE2D8] rounded-xl px-3.5 py-2.5 text-xs text-[#18271E] focus:outline-hidden focus:ring-2 focus:ring-[#2C573A]/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#18271E] mb-1">Email Address</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="jane@example.com"
              className="w-full bg-[#F9FAF8] border border-[#DCE2D8] rounded-xl px-3.5 py-2.5 text-xs text-[#18271E] focus:outline-hidden focus:ring-2 focus:ring-[#2C573A]/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#18271E] mb-2">What&apos;s It About?</label>
            <div className="grid grid-cols-2 gap-2">
              {TOPICS.map((topic) => (
                <button
                  type="button"
                  key={topic}
                  onClick={() => setFormData({ ...formData, topic })}
                  className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                    formData.topic === topic
                      ? 'bg-[#2A4E38] text-white border-[#2A4E38]'
                      : 'bg-[#F9FAF8] text-[#243F2D] border-[#DCE2D8] hover:bg-white'
                  }`}
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#18271E] mb-1">Your Message</label>
            <textarea
              rows={4}
              required
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Dates, group size, questions — anything at all."
              className="w-full bg-[#F9FAF8] border border-[#DCE2D8] rounded-xl px-3.5 py-2.5 text-xs text-[#18271E] focus:outline-hidden focus:ring-2 focus:ring-[#2C573A]/20 resize-none"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-[#2A4E38] hover:bg-[#1E3A28] text-white font-semibold py-3 rounded-full text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-98"
          >
            <span>Send Message</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      )}
    </div>
  );
};
