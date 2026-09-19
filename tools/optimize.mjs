import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const SRC = 'source-photos/meka';
const OUT = 'public/images';
const H = `${SRC}/hostel surf and retreat`;
const R = `${SRC}/privare rooms apartment syle`;
const F = `${SRC}/foods`;

// [source file, output name, width]
const JOBS = [
  // Dorms
  [`${H}/WhatsApp Image 2025-12-23 at 13.11.44 (2) - Copy.jpeg`, 'dorm-8bed', 1200],
  [`${H}/WhatsApp Image 2025-12-23 at 13.11.44 (1) - Copy.jpeg`, 'dorm-curtain-pod', 1200],
  [`${H}/WhatsApp Image 2025-12-23 at 13.01.22.jpeg`, 'dorm-bunks', 1200],
  [`${H}/WhatsApp Image 2025-12-23 at 13.01.23 (2).jpeg`, 'dorm-bunk-close', 1200],
  [`${H}/WhatsApp Image 2025-12-23 at 13.01.23.jpeg`, 'dorm-bunk-ladder', 1200],
  [`${H}/WhatsApp Image 2025-12-23 at 13.20.24.jpeg`, 'dorm-bed-made', 1200],
  // Private rooms
  [`${R}/WhatsApp Image 2026-04-22 at 14.08.18 (1).jpeg`, 'private-double', 1200],
  [`${R}/WhatsApp Image 2026-04-22 at 14.08.18 (5) - Copy.jpeg`, 'private-double-2', 1200],
  [`${R}/WhatsApp Image 2026-04-22 at 14.10.02.jpeg`, 'private-fourposter', 1200],
  [`${R}/WhatsApp Image 2026-04-22 at 14.09.58.jpeg`, 'private-fourposter-2', 1200],
  [`${R}/WhatsApp Image 2026-04-22 at 14.08.19 (1).jpeg`, 'apartment-kitchen', 1200],
  [`${R}/WhatsApp Image 2026-04-22 at 14.09.58 (2).jpeg`, 'apartment-kitchen-2', 1200],
  // Coworking
  [`${H}/WhatsApp Image 2025-12-23 at 13.01.27 (2).jpeg`, 'coworking', 1400],
  [`${H}/WhatsApp Image 2025-12-23 at 13.01.27.jpeg`, 'coworking-2', 1400],
  // Property & around
  [`${H}/Front Hostel Sign View.jpeg`, 'hostel-sign', 1400],
  [`${H}/WhatsApp Image 2025-11-18 at 01.38.29.jpeg`, 'garden', 1400],
  [`${R}/WhatsApp Image 2026-04-22 at 14.09.57 (3).jpeg`, 'building-exterior', 1400],
  [`${H}/WhatsApp Image 2025-12-23 at 13.01.21.jpeg`, 'scooter-surfboard', 1600],
  [`${H}/WhatsApp Image 2025-12-23 at 11.50.14.jpeg`, 'hostel-dog-bike', 1200],
  // Food — the standouts
  [`${F}/Banging Bagel.jpg`, 'food-bagel-beach', 1400],
  [`${F}/Hummus and homemade chips.jpg`, 'food-hummus-beach', 1400],
  [`${F}/Banana Blush smoothie bowl.jpg`, 'food-smoothie-bowl', 1200],
  [`${F}/tuna poke 1.jpg`, 'food-tuna-poke', 1200],
  [`${F}/Coconut Waffle.jpg`, 'food-coconut-waffle', 1200],
  [`${F}/Supergreen Pasta.jpg`, 'food-supergreen-pasta', 1200],
  [`${F}/beef burger.jpg`, 'food-burger', 1200],
  [`${F}/Shakshuka.jpg`, 'food-shakshuka', 1200],
  [`${F}/milano poach eggs (2).jpg`, 'food-poached-eggs', 1200],
  [`${F}/Coastal fish curry.jpg`, 'food-fish-curry', 1200],
  [`${F}/Pistachio Prawn 2.jpg`, 'food-prawn-pasta', 1200],
  [`${F}/watermelon feta bowl.jpg`, 'food-watermelon-feta', 1200],
];

/** Widths emitted for every photo so browsers can pick per device. */
const STEPS = [400, 800, 1200, 1600];

fs.mkdirSync(OUT, { recursive: true });
const manifest = {};
let total = 0;

for (const [src, name, width] of JOBS) {
  if (!fs.existsSync(src)) {
    console.error('MISSING:', src);
    continue;
  }
  const meta = await sharp(src).rotate().metadata();
  const maxWidth = Math.min(width, meta.width);
  const widths = [...new Set([...STEPS.filter((w) => w < maxWidth), maxWidth])];

  for (const w of widths) {
    const dest = path.join(OUT, w === maxWidth ? `${name}.webp` : `${name}-${w}.webp`);
    await sharp(src).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 82 }).toFile(dest);
    total += fs.statSync(dest).size / 1024;
  }

  manifest[name] = {
    w: maxWidth,
    h: Math.round((meta.height / meta.width) * maxWidth),
    variants: widths,
  };
  console.log(`${name}  ${widths.join('/')}`);
}

fs.writeFileSync('src/image-manifest.json', JSON.stringify(manifest, null, 1) + '\n');
console.log(`\n${JOBS.length} photos, ${Object.values(manifest).reduce((n, m) => n + m.variants.length, 0)} files, ${Math.round(total / 1024 * 10) / 10}MB total`);
