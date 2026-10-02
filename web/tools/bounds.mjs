import { chromium } from 'playwright';
const [OUT, BASE] = process.argv.slice(2);
const browser = await chromium.launch();
for (const [w, h, label] of [[1440,900,'desktop'],[1365,700,'short'],[390,844,'phone']]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const card = document.getElementById('site-navbar')?.parentElement?.parentElement;
    const imgWrap = document.querySelector('.hero-img-in')?.parentElement;
    const b = el => { const x = el.getBoundingClientRect(); return { top: Math.round(x.top), bottom: Math.round(x.bottom), right: Math.round(x.right) }; };
    return { card: card ? b(card) : null, img: imgWrap ? b(imgWrap) : null };
  });
  const spillY = r.card && r.img ? r.img.bottom - r.card.bottom : null;
  const spillX = r.card && r.img ? r.img.right - r.card.right : null;
  console.log(`${label.padEnd(8)} card bottom=${r.card?.bottom} right=${r.card?.right} | image bottom=${r.img?.bottom} right=${r.img?.right} | spill below=${spillY}px right=${spillX}px`);
  await page.close();
}
await browser.close();
