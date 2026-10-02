import { chromium } from 'playwright';
const [OUT, URL] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1365, height: 700 } });
const marks = [200, 500, 900, 1400, 2000, 2600, 3200, 4000];
const start = Date.now();
await page.goto(URL, { waitUntil: 'commit', timeout: 60000 });
for (const m of marks) {
  const wait = m - (Date.now() - start);
  if (wait > 0) await page.waitForTimeout(wait);
  const state = await page.evaluate(() => {
    const fog = document.querySelector('.fog-clear');
    const pre = document.querySelector('.preloader');
    const img = document.querySelector('.hero-img-in');
    const cs = el => el ? getComputedStyle(el) : null;
    return {
      preloader: pre ? `opacity ${cs(pre).opacity}` : 'gone',
      fogOpacity: fog ? cs(fog).opacity : 'none',
      imgComplete: img ? img.complete : 'n/a',
    };
  });
  await page.screenshot({ path: `${OUT}/t-${String(m).padStart(4,'0')}.png` });
  console.log(`${String(m).padStart(4)}ms  preloader:${state.preloader}  heroFogVeil:${state.fogOpacity}  imgLoaded:${state.imgComplete}`);
}
await browser.close();
