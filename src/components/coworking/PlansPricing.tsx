import React from 'react';
import { Check, ArrowRight, Ticket } from 'lucide-react';
import { COWORKING_PLANS } from '../../data';
import { Eyebrow } from '../ui/Eyebrow';
import { useModals } from '../../context/ModalContext';

export const PlansPricing: React.FC = () => {
  const { openBooking } = useModals();

  return (
    <section className="mt-8 sm:mt-12">
      <div className="bg-white border border-[#E3E8DE] rounded-[32px] sm:rounded-[36px] p-6 sm:p-10 lg:p-12 shadow-xs">
        <div className="text-center max-w-xl mx-auto space-y-4 mb-10">
          <Eyebrow icon={Ticket}>Desk Passes</Eyebrow>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#18261E] tracking-tight leading-tight">
            Simple Pricing, No Surprises
          </h2>
          <p className="text-[#59695C] text-sm leading-relaxed">
            Hostel guests always get member rates. Staying a while? The coliving bundle
            on the Rooms page includes a dedicated desk.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-4xl mx-auto">
          {COWORKING_PLANS.map((plan) => (
            <div
              key={plan.id}
              id={`plan-${plan.id}`}
              className={`relative rounded-3xl p-6 sm:p-7 transition-all duration-200 hover:-translate-y-1 ${
                plan.popular
                  ? 'bg-[#D7E95C] shadow-sm'
                  : 'bg-[#F4F6F2]/90 border border-[#E1E7DE] shadow-xs hover:bg-white'
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#2A4E38] text-white text-[10px] font-bold px-3.5 py-1 rounded-full uppercase tracking-wider shadow-xs">
                  Most Popular
                </span>
              )}
              <h3 className={`text-[15px] font-bold tracking-tight ${plan.popular ? 'text-[#193623]' : 'text-[#18271E]'}`}>
                {plan.name}
              </h3>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className={`text-4xl font-bold tracking-tight ${plan.popular ? 'text-[#193623]' : 'text-[#18271E]'}`}>
                  {plan.price}
                </span>
                <span className={`text-[12px] font-medium ${plan.popular ? 'text-[#2F4A37]' : 'text-[#637265]'}`}>
                  {plan.period}
                </span>
              </div>
              <ul className="mt-5 space-y-2.5">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className={`flex items-start gap-2 text-[13px] leading-snug ${
                      plan.popular ? 'text-[#243E2C]' : 'text-[#5A695D]'
                    }`}
                  >
                    <Check className={`w-4 h-4 shrink-0 mt-0.5 ${plan.popular ? 'text-[#1E3E2A]' : 'text-[#2C573A]'}`} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => openBooking('coworking')}
                className={`mt-6 w-full text-sm font-semibold py-3 rounded-full flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer shadow-xs active:scale-98 ${
                  plan.popular
                    ? 'bg-[#234530] hover:bg-[#183422] text-white'
                    : 'bg-[#2A4E38] hover:bg-[#1E3B29] text-white'
                }`}
              >
                <span>Choose {plan.name}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
