// ─────────────────────────────────────────────────────────────
// Minimal REST server (Node stdlib only) exposing the engine.
// Run: `npm start`  →  http://localhost:8787
//
// This is the API surface the PMS front-end / booking engine calls
// instead of talking to Beds24. Endpoints:
//   GET  /health
//   GET  /connectors              — connectors + certification state
//   GET  /calendar?room=DLXK      — source-of-truth ARI
//   POST /ari                     — set a BAR cell, auto-republish
//   POST /webhooks/:channel       — inbound OTA booking notification
//   GET  /sync-log
//   GET  /parity
// ─────────────────────────────────────────────────────────────
import { createServer } from 'node:http';
import { SourceOfTruth } from './sourceOfTruth.ts';
import { ConnectorRegistry, PushEngine } from './pushEngine.ts';
import { ReservationDelivery } from './reservationDelivery.ts';
import { computeParity } from './parity.ts';
import { MockConnector } from './adapters/mock.ts';
import { BookingComConnector } from './adapters/bookingcom.ts';
import { ExpediaConnector } from './adapters/expedia.ts';
import { AgodaConnector } from './adapters/agoda.ts';
import { HostelworldConnector } from './adapters/hostelworld.ts';
import type { AriCell, ChannelCode } from './types.ts';

function bootstrap() {
  const sot = new SourceOfTruth();
  sot.addRoomType({ code: 'DLXK', name: 'Deluxe King', physicalCount: 12, occupancy: 2 });
  sot.addRoomType({ code: 'OVK', name: 'Ocean View King', physicalCount: 8, occupancy: 2 });
  sot.addRatePlan({ code: 'BAR', name: 'Best Available', refundable: true, channels: ['BDC', 'EXP', 'AGD', 'DIRECT'] });
  sot.addRatePlan({ code: 'NREF', name: 'Non-refundable', refundable: false, parent: 'BAR', offsetType: 'percent', offsetValue: -10, channels: ['BDC', 'EXP', 'AGD'] });
  for (const date of ['2026-05-04', '2026-05-05', '2026-05-06']) {
    sot.setCell({ roomType: 'DLXK', ratePlan: 'BAR', date, price: 285, available: 12, minStay: 1 });
    sot.setCell({ roomType: 'OVK', ratePlan: 'BAR', date, price: 320, available: 8, minStay: 1 });
  }
  const registry = new ConnectorRegistry();
  registry.register(new MockConnector('BDC', 'Booking.com (direct)'));
  registry.register(new MockConnector('EXP', 'Expedia (direct)'));
  registry.register(new MockConnector('AGD', 'Agoda (direct)'));
  registry.register(new HostelworldConnector());
  // Real (inert) adapters kept alongside for the connectors listing.
  const inert = [new BookingComConnector(), new ExpediaConnector(), new AgodaConnector()];
  const engine = new PushEngine(registry, sot);
  const delivery = new ReservationDelivery(registry, sot, engine);
  return { sot, registry, engine, delivery, inert };
}

const { sot, registry, engine, delivery, inert } = bootstrap();

function json(res: import('node:http').ServerResponse, code: number, body: unknown) {
  const s = JSON.stringify(body, null, 2);
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(s);
}

async function readBody(req: import('node:http').IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { return {}; }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname;
  const liveChannels: ChannelCode[] = registry.live().map((c) => c.channel);

  try {
    if (path === '/health') return json(res, 200, { ok: true, service: 'helio-channel-engine' });

    if (path === '/connectors') {
      const list = [...registry.all(), ...inert].map((c) => ({
        channel: c.channel, name: c.name, protocol: c.protocol,
        certification: c.certification, health: c.health, capabilities: c.capabilities,
      }));
      return json(res, 200, list);
    }

    if (path === '/calendar') {
      const room = url.searchParams.get('room') ?? 'DLXK';
      const cells: AriCell[] = [];
      for (const d of ['2026-05-04', '2026-05-05', '2026-05-06']) {
        const c = sot.getCell(room, 'BAR', d);
        if (c) cells.push(c);
      }
      return json(res, 200, cells);
    }

    if (path === '/ari' && req.method === 'POST') {
      const b = await readBody(req);
      sot.setCell({ roomType: b.roomType, ratePlan: 'BAR', date: b.date,
        price: b.price, available: b.available, minStay: b.minStay ?? 1,
        stopSell: b.stopSell });
      await engine.publish(liveChannels, `ari.set ${b.roomType} ${b.date}`);
      return json(res, 200, { ok: true, republishedTo: liveChannels });
    }

    if (path.startsWith('/webhooks/') && req.method === 'POST') {
      const channel = path.split('/')[2] as ChannelCode;
      const b = await readBody(req);
      const resv = await delivery.handle(channel, { raw: b });
      return json(res, resv ? 200 : 404, resv ?? { error: 'unknown channel' });
    }

    if (path === '/sync-log') return json(res, 200, engine.log.slice(-50));

    if (path === '/parity') return json(res, 200, computeParity(sot, liveChannels));

    return json(res, 404, { error: 'not found', path });
  } catch (e) {
    return json(res, 500, { error: String(e) });
  }
});

const PORT = Number(process.env.PORT ?? 8787);
server.listen(PORT, () => {
  process.stdout.write(`helio-channel-engine listening on http://localhost:${PORT}\n`);
});
