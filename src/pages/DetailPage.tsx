import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, BedDouble, Check, ChevronRight, MapPin, ShieldCheck, Users, Waves } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { PageHero } from '../components/layout/PageHero';
import { Button } from '../components/ui/Button';
import { Photo } from '../components/ui/Photo';
import { usePageMeta } from '../hooks/usePageMeta';
import { ROOMS, SURF_PACKAGES } from '../data';
import { DetailItem } from '../types';
import NotFoundPage from './NotFoundPage';

type Kind = 'room' | 'surf';

const KINDS = {
  room: {
    listPath: '/rooms',
    listName: 'Rooms',
    tab: 'stay',
    icon: BedDouble,
    items: ROOMS,
    factsTitle: "What's in the room",
    otherTitle: 'Other rooms',
  },
  surf: {
    listPath: '/surf-camp',
    listName: 'Surf Camp',
    tab: 'surf',
    icon: Waves,
    items: SURF_PACKAGES,
    factsTitle: "What's included",
    otherTitle: 'Other surf packages',
  },
} as const;

const breadcrumbLink = 'hover:text-[#183321] hover:underline underline-offset-2';

/** One room or surf package on its own page (replaces the old "View Details" popup). */
export default function DetailPage({ kind }: { kind: Kind }) {
  usePageMeta();
  const { id } = useParams();
  const config = KINDS[kind];
  const item = config.items.find((entry) => entry.id === id);
  if (!item) return <NotFoundPage />;

  const facts = 'features' in item ? item.features : item.includes;
  const subline = 'capacity' in item ? item.capacity : item.level;
  const price = 'pricePerNight' in item ? item.pricePerNight : item.price;
  const others = (config.items as readonly DetailItem[]).filter((entry) => entry.id !== item.id);
  const Icon = config.icon;

  return (
    <>
      <PageHeader>
        <PageHero
          eyebrow={item.tag}
          eyebrowIcon={Icon}
          title={item.title}
          subtitle={item.description}
          image={item.image}
          imageAlt={item.title}
        >
          <Button variant="primary" book={config.tab} bookItem={item.id}>
            <span>Request to Book</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" to={config.listPath}>
            All {config.listName.toLowerCase()}
          </Button>
        </PageHero>
      </PageHeader>

      <nav aria-label="Breadcrumb" className="mt-5 px-1 flex items-center gap-1.5 text-xs text-[#637265]">
        <Link to="/" className={breadcrumbLink}>
          Home
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link to={config.listPath} className={breadcrumbLink}>
          {config.listName}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="font-semibold text-[#254A32]" aria-current="page">
          {item.title}
        </span>
      </nav>

      <section className="mt-4 sm:mt-6">
        <div className="bg-white rounded-[32px] sm:rounded-[36px] p-6 sm:p-10 lg:p-12 shadow-xs">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            <div className="lg:col-span-7 space-y-6">
              <div>
                <h2 className="text-xs font-bold text-[#355B40] uppercase tracking-wider">{item.category}</h2>
              </div>

              <div>
                <h3 className="text-xl font-bold text-[#18261E] tracking-tight">{config.factsTitle}</h3>
                <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                  {facts.map((fact) => (
                    <li key={fact} className="flex items-start gap-2 text-sm text-[#4F5F52] leading-snug">
                      <Check className="w-4 h-4 text-[#2C573A] shrink-0 mt-0.5" />
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {item.highlight && (
                <div className="bg-[#F4F7F2] p-4 rounded-2xl border border-[#DFE6DB] flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-[#2C573A] shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-[#1C3A27] block">Good to know</span>
                    <span className="text-sm text-[#526456] mt-0.5 block leading-relaxed">{item.highlight}</span>
                  </div>
                </div>
              )}
            </div>

            <aside className="lg:col-span-5">
              <div className="rounded-3xl bg-[#F4F6F2] border border-[#E1E7DE] p-6 space-y-4 lg:sticky lg:top-24">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8B9A8D]">Price</span>
                  <div className="text-3xl font-bold text-[#18271E] tracking-tight mt-1">{price}</div>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#4F5F52]">
                  <Users className="w-4 h-4 text-[#2C573A] shrink-0" />
                  <span>{subline}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#4F5F52]">
                  <MapPin className="w-4 h-4 text-[#2C573A] shrink-0" />
                  <span>Weligama, Sri Lanka</span>
                </div>
                <Button variant="primary" book={config.tab} bookItem={item.id} className="w-full justify-center">
                  <span>Request to Book</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="mt-6 sm:mt-10">
        <div className="bg-white rounded-[32px] sm:rounded-[36px] p-6 sm:p-10 shadow-xs">
          <h2 className="text-2xl font-bold text-[#18261E] tracking-tight">{config.otherTitle}</h2>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {others.map((other) => (
              <Link
                key={other.id}
                to={`${config.listPath}/${other.id}`}
                className="group flex items-center gap-4 p-3 rounded-2xl border border-[#E1E7DE] bg-[#F9FAF8] hover:bg-white hover:border-[#B9C8B7] transition-colors"
              >
                <span className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-[#EBF0E8]">
                  <Photo src={other.image} alt={other.title} sizes="80px" className="w-full h-full object-cover" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-[#18271E] leading-snug">{other.title}</span>
                  <span className="block text-xs font-semibold text-[#2A4E38] mt-0.5">
                    {'pricePerNight' in other ? (other as { pricePerNight: string }).pricePerNight : other.price}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
