import { chromium } from 'playwright';
const [OUT, BASE] = process.argv.slice(2);
const browser = await chromium.launch();
const track = (page, sel) => page.evaluate(s => {
  const t = [...document.querySelectorAll(s + ' .marquee-track')].find(e => e.getBoundingClientRect().width > 0);
  return t ? t.getBoundingClientRect().x : null;
}, sel);
for (const [w, tag] of [[1365, 'desk'], [390, 'phone'], [320, 'xs']]) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2 });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.mouse.move(1, 1);
  const strip = page.locator('div.border-y').first();
  await strip.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  if (tag !== 'xs') await strip.screenshot({ path: `${OUT}/platforms-${tag}.png` });
  const o1 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  await page.goto(`${BASE}about`, { waitUntil: 'networkidle' });
  await page.mouse.move(1, 1);
  const story = page.locator('section:has(h2:has-text("Run Like a"))').first();
  await story.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  const a = await track(page, 'section:has(h2)');
  await page.waitForTimeout(1500);
  const b = await track(page, 'section:has(h2)');
  if (tag === 'phone') await page.locator('section:has(h2:has-text("Run Like a")) .marquee').first().screenshot({ path: `${OUT}/story-phone.png` });
  const o2 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(`${String(w).padStart(4)}px  home overflow ${o1} | about stats: ${a === null ? 'static grid' : `slider moved ${Math.round(a - b)}px/1.5s`}, overflow ${o2}`);
  await page.close();
}
await browser.close();
