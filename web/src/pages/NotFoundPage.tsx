import React from 'react';
import { ArrowRight, Compass } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { PageHero } from '../components/layout/PageHero';
import { Button } from '../components/ui/Button';
import { usePageMeta } from '../hooks/usePageMeta';

export default function NotFoundPage() {
  usePageMeta();

  return (
    <PageHeader>
      <PageHero
        eyebrow="404"
        eyebrowIcon={Compass}
        title={
          <>
            This Wave
            <br />
            Doesn&apos;t <span className="text-[#2C573A]">Exist.</span>
          </>
        }
        subtitle="We could not find that page. Head back to the beach — the rooms, surf lessons and coworking are all one click away."
      >
        <Button variant="primary" to="/">
          <span>Back to Home</span>
          <ArrowRight className="w-4 h-4" />
        </Button>
        <Button variant="outline" to="/contact">
          Contact Us
        </Button>
      </PageHero>
    </PageHeader>
  );
}
