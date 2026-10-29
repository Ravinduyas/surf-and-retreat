import React from 'react';
import { Mail, ArrowRight } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { PageHero } from '../components/layout/PageHero';
import { ContactForm } from '../components/contact/ContactForm';
import { LocationCard } from '../components/contact/LocationCard';
import { FaqAccordion } from '../components/contact/FaqAccordion';
import { Button } from '../components/ui/Button';
import { Reveal } from '../components/ui/Reveal';
import { usePageMeta } from '../hooks/usePageMeta';
import { CONTACT_INFO, GALLERY_IMAGES } from '../data';

export default function ContactPage() {
  usePageMeta();
  const hostelSign = GALLERY_IMAGES.find((g) => g.id === 'g23')?.src;

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
          subtitle="Drop us a message about beds, boards or desks - we answer within 24 hours. Or just show up; the kettle's always on."
          image={hostelSign}
          imageAlt="Surf & Retreat Hostel entrance sign and welcome area"
        >
          <Button
            variant="primary"
            to="#contact-form"
            onClick={() => {
              document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <span>Send a Message</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            href={`https://wa.me/${CONTACT_INFO.phone.replace(/[^0-9]/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp Us
          </Button>
        </PageHero>
      </PageHeader>

      <section className="mt-6 sm:mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-start">
        <Reveal delay={100}>
          <ContactForm />
        </Reveal>
        <Reveal delay={250}>
          <LocationCard />
        </Reveal>
      </section>

      <Reveal>
        <FaqAccordion />
      </Reveal>
    </>
  );
}
