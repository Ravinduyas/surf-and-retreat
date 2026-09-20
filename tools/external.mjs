import { chromium } from 'playwright';
const BASE = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1365, height: 900 }, reducedMotion: 'reduce' });
for (const p of ['', 'experience', 'services', 'gallery', 'about', 'contact']) {
  const ext = new Map();
  const onResp = r => {
    const u = r.url();
    if (r.request().resourceType() === 'image' && !u.startsWith('http://localhost')) {
      const host = new URL(u).host;
      ext.set(host, (ext.get(host) || 0) + 1);
    }
  };
  page.on('response', onResp);
  await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle' });
  await page.evaluate(async () => { await new Promise(r => { let y=0; const s=()=>{ y+=600; window.scrollTo(0,y); if(y<document.body.scrollHeight) setTimeout(s,60); else setTimeout(r,500); }; s(); }); });
  await page.waitForTimeout(800);
  // which section do the external images sit in?
  const where = await page.evaluate(() => [...document.images]
    .filter(i => i.currentSrc && !i.currentSrc.startsWith('http://localhost'))
    .map(i => (i.closest('section')?.querySelector('h2')?.textContent || 'no section').trim().slice(0, 40)));
  page.off('response', onResp);
  const summary = [...ext].map(([h, n]) => `${n} from ${h}`).join(', ') || 'none';
  console.log(`/${(p || 'home').padEnd(11)} external images: ${summary}${where.length ? `  -> in: ${[...new Set(where)].join(' | ')}` : ''}`);
}
await browser.close();
