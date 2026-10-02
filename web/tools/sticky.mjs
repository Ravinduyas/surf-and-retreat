import { chromium } from 'playwright';
const [OUT, BASE] = process.argv.slice(2);
const browser = await chromium.launch();
for (const [w, label] of [[1365,'desktop'],[390,'phone']]) {
  const page = await browser.newPage({ viewport: { width: w, height: 800 } });
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(900);
  const read = async () => page.evaluate(() => {
    const el = document.getElementById('site-navbar');
    if (!el) return { missing: true };
    const r = el.getBoundingClientRect();
    return { y: Math.round(r.y), bg: getComputedStyle(el).backgroundColor };
  });
  const top = await read();
  await page.screenshot({ path: `${OUT}/nv-${label}-top.png` });
  for (const y of [600, 1600]) {
    await page.evaluate(v => window.scrollTo(0, v), y);
    await page.waitForTimeout(700);
    const s = await read();
    console.log(`${label.padEnd(8)} scrollY=${String(y).padEnd(5)} navbar y=${s.y}  bg=${s.bg}`);
    await page.screenshot({ path: `${OUT}/nv-${label}-${y}.png` });
  }
  console.log(`${label.padEnd(8)} at top     navbar y=${top.y}  bg=${top.bg}`);
  await page.close();
}
await browser.close();
