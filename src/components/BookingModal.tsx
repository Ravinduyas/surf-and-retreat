import React, { useState } from 'react';
import { X, BedDouble, Waves, Laptop, CheckCircle2, ArrowRight } from 'lucide-react';
import { ModalShell } from './ui/ModalShell';
import { BookingTab } from '../types';

interface BookingModalProps {
  initialTab: BookingTab;
  onClose: () => void;
}

const TABS: { id: BookingTab; label: string; icon: typeof BedDouble }[] = [
  { id: 'stay', label: 'Stay', icon: BedDouble },
  { id: 'surf', label: 'Surf', icon: Waves },
  { id: 'coworking', label: 'Coworking', icon: Laptop },
];

const QUICK_PICKS: Record<BookingTab, { label: string; options: string[] }> = {
  stay: { label: 'Room Type', options: ['Dorm Bed', 'Female Dorm', 'Private AC', 'Bungalow'] },
  surf: { label: 'Package', options: ['Beginner Week', 'Coaching', 'Board Rental'] },
  coworking: { label: 'Pass', options: ['Day Pass', 'Week Pass', 'Month Pass'] },
};

export const BookingModal: React.FC<BookingModalProps> = ({ initialTab, onClose }) => {
  const [selectedTab, setSelectedTab] = useState<BookingTab>(initialTab);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    checkIn: '',
    checkOut: '',
    message: '',
    pick: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 2500);
  };

  const quickPick = QUICK_PICKS[selectedTab];

  return (
    <ModalShell
      onClose={onClose}
      cardClassName="relative w-full max-w-lg bg-white rounded-[28px] overflow-hidden border border-[#DCE2D8] shadow-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto"
    >
      <button
        onClick={onClose}
        className="absolute top-5 right-5 p-2 rounded-full text-[#6B796D] hover:text-[#18271E] hover:bg-[#F2F5F0] transition-colors cursor-pointer"
        aria-label="Close booking"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F2F6F0] text-[#2C573A] text-[11px] font-semibold tracking-wider uppercase mb-2">
          Book Your Stay
        </div>
        <h3 className="text-2xl font-bold text-[#18271E]">Request a Booking</h3>
        <p className="text-xs sm:text-sm text-[#637265] mt-1">
          Tell us what you need and we&apos;ll confirm availability within 24 hours.
        </p>
      </div>

      {/* Booking Tabs */}
      <div className="grid grid-cols-3 gap-2 bg-[#F3F6F1] p-1.5 rounded-2xl mb-6">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedTab === tab.id
                  ? 'bg-white text-[#1D3E29] shadow-xs'
                  : 'text-[#5C6E61] hover:text-[#1D3E29]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {submitted ? (
        <div className="py-8 text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-[#2C573A] mx-auto animate-bounce" />
          <h4 className="text-lg font-bold text-[#18271E]">Request Sent!</h4>
          <p className="text-xs text-[#5D6D5F] max-w-xs mx-auto">
            We&apos;ll get back to you within 24 hours to confirm your booking. See you in
            Weligama!
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#18271E] mb-2">
              {quickPick.label}
            </label>
            <div className={`grid gap-2 mb-1 ${quickPick.options.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
              {quickPick.options.map((opt) => (
                <button
                  type="button"
                  key={opt}
                  onClick={() => setFormData({ ...formData, pick: opt })}
                  className={`py-2 px-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                    formData.pick === opt
                      ? 'bg-[#2A4E38] text-white border-[#2A4E38]'
                      : 'bg-[#F9FAF8] text-[#243F2D] border-[#DCE2D8] hover:bg-white'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#18271E] mb-1">
              Your Full Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Jane Doe"
              className="w-full bg-[#F9FAF8] border border-[#DCE2D8] rounded-xl px-3.5 py-2 text-xs text-[#18271E] focus:outline-hidden focus:ring-2 focus:ring-[#2C573A]/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#18271E] mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="jane@example.com"
              className="w-full bg-[#F9FAF8] border border-[#DCE2D8] rounded-xl px-3.5 py-2 text-xs text-[#18271E] focus:outline-hidden focus:ring-2 focus:ring-[#2C573A]/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#18271E] mb-1">
                {selectedTab === 'coworking' ? 'Start Date' : 'Check-in'}
              </label>
              <input
                type="date"
                required
                value={formData.checkIn}
                onChange={(e) => setFormData({ ...formData, checkIn: e.target.value })}
                className="w-full bg-[#F9FAF8] border border-[#DCE2D8] rounded-xl px-3.5 py-2 text-xs text-[#18271E] focus:outline-hidden focus:ring-2 focus:ring-[#2C573A]/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#18271E] mb-1">
                {selectedTab === 'coworking' ? 'End Date' : 'Check-out'}
              </label>
              <input
                type="date"
                value={formData.checkOut}
                onChange={(e) => setFormData({ ...formData, checkOut: e.target.value })}
                className="w-full bg-[#F9FAF8] border border-[#DCE2D8] rounded-xl px-3.5 py-2 text-xs text-[#18271E] focus:outline-hidden focus:ring-2 focus:ring-[#2C573A]/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#18271E] mb-1">
              Anything Else?
            </label>
            <textarea
              rows={2}
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Group size, dietary needs, airport pickup..."
              className="w-full bg-[#F9FAF8] border border-[#DCE2D8] rounded-xl px-3.5 py-2 text-xs text-[#18271E] focus:outline-hidden focus:ring-2 focus:ring-[#2C573A]/20 resize-none"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-[#2A4E38] hover:bg-[#1E3A28] text-white font-semibold py-3 rounded-full text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-98"
          >
            <span>Send Booking Request</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      )}
    </ModalShell>
  );
};
