import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { buildJsonLd } from '../structuredData';
import { HeadTag, canonicalFor, headTags, isKnownRoute, metaFor } from '../seo';

const upsertMeta = ({ attr, key, content }: HeadTag) => {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
};

/**
 * Keeps <title>, meta tags, canonical and JSON-LD in step with the current route.
 * The same values are baked into each page's static HTML at build time (scripts/prerender.mjs),
 * so this only does real work after client-side navigation.
 */
export function usePageMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = metaFor(pathname).title;

    const tags = headTags(pathname);
    tags.forEach(upsertMeta);
    // Tags that only some routes have must not linger from the previous route.
    for (const [attr, key] of [['name', 'robots'], ['property', 'og:url']] as const) {
      if (!tags.some((t) => t.key === key)) document.head.querySelector(`meta[${attr}="${key}"]`)?.remove();
    }

    const known = isKnownRoute(pathname);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!known) {
      canonical?.remove();
    } else {
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.rel = 'canonical';
        document.head.appendChild(canonical);
      }
      canonical.href = canonicalFor(pathname);
    }

    let ld = document.head.querySelector<HTMLScriptElement>('script#ld-json');
    if (!known) {
      ld?.remove();
    } else {
      if (!ld) {
        ld = document.createElement('script');
        ld.id = 'ld-json';
        ld.type = 'application/ld+json';
        document.head.appendChild(ld);
      }
      ld.textContent = JSON.stringify(buildJsonLd(pathname));
    }
  }, [pathname]);
}
