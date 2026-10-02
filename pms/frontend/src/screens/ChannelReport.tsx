// Telling the channel what happened to a booking it sent us.
//
// The one thing this screen must never do is imply a report reached
// Booking.com when it did not. Every state is spelled out — not reported,
// reported, failed with the channel's own words — and the fact that the payload
// has not been confirmed against a live account is said out loud rather than
// left for someone to discover during an argument about commission.
import { useState } from 'react';
import {
  Send, ShieldCheck, TriangleAlert, CircleAlert, Clock, ChevronDown, ChevronRight,
} from 'lucide-react';
import {
  useChannelReport, useChannelReportEligibility, useReportToChannel,
  usePendingChannelReports, type PendingChannelReport,
} from '../queries';
import { Card, Pill, Button, Modal, Field, Select } from '../ui';
import { QueryState, useToast, PermissionButton, WarnNote, InfoNote, Loading } from '../components';
import { shortDate, timestamp, relativeTime } from '../format';
import { CHANNEL_HUB } from '../branding';

const NOT_YET_CONFIRMED =
  `Reporting to Booking.com has been built to the documented ${CHANNEL_HUB} behaviour but has not yet `
  + 'been confirmed against a live account. Whatever the channel actually answers is what is '
  + 'recorded here — nothing is assumed to have worked.';

// ─── On a reservation ────────────────────────────────────────

export function ChannelReportPanel({ reservationId }: { reservationId: string }) {
  const toast = useToast();
  const state = useChannelReport(reservationId);
  const [kind, setKind] = useState('no_show');
  const eligibility = useChannelReportEligibility(reservationId, kind);
  const report = useReportToChannel();
  const [showExchange, setShowExchange] = useState(false);

  return (
    <QueryState query={state} loadingRows={2}>
      {(s) => {
        const e = eligibility.data;
        const reported = s.status === 'reported';
        const failed = s.status === 'failed';

        return (
          <Card>
            <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">
                  Reported to the channel
                </p>
                <p className="text-[11px] text-dash-muted mt-0.5 max-w-lg leading-relaxed">
                  Until the channel is told, it still believes the guest arrived — the commission
                  stands and the guest is not flagged.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {reported ? <Pill tone="mint">reported</Pill>
                  : failed ? <Pill tone="red">failed</Pill>
                    : <Pill tone="yellow">not reported</Pill>}
              </div>
            </div>

            {reported && (
              <div className="flex items-start gap-2 text-[12px] mb-3">
                <ShieldCheck className="w-4 h-4 text-status-ok shrink-0 mt-px" />
                <span>
                  {s.label} reported {s.reportedAt ? relativeTime(s.reportedAt) : ''}
                  {s.attempts > 1 && ` after ${s.attempts} attempts`}.
                  <span className="text-dash-muted"> The channel confirmed the change.</span>
                </span>
              </div>
            )}

            {failed && (
              <WarnNote>
                <span className="font-bold">The channel refused this report.</span>
                <br />
                {s.error}
                <br />
                <span className="text-[11px]">
                  Attempt {s.attempts}. The booking is still shown to the channel as arriving.
                </span>
              </WarnNote>
            )}

            {!reported && (
              <div className="space-y-3 mt-3">
                {e && !e.reportable && <InfoNote>{e.reason}</InfoNote>}

                {e?.reportable && e.windowPassed && (
                  <WarnNote>
                    <span className="inline-flex items-start gap-1.5">
                      <Clock className="w-3.5 h-3.5 shrink-0 mt-px" />{e.reason}
                    </span>
                  </WarnNote>
                )}

                {e?.reportable && !e.windowPassed && (
                  <p className="text-[11px] text-dash-muted">
                    {e.channelName} · {e.otaReference} ·{' '}
                    {e.daysLeft === 0
                      ? 'the reporting window is understood to close today'
                      : `about ${e.daysLeft} day(s) left to report this`}
                  </p>
                )}

                <div className="flex items-end gap-2 flex-wrap">
                  <div className="w-full sm:w-[240px]">
                    <Field label="What happened">
                      <Select value={kind} onChange={setKind}
                        options={s.kinds.map((k) => ({ label: k.label, value: k.kind }))} />
                    </Field>
                  </div>
                  <PermissionButton permission="frontdesk.write"
                    icon={<Send className="w-3.5 h-3.5" />}
                    disabled={!e?.reportable || report.isPending}
                    onClick={async () => {
                      try {
                        const r: any = await report.mutateAsync({ id: reservationId, kind });
                        if (r.status === 'reported') {
                          toast.success('Reported to the channel',
                            'The channel confirmed the change.');
                        } else {
                          // Never a success toast for something that failed.
                          toast.push({
                            kind: 'error',
                            title: 'The channel refused the report',
                            body: r.error ?? 'No reason given.',
                          });
                        }
                      } catch (err) { toast.fail(err, 'Could not reach the channel'); }
                    }}>
                    {report.isPending ? 'Reporting…' : failed ? 'Try again' : 'Report to channel'}
                  </PermissionButton>
                </div>
              </div>
            )}

            {(s.request || s.response) && (
              <div className="mt-3 border-t subtle-divider pt-3">
                <button
                  className="flex items-center gap-1.5 text-[11px] font-bold text-dash-muted hover:text-black"
                  onClick={() => setShowExchange(!showExchange)}>
                  {showExchange ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  What was sent and what came back
                </button>
                {showExchange && (
                  <div className="mt-2 space-y-2">
                    <Exchange label="Sent" value={s.request} />
                    <Exchange label="Received" value={s.response} />
                  </div>
                )}
              </div>
            )}

            <p className="text-[10px] text-dash-muted mt-3 flex items-start gap-1.5 leading-relaxed">
              <CircleAlert className="w-3 h-3 shrink-0 mt-px" />
              {NOT_YET_CONFIRMED}
            </p>
          </Card>
        );
      }}
    </QueryState>
  );
}

function Exchange({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-widest text-dash-muted mb-1">{label}</p>
      <pre className="text-[10px] font-mono bg-dash-bg p-2.5 rounded-xl overflow-x-auto scroll-thin">
        {value ? JSON.stringify(value, null, 2) : '—'}
      </pre>
    </div>
  );
}

// ─── The work list ───────────────────────────────────────────

export function PendingReportsPanel({ onOpen }: { onOpen?: (reservationId: string) => void }) {
  const toast = useToast();
  const pending = usePendingChannelReports();
  const report = useReportToChannel();
  const [busyId, setBusyId] = useState<string | null>(null);

  return (
    <QueryState query={pending} loadingRows={3}>
      {(rows) => (
        <div className="space-y-3">
          <Card>
            <div className="mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">
                No-shows not yet reported
              </p>
              <p className="text-[11px] text-dash-muted mt-0.5 max-w-2xl leading-relaxed">
                Each of these is a booking the channel still believes arrived. Until it is told,
                the commission stands.
              </p>
            </div>

            {rows.length === 0 ? (
              <div className="py-10 text-center">
                <ShieldCheck className="w-6 h-6 text-status-ok mx-auto mb-2" />
                <p className="text-[13px] font-bold">Nothing outstanding</p>
                <p className="text-[11px] text-dash-muted mt-1">
                  Every channel no-show has been reported.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full min-w-[46rem] text-[12px]">
                  <thead>
                    <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                      <th className="pb-2">Booking</th>
                      <th className="pb-2">Guest</th>
                      <th className="pb-2">Arrival</th>
                      <th className="pb-2">Channel</th>
                      <th className="pb-2">Window</th>
                      <th className="pb-2">State</th>
                      <th className="pb-2 text-right" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r: PendingChannelReport) => (
                      <tr key={r.id} className="border-b border-black/[0.03]">
                        <td className="py-2.5 font-semibold whitespace-nowrap">
                          <button className="hover:underline" onClick={() => onOpen?.(r.id)}>
                            {r.confirmation}
                          </button>
                          <p className="text-[10px] text-dash-muted font-normal">{r.otaReference}</p>
                        </td>
                        <td className="py-2.5">{r.guest}</td>
                        <td className="py-2.5 whitespace-nowrap">{shortDate(r.arrival)}</td>
                        <td className="py-2.5">
                          {r.channelName}
                          {!r.channelConnected && (
                            <Pill tone="red">not connected</Pill>
                          )}
                        </td>
                        <td className="py-2.5 whitespace-nowrap">
                          {r.windowPassed
                            ? <span className="text-status-bad">closed {shortDate(r.windowClosesOn)}</span>
                            : <span className="text-dash-muted">{r.daysLeft} day(s) left</span>}
                        </td>
                        <td className="py-2.5">
                          {r.status === 'failed'
                            ? <Pill tone="red">failed × {r.attempts}</Pill>
                            : <Pill tone="yellow">not reported</Pill>}
                          {r.error && <p className="text-[10px] text-status-bad mt-0.5">{r.error}</p>}
                        </td>
                        <td className="py-2.5 text-right whitespace-nowrap">
                          <PermissionButton permission="frontdesk.write" size="sm"
                            variant={r.status === 'failed' ? 'secondary' : 'primary'}
                            icon={<Send className="w-3 h-3" />}
                            disabled={!r.channelConnected || busyId === r.id}
                            onClick={async () => {
                              setBusyId(r.id);
                              try {
                                const out: any = await report.mutateAsync({ id: r.id, kind: 'no_show' });
                                if (out.status === 'reported') toast.success(`${r.confirmation} reported`);
                                else {
                                  toast.push({
                                    kind: 'error', title: `${r.confirmation} was refused`,
                                    body: out.error ?? 'No reason given.',
                                  });
                                }
                              } catch (e) { toast.fail(e); }
                              setBusyId(null);
                            }}>
                            {busyId === r.id ? 'Reporting…' : r.status === 'failed' ? 'Retry' : 'Report'}
                          </PermissionButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <p className="text-[11px] text-dash-muted flex items-start gap-2 leading-relaxed">
              <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-px" />
              {NOT_YET_CONFIRMED}
            </p>
          </Card>
        </div>
      )}
    </QueryState>
  );
}

// ─── Offered straight after marking a no-show ────────────────

export function ReportAfterNoShowModal({
  open, onClose, reservation,
}: {
  open: boolean;
  onClose: () => void;
  reservation: { id: string; confirmation: string; guest: string } | null;
}) {
  const toast = useToast();
  const eligibility = useChannelReportEligibility(open && reservation ? reservation.id : null, 'no_show');
  const report = useReportToChannel();
  const e = eligibility.data;

  if (!reservation) return null;

  return (
    <Modal open={open} onClose={onClose} title="Tell the channel?"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Not now</Button>
          <Button disabled={!e?.reportable || report.isPending}
            onClick={async () => {
              try {
                const r: any = await report.mutateAsync({ id: reservation.id, kind: 'no_show' });
                if (r.status === 'reported') {
                  toast.success('Reported to the channel', 'The channel confirmed the change.');
                  onClose();
                } else {
                  toast.push({
                    kind: 'error', title: 'The channel refused the report',
                    body: `${r.error ?? 'No reason given.'} You can retry from the booking.`,
                  });
                }
              } catch (err) { toast.fail(err, 'Could not reach the channel'); }
            }}>
            {report.isPending ? 'Reporting…' : 'Report the no-show'}
          </Button>
        </div>
      }>
      <div className="space-y-3">
        <p className="text-[13px]">
          <span className="font-bold">{reservation.guest}</span> ({reservation.confirmation}) is
          marked as a no-show here. {e?.channelName ?? 'The channel'} has not been told.
        </p>
        {eligibility.isPending && <Loading label="Checking the channel…" rows={1} />}
        {e && !e.reportable && <InfoNote>{e.reason}</InfoNote>}
        {e?.reportable && e.windowPassed && <WarnNote>{e.reason}</WarnNote>}
        {e?.reportable && !e.windowPassed && (
          <InfoNote>
            Reporting it cancels the booking at {e.channelName} with a no-show reason, which is what
            removes the commission. About {e.daysLeft} day(s) are understood to be left.
          </InfoNote>
        )}
        <p className="text-[10px] text-dash-muted leading-relaxed">{NOT_YET_CONFIRMED}</p>
      </div>
    </Modal>
  );
}
