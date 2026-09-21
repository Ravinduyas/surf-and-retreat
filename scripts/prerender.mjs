// Turns the client-side build into static pages, so every route is served with HTTP 200 and its own
// title, description, canonical, JSON-LD and body text — GitHub Pages can't rewrite SPA routes.
//
//   vite build                                        -> dist/            (client bundle + index.html template)
//   vite build --ssr src/entry-server.tsx --outDir dist-ssr
//   node scripts/prerender.mjs                        -> dist/*.html, dist/404.html, dist/sitemap.xml
//
// GitHub Pages serves /experience from experience.html, so each route becomes <route>.html.
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const root = process.cwd();
const dist = path.join(root, 'dist');
const {render, head, PRERENDER_PATHS, INDEXABLE_PATHS} = await import(
  pathToFileURL(path.join(root, 'dist-ssr', 'entry-server.js')).href
);

const SITE_URL = 'https://ravinduyas.github.io/surf-and-retreat';
const template = await fs.readFile(path.join(dist, 'index.html'), 'utf8');

for (const marker of ['<!--seo-head-->', '<div id="root"></div>']) {
  if (!template.includes(marker)) throw new Error(`dist/index.html is missing ${marker}`);
}

// The hero preload only pays off on the home page.
const HERO_PRELOAD = /\s*<link\s+rel="preload"\s+as="image"[^>]*>/;

const build = (routePath, html) => {
  const {title, tags} = head(routePath);
  let page = template
    .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
    .replace('<!--seo-head-->', tags)
    .replace('<div id="root"></div>', `<div id="root">${html}</div>`);
  if (routePath !== '/') page = page.replace(HERO_PRELOAD, '');
  return page;
};

const fileFor = (routePath) => (routePath === '/' ? 'index.html' : `${routePath.slice(1)}.html`);

for (const routePath of PRERENDER_PATHS) {
  const html = await render(routePath);
  await fs.writeFile(path.join(dist, fileFor(routePath)), build(routePath, html));
  console.log(`prerendered ${routePath.padEnd(22)} -> ${fileFor(routePath)} (${html.length} bytes of markup)`);
}

// Unknown URLs: GitHub Pages serves 404.html with a 404 status; the client renders the not-found page.
await fs.writeFile(path.join(dist, '404.html'), build('/404', ''));
console.log('wrote 404.html (client-rendered not-found shell)');

// sitemap.xml — lastmod from git history where there is any, otherwise today.
const SOURCES = {
  '/': 'src/pages/HomePage.tsx',
  '/experience': 'src/pages/ExperiencePage.tsx',
  '/rooms': 'src/pages/RoomsPage.tsx',
  '/surf-camp': 'src/pages/SurfCampPage.tsx',
  '/coworking-coliving': 'src/pages/CoworkingPage.tsx',
  '/services': 'src/pages/ServicesPage.tsx',
  '/gallery': 'src/pages/GalleryPage.tsx',
  '/about': 'src/pages/AboutPage.tsx',
  '/contact': 'src/pages/ContactPage.tsx',
};
const today = new Date().toISOString().slice(0, 10);
const lastCommit = (file) => {
  try {
    return execFileSync('git', ['log', '-1', '--format=%cs', '--', file], {encoding: 'utf8'}).trim() || undefined;
  } catch {
    return undefined;
  }
};
const dataDate = lastCommit('src/data.ts');
const lastmod = (routePath) =>
  [lastCommit(SOURCES[routePath]), dataDate].filter(Boolean).sort().pop() ?? today;

const urls = INDEXABLE_PATHS.map((p) => {
  const loc = p === '/' ? `${SITE_URL}/` : `${SITE_URL}${p}`;
  return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod(p)}</lastmod>\n  </url>`;
});
await fs.writeFile(
  path.join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
);
console.log(`wrote sitemap.xml (${urls.length} URLs)`);
