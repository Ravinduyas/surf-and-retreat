import {StrictMode} from 'react';
import {renderToPipeableStream} from 'react-dom/server';
import {StaticRouter} from 'react-router-dom';
import {Writable} from 'node:stream';
import App from './App.tsx';
import {buildJsonLd} from './structuredData';
import {INDEXABLE_PATHS, canonicalFor, headTags, isKnownRoute, metaFor} from './seo';

/** Routes that get their own prerendered HTML file. /book is included so it is served with a noindex tag. */
export const PRERENDER_PATHS = [...INDEXABLE_PATHS, '/book'];
export {INDEXABLE_PATHS};

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** <title> text and the <head> tags for a route (the same values usePageMeta applies on the client). */
export function head(path: string): {title: string; tags: string} {
  const tags = headTags(path).map(
    ({attr, key, content}) => `<meta ${attr}="${escapeHtml(key)}" content="${escapeHtml(content)}" />`,
  );
  if (isKnownRoute(path)) {
    tags.push(`<link rel="canonical" href="${escapeHtml(canonicalFor(path))}" />`);
    // "<" is escaped so the JSON can never close its own <script> tag.
    const json = JSON.stringify(buildJsonLd(path)).replace(/</g, '\\u003c');
    tags.push(`<script id="ld-json" type="application/ld+json">${json}</script>`);
  }
  return {title: escapeHtml(metaFor(path).title), tags: tags.join('\n    ')};
}

/** Renders one route to an HTML string, waiting for every lazy page chunk to resolve. */
export function render(path: string): Promise<string> {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');

  return new Promise((resolve, reject) => {
    let html = '';
    const sink = new Writable({
      write(chunk, _encoding, done) {
        html += chunk.toString();
        done();
      },
      final(done) {
        resolve(html);
        done();
      },
    });

    const {pipe} = renderToPipeableStream(
      <StrictMode>
        <StaticRouter basename={base} location={`${base}${path}`}>
          <App />
        </StaticRouter>
      </StrictMode>,
      {
        onAllReady: () => pipe(sink),
        onShellError: reject,
        onError: reject,
      },
    );
  });
}
