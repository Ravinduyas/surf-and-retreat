import React from 'react';
import { Mail } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { PageHero } from '../components/layout/PageHero';
import { ContactForm } from '../components/contact/ContactForm';
import { LocationCard } from '../components/contact/LocationCard';
import { FaqAccordion } from '../components/contact/FaqAccordion';
import { usePageMeta } from '../hooks/usePageMeta';

export default function ContactPage() {
  usePageMeta(
    'Contact & FAQs | Surf & Retreat Hostel Weligama',
    'Get in touch with Surf & Retreat Hostel Weligama — booking questions, directions from Colombo Airport and answers to common questions.'
  );

  return (
    <>
      <PageHeader>
        <PageHero
          eyebrow="Contact Us"
          eyebrowIcon={Mail}
          title={
            <>
              Questions? We Reply
              <br />
              <span className="text-[#2C573A]">Fast.</span>
            </>
          }
          subtitle="Drop us a message about beds, boards or desks — we answer within 24 hours. Or just show up; the kettle's always on."
        />
      </PageHeader>

      <section className="mt-6 sm:mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-start">
        <ContactForm />
        <LocationCard />
      </section>

      <FaqAccordion />
    </>
  );
}
