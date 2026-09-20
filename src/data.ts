import {
  StatItem,
  HighlightItem,
  ExploreCard,
  RoomItem,
  SurfPackage,
  SurfSpot,
  CoworkingPlan,
  Amenity,
  Testimonial,
  Review,
  CafeDish,
  ServiceItem,
  GalleryImage,
  FaqItem,
  ValueItem,
} from './types';

/**
 * Real hostel photography lives in public/images and must be resolved
 * against the deploy base path (the site is served from a subfolder).
 */
const img = (name: string) => `${import.meta.env.BASE_URL}images/${name}`;

export const STATS: StatItem[] = [
  { id: '1', value: '5 min', label: 'Walk to Weligama Bay' },
  { id: '2', value: '28', label: 'Beds, Dorm & Private' },
  { id: '3', value: '300 Mbps', label: 'Fiber Wifi + Backup' },
  { id: '4', value: '4.9★', label: '600+ Guest Reviews' },
];

export const HIGHLIGHTS: HighlightItem[] = [
  {
    id: 'stay',
    title: 'Stay',
    description: 'Breezy dorms & private rooms steps from the bay.',
    image: img('dorm-bunks.webp'),
    iconType: 'bed',
    to: '/experience#rooms',
  },
  {
    id: 'surf',
    title: 'Surf',
    description: 'Learn on Weligama’s gentle, sandy-bottom waves.',
    image: img('surf-board-carry.webp'),
    iconType: 'wave',
    to: '/experience#surf',
  },
  {
    id: 'work',
    title: 'Work',
    description: 'Fast wifi and focus space, ocean air included.',
    image: img('coworking.webp'),
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
    image: img('dorm-bed-made.webp'),
    to: '/experience#rooms',
  },
  {
    id: 'surf',
    tag: 'Surf School',
    title: 'Your First Wave Starts Here',
    description: 'Lessons, coaching and board rental on Weligama Bay.',
    image: img('surf-beach-board.webp'),
    to: '/experience#surf',
  },
  {
    id: 'coworking',
    tag: 'Coworking',
    title: 'Deep Work, Then Sunset Sessions',
    description: 'Dedicated desks, call booths and 300 Mbps fiber.',
    image: img('coworking-2.webp'),
    to: '/experience#coworking',
  },
  {
    id: 'about',
    tag: 'The Retreat',
    title: 'A Home for Surfers & Remote Workers',
    description: 'The story, the crew and the community behind the hostel.',
    image: img('hostel-sign.webp'),
    to: '/about',
  },
];

export const ROOMS: RoomItem[] = [
  {
    id: 'surfer-dorm',
    tag: 'Dorm',
    title: '8-Bed Surfer Dorm',
    description: 'Our social hub — big fans, big lockers and the best surf chat in Weligama.',
    image: img('dorm-8bed.webp'),
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
    image: img('dorm-curtain-pod.webp'),
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
    image: img('private-double.webp'),
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
    image: img('private-fourposter.webp'),
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
    image: img('surf-walk-in.webp'),
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
    image: img('weligama-bay-aerial.webp'),
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
    image: img('surf-sunset-board.webp'),
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

export const SERVICES: ServiceItem[] = [
  {
    id: 'rooms',
    title: 'Rooms',
    description:
      'Curtain-pod dorms and private AC rooms, all a five-minute walk from Weligama Bay.',
    price: 'from $12 / night',
    image: img('dorm-8bed.webp'),
    iconType: 'rooms',
    group: 'core',
    to: '/experience#rooms',
  },
  {
    id: 'coworking',
    title: 'Co-working',
    description:
      'Dedicated desks, call booths and an AC focus room on 300 Mbps fiber with 4G backup.',
    price: 'from $8 / day',
    image: img('coworking.webp'),
    iconType: 'coworking',
    group: 'core',
    to: '/experience#coworking',
  },
  {
    id: 'surfing',
    title: 'Surfing',
    description:
      'Sunrise lessons with local instructors, video coaching and boards for every level.',
    price: 'from $5 / rental',
    image: img('surf-walk-in.webp'),
    iconType: 'surfing',
    group: 'core',
    to: '/experience#surf',
  },
  {
    id: 'skating',
    title: 'Skating',
    description:
      'Surfskate and skate sessions — keep your balance dialled in on the flat days.',
    price: 'Ask at the desk',
    image: img('skate-park.webp'),
    iconType: 'skating',
    group: 'extra',
  },
  {
    id: 'yoga',
    title: 'Yoga',
    description:
      'Sunrise rooftop classes that stretch out surf-tight shoulders. Mats provided.',
    price: '$8 / class',
    image: img('guest-portrait.webp'),
    iconType: 'yoga',
    group: 'extra',
  },
  {
    id: 'transfer',
    title: 'Pick Up & Drop',
    description:
      'Door-to-door transfers from Colombo airport or Weligama station, day or night.',
    price: 'from $35',
    image: img('building-exterior.webp'),
    iconType: 'transfer',
    group: 'extra',
  },
  {
    id: 'laundry',
    title: 'Laundry',
    description:
      'Drop your bag before breakfast, get it back folded by sunset — salt, sand and wax gone.',
    price: '$3 / kg',
    image: img('dorm-bed-made.webp'),
    iconType: 'laundry',
    group: 'extra',
  },
];

export const GALLERY_IMAGES: GalleryImage[] = [
  // Rooms
  { id: 'g1', src: img('dorm-8bed.webp'), alt: 'The 8-bed surfer dorm', category: 'rooms' },
  { id: 'g2', src: img('dorm-curtain-pod.webp'), alt: 'Bunk with privacy curtain', category: 'rooms' },
  { id: 'g3', src: img('dorm-bunk-ladder.webp'), alt: 'Dorm bunk beds with ladder', category: 'rooms' },
  { id: 'g4', src: img('dorm-bed-made.webp'), alt: 'Freshly made bed with towels', category: 'rooms' },
  { id: 'g5', src: img('private-double.webp'), alt: 'Private double room', category: 'rooms' },
  { id: 'g6', src: img('private-fourposter.webp'), alt: 'Four-poster bed with mosquito net', category: 'rooms' },
  { id: 'g7', src: img('apartment-kitchen-2.webp'), alt: 'Apartment-style room with kitchenette', category: 'rooms' },
  { id: 'g8', src: img('apartment-kitchen.webp'), alt: 'Shared kitchen for long stays', category: 'rooms' },
  // Coworking
  { id: 'g9', src: img('coworking.webp'), alt: 'Coworking room with desks and ergonomic chairs', category: 'coworking' },
  { id: 'g10', src: img('coworking-2.webp'), alt: 'Bright workspace with sea-facing windows', category: 'coworking' },
  // Food — the hostel kitchen
  { id: 'g11', src: img('food-bagel-beach.webp'), alt: 'The Banging Bagel, served by the beach', category: 'food' },
  { id: 'g12', src: img('food-hummus-beach.webp'), alt: 'Hummus with homemade chips on the sand', category: 'food' },
  { id: 'g13', src: img('food-smoothie-bowl.webp'), alt: 'Banana blush smoothie bowl', category: 'food' },
  { id: 'g14', src: img('food-tuna-poke.webp'), alt: 'Fresh tuna poke bowl', category: 'food' },
  { id: 'g15', src: img('food-coconut-waffle.webp'), alt: 'Coconut waffles', category: 'food' },
  { id: 'g16', src: img('food-poached-eggs.webp'), alt: 'Poached eggs on avocado toast', category: 'food' },
  { id: 'g17', src: img('food-shakshuka.webp'), alt: 'Shakshuka with fresh bread', category: 'food' },
  { id: 'g18', src: img('food-supergreen-pasta.webp'), alt: 'Supergreen pasta', category: 'food' },
  { id: 'g19', src: img('food-prawn-pasta.webp'), alt: 'Pistachio prawn pasta', category: 'food' },
  { id: 'g20', src: img('food-fish-curry.webp'), alt: 'Coastal fish curry', category: 'food' },
  { id: 'g21', src: img('food-burger.webp'), alt: 'Beef burger with homemade chips', category: 'food' },
  { id: 'g22', src: img('food-watermelon-feta.webp'), alt: 'Watermelon and feta bowl', category: 'food' },
  // Around the hostel
  { id: 'g23', src: img('hostel-sign.webp'), alt: 'Surf & Retreat Hostel entrance sign', category: 'around' },
  { id: 'g24', src: img('garden.webp'), alt: 'Garden and hangout area', category: 'around' },
  { id: 'g25', src: img('building-exterior.webp'), alt: 'The hostel building and balcony', category: 'around' },
  { id: 'g26', src: img('scooter-surfboard.webp'), alt: 'Rental scooter with a board rack at dusk', category: 'around' },
  { id: 'g27', src: img('hostel-dog-bike.webp'), alt: 'The hostel dog keeping watch', category: 'around' },
  // Surf & skate
  { id: 'g28', src: img('surf-walk-in.webp'), alt: 'Heading out for a session on Weligama Bay', category: 'surf' },
  { id: 'g29', src: img('surf-board-carry.webp'), alt: 'Board overhead, ready to paddle out', category: 'surf' },
  { id: 'g30', src: img('surf-beach-board.webp'), alt: 'Checking the waves before a surf', category: 'surf' },
  { id: 'g31', src: img('surf-sunset-board.webp'), alt: 'Surfboard at sunset', category: 'surf' },
  { id: 'g32', src: img('weligama-bay-aerial.webp'), alt: 'Weligama Bay from above', category: 'surf' },
  { id: 'g33', src: img('skate-park.webp'), alt: 'Carving the skate park', category: 'surf' },
  { id: 'g34', src: img('skate-bowl.webp'), alt: 'Surfskate session in the bowl', category: 'surf' },
  { id: 'g35', src: img('skate-covered-ramp.webp'), alt: 'Skating under the covered ramp', category: 'surf' },
  { id: 'g36', src: img('skate-wave.webp'), alt: 'A wave from the skate ramp', category: 'surf' },
  // Beach life
  { id: 'g37', src: img('beach-sunset.webp'), alt: 'Sunset over the south coast', category: 'around' },
  { id: 'g38', src: img('beach-coconut.webp'), alt: 'King coconut on the beach', category: 'around' },
  { id: 'g39', src: img('beach-palm.webp'), alt: 'Palm tree over the waves', category: 'around' },
  { id: 'g40', src: img('guest-portrait.webp'), alt: 'Golden hour in the garden', category: 'around' },
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

export const HERO_IMAGE = img('scooter-surfboard.webp');

export const SERVICES_HERO_IMAGE = img('hostel-dog-bike.webp');

export const CAFE_DISHES: CafeDish[] = [
  {
    id: 'bagel',
    name: 'The Banging Bagel',
    note: 'Bacon, egg and avocado — the post-session favourite.',
    image: img('food-bagel-beach.webp'),
  },
  {
    id: 'smoothie-bowl',
    name: 'Banana Blush Bowl',
    note: 'Fruit, seeds and nuts, blended cold for hot mornings.',
    image: img('food-smoothie-bowl.webp'),
  },
  {
    id: 'poke',
    name: 'Tuna Poke Bowl',
    note: 'Line-caught tuna from the Weligama boats each morning.',
    image: img('food-tuna-poke.webp'),
  },
  {
    id: 'curry',
    name: 'Coastal Fish Curry',
    note: 'The Sri Lankan classic, cooked the way our chef’s mother does.',
    image: img('food-fish-curry.webp'),
  },
  {
    id: 'waffle',
    name: 'Coconut Waffles',
    note: 'Golden, crisp and drenched in island coconut treacle.',
    image: img('food-coconut-waffle.webp'),
  },
  {
    id: 'pasta',
    name: 'Pistachio Prawn Pasta',
    note: 'Fresh prawns, pistachio pesto — our most photographed plate.',
    image: img('food-prawn-pasta.webp'),
  },
];

export const ABOUT_IMAGES = {
  story: img('garden.webp'),
  location: img('building-exterior.webp'),
};

export const CONTACT_INFO = {
  address: 'No. 24, Beach Road, Weligama 81700, Sri Lanka',
  phone: '+94 77 123 4567',
  email: 'hello@surfandretreat.lk',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Weligama+Bay+Sri+Lanka',
};
