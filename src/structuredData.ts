import { AMENITIES, COWORKING_PLANS, HERO_IMAGE, ROOMS, SURF_PACKAGES } from './data';
import { SITE_NAME, SITE_URL, canonicalFor, metaFor, normalizePath } from './seo';

const HOSTEL_ID = `${SITE_URL}/#hostel`;
const WEBSITE_ID = `${SITE_URL}/#website`;

/** Image paths in data.ts are site-relative; JSON-LD wants absolute URLs. */
const absolute = (src: string) => (src.startsWith('http') ? src : `${new URL(SITE_URL).origin}${src}`);

const priceOf = (text: string) => {
  const n = text.match(/\$(\d+(?:\.\d+)?)/);
  return n ? Number(n[1]) : undefined;
};

/**
 * Prices on the site read "$12", "from $12/night" or "$149 / week". Assumes USD — the site never
 * states a currency, so the owner should confirm this.
 */
const offer = (name: string, priceText: string, unit?: string) => {
  const price = priceOf(priceText);
  if (price === undefined) return null;
  return {
    '@type': 'Offer',
    itemOffered: { '@type': 'Service', name },
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      price,
      priceCurrency: 'USD',
      ...(unit ? { unitText: unit } : {}),
    },
  };
};

const hostel = () => ({
  '@type': 'Hostel',
  '@id': HOSTEL_ID,
  name: SITE_NAME,
  description: metaFor('/').description,
  url: `${SITE_URL}/`,
  image: [absolute(HERO_IMAGE), ...ROOMS.map((r) => absolute(r.image))],
  // Street address, phone and email are deliberately left out until the real values are confirmed.
  address: { '@type': 'PostalAddress', addressLocality: 'Weligama', addressCountry: 'LK' },
  checkinTime: '14:00',
  checkoutTime: '11:00',
  amenityFeature: AMENITIES.map((a) => ({
    '@type': 'LocationFeatureSpecification',
    name: a.label,
    value: true,
  })),
  containsPlace: ROOMS.map((r) => ({
    '@type': 'Room',
    name: r.title,
    description: r.description,
    image: absolute(r.image),
    occupancy: { '@type': 'QuantitativeValue', maxValue: r.maxGuests },
  })),
  makesOffer: [
    ...ROOMS.map((r) => offer(r.title, r.price, 'NIGHT')),
    ...SURF_PACKAGES.map((s) => offer(s.title, s.price)),
    ...COWORKING_PLANS.map((p) => offer(`Coworking ${p.name}`, p.price, p.period.replace('per ', '').toUpperCase())),
  ].filter(Boolean),
});

/** JSON-LD graph for one route: the hostel entity, the website, this page and its breadcrumb. */
export const buildJsonLd = (pathname: string) => {
  const path = normalizePath(pathname);
  const meta = metaFor(path);
  const url = canonicalFor(path);

  const graph: Record<string, unknown>[] = [
    hostel(),
    {
      '@type': 'WebSite',
      '@id': WEBSITE_ID,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      publisher: { '@id': HOSTEL_ID },
      inLanguage: 'en',
    },
    {
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: meta.title,
      description: meta.description,
      isPartOf: { '@id': WEBSITE_ID },
      about: { '@id': HOSTEL_ID },
      primaryImageOfPage: { '@type': 'ImageObject', url: absolute(HERO_IMAGE) },
    },
  ];

  if (path !== '/') {
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
        ...(meta.parent
          ? [{ '@type': 'ListItem', position: 2, name: meta.parent.name, item: canonicalFor(meta.parent.path) }]
          : []),
        { '@type': 'ListItem', position: meta.parent ? 3 : 2, name: meta.name, item: url },
      ],
    });
  }

  return { '@context': 'https://schema.org', '@graph': graph };
};
