import {StrictMode} from 'react';
import {createRoot, hydrateRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import App, {preloadRoute} from './App.tsx';
import './index.css';

const root = document.getElementById('root')!;

const app = (
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>
);

if (root.hasChildNodes()) {
  // Served from a prerendered page: attach to the existing markup once this route's chunk is
  // loaded, so hydration doesn't have to suspend on it.
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const path = window.location.pathname.startsWith(base)
    ? window.location.pathname.slice(base.length) || '/'
    : window.location.pathname;
  preloadRoute(path)
    .catch(() => undefined)
    .then(() => hydrateRoot(root, app));
} else {
  // The 404.html fallback shell (unknown URLs) has nothing to hydrate.
  createRoot(root).render(app);
}
