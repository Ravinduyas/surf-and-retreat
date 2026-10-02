import { chromium } from 'playwright';
const [OUT, BASE] = process.argv.slice(2);
const browser = await chromium.launch();
for (const [w, label] of [[1365,'desktop'],[390,'phone']]) {
  const page = await browser.newPage({ viewport: { width: w, height: 800 } });
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(900);
  const read = async () => page.evaluate(() => {
    const el = document.getElementById('site-navbar');
    const r = el.getBoundingClientRect();
    return { y: Math.round(r.y), h: Math.round(r.height) };
  });
  const a = await read();
  await page.evaluate(() => window.scrollTo(0, 1500));
  await page.waitForTimeout(800);
  const b = await read();
  await page.screenshot({ path: `${OUT}/thin-${label}.png` });
  console.log(`${label.padEnd(8)} in-card: h=${a.h} y=${a.y}   stuck: h=${b.h} y=${b.y}`);
  await page.close();
}
await browser.close();
