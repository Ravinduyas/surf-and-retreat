import {
  StatItem,
  HighlightItem,
  ExploreCard,
  RoomItem,
  SurfPackage,
  ActivityItem,
  SurfSpot,
  CoworkingPlan,
  Amenity,
  Testimonial,
  Review,
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
    to: '/rooms',
  },
  {
    id: 'surf',
    title: 'Surf',
    description: 'Learn on Weligama’s gentle, sandy-bottom waves.',
    image: img('surf-board-carry.webp'),
    iconType: 'wave',
    to: '/surf-camp',
  },
  {
    id: 'yoga',
    title: 'Yoga',
    description: 'Sunrise rooftop classes for surf-tight shoulders.',
    image: img('guest-portrait.webp'),
    iconType: 'yoga',
    to: '/services',
  },
  {
    id: 'skate',
    title: 'Skate',
    description: 'Surfskate sessions to keep your balance sharp on flat days.',
    image: img('skate-wave.webp'),
    iconType: 'skate',
    to: '/services',
  },
  {
    id: 'work',
    title: 'Co-working',
    description: 'Fast wifi and focus space, ocean air included.',
    image: img('coworking.webp'),
    iconType: 'laptop',
    to: '/coworking-coliving',
  },
];

export const EXPLORE_CARDS: ExploreCard[] = [
  {
    id: 'rooms',
    tag: 'Rooms & Stay',
    title: 'Sleep Well, Steps from the Surf',
    description: 'Mixed and female dorms, A/C doubles and an ensuite with its own kitchen.',
    image: img('dorm-bed-made.webp'),
    to: '/rooms',
  },
  {
    id: 'surf',
    tag: 'Surf School',
    title: 'Your First Wave Starts Here',
    description: 'Lessons, coaching and board rental on Weligama Bay.',
    image: img('surf-beach-board.webp'),
    to: '/surf-camp',
  },
  {
    id: 'coworking',
    tag: 'Coworking',
    title: 'Deep Work, Then Sunset Sessions',
    description: 'Dedicated desks, call booths and 300 Mbps fiber.',
    image: img('coworking-2.webp'),
    to: '/coworking-coliving',
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

/** "from $12/night" - the room card text for a bundled nightly rate. */
export const perNight = (amount: number) => `from $${amount}/night`;

/**
 * Builds a room with its display prices taken from `nightly`, so the two can't drift apart.
 * Ids are what the PMS price feed is keyed by (see pms.ts), so keep them stable.
 */
const room = (r: Omit<RoomItem, 'pricePerNight' | 'price'>): RoomItem => ({
  ...r,
  pricePerNight: perNight(r.nightly),
  price: perNight(r.nightly),
});

// Cheapest first: the SEO copy reads ROOMS[0] as the "from" price and the last room as the top price.
// Nightly rates are placeholders until the PMS supplies real ones.
export const ROOMS: RoomItem[] = [
  room({
    id: 'mixed-dorm',
    tag: 'Dorm',
    title: '6-Bed Mixed Dorm',
    description: 'Our social ground-floor dorm with six bunk beds, a short walk from Weligama Bay.',
    image: img('dorm-8bed.webp'),
    category: 'Shared',
    nightly: 12,
    capacity: 'Sleeps 6 · Mixed · Ground floor',
    maxGuests: 6,
    features: ['Bunk beds: 2 × 7′×4′, 4 × 6′×5′', 'Ground floor', 'Shared bathroom', 'Mixed dorm'],
    highlight: 'The social heart of the hostel - easiest place to find a surf buddy.',
  }),
  room({
    id: 'female-dorm',
    tag: 'Dorm',
    title: '6-Bed Female Dorm',
    description: 'Our big first-floor dorm reserved for female travellers, with bunk beds and a shared bathroom.',
    image: img('dorm-bunks.webp'),
    category: 'Shared',
    nightly: 13,
    capacity: 'Sleeps 6 · Female only · 1st floor',
    maxGuests: 6,
    features: ['Bunk beds: 2 × 6′×5′, 2 × 6′×4′, 2 × 7′×7′', 'First floor', 'Shared bathroom', 'Female only'],
    highlight: 'A calmer floor upstairs, just for women.',
  }),
  room({
    id: 'female-dorm-ensuite',
    tag: 'Dorm',
    title: '6-Bed Female Dorm Ensuite',
    description: 'A first-floor female dorm with its own private bathroom.',
    image: img('dorm-curtain-pod.webp'),
    category: 'Shared',
    nightly: 15,
    capacity: 'Sleeps 6 · Female only · 1st floor',
    maxGuests: 6,
    features: ['Private bathroom', 'Beds: 2 × 6′×5′, 4 × 7′×4′', 'First floor', 'Female only'],
    highlight: 'A female dorm with a bathroom you only share with your roommates.',
  }),
  room({
    id: 'bunk-double',
    tag: 'Private',
    title: 'Bunk Bed Double Room',
    description: 'A private ground-floor room with one bunk bed for two - great for friends travelling together.',
    image: img('dorm-bunk-close.webp'),
    category: 'Private',
    nightly: 22,
    capacity: 'Sleeps 2 · Bunk bed · Ground floor',
    maxGuests: 2,
    features: ['Bunk bed: 2 × 6′×5′', 'Private room', 'Shared bathroom', 'Ground floor'],
    highlight: 'Your own room for the price of two beds.',
  }),
  room({
    id: 'double-shared',
    tag: 'Private',
    title: 'Standard Double Room',
    description: 'A private non-A/C double with a queen-size bed and a shared bathroom.',
    image: img('private-fourposter.webp'),
    category: 'Private',
    nightly: 25,
    capacity: 'Sleeps 2 · Queen bed',
    maxGuests: 2,
    features: ['Queen-size bed', 'Fan (non-A/C)', 'Shared bathroom', 'Private room'],
    highlight: 'The simplest way to get a room of your own.',
  }),
  room({
    id: 'double-ac-shared',
    tag: 'Private',
    title: 'Standard Double Room A/C',
    description: 'A private air-conditioned double with a queen-size bed and a shared bathroom.',
    image: img('private-double-2.webp'),
    category: 'Private',
    nightly: 30,
    capacity: 'Sleeps 2 · Queen bed · A/C',
    maxGuests: 2,
    features: ['Air conditioning', 'Queen-size bed', 'Shared bathroom', 'Private room'],
    highlight: 'Cool nights without paying for an ensuite.',
  }),
  room({
    id: 'double-ensuite-kitchen',
    tag: 'Apartment',
    title: 'Standard Double Ensuite with Kitchen',
    description: 'An apartment-style non-A/C double with a queen-size bed, private bathroom and its own kitchen.',
    image: img('apartment-kitchen-2.webp'),
    category: 'Private',
    nightly: 35,
    capacity: 'Sleeps 2 · Queen bed · Kitchen',
    maxGuests: 2,
    features: ['Kitchen included', 'Private ensuite bathroom', 'Queen-size bed', 'Fan (non-A/C)'],
    highlight: 'Cook your own meals - made for long stays.',
  }),
  room({
    id: 'double-ac-ensuite',
    tag: 'Private',
    title: 'Standard Double Room A/C Ensuite',
    description: 'A private air-conditioned double with a queen-size bed and your own bathroom.',
    image: img('private-double.webp'),
    category: 'Private',
    nightly: 38,
    capacity: 'Sleeps 2 · Queen bed · A/C',
    maxGuests: 2,
    features: ['Air conditioning', 'Private ensuite bathroom', 'Queen-size bed', 'Private room'],
    highlight: 'Our most comfortable double - favourite of couples and remote workers.',
  }),
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
    highlight: 'Most guests stand up on day one - Weligama is the easiest wave in Sri Lanka.',
    amount: 149,
    unit: ' / week',
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
    highlight: 'Small groups of max 4 - filmed from land and reviewed over coffee.',
    amount: 189,
    unit: ' / week',
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
    highlight: 'Guests get 20% off all rentals - half-day from just $5.',
    amount: 5,
    unit: ' / half-day',
    from: true,
    price: 'from $5 / half-day',
  },
];

// Skate and yoga add-ons for the booking flow. Prices are placeholders until the PMS supplies real ones.
export const SKATE_OPTIONS: ActivityItem[] = [
  {
    id: 'skate-lesson',
    category: 'Skate',
    title: 'Surfskate Lesson',
    meta: 'All levels · 1 hour',
    description: 'Train your surf turns on land with a coach at the local skate park.',
    image: img('skate-park.webp'),
    amount: 15,
    unit: ' / session',
  },
  {
    id: 'skate-rental',
    category: 'Skate',
    title: 'Surfskate Rental',
    meta: 'Board & helmet',
    description: 'Take a surfskate out on the flat days.',
    image: img('skate-bowl.webp'),
    amount: 5,
    unit: ' / day',
  },
];

export const YOGA_OPTIONS: ActivityItem[] = [
  {
    id: 'yoga-class',
    category: 'Yoga',
    title: 'Sunrise Yoga Class',
    meta: 'Drop-in · mats provided',
    description: 'A rooftop class that stretches out surf-tight shoulders.',
    amount: 8,
    unit: ' / class',
  },
];

// One-off activity add-ons, offered alongside skate and yoga on the extras step. The surf and
// coworking entries are single sessions on purpose: the week-long packages and desk plans keep
// their own steps. Prices are placeholders until the PMS supplies real ones.
export const SURF_EXTRAS: ActivityItem[] = [
  {
    id: 'surf-single-lesson',
    category: 'Surf',
    title: 'Single Surf Lesson',
    meta: '90 min · board & rash vest',
    description: 'One morning lesson on Weligama Bay’s sandy-bottom break, no package needed.',
    amount: 35,
    unit: ' / lesson',
  },
];

export const FITNESS_OPTIONS: ActivityItem[] = [
  {
    id: 'fitness-day-pass',
    category: 'Fitness',
    title: 'Gym Day Pass',
    meta: 'Free weights & cardio · 6 AM – 9 PM',
    description: 'The open-air gym beside the skate ramp, yours for the day.',
    amount: 4,
    unit: ' / day',
  },
];

export const COWORKING_EXTRAS: ActivityItem[] = [
  {
    id: 'desk-day-pass',
    category: 'Co-working',
    title: 'Coworking Day Pass',
    meta: 'Hot desk · 8 AM – 10 PM',
    description: 'A desk on 300 Mbps fiber for a single day, without taking a plan.',
    amount: 8,
    unit: ' / day',
  },
];

export const WHALE_OPTIONS: ActivityItem[] = [
  {
    id: 'whale-trip',
    category: 'Whale Watching',
    title: 'Whale Watching Trip',
    meta: 'Mirissa · 6 AM start · Nov–Apr',
    description: 'Early boat out of nearby Mirissa to spot blue whales and dolphins.',
    amount: 45,
    unit: ' / seat',
  },
];

export const GEM_OPTIONS: ActivityItem[] = [
  {
    id: 'gem-workshop',
    category: 'Gem Crafting',
    title: 'Gem Crafting Workshop',
    meta: 'Half day · all materials included',
    description: 'Cut and polish a Sri Lankan stone with a local gem cutter.',
    amount: 30,
    unit: ' / workshop',
  },
];

export const SURF_SPOTS: SurfSpot[] = [
  {
    id: 'weligama-bay',
    name: 'Weligama Bay',
    distance: 'On your doorstep',
    level: 'Beginner',
    description: 'A 2 km sandy-bottom beach break - the best learning wave in Sri Lanka.',
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
    amount: 8,
    price: '$8',
    period: 'per day',
    features: ['Hot desk 8 AM – 10 PM', '300 Mbps fiber wifi', 'Unlimited filter coffee', 'AC focus room access'],
  },
  {
    id: 'week-pass',
    name: 'Week Pass',
    amount: 39,
    price: '$39',
    period: 'per week',
    features: ['Everything in Day Pass', 'Call booth bookings', 'Locker & monitor use', 'Community dinner Friday'],
    popular: true,
  },
  {
    id: 'month-pass',
    name: 'Month Pass',
    amount: 129,
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
      'I came for a week and stayed two months. Morning surf, deep work till four, sunset with the crew - the routine I never wanted to leave.',
  },
  {
    id: 't2',
    name: 'Dan O.',
    origin: 'Melbourne, Australia',
    quote:
      'The wifi is genuinely fast - I ran client calls from the booth every day. And I finally learned to surf at 34. Best month of my year.',
  },
  {
    id: 't3',
    name: 'Priya S.',
    origin: 'London, UK',
    quote:
      'The female dorm was spotless and the staff treated us like family. Weligama Bay is five minutes barefoot - you can’t beat that.',
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
    to: '/rooms',
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
    to: '/coworking-coliving',
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
    to: '/surf-camp',
  },
  {
    id: 'skating',
    title: 'Skating',
    description:
      'Surfskate and skate sessions - keep your balance dialled in on the flat days.',
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
    id: 'whale-watching',
    title: 'Whale Watching',
    description:
      'Early boat trips out of nearby Mirissa to spot blue whales and dolphins, November to April.',
    price: 'Ask at the desk',
    image: img('weligama-bay-aerial.webp'),
    iconType: 'whale',
    group: 'extra',
  },
];

export const GALLERY_IMAGES: GalleryImage[] = [
  // Rooms
  { id: 'g1', src: img('dorm-8bed.webp'), alt: 'The 6-bed mixed dorm', category: 'rooms' },
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

// Real 5-star Google reviews (names as shown on Google, dates are the month they were posted).
export const REVIEWS: Review[] = [
  {
    id: 'r1',
    name: 'Maggie Meyer',
    origin: 'Google review',
    rating: 5,
    stayType: 'Coworking',
    date: 'March 2026',
    quote:
      'This hostel is beautifully located in a quiet and peaceful area. It’s very clean, social, and at the same time perfect for coworking. The atmosphere is amazing – relaxed but welcoming. The hosts are lovely and caring, and there is always someone around who is happy to help with anything. I truly felt comfortable and supported during my stay. Highly recommended!',
  },
  {
    id: 'r2',
    name: 'Noémi Bartók',
    origin: 'Google review',
    rating: 5,
    stayType: 'Social stay',
    date: 'February 2026',
    quote:
      'Really great hostel! Close to the beach, clean, and has big communal and working spaces and a really well equipped kitchen. The beds are super big and comfy! The host and workers are all super kind, hospitable and fun, and you always have the chance to go out or have a calm night as well. I had the most fun in this hostel, felt welcomed and understood at all times and could only recommend it!',
  },
  {
    id: 'r3',
    name: 'Marina Izquierdo',
    origin: 'Google review',
    rating: 5,
    stayType: 'Social stay',
    date: 'March 2026',
    quote:
      'Best hostel ever! The volunteers were simply amazing – kind, professional and inspiring people. The beds were so comfortable and the AC made it perfect to sleep there. The best social hostel in the world: we did yoga together, had family breakfast, dinner, played games… if you go to Weligama, stay there!',
  },
  {
    id: 'r4',
    name: 'Dilan Shashen',
    origin: 'Google review',
    rating: 5,
    stayType: 'Coworking',
    date: 'January 2026',
    quote:
      'Surf & Retreat Weligama is one of the best hostels I’ve stayed in. The place is spotless, the beds are super comfy, and the coworking area is perfect for getting work done. Great location close to everything. I felt completely safe during my stay. Relax, sip my drink, and enjoy the easy-going, chill surfer vibe. Loved it!',
  },
  {
    id: 'r5',
    name: 'Anjejoline Stevens',
    origin: 'Google review',
    rating: 5,
    stayType: 'Relaxed stay',
    date: 'December 2025',
    quote:
      'Really lovely place to stay: calm vibe, super clean and very welcoming. The beds are comfortable, and the free co-working space is a plus. A truly relaxing and refreshing stay!',
  },
  {
    id: 'r6',
    name: 'Palika Withana',
    origin: 'Google review',
    rating: 5,
    stayType: 'Friends trip',
    date: 'November 2025',
    quote:
      'We had a lovely experience staying at Surf and Retreat. The staff was amazing and the owners were so nice and accommodating. The rooms were so clean and nice too. Easy access to the beach and other main areas of Weligama, it’s a prime location. We would definitely come again! Highly recommend!',
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
      'The south coast works best from November to April, with clean, gentle waves ideal for learning. Weligama Bay is surfable almost year-round though - summer just brings more onshore wind.',
  },
  {
    id: 'faq-transfer',
    question: 'Do you arrange airport transfers?',
    answer:
      'Yes. We can book a private taxi from Colombo Airport (about 2.5 hours, ~$55) - just send us your flight details after booking. Budget option: the highway bus to Matara plus a short tuk-tuk ride.',
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
      'Yes - we have four queen-bed doubles (with or without A/C, ensuite or shared bathroom, one with its own kitchen) and a private bunk-bed room for two friends. For families we can also connect a private room with dorm beds nearby.',
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

export const ABOUT_IMAGES = {
  story: img('garden.webp'),
  location: img('building-exterior.webp'),
};

export const CONTACT_INFO = {
  address: 'No. 24, Beach Road, Weligama 81700, Sri Lanka',
  phone: '+94 77 749 7887',
  email: 'hello@surfandretreat.lk',
  // The hostel's Google Maps listing (same place as the embedded map on /services).
  mapsUrl: 'https://maps.google.com/?cid=11401800430014995282',
};
