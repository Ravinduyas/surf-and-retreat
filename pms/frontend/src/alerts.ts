// ─────────────────────────────────────────────────────────────
// Audible alerts.
//
// The sounds are synthesised with the Web Audio API rather than loaded as
// files. That keeps the app self-contained — it works offline, there is nothing
// to 404, and no audio asset has to be shipped, cached or versioned.
//
// Three rules are load-bearing:
//
//   · **Only new events make a noise.** The poller starts from "now" and never
//     sounds for anything older. An alarm that goes off on every page refresh
//     is how alarms get switched off for good.
//
//   · **A blocked alarm must say so.** Browsers refuse to play audio until the
//     user has interacted with the page. A muted alarm that believes it is
//     armed is worse than no alarm, so that state is surfaced, not swallowed.
//
//   · **Distinguishable across a room.** Someone looking at a guest should be
//     able to tell an overbooking from a cancellation without looking up. The
//     three sounds differ in direction, timbre and rhythm, not just pitch.
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, useCallback } from 'react';

export type AlertKind = 'overbooking' | 'booking.new' | 'booking.cancelled';

// ─── The synthesiser ─────────────────────────────────────────

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

/** True once the browser will actually let us make a noise. */
export function audioReady(): boolean {
  return !!ctx && ctx.state === 'running';
}

/**
 * Unlock audio. Must be called from a real user gesture — a click or a key
 * press — or the browser will leave the context suspended.
 */
export async function enableAudio(): Promise<boolean> {
  const audio = context();
  if (!audio) return false;
  try {
    if (audio.state === 'suspended') await audio.resume();
    return audio.state === 'running';
  } catch {
    return false;
  }
}

interface Note {
  /** Hz at the start of the note. */
  from: number;
  /** Hz at the end — equal to `from` for a flat tone. */
  to?: number;
  /** Seconds from the start of the sound. */
  at: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
}

function play(notes: Note[], volume: number) {
  const audio = context();
  if (!audio || audio.state !== 'running' || volume <= 0) return;
  const master = audio.createGain();
  // Squared so the slider behaves the way ears do rather than the way numbers
  // do — halfway should sound halfway, not three-quarters.
  master.gain.value = (volume / 100) ** 2 * 0.5;
  master.connect(audio.destination);

  for (const note of notes) {
    const osc = audio.createOscillator();
    const env = audio.createGain();
    osc.type = note.type ?? 'sine';
    const start = audio.currentTime + note.at;
    const end = start + note.duration;

    osc.frequency.setValueAtTime(note.from, start);
    if (note.to && note.to !== note.from) {
      osc.frequency.exponentialRampToValueAtTime(note.to, end);
    }

    // Short ramps at both ends. Starting or stopping an oscillator at full gain
    // produces a click, which sounds like a fault rather than an alert.
    const peak = note.gain ?? 1;
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(peak, start + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(env);
    env.connect(master);
    osc.start(start);
    osc.stop(end + 0.02);
  }
}

/**
 * The three sounds.
 *
 * Overbooking is a two-tone alternation with a hard edge — the shape every
 * alarm in the world uses, because it is the one people react to. The other two
 * are single soft gestures that go in opposite directions, so "something
 * arrived" and "something went away" are told apart by contour rather than by
 * having to remember which beep meant which.
 */
export const SOUNDS: Record<AlertKind, { label: string; describe: string; notes: Note[] }> = {
  overbooking: {
    label: 'Overbooking alarm',
    describe: 'Urgent, two-tone, repeating',
    notes: [
      { from: 880, at: 0.00, duration: 0.16, type: 'square', gain: 0.55 },
      { from: 660, at: 0.18, duration: 0.16, type: 'square', gain: 0.55 },
      { from: 880, at: 0.36, duration: 0.16, type: 'square', gain: 0.55 },
      { from: 660, at: 0.54, duration: 0.22, type: 'square', gain: 0.55 },
    ],
  },
  'booking.new': {
    label: 'New booking',
    describe: 'A short rising chime',
    notes: [
      { from: 587, at: 0.00, duration: 0.14, type: 'sine', gain: 0.7 },
      { from: 880, at: 0.10, duration: 0.30, type: 'sine', gain: 0.7 },
    ],
  },
  'booking.cancelled': {
    label: 'Cancellation',
    describe: 'A short falling tone',
    notes: [
      { from: 660, at: 0.00, duration: 0.16, type: 'triangle', gain: 0.6 },
      { from: 392, at: 0.12, duration: 0.32, type: 'triangle', gain: 0.6 },
    ],
  },
};

export function playAlert(kind: AlertKind, volume: number) {
  play(SOUNDS[kind].notes, volume);
}

// ─── Per-device mute ─────────────────────────────────────────
// Separate from the property's settings on purpose: the property decides which
// alerts exist, the person sitting at this particular desk decides whether
// *this* machine makes a noise. A back-office PC muting itself must not silence
// the front desk.

const MUTE_KEY = 'helio.pms.alerts.muted';

export function deviceMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
}

export function setDeviceMuted(muted: boolean) {
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* private mode */ }
}

// ─── The watcher ─────────────────────────────────────────────

export interface AlertEvent {
  id: string;
  ts: string;
  kind: AlertKind;
  severity: string;
  title: string;
  body: string | null;
  reservationId: string | null;
  overbookingId: string | null;
  acknowledgedAt: string | null;
}

export interface AlertSettings {
  overbooking: { enabled: boolean; repeat: 'once' | 'three' | 'until-acknowledged' };
  'booking.new': { enabled: boolean };
  'booking.cancelled': { enabled: boolean };
  volume: number;
  quietHours: { enabled: boolean; from: string; to: string; allowOverbooking: boolean };
}

export interface AlertFeed {
  events: AlertEvent[];
  replay: boolean;
  now: string;
  settings: AlertSettings;
  quiet: boolean;
  unacknowledged: number;
}

const POLL_MS = 20_000;
const REPEAT_MS = 30_000;

/**
 * Poll the feed, make the right noise, and keep an unacknowledged overbooking
 * alarm going until somebody deals with it.
 *
 * The cursor starts at the server's clock on the first call, so the first poll
 * establishes "now" and everything before it is history. That single decision
 * is what stops a refresh setting off the alarm.
 */
export function useAlertWatcher(
  fetchFeed: (since?: string) => Promise<AlertFeed>,
  opts: { enabled: boolean } = { enabled: true },
) {
  const cursor = useRef<string | null>(null);
  const repeatTimer = useRef<number | null>(null);
  const [latest, setLatest] = useState<AlertEvent[]>([]);
  const [settings, setSettings] = useState<AlertSettings | null>(null);
  const [unacknowledged, setUnacknowledged] = useState(0);
  const [muted, setMutedState] = useState(deviceMuted());
  const [blocked, setBlocked] = useState(false);

  const shouldSound = useCallback((kind: AlertKind, feed: AlertFeed): boolean => {
    if (muted) return false;
    if (!feed.settings[kind]?.enabled) return false;
    // Quiet hours silence everything except, optionally, an overbooking — which
    // is the one worth waking somebody for.
    if (feed.quiet && !(kind === 'overbooking' && feed.settings.quietHours.allowOverbooking)) {
      return false;
    }
    return true;
  }, [muted]);

  useEffect(() => {
    if (!opts.enabled) return;
    let cancelled = false;

    async function poll() {
      try {
        const feed = await fetchFeed(cursor.current ?? undefined);
        if (cancelled) return;
        setSettings(feed.settings);
        setUnacknowledged(feed.unacknowledged);

        // A replay is for display only. Establish the cursor and stay silent.
        if (feed.replay) {
          cursor.current = feed.now;
          setLatest(feed.events);
          return;
        }

        cursor.current = feed.now;
        if (!feed.events.length) return;
        setLatest((prev) => [...prev, ...feed.events].slice(-50));

        // One sound per kind per poll. Six bookings arriving together should
        // sound like a notification, not like a fire.
        const kinds = new Set(feed.events.map((e) => e.kind));
        for (const kind of kinds) {
          if (shouldSound(kind, feed)) {
            if (!audioReady()) setBlocked(true);
            playAlert(kind, feed.settings.volume);
          }
        }
      } catch { /* offline — the next poll will catch up */ }
    }

    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [fetchFeed, opts.enabled, shouldSound]);

  // The repeating alarm. Runs only while something is unacknowledged, and stops
  // the instant it is — which is what makes acknowledging worth doing.
  useEffect(() => {
    const repeat = settings?.overbooking.repeat ?? 'until-acknowledged';
    const wanted = repeat === 'until-acknowledged'
      && unacknowledged > 0
      && !muted
      && (settings?.overbooking.enabled ?? true);

    if (!wanted) {
      if (repeatTimer.current) { window.clearInterval(repeatTimer.current); repeatTimer.current = null; }
      return;
    }
    if (repeatTimer.current) return;
    repeatTimer.current = window.setInterval(() => {
      playAlert('overbooking', settings?.volume ?? 70);
    }, REPEAT_MS);
    return () => {
      if (repeatTimer.current) { window.clearInterval(repeatTimer.current); repeatTimer.current = null; }
    };
  }, [unacknowledged, muted, settings]);

  const setMuted = useCallback((next: boolean) => {
    setDeviceMuted(next);
    setMutedState(next);
  }, []);

  const unblock = useCallback(async () => {
    const ok = await enableAudio();
    setBlocked(!ok);
    return ok;
  }, []);

  return {
    latest,
    settings,
    unacknowledged,
    muted,
    setMuted,
    /** The browser is refusing to play sound until someone interacts. */
    blocked: blocked && !audioReady(),
    unblock,
  };
}
