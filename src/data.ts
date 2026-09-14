import {
  StatItem,
  HeroLinkCard,
  HighlightItem,
  ExploreCard,
  RoomItem,
  SurfPackage,
  SurfSpot,
  CoworkingPlan,
  Amenity,
  Testimonial,
  Review,
  FaqItem,
  ValueItem,
} from './types';

export const STATS: StatItem[] = [
  { id: '1', value: '5 min', label: 'Walk to Weligama Bay' },
  { id: '2', value: '28', label: 'Beds, Dorm & Private' },
  { id: '3', value: '300 Mbps', label: 'Fiber Wifi + Backup' },
  { id: '4', value: '4.9★', label: '600+ Guest Reviews' },
];

export const HERO_CARDS: HeroLinkCard[] = [
  {
    id: 'surf-lessons',
    title: 'Surf Lessons',
    description: 'Daily 6:30 AM sessions, all levels welcome.',
    image: 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?q=80&w=300&auto=format&fit=crop',
    to: '/experience#surf',
  },
  {
    id: 'beds-privates',
    title: 'Beds & Privates',
    description: 'Dorms from $12, AC private rooms.',
    image: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=300&auto=format&fit=crop',
    to: '/experience#rooms',
  },
  {
    id: 'work-by-the-bay',
    title: 'Work by the Bay',
    description: 'Fiber wifi, call booths, cold brew.',
    image: 'https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?q=80&w=300&auto=format&fit=crop',
    to: '/experience#coworking',
  },
];

export const HIGHLIGHTS: HighlightItem[] = [
  {
    id: 'stay',
    title: 'Stay',
    description: 'Breezy dorms & private rooms steps from the bay.',
    image: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=900&auto=format&fit=crop',
    iconType: 'bed',
    to: '/experience#rooms',
  },
  {
    id: 'surf',
    title: 'Surf',
    description: 'Learn on Weligama’s gentle, sandy-bottom waves.',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=900&auto=format&fit=crop',
    iconType: 'wave',
    to: '/experience#surf',
  },
  {
    id: 'work',
    title: 'Work',
    description: 'Fast wifi and focus space, ocean air included.',
    image: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?q=80&w=900&auto=format&fit=crop',
    iconType: 'laptop',
    to: '/experience#coworking',
  },
];

export const EXPLORE_CARDS: ExploreCard[] = [
  {
    id: 'rooms',
    tag: 'Rooms & Stay',
    title: 'Sleep Well, Steps from the Surf',
    description: 'Curtain-pod dorms, AC privates and a garden bungalow.',
    image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800&auto=format&fit=crop',
    to: '/experience#rooms',
  },
  {
    id: 'surf',
    tag: 'Surf School',
    title: 'Your First Wave Starts Here',
    description: 'Lessons, coaching and board rental on Weligama Bay.',
    image: 'https://images.unsplash.com/photo-1468413253725-0d5181091126?q=80&w=800&auto=format&fit=crop',
    to: '/experience#surf',
  },
  {
    id: 'coworking',
    tag: 'Coworking',
    title: 'Deep Work, Then Sunset Sessions',
    description: 'Dedicated desks, call booths and 300 Mbps fiber.',
    image: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=800&auto=format&fit=crop',
    to: '/experience#coworking',
  },
  {
    id: 'about',
    tag: 'The Retreat',
    title: 'A Home for Surfers & Remote Workers',
    description: 'The story, the crew and the community behind the hostel.',
    image: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?q=80&w=800&auto=format&fit=crop',
    to: '/about',
  },
];

export const ROOMS: RoomItem[] = [
  {
    id: 'surfer-dorm',
    tag: 'Dorm',
    title: '8-Bed Surfer Dorm',
    description: 'Our social hub — big fans, big lockers and the best surf chat in Weligama.',
    image: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?q=80&w=800&auto=format&fit=crop',
    category: 'Shared',
    pricePerNight: 'from $12/night',
    capacity: 'Sleeps 8 · Mixed',
    features: ['Curtain pods & reading lights', 'Personal lockers', 'Board rack outside', 'Hot rain showers'],
    highlight: 'Most booked bed in the house — surfers love the 6 AM wake-up crew.',
    price: 'from $12/night',
  },
  {
    id: 'female-dorm',
    tag: 'Dorm',
    title: '4-Bed Female Dorm',
    description: 'A calmer, cosier dorm reserved for female travellers, with ensuite bathroom.',
    image: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=800&auto=format&fit=crop',
    category: 'Shared',
    pricePerNight: 'from $15/night',
    capacity: 'Sleeps 4 · Female only',
    features: ['Ensuite bathroom', 'Curtain pods & mirrors', 'AC at night', 'Extra-large lockers'],
    highlight: 'Ensuite bathroom and night-time AC — the quiet corner of the hostel.',
    price: 'from $15/night',
  },
  {
    id: 'private-double',
    tag: 'Private',
    title: 'Private Double AC',
    description: 'A bright double room with air-con, desk space and your own bathroom.',
    image: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=800&auto=format&fit=crop',
    category: 'Private',
    pricePerNight: 'from $38/night',
    capacity: 'Sleeps 2 · Queen bed',
    features: ['Air conditioning', 'Private bathroom', 'Work desk & chair', 'Daily housekeeping'],
    highlight: 'Favourite of couples and remote workers who want their own space.',
    price: 'from $38/night',
  },
  {
    id: 'garden-bungalow',
    tag: 'Bungalow',
    title: 'Garden Bungalow',
    description: 'Standalone bungalow in the palm garden — veranda, hammock and total privacy.',
    image: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?q=80&w=800&auto=format&fit=crop',
    category: 'Private',
    pricePerNight: 'from $55/night',
    capacity: 'Sleeps 2–3 · King bed',
    features: ['Private veranda & hammock', 'King bed + day bed', 'Outdoor rain shower', 'Mini fridge & kettle'],
    highlight: 'Book early — there’s only one, and long-stayers rarely give it up.',
    price: 'from $55/night',
  },
];

export const SURF_PACKAGES: SurfPackage[] = [
  {
    id: 'beginner-week',
    tag: 'Beginner',
    title: 'Beginner Surf Week',
    description: 'Five morning lessons on Weligama Bay’s forgiving sandy-bottom beach break.',
    image: 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?q=80&w=800&auto=format&fit=crop',
    category: 'Surf Package',
    level: 'Beginner',
    includes: ['5 × 90-min group lessons', 'Board & rash vest all week', 'ISA-certified instructors', 'Video debrief on day 5'],
    highlight: 'Most guests stand up on day one — Weligama is the easiest wave in Sri Lanka.',
    price: '$149 / week',
  },
  {
    id: 'intermediate-coaching',
    tag: 'Intermediate',
    title: 'Intermediate Coaching',
    description: 'Video-analysis coaching to fix your pop-up, trim and turns on green waves.',
    image: 'https://images.unsplash.com/photo-1468413253725-0d5181091126?q=80&w=800&auto=format&fit=crop',
    category: 'Surf Package',
    level: 'Intermediate',
    includes: ['4 × coached sessions', 'Daily video analysis', 'Guided trips to Lazy Left', 'Surf theory evening'],
    highlight: 'Small groups of max 4 — filmed from land and reviewed over coffee.',
    price: '$189 / week',
  },
  {
    id: 'board-rental',
    tag: 'Rental',
    title: 'Board Rental',
    description: 'Softtops, funboards and shortboards, waxed and ready under the board rack.',
    image: 'https://images.unsplash.com/photo-1455729552865-3658a5d39692?q=80&w=800&auto=format&fit=crop',
    category: 'Surf Package',
    level: 'All levels',
    includes: ['Soft-tops to shortboards', 'Free wax & leash', 'Swap boards anytime', 'Free rack storage for guests'],
    highlight: 'Guests get 20% off all rentals — half-day from just $5.',
    price: 'from $5 / half-day',
  },
];

export const SURF_SPOTS: SurfSpot[] = [
  {
    id: 'weligama-bay',
    name: 'Weligama Bay',
    distance: 'On your doorstep',
    level: 'Beginner',
    description: 'A 2 km sandy-bottom beach break — the best learning wave in Sri Lanka.',
  },
  {
    id: 'lazy-left',
    name: 'Lazy Left & Lazy Right',
    distance: '10 min by tuk-tuk',
    level: 'Intermediate',
    description: 'Mellow reef points at Midigama with long, peeling shoulders.',
  },
  {
    id: 'mirissa',
    name: 'Mirissa',
    distance: '15 min by tuk-tuk',
    level: 'All levels',
    description: 'Fun beach and point waves, plus whale watching in season.',
  },
  {
    id: 'coconut-point',
    name: 'Coconut Point',
    distance: '12 min by tuk-tuk',
    level: 'Intermediate',
    description: 'A playful right-hander wrapping around a palm-backed reef.',
  },
];

export const COWORKING_PLANS: CoworkingPlan[] = [
  {
    id: 'day-pass',
    name: 'Day Pass',
    price: '$8',
    period: 'per day',
    features: ['Hot desk 8 AM – 10 PM', '300 Mbps fiber wifi', 'Unlimited filter coffee', 'AC focus room access'],
  },
  {
    id: 'week-pass',
    name: 'Week Pass',
    price: '$39',
    period: 'per week',
    features: ['Everything in Day Pass', 'Call booth bookings', 'Locker & monitor use', 'Community dinner Friday'],
    popular: true,
  },
  {
    id: 'month-pass',
    name: 'Month Pass',
    price: '$129',
    period: 'per month',
    features: ['Everything in Week Pass', 'Dedicated desk option', '24/7 access', '2 free surf lessons'],
  },
];

export const AMENITIES: Amenity[] = [
  { id: 'wifi', label: '300 Mbps Fiber', description: 'Plus 4G backup that kicks in automatically.', iconType: 'wifi' },
  { id: 'ac', label: 'AC Focus Room', description: 'A silent, chilled room for heads-down work.', iconType: 'ac' },
  { id: 'desk', label: 'Standing Desks', description: 'Ergonomic chairs and sit-stand desks.', iconType: 'desk' },
  { id: 'booth', label: 'Call Booths', description: 'Two private booths for meetings & calls.', iconType: 'booth' },
  { id: 'coffee', label: 'Cold Brew on Tap', description: 'Unlimited filter coffee and cold brew.', iconType: 'coffee' },
  { id: 'printer', label: 'Print & Scan', description: 'Printer, scanner and stationery corner.', iconType: 'printer' },
];

export const TESTIMONIALS: Testimonial[] = [
  {
    id: 't1',
    name: 'Mara K.',
    origin: 'Berlin, Germany',
    quote:
      'I came for a week and stayed two months. Morning surf, deep work till four, sunset with the crew — the routine I never wanted to leave.',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=120&auto=format&fit=crop',
  },
  {
    id: 't2',
    name: 'Dan O.',
    origin: 'Melbourne, Australia',
    quote:
      'The wifi is genuinely fast — I ran client calls from the booth every day. And I finally learned to surf at 34. Best month of my year.',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=120&auto=format&fit=crop',
  },
  {
    id: 't3',
    name: 'Priya S.',
    origin: 'London, UK',
    quote:
      'The female dorm was spotless and the staff treated us like family. Weligama Bay is five minutes barefoot — you can’t beat that.',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=120&auto=format&fit=crop',
  },
];

export const REVIEWS: Review[] = [
  {
    id: 'r1',
    name: 'Jonas W.',
    origin: 'Hamburg, Germany',
    rating: 5,
    stayType: 'Surf Camp',
    date: 'August 2026',
    quote:
      'Stood up on day two thanks to the instructors. Boards, lessons and beach transport all sorted by the hostel — zero hassle, all fun.',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=120&auto=format&fit=crop',
  },
  {
    id: 'r2',
    name: 'Amelia R.',
    origin: 'Bristol, UK',
    rating: 5,
    stayType: 'Coliving',
    date: 'July 2026',
    quote:
      'Worked remotely here for six weeks. The focus room is genuinely quiet, calls from the booths were flawless, and I surfed every single morning.',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=120&auto=format&fit=crop',
  },
  {
    id: 'r3',
    name: 'Lucas M.',
    origin: 'São Paulo, Brazil',
    rating: 5,
    stayType: 'Dorm Stay',
    date: 'June 2026',
    quote:
      'Cleanest dorm I have stayed in across Asia. Big lockers, curtains on every bunk and the best rooftop sunsets in Weligama.',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=120&auto=format&fit=crop',
  },
  {
    id: 'r4',
    name: 'Sofia L.',
    origin: 'Stockholm, Sweden',
    rating: 5,
    stayType: 'Private Room',
    date: 'August 2026',
    quote:
      'Booked three nights, stayed ten. The garden room was spotless and the family dinners made travelling solo feel anything but solo.',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=120&auto=format&fit=crop',
  },
  {
    id: 'r5',
    name: 'Ethan C.',
    origin: 'Toronto, Canada',
    rating: 4,
    stayType: 'Surf Camp',
    date: 'May 2026',
    quote:
      'Great value surf package and honest coaching with video review. Wish I had booked longer — the intermediate spots trips are worth it alone.',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=120&auto=format&fit=crop',
  },
  {
    id: 'r6',
    name: 'Hana T.',
    origin: 'Osaka, Japan',
    rating: 5,
    stayType: 'Coliving',
    date: 'April 2026',
    quote:
      'The 300 Mbps wifi is real — I uploaded video projects daily with no drama. Weligama Bay at sunrise before work never got old.',
    avatar: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?q=80&w=120&auto=format&fit=crop',
  },
];

export const FAQS: FaqItem[] = [
  {
    id: 'faq-checkin',
    question: 'What are check-in and check-out times?',
    answer:
      'Check-in is from 2 PM and check-out by 11 AM. Arriving early or leaving late? Store your bags for free and use the showers, coworking space and board rack while you wait.',
  },
  {
    id: 'faq-season',
    question: 'When is the surf season in Weligama?',
    answer:
      'The south coast works best from November to April, with clean, gentle waves ideal for learning. Weligama Bay is surfable almost year-round though — summer just brings more onshore wind.',
  },
  {
    id: 'faq-transfer',
    question: 'Do you arrange airport transfers?',
    answer:
      'Yes. We can book a private taxi from Colombo Airport (about 2.5 hours, ~$55) — just send us your flight details after booking. Budget option: the highway bus to Matara plus a short tuk-tuk ride.',
  },
  {
    id: 'faq-wifi',
    question: 'Is the wifi really good enough for remote work?',
    answer:
      'We run 300 Mbps fiber with an automatic 4G backup line, an AC focus room and two private call booths. Plenty of guests hold daily video calls and some have been working from here for months.',
  },
  {
    id: 'faq-hours',
    question: 'What are the coworking space hours?',
    answer:
      'The coworking area is open 8 AM to 10 PM for day and week passes, and 24/7 for month-pass holders and long-stay coliving guests.',
  },
  {
    id: 'faq-private',
    question: 'Do you have private rooms for couples or families?',
    answer:
      'Yes — the Private Double AC suits couples, and the Garden Bungalow sleeps up to three. Both have private bathrooms. For families we can also connect a private room with dorm beds nearby.',
  },
];

export const VALUES: ValueItem[] = [
  {
    id: 'v1',
    title: 'Ocean First',
    description: 'Weekly beach clean-ups, no single-use plastic and reef-safe everything.',
    iconType: 'wave',
  },
  {
    id: 'v2',
    title: 'Real Community',
    description: 'Family dinners, skill-share nights and a crew that remembers your name.',
    iconType: 'community',
  },
  {
    id: 'v3',
    title: 'Local Roots',
    description: 'Local instructors, local produce and fair wages for our Weligama team.',
    iconType: 'leaf',
  },
];

export const AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=120&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=120&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=120&auto=format&fit=crop',
];

export const HERO_IMAGES = {
  left: 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?q=80&w=1400&auto=format&fit=crop',
  right: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1400&auto=format&fit=crop',
};

export const ABOUT_IMAGES = {
  story: 'https://images.unsplash.com/photo-1586500036706-41963de24d8b?q=80&w=1200&auto=format&fit=crop',
  location: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?q=80&w=1200&auto=format&fit=crop',
};

export const CONTACT_INFO = {
  address: 'No. 24, Beach Road, Weligama 81700, Sri Lanka',
  phone: '+94 77 123 4567',
  email: 'hello@surfandretreat.lk',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Weligama+Bay+Sri+Lanka',
};
