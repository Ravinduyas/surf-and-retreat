// Alert sound settings.
//
// The rule this screen follows: **you can hear every setting before you commit
// to it.** A toggle for a sound nobody has heard is a toggle nobody trusts, so
// each alert has a Test button that plays exactly what will play, at exactly
// the volume that is set.
import { useState } from 'react';
import {
  Volume2, VolumeX, Play, Moon, BellRing, BellOff, TriangleAlert, CircleAlert,
} from 'lucide-react';
import { useAlertSettings, useSaveAlertSettings } from '../queries';
import {
  SOUNDS, playAlert, enableAudio, audioReady, deviceMuted, setDeviceMuted,
  type AlertKind, type AlertSettings as Settings,
} from '../alerts';
import { Card, Pill, Button, Field, Select } from '../ui';
import { QueryState, useToast, PermissionButton, Toggle, WarnNote } from '../components';

const ORDER: AlertKind[] = ['overbooking', 'booking.new', 'booking.cancelled'];

export function AlertSettingsPanel() {
  const toast = useToast();
  const settings = useAlertSettings();
  const save = useSaveAlertSettings();
  const [muted, setMuted] = useState(deviceMuted());
  const [unlocked, setUnlocked] = useState(audioReady());

  async function test(kind: AlertKind, volume: number) {
    const ok = await enableAudio();
    setUnlocked(ok);
    if (!ok) {
      toast.push({
        kind: 'warn',
        title: 'The browser is blocking sound',
        body: 'Click anywhere on the page first, then try again.',
      });
      return;
    }
    playAlert(kind, volume);
  }

  async function patch(body: Record<string, unknown>) {
    try {
      await save.mutateAsync(body);
    } catch (e) { toast.fail(e, 'Could not save that'); }
  }

  return (
    <QueryState query={settings} loadingRows={4}>
      {(s: Settings) => {
        const allOff = ORDER.every((k) => !s[k].enabled);
        return (
          <div className="space-y-3">
            {!unlocked && (
              <WarnNote>
                <span className="font-bold">Sound is not armed on this device.</span>{' '}
                Browsers refuse to play audio until someone has interacted with the page. Press the
                button below once per session — until then, alerts appear on screen but make no
                noise.
                <div className="mt-2">
                  <Button size="sm" icon={<Volume2 className="w-3.5 h-3.5" />}
                    onClick={async () => {
                      const ok = await enableAudio();
                      setUnlocked(ok);
                      if (ok) { playAlert('booking.new', s.volume); toast.success('Sound armed'); }
                    }}>
                    Enable sound on this device
                  </Button>
                </div>
              </WarnNote>
            )}

            {allOff && (
              <WarnNote>
                <span className="inline-flex items-center gap-1.5">
                  <BellOff className="w-3.5 h-3.5" />
                  Every alert sound is switched off. Nothing will be heard, including an
                  overbooking.
                </span>
              </WarnNote>
            )}

            {/* ── This device ─────────────────────────────── */}
            <Card tone={muted ? 'peach' : 'plain'}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-[13px] font-bold flex items-center gap-2">
                    {muted ? <VolumeX className="w-4 h-4 text-status-warn" />
                      : <Volume2 className="w-4 h-4 text-dash-muted" />}
                    This device
                  </p>
                  <p className="text-[11px] text-dash-muted mt-1 max-w-xl leading-relaxed">
                    Muting here silences this machine only — the property's settings below are
                    untouched, and every other desk keeps hearing alerts. A back-office PC going
                    quiet must not silence reception.
                  </p>
                </div>
                <Toggle
                  checked={!muted}
                  onChange={(on) => { setDeviceMuted(!on); setMuted(!on); }}
                  label={muted ? 'Muted here' : 'Sound on here'}
                />
              </div>
            </Card>

            {/* ── Each alert ──────────────────────────────── */}
            <Card>
              <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-1">
                Alerts
              </p>
              <p className="text-[11px] text-dash-muted mb-3">
                Each one can be turned off on its own. Turning a sound off does not stop the event
                being recorded — it only stops the noise.
              </p>

              <div className="space-y-2">
                {ORDER.map((kind) => (
                  <div key={kind}
                    className="flex items-center justify-between gap-3 py-2.5 border-b border-black/[0.04] last:border-0 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold flex items-center gap-2">
                        {kind === 'overbooking'
                          ? <TriangleAlert className="w-3.5 h-3.5 text-status-bad" />
                          : <BellRing className="w-3.5 h-3.5 text-dash-muted" />}
                        {SOUNDS[kind].label}
                        {!s[kind].enabled && <Pill tone="grey">off</Pill>}
                      </p>
                      <p className="text-[11px] text-dash-muted mt-0.5">{SOUNDS[kind].describe}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="secondary" icon={<Play className="w-3 h-3" />}
                        onClick={() => test(kind, s.volume)}>
                        Test
                      </Button>
                      <PermissionButton permission="config.write" size="sm" variant="ghost"
                        onClick={() => patch({ [kind]: { ...s[kind], enabled: !s[kind].enabled } })}>
                        {s[kind].enabled ? 'Turn off' : 'Turn on'}
                      </PermissionButton>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t subtle-divider grid md:grid-cols-2 gap-4">
                <Field label="Volume" hint="Applies to every alert on every device">
                  <div className="flex items-center gap-3">
                    <input
                      type="range" min={0} max={100} step={5} value={s.volume}
                      onChange={(e) => patch({ volume: Number(e.target.value) })}
                      className="flex-1 accent-black"
                    />
                    <span className="text-[12px] font-bold tabular-nums w-10 text-right">
                      {s.volume}%
                    </span>
                    <Button size="sm" variant="ghost" icon={<Play className="w-3 h-3" />}
                      onClick={() => test('booking.new', s.volume)} />
                  </div>
                </Field>

                <Field label="When an overbooking is found"
                  hint="A repeating alarm needs a person to stop it — that is the point">
                  <Select
                    value={s.overbooking.repeat}
                    onChange={(v) => patch({ overbooking: { ...s.overbooking, repeat: v } })}
                    options={[
                      { label: 'Repeat every 30s until acknowledged', value: 'until-acknowledged' },
                      { label: 'Sound three times, then stop', value: 'three' },
                      { label: 'Sound once', value: 'once' },
                    ]}
                  />
                </Field>
              </div>
            </Card>

            {/* ── Quiet hours ─────────────────────────────── */}
            <Card>
              <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                <div>
                  <p className="text-[13px] font-bold flex items-center gap-2">
                    <Moon className="w-4 h-4 text-dash-muted" />
                    Quiet hours
                  </p>
                  <p className="text-[11px] text-dash-muted mt-1 max-w-xl leading-relaxed">
                    A window in which alerts stay silent. Events are still recorded and still shown
                    on screen — only the sound is suppressed.
                  </p>
                </div>
                <Toggle
                  checked={s.quietHours.enabled}
                  onChange={(on) => patch({ quietHours: { ...s.quietHours, enabled: on } })}
                  label={s.quietHours.enabled ? 'On' : 'Off'}
                />
              </div>

              {s.quietHours.enabled && (
                <div className="grid md:grid-cols-3 gap-4">
                  <Field label="From">
                    <input type="time" value={s.quietHours.from}
                      onChange={(e) => patch({ quietHours: { ...s.quietHours, from: e.target.value } })}
                      className="w-full bg-white border border-black/10 rounded-xl px-4 py-2.5 text-[13px]" />
                  </Field>
                  <Field label="To">
                    <input type="time" value={s.quietHours.to}
                      onChange={(e) => patch({ quietHours: { ...s.quietHours, to: e.target.value } })}
                      className="w-full bg-white border border-black/10 rounded-xl px-4 py-2.5 text-[13px]" />
                  </Field>
                  <Field label="Overbooking" hint="Worth waking for">
                    <Toggle
                      checked={s.quietHours.allowOverbooking}
                      onChange={(on) => patch({
                        quietHours: { ...s.quietHours, allowOverbooking: on },
                      })}
                      label={s.quietHours.allowOverbooking
                        ? 'Sounds anyway' : 'Silenced too'}
                    />
                  </Field>
                </div>
              )}

              {s.quietHours.enabled && !s.quietHours.allowOverbooking && (
                <div className="mt-3">
                  <WarnNote>
                    Overbookings will be silent between {s.quietHours.from} and {s.quietHours.to}.
                    An overbooking found overnight is the one that reaches the desk as a guest with
                    nowhere to sleep.
                  </WarnNote>
                </div>
              )}
            </Card>

            <Card>
              <p className="text-[11px] text-dash-muted flex items-start gap-2 leading-relaxed">
                <CircleAlert className="w-3.5 h-3.5 shrink-0 mt-px" />
                Sounds are generated in the browser, so they work with no network and nothing to
                download. Alerts appear the moment they happen — nothing is played for anything
                that happened before this screen was opened, so a page refresh never sets the alarm
                off.
              </p>
            </Card>
          </div>
        );
      }}
    </QueryState>
  );
}
