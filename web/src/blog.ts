// Blog posts. Each post gets its own prerendered page at /blog/<slug> and a sitemap entry;
// add a post by adding an entry here (newest first). Body blocks render in order.

const img = (name: string) => `${import.meta.env.BASE_URL}images/${name}`;

export type BlogBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'ul'; items: string[] };

export interface BlogPost {
  slug: string;
  title: string;
  /** One or two sentences: the card text and the meta description. */
  excerpt: string;
  category: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  readMinutes: number;
  image: string;
  body: BlogBlock[];
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'best-time-to-surf-weligama',
    title: 'When Is the Best Time to Surf in Weligama?',
    excerpt:
      'November to April is peak season on Sri Lanka’s south coast, but Weligama Bay is one of the few places you can learn almost all year. Here’s how the seasons play out.',
    category: 'Surf',
    date: '2026-10-12',
    readMinutes: 4,
    image: img('surf-sunset-board.webp'),
    body: [
      {
        type: 'p',
        text: 'Sri Lanka has two surf coasts with opposite seasons. The south coast, where Weligama sits, is at its best from November to April, while the east coast around Arugam Bay takes over from May to October.',
      },
      { type: 'h2', text: 'November to April: peak season' },
      {
        type: 'p',
        text: 'This is when the south coast lines up. Mornings are glassy, the wind stays light and offshore for longer, and the swell is consistent without being heavy. Weligama Bay turns into a long, friendly sandy-bottom beach break that is about as good as it gets for a first week on a board.',
      },
      {
        type: 'p',
        text: 'It is also the busiest time of year, so book beds and surf packages a few weeks ahead if you are coming over Christmas, New Year or February.',
      },
      { type: 'h2', text: 'May to October: the quieter months' },
      {
        type: 'p',
        text: 'The southwest monsoon brings more wind and bigger, messier swell to most of the south coast. Weligama Bay is sheltered enough to stay surfable for beginners most days, but expect more onshore wind in the afternoons. Surf early, take the rest of the day for work, yoga or the skate park, and enjoy emptier line-ups and lower prices.',
      },
      { type: 'h2', text: 'Where to surf once you’re hooked' },
      {
        type: 'ul',
        items: [
          'Weligama Bay - on your doorstep, the best learning wave in the country.',
          'Lazy Left & Lazy Right - mellow reef points at Midigama, about 10 minutes by tuk-tuk.',
          'Coconut Point - a playful right-hander, around 12 minutes away.',
          'Mirissa - fun beach and point waves 15 minutes east.',
        ],
      },
      {
        type: 'p',
        text: 'Whenever you come, our instructors pick the spot that suits the day’s swell and your level, so you spend your time riding waves instead of guessing.',
      },
    ],
  },
  {
    slug: 'colombo-airport-to-weligama',
    title: 'How to Get from Colombo Airport to Weligama',
    excerpt:
      'Private taxi, highway bus or the coastal train: the three ways to reach Weligama from Bandaranaike International Airport, with times and rough costs.',
    category: 'Travel',
    date: '2026-10-12',
    readMinutes: 3,
    image: img('scooter-surfboard.webp'),
    body: [
      {
        type: 'p',
        text: 'Weligama is on Sri Lanka’s south coast, roughly 150 km from Bandaranaike International Airport (CMB). Thanks to the Southern Expressway, the trip is far quicker than it used to be. These are your options.',
      },
      { type: 'h2', text: 'Private taxi: the easy way' },
      {
        type: 'p',
        text: 'A private car takes about 2.5 hours via the expressway and costs around $55. It is the best option after a long flight, with a board bag, or if you land at night. Send us your flight details after booking and we can arrange the driver to meet you at arrivals.',
      },
      { type: 'h2', text: 'Highway bus: the budget way' },
      {
        type: 'p',
        text: 'Express buses run along the Southern Expressway to Matara. Ask to be dropped close to Weligama, or ride to Matara and take a short tuk-tuk back along the coast. It is cheap and reasonably quick, but there is little room for big bags.',
      },
      { type: 'h2', text: 'Coastal train: the scenic way' },
      {
        type: 'p',
        text: 'Trains from Colombo Fort run down the coast to Weligama station, often with the ocean right outside the window. Get from the airport to Colombo Fort first by taxi or bus. It is slower than the road, but a great first afternoon in Sri Lanka if you are not in a hurry.',
      },
      { type: 'h2', text: 'Quick tips' },
      {
        type: 'ul',
        items: [
          'Pick up a local SIM card at the airport for maps and calls on the way.',
          'Carry some Sri Lankan rupees in small notes for buses and tuk-tuks.',
          'Tell us your arrival time, so we know when to expect you, day or night.',
        ],
      },
    ],
  },
  {
    slug: 'working-remotely-from-weligama',
    title: 'Working Remotely from Weligama: A Practical Guide',
    excerpt:
      'Fast fiber, a backup connection, time zones and a daily rhythm that fits surf around work. What digital nomads need to know before a stay in Weligama.',
    category: 'Coworking',
    date: '2026-10-12',
    readMinutes: 4,
    image: img('coworking-2.webp'),
    body: [
      {
        type: 'p',
        text: 'Weligama has quietly become one of Sri Lanka’s best bases for remote workers: warm water, a beginner-friendly bay, and a growing community of people doing the same thing. The big question is always the internet, so let’s start there.',
      },
      { type: 'h2', text: 'Internet you can rely on' },
      {
        type: 'p',
        text: 'Our coworking space runs on 300 Mbps fiber with a 4G backup, so a power cut or a line fault doesn’t end your call. There are dedicated desks, call booths for meetings and an air-conditioned focus room for deep work.',
      },
      { type: 'h2', text: 'Time zones' },
      {
        type: 'p',
        text: 'Sri Lanka is on UTC+5:30. That overlaps comfortably with Europe in the afternoon and leaves Asia-Pacific mornings free. If you work with the US, plan for late evenings, and keep your mornings for the surf.',
      },
      { type: 'h2', text: 'A day that works' },
      {
        type: 'ul',
        items: [
          'Sunrise: surf session on Weligama Bay while the wind is calm.',
          'Late morning to afternoon: focused work at your desk.',
          'Late afternoon: yoga, skate or a swim.',
          'Evening: calls with Europe or the US, then dinner with the house.',
        ],
      },
      { type: 'h2', text: 'Passes and longer stays' },
      {
        type: 'p',
        text: 'Desk passes start at $8 for a day, $39 for a week and $129 for a month, and hostel guests always get member rates. Staying a month or more? Our coliving bundle pairs a bed with a dedicated desk for less than booking the two separately.',
      },
    ],
  },
  {
    slug: 'whale-watching-mirissa',
    title: 'Whale Watching from Mirissa: What to Know',
    excerpt:
      'Blue whales, spinner dolphins and an early start: when to go, what the trip is like and how to plan it from Weligama.',
    category: 'Things to Do',
    date: '2026-10-12',
    readMinutes: 3,
    image: img('weligama-bay-aerial.webp'),
    body: [
      {
        type: 'p',
        text: 'Mirissa, about 15 minutes from Weligama by tuk-tuk, is one of the best places in the world to see blue whales. The continental shelf drops away close to shore here, which brings the whales within reach of a morning boat trip.',
      },
      { type: 'h2', text: 'When to go' },
      {
        type: 'p',
        text: 'The season runs from roughly November to April, the same months the south coast surf is at its best. Seas are calmer and sightings are more frequent in the middle of the season. Outside these months, most operators stop running trips.',
      },
      { type: 'h2', text: 'What the trip is like' },
      {
        type: 'p',
        text: 'Boats leave the harbour early in the morning and are usually back around midday. Besides blue whales, you might see sperm whales, spinner dolphins and flying fish. The open ocean can be choppy, so take seasickness tablets beforehand if you’re prone to it.',
      },
      { type: 'h2', text: 'Before you go' },
      {
        type: 'ul',
        items: [
          'Choose an operator that keeps its distance and limits the number of boats around each whale.',
          'Bring sunscreen, a hat, water and a light layer for the early start.',
          'Eat a light breakfast and sit near the back of the boat if you feel queasy.',
          'Plan it for a flat day, so you don’t miss good surf.',
        ],
      },
      {
        type: 'p',
        text: 'Ask at the front desk and we’ll help you book a trip and arrange a tuk-tuk to the harbour.',
      },
    ],
  },
];

export const postBySlug = (slug: string | undefined) => BLOG_POSTS.find((p) => p.slug === slug);

/** "2026-10-12" -> "12 October 2026", formatted the same on the server and in the browser. */
export const formatPostDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
