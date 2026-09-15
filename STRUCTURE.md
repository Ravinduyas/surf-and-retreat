# Site Structure — Surf & Retreat Hostel Weligama

Live site: https://ravinduyas.github.io/surf-and-retreat/
Sitemap: https://ravinduyas.github.io/surf-and-retreat/sitemap.xml (6 URLs)

## Canonical pages

| URL | Page | Notes |
|-----|------|-------|
| `/` | Home | Hero, highlights, explore, services preview, gallery preview, reviews |
| `/experience` | Stay, Surf & Work | Merged page with `#rooms`, `#surf`, `#coworking` anchor sections |
| `/services` | Guest Services | Pickup, scooters, laundry, tours, yoga, storage |
| `/gallery` | Gallery | Filterable photo grid with lightbox |
| `/about` | About Us | Story, values, testimonials |
| `/contact` | Contact & FAQs | Form (visual-only), location, FAQ accordion |

## Redirects (excluded from sitemap)

`/rooms`, `/surf`, `/coworking` are client-side redirects to the matching
`/experience` anchor. Anchor URLs (`/experience#rooms` etc.) are fragments of
one page and are also not sitemap entries.

## Maintenance

- `public/sitemap.xml` is copied into `dist/` by Vite on build and deployed
  with the site. Update `<lastmod>` (W3C date, `YYYY-MM-DD`) only when a page's
  actual content changes — Google ignores inaccurate values.
- GitHub Pages project sites cannot serve a domain-root `robots.txt`, so the
  sitemap should be submitted directly in Google Search Console
  (Indexing → Sitemaps → `https://ravinduyas.github.io/surf-and-retreat/sitemap.xml`).
- `<priority>`/`<changefreq>` are deliberately omitted (ignored by Google).
