import { COWORKING_PLANS, ROOMS, SURF_PACKAGES } from './data';

export const SITE_URL = 'https://ravinduyas.github.io/surf-and-retreat';
export const SITE_NAME = 'Surf & Retreat Hostel Weligama';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/images/scooter-surfboard.webp`;

export interface RouteMeta {
  /** Breadcrumb label. */
  name: string;
  /** Middle breadcrumb for pages that sit under a section (e.g. a single room). */
  parent?: { name: string; path: string };
  title: string;
  description: string;
  noindex?: boolean;
  /** Listed in sitemap.xml and prerendered to its own HTML file. */
  indexable: boolean;
}

/** "from $12/night" -> "$12" */
const amount = (price: string) => price.match(/\$\d+/)?.[0] ?? '';

const dormFrom = amount(ROOMS[0].price);
const privateFrom = amount(ROOMS.find((r) => r.category === 'Private')?.price ?? '');
const surfWeek = amount(SURF_PACKAGES[0].price);
const dayPass = COWORKING_PLANS[0].price;
const weekPass = COWORKING_PLANS[1].price;
const monthPass = COWORKING_PLANS[2].price;

const SUFFIX = 'Surf & Retreat';

export const ROUTE_META: Record<string, RouteMeta> = {
  '/': {
    name: 'Home',
    title: 'Surf & Retreat Hostel Weligama — Surf, Stay & Cowork in Sri Lanka',
    description:
      'A coliving & coworking surf hostel five minutes from Weligama Bay, Sri Lanka. Dorms and private rooms, daily surf lessons and 300 Mbps fiber wifi.',
    indexable: true,
  },
  '/experience': {
    name: 'Stay, Surf & Work',
    title: 'Stay, Surf & Work | Surf & Retreat Hostel Weligama',
    description: `Dorms from ${dormFrom}, daily surf lessons on Weligama Bay and a coworking space with 300 Mbps fiber — everything under one roof, five minutes from the beach.`,
    indexable: true,
  },
  '/rooms': {
    name: 'Rooms',
    title: `Weligama Hostel Dorms & Private Rooms from ${dormFrom} | ${SUFFIX}`,
    description: `Dorm beds from ${dormFrom} and private rooms from ${privateFrom} a night, five minutes from Weligama Bay. Curtain pods, lockers, AC and 300 Mbps fiber wifi.`,
    indexable: true,
  },
  '/surf-camp': {
    name: 'Surf Camp',
    title: `Weligama Surf Camp & Lessons from ${surfWeek}/week | ${SUFFIX}`,
    description: `Weligama surf lessons and weekly packages from ${surfWeek}: beginner weeks, video coaching and board rental on Weligama Bay, Sri Lanka.`,
    indexable: true,
  },
  '/coworking-coliving': {
    name: 'Coworking & Coliving',
    title: `Coworking Hostel Sri Lanka: Day Pass ${dayPass}, 300 Mbps | ${SUFFIX}`,
    description: `Coworking hostel in Weligama, Sri Lanka: 300 Mbps fiber, an AC focus room and call booths. Day pass ${dayPass}, week pass ${weekPass}, month pass ${monthPass}.`,
    indexable: true,
  },
  '/services': {
    name: 'Guest Services',
    title: 'Guest Services | Surf & Retreat Hostel Weligama',
    description:
      'Rooms, co-working, surfing, skating, yoga, airport pick-up and drop, and laundry — every service at Surf & Retreat Hostel Weligama, bookable at the front desk.',
    indexable: true,
  },
  '/gallery': {
    name: 'Gallery',
    title: 'Gallery | Surf & Retreat Hostel Weligama',
    description:
      'Rooms, waves, workspaces and family dinners — see what a week at Surf & Retreat Hostel Weligama actually looks like.',
    indexable: true,
  },
  '/about': {
    name: 'About',
    title: 'About Us | Surf & Retreat Hostel Weligama',
    description:
      'The story, values and community behind Surf & Retreat — a family-run coliving and coworking surf hostel in Weligama, Sri Lanka.',
    indexable: true,
  },
  '/contact': {
    name: 'Contact & FAQs',
    title: 'Contact & FAQs | Surf & Retreat Hostel Weligama',
    description:
      'Get in touch with Surf & Retreat Hostel Weligama — booking questions, directions from Colombo Airport and answers to common questions.',
    indexable: true,
  },
  '/book': {
    name: 'Book',
    title: 'Book Your Stay | Surf & Retreat Hostel Weligama',
    description: 'Request a bed, surf package or coworking pass at Surf & Retreat Hostel Weligama.',
    noindex: true,
    indexable: false,
  },
};

// One page per room and surf package (their "View Details" pages).
for (const room of ROOMS) {
  ROUTE_META[`/rooms/${room.id}`] = {
    name: room.title,
    parent: { name: 'Rooms', path: '/rooms' },
    title: `${room.title} in Weligama, ${room.price} | ${SUFFIX}`,
    description: `${room.description} ${room.capacity}, ${room.price}, five minutes from Weligama Bay.`,
    indexable: true,
  };
}
for (const pkg of SURF_PACKAGES) {
  ROUTE_META[`/surf-camp/${pkg.id}`] = {
    name: pkg.title,
    parent: { name: 'Surf Camp', path: '/surf-camp' },
    title: `${pkg.title} in Weligama, ${pkg.price} | ${SUFFIX}`,
    description: `${pkg.description} ${pkg.price} at Surf & Retreat Hostel Weligama.`,
    indexable: true,
  };
}

export const NOT_FOUND_META: RouteMeta = {
  name: 'Page not found',
  title: 'Page not found | Surf & Retreat Hostel Weligama',
  description: 'That page does not exist. Head back to the Surf & Retreat Hostel Weligama home page.',
  noindex: true,
  indexable: false,
};

/** '/experience/' -> '/experience' (router paths are already relative to the base). */
export const normalizePath = (pathname: string) => {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
};

/** Real pages only — unknown URLs get the noindex not-found page, with no canonical or JSON-LD. */
export const isKnownRoute = (pathname: string) => normalizePath(pathname) in ROUTE_META;

export const metaFor = (pathname: string): RouteMeta => ROUTE_META[normalizePath(pathname)] ?? NOT_FOUND_META;

export const canonicalFor = (pathname: string) => {
  const path = normalizePath(pathname);
  return path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`;
};

export const INDEXABLE_PATHS = Object.entries(ROUTE_META)
  .filter(([, m]) => m.indexable)
  .map(([path]) => path);

export interface HeadTag {
  attr: 'name' | 'property';
  key: string;
  content: string;
}

/** The <meta> tags for a route — used by the client hook and by the prerenderer. */
export const headTags = (pathname: string): HeadTag[] => {
  const meta = metaFor(pathname);
  const tags: HeadTag[] = [
    { attr: 'name', key: 'description', content: meta.description },
    { attr: 'property', key: 'og:type', content: 'website' },
    { attr: 'property', key: 'og:site_name', content: SITE_NAME },
    { attr: 'property', key: 'og:title', content: meta.title },
    { attr: 'property', key: 'og:description', content: meta.description },
    { attr: 'property', key: 'og:image', content: DEFAULT_OG_IMAGE },
    { attr: 'name', key: 'twitter:card', content: 'summary_large_image' },
    { attr: 'name', key: 'twitter:title', content: meta.title },
    { attr: 'name', key: 'twitter:description', content: meta.description },
    { attr: 'name', key: 'twitter:image', content: DEFAULT_OG_IMAGE },
  ];
  if (isKnownRoute(pathname)) tags.push({ attr: 'property', key: 'og:url', content: canonicalFor(pathname) });
  if (meta.noindex) tags.push({ attr: 'name', key: 'robots', content: 'noindex, follow' });
  return tags;
};
