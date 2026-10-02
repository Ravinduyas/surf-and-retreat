// ─────────────────────────────────────────────────────────────
// End-to-end demo — run: `npm run demo`  (node --experimental-strip-types)
//
// Proves the DIRECT model end to end with NO Beds24 in the path:
//   1. build the PMS source of truth (rooms, BAR + derived rates, ARI)
//   2. register direct connectors (mock BDC/EXP/AGD live; real stubs inert)
//   3. publish ARI to every certified channel
//   4. an OTA delivers a booking → pooled inventory decrements →
//      engine re-pushes to all OTHER channels (overbooking guard)
//   5. print the sync log + a parity snapshot
// ─────────────────────────────────────────────────────────────
import { SourceOfTruth } from './sourceOfTruth.ts';
import { ConnectorRegistry, PushEngine } from './pushEngine.ts';
import { ReservationDelivery } from './reservationDelivery.ts';
import { computeParity } from './parity.ts';
import { MockConnector } from './adapters/mock.ts';
import { BookingComConnector } from './adapters/bookingcom.ts';
import { ExpediaConnector } from './adapters/expedia.ts';
import { AgodaConnector } from './adapters/agoda.ts';
import { HostelworldConnector } from './adapters/hostelworld.ts';
import type { ChannelCode } from './types.ts';

// deterministic clock so output is stable across runs
let tick = 0;
const clock = () => {
  tick += 1;
  const s = String(tick).padStart(2, '0');
  return `2026-05-01T14:00:${s}Z`;
};

function line(s = '') { process.stdout.write(s + '\n'); }
function rule(t: string) { line('\n\x1b[1m── ' + t + ' ' + '─'.repeat(Math.max(0, 56 - t.length)) + '\x1b[0m'); }

async function main() {
  // 1) Source of truth ────────────────────────────────────────
  const sot = new SourceOfTruth();
  sot.addRoomType({ code: 'DLXK', name: 'Deluxe King', physicalCount: 12, occupancy: 2 });
  sot.addRoomType({ code: 'OVK',  name: 'Ocean View King', physicalCount: 8, occupancy: 2 });
  sot.addRoomType({ code: 'DORM8', name: '8-bed Mixed Dorm', physicalCount: 8, occupancy: 8, bedLevel: true });

  // BAR is the parent; NREF and BKFST are DERIVED (recalculate on read).
  sot.addRatePlan({ code: 'BAR',   name: 'Best Available', refundable: true,
    channels: ['BDC', 'EXP', 'AGD', 'DIRECT'] });
  sot.addRatePlan({ code: 'NREF',  name: 'Non-refundable', refundable: false,
    parent: 'BAR', offsetType: 'percent', offsetValue: -10, channels: ['BDC', 'EXP', 'AGD'] });
  sot.addRatePlan({ code: 'BKFST', name: 'Bed & Breakfast', refundable: true,
    parent: 'BAR', offsetType: 'fixed', offsetValue: 15, channels: ['BDC', 'DIRECT'] });

  // Seed 3 nights of BAR ARI for two room types.
  for (const date of ['2026-05-04', '2026-05-05', '2026-05-06']) {
    sot.setCell({ roomType: 'DLXK', ratePlan: 'BAR', date, price: 285, available: 12, minStay: 1 });
    sot.setCell({ roomType: 'OVK',  ratePlan: 'BAR', date, price: 320, available: 8,  minStay: 1 });
  }

  line('\x1b[1mHelio Channel Engine — DIRECT distribution demo\x1b[0m');
  rule('Derived-rate resolution (one BAR edit cascades)');
  line(`BAR   DLXK 2026-05-04 = $${sot.resolvePrice('BAR', 'DLXK', '2026-05-04')}`);
  line(`NREF  DLXK 2026-05-04 = $${sot.resolvePrice('NREF', 'DLXK', '2026-05-04')}  (BAR -10%)`);
  line(`BKFST DLXK 2026-05-04 = $${sot.resolvePrice('BKFST', 'DLXK', '2026-05-04')}  (BAR +$15)`);

  // 2) Register DIRECT connectors ─────────────────────────────
  const registry = new ConnectorRegistry();
  // Live (mock transport standing in for certified direct connections):
  registry.register(new MockConnector('BDC', 'Booking.com (direct)'));
  registry.register(new MockConnector('EXP', 'Expedia (direct)'));
  registry.register(new MockConnector('AGD', 'Agoda (direct)'));
  // Real adapters — present but INERT until certified:
  registry.register(new BookingComConnector());
  registry.register(new ExpediaConnector());
  registry.register(new AgodaConnector());
  registry.register(new HostelworldConnector());
  // Note: the real BDC/EXP/AGD stubs share channel codes with the mocks;
  // the registry keeps the last registered per code, so the inert real
  // adapters would REPLACE the mocks in production once certified. For
  // this demo we register mocks first, then overwrite with reals — so
  // re-register the mocks last to keep the demo "live".
  registry.register(new MockConnector('BDC', 'Booking.com (direct)'));
  registry.register(new MockConnector('EXP', 'Expedia (direct)'));
  registry.register(new MockConnector('AGD', 'Agoda (direct)'));

  const engine = new PushEngine(registry, sot, clock);
  const delivery = new ReservationDelivery(registry, sot, engine, clock);

  rule('Connectors registered');
  for (const c of registry.all()) {
    const live = c.certification === 'certified' ? '\x1b[32mLIVE\x1b[0m' : '\x1b[33m' + c.certification + '\x1b[0m';
    line(`  ${c.channel.padEnd(6)} ${c.name.padEnd(26)} ${c.protocol.padEnd(9)} ${live}`);
  }

  // 3) Publish ARI to every live channel ──────────────────────
  const liveChannels: ChannelCode[] = registry.live().map((c) => c.channel);
  rule('Publish ARI to all live channels');
  await engine.publish(liveChannels, 'rate.bulk-update BAR next-3-days');

  // 4) Inbound booking → decrement → re-push ──────────────────
  rule('Inbound booking on Booking.com (pooled-inventory guard)');
  const before = sot.getCell('DLXK', 'BAR', '2026-05-04')?.available;
  const res = await delivery.handle('BDC', { raw: {
    ref: 'BDC-9928-1129', guest: 'Hiroshi Tanaka', roomType: 'DLXK',
    ratePlan: 'BAR', arrival: '2026-05-04', departure: '2026-05-06', amount: 570,
  }});
  const after = sot.getCell('DLXK', 'BAR', '2026-05-04')?.available;
  line(`  Booking ${res?.otaReference} · ${res?.guest} · ${res?.roomType} ${res?.arrival}→${res?.departure}`);
  line(`  DLXK 2026-05-04 availability: ${before} → ${after}  (decremented, re-pushed to EXP + AGD)`);

  // 5) Sync log + parity snapshot ─────────────────────────────
  rule('Sync log');
  for (const e of engine.log) {
    const color = e.status === 'success' ? '\x1b[32m' : e.status === 'retrying' ? '\x1b[33m' : '\x1b[31m';
    line(`  ${e.ts.slice(11, 19)} ${e.direction.toUpperCase().padEnd(4)} ${e.channel.padEnd(5)} ` +
      `${color}${e.status.padEnd(8)}\x1b[0m a${e.attempt} ${e.action}${e.detail ? ' · ' + e.detail : ''}`);
  }

  rule('Rate parity (BAR) — clean by construction');
  const overrides = new Map([['OVK|2026-05-05', { AGD: 302 }]]); // simulate a drifted channel
  const parity = computeParity(sot, liveChannels, overrides);
  for (const p of parity) {
    const tag = p.inParity ? '\x1b[32mOK\x1b[0m' : `\x1b[31mDRIFT ${p.worstDeltaPct}%\x1b[0m`;
    line(`  ${p.roomType.padEnd(6)} ${p.date}  ref $${p.reference}  worst Δ ${p.worstDeltaPct}%  ${tag}`);
  }

  line('\n\x1b[32m✓ direct distribution demo complete — no Beds24 in the path\x1b[0m\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
