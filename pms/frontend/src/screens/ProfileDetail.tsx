import { useState } from 'react';
import { ArrowLeft, Star, Ban, Merge, Save, Shield, Eye } from 'lucide-react';
import { useNav } from '../nav';
import {
  useProfile, useUpdateProfile, useProfileDuplicates, useMergeProfiles,
  useProfileDocuments, fetchDocument,
} from '../queries';
import { Card, Pill, Button, SectionHeader, Tabs, Field, TextInput, Select, Modal } from '../ui';
import {
  QueryState, useToast, PermissionButton, Toggle, ConfirmDialog, statusTone, DateInput, InfoNote,
} from '../components';
import {
  money, longDate, timestamp, bookingPreference, addressLine, bytes as formatBytes,
} from '../format';

export function ProfileDetailScreen({ profileId }: { profileId?: string }) {
  const { navigate, back } = useNav();
  const toast = useToast();
  const profile = useProfile(profileId);
  const duplicates = useProfileDuplicates(profileId);
  const updateProfile = useUpdateProfile();
  const mergeProfiles = useMergeProfiles();

  const [tab, setTab] = useState<'overview' | 'stays' | 'documents' | 'duplicates'>('overview');
  const documents = useProfileDocuments(profileId);
  /** The image currently open. Fetched on demand, because reading one is audited. */
  const [viewing, setViewing] = useState<{ mime: string; data: string; label: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [mergeTarget, setMergeTarget] = useState<{ id: string; name: string } | null>(null);
  const [blacklistOpen, setBlacklistOpen] = useState(false);
  const [blacklistReason, setBlacklistReason] = useState('');

  if (!profileId) {
    return (
      <div className="py-16 text-center">
        <p className="font-bold mb-1">No profile selected</p>
        <Button className="mt-3" onClick={() => navigate('profiles')}>Go to profiles</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={back} className="text-dash-muted hover:text-black"><ArrowLeft className="w-4 h-4" /></button>
        <SectionHeader eyebrow="CRM" title="Guest profile" />
      </div>

      <QueryState query={profile} loadingRows={6}>
        {(p) => (
          <>
            <Card className="mb-3">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-black text-white flex items-center justify-center text-[18px] font-black shrink-0">
                    {p.name.split(' ').slice(0, 2).map((n: string) => n[0]).join('')}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h2 className="text-[20px] font-bold tracking-tight">{p.name}</h2>
                      {p.vip && <Pill tone="yellow" solid><Star className="w-3 h-3" /> VIP</Pill>}
                      {p.loyalty !== 'None' && <Pill tone="purple">{p.loyalty}</Pill>}
                      {p.blacklist && <Pill tone="red"><Ban className="w-3 h-3" /> Blacklisted</Pill>}
                    </div>
                    <p className="text-[11px] text-dash-muted">
                      {[p.email, p.phone, p.nationality].filter(Boolean).join(' · ') || 'No contact details'}
                    </p>
                    {p.blacklist && p.blacklistReason && (
                      <p className="text-[11px] text-status-bad mt-1">Reason: {p.blacklistReason}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <PermissionButton
                    permission="profiles.write"
                    variant="secondary"
                    icon={<Save className="w-3.5 h-3.5" />}
                    onClick={() => {
                      if (editing) { setEditing(false); return; }
                      setDraft({
                        name: p.name, email: p.email ?? '', phone: p.phone ?? '',
                        nationality: p.nationality ?? '', idType: p.idType ?? 'passport',
                        idNumber: p.idNumber ?? '', loyalty: p.loyalty, notes: p.notes ?? '',
                        vip: p.vip, marketingConsent: p.marketingConsent,
                        preferences: (p.preferences ?? []).join(', '),
                        dob: p.dob ?? '', idExpiry: p.idExpiry ?? '', language: p.language ?? '',
                        // Flattened for editing and rebuilt on save — the column
                        // holds one JSON object, but five nested inputs bound to
                        // it is how a half-typed address ends up half-saved.
                        addressLine1: p.address?.line1 ?? '',
                        addressCity: p.address?.city ?? '',
                        addressPostcode: p.address?.postcode ?? '',
                        addressCountry: p.address?.country ?? '',
                      });
                      setEditing(true);
                    }}
                  >
                    {editing ? 'Cancel edit' : 'Edit'}
                  </PermissionButton>
                  <PermissionButton
                    permission="profiles.write"
                    variant={p.blacklist ? 'secondary' : 'danger'}
                    icon={<Ban className="w-3.5 h-3.5" />}
                    onClick={async () => {
                      if (p.blacklist) {
                        try {
                          await updateProfile.mutateAsync({ id: p.id, body: { blacklist: false, blacklistReason: null } });
                          toast.success('Removed from the blacklist');
                        } catch (e) { toast.fail(e); }
                      } else {
                        setBlacklistReason('');
                        setBlacklistOpen(true);
                      }
                    }}
                  >
                    {p.blacklist ? 'Remove blacklist' : 'Blacklist'}
                  </PermissionButton>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-5 pt-4 border-t subtle-divider">
                <Stat label="Completed stays" value={String(p.completedStays ?? 0)} />
                <Stat label="Total nights" value={String(p.totalNights ?? 0)} />
                <Stat label="Lifetime value" value={money(p.lifetimeValueMinor ?? 0)} />
                <Stat label="Average stay" value={`${p.averageStayNights ?? 0}n`} />
                <Stat label="Last stay" value={p.lastStay ? longDate(p.lastStay) : 'Never'} />
              </div>
            </Card>

            <div className="mb-4">
              <Tabs
                tabs={[
                  { value: 'overview', label: 'Details' },
                  { value: 'stays', label: 'Stay history', count: p.stays?.length ?? 0 },
                  {
                    value: 'documents',
                    label: 'ID & signature',
                    count: documents.data?.documents.length ?? 0,
                  },
                  { value: 'duplicates', label: 'Possible duplicates', count: duplicates.data?.length ?? 0 },
                ]}
                active={tab}
                onChange={setTab}
              />
            </div>

            {tab === 'overview' && (
              <Card>
                {editing ? (
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <Field label="Full name" required>
                        <TextInput value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />
                      </Field>
                      <Field label="Email">
                        <TextInput value={draft.email} onChange={(v) => setDraft({ ...draft, email: v })} />
                      </Field>
                      <Field label="Phone">
                        <TextInput value={draft.phone} onChange={(v) => setDraft({ ...draft, phone: v })} />
                      </Field>
                      <Field label="Nationality">
                        <TextInput value={draft.nationality} onChange={(v) => setDraft({ ...draft, nationality: v })} />
                      </Field>
                      <Field label="Date of birth">
                        <DateInput value={draft.dob} onChange={(v) => setDraft({ ...draft, dob: v })} />
                      </Field>
                      <Field label="ID type">
                        <Select value={draft.idType} onChange={(v) => setDraft({ ...draft, idType: v })} options={[
                          { label: 'Passport', value: 'passport' },
                          { label: 'National ID', value: 'national-id' },
                          { label: 'Driving licence', value: 'licence' },
                        ]} />
                      </Field>
                      <Field label="ID number">
                        <TextInput value={draft.idNumber} onChange={(v) => setDraft({ ...draft, idNumber: v })} />
                      </Field>
                      <Field label="ID expires">
                        <DateInput value={draft.idExpiry} onChange={(v) => setDraft({ ...draft, idExpiry: v })} />
                      </Field>
                      <Field label="Language">
                        <TextInput value={draft.language} onChange={(v) => setDraft({ ...draft, language: v })}
                          placeholder="e.g. en" />
                      </Field>
                      <Field label="Loyalty tier">
                        <Select value={draft.loyalty} onChange={(v) => setDraft({ ...draft, loyalty: v })} options={[
                          { label: 'None', value: 'None' }, { label: 'Silver', value: 'Silver' },
                          { label: 'Gold', value: 'Gold' }, { label: 'Platinum', value: 'Platinum' },
                        ]} />
                      </Field>
                      <Field label="Preferences" hint="Comma separated">
                        <TextInput value={draft.preferences} onChange={(v) => setDraft({ ...draft, preferences: v })}
                          placeholder="High floor, foam pillow, late checkout" />
                      </Field>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <Field label="Street" className="md:col-span-2">
                        <TextInput value={draft.addressLine1}
                          onChange={(v) => setDraft({ ...draft, addressLine1: v })} />
                      </Field>
                      <Field label="City">
                        <TextInput value={draft.addressCity}
                          onChange={(v) => setDraft({ ...draft, addressCity: v })} />
                      </Field>
                      <Field label="Postcode">
                        <TextInput value={draft.addressPostcode}
                          onChange={(v) => setDraft({ ...draft, addressPostcode: v })} />
                      </Field>
                      <Field label="Country" className="md:col-span-2">
                        <TextInput value={draft.addressCountry}
                          onChange={(v) => setDraft({ ...draft, addressCountry: v })} />
                      </Field>
                    </div>
                    <Field label="Notes">
                      <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                        rows={3}
                        className="w-full bg-white border border-black/10 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-black/40" />
                    </Field>
                    <div className="flex flex-wrap gap-6">
                      <Toggle checked={!!draft.vip} onChange={(v) => setDraft({ ...draft, vip: v })} label="VIP" />
                      <Toggle checked={!!draft.marketingConsent}
                        onChange={(v) => setDraft({ ...draft, marketingConsent: v })}
                        label="Marketing consent" />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
                      <Button
                        disabled={updateProfile.isPending}
                        onClick={async () => {
                          try {
                            const {
                              addressLine1, addressCity, addressPostcode, addressCountry,
                              ...rest
                            } = draft;
                            const parts = {
                              line1: addressLine1, city: addressCity,
                              postcode: addressPostcode, country: addressCountry,
                            };
                            await updateProfile.mutateAsync({
                              id: p.id,
                              body: {
                                ...rest,
                                preferences: String(draft.preferences ?? '')
                                  .split(',').map((s) => s.trim()).filter(Boolean),
                                // An address nobody filled in is stored as
                                // nothing, not as an object of empty strings —
                                // otherwise every profile grows a blank address.
                                address: Object.values(parts).some((v) => String(v ?? '').trim())
                                  ? parts : null,
                              },
                            });
                            toast.success('Profile updated');
                            setEditing(false);
                          } catch (e) { toast.fail(e); }
                        }}
                      >
                        Save changes
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-3 gap-x-6 gap-y-4">
                    <Detail label="Email" value={p.email || '—'} />
                    <Detail label="Phone" value={p.phone || '—'} />
                    <Detail label="Nationality" value={p.nationality || '—'} />
                    <Detail label="Date of birth" value={p.dob ? longDate(p.dob) : '—'} />
                    <Detail label="ID" value={p.idNumber ? `${p.idType ?? 'ID'} · ${p.idNumber}` : '—'} />
                    <Detail label="ID expires" value={p.idExpiry ? longDate(p.idExpiry) : '—'} />
                    <Detail label="Address" value={addressLine(p.address) || '—'} />
                    <Detail label="Language" value={p.language || '—'} />
                    <Detail label="Loyalty" value={`${p.loyalty}${p.loyaltyPoints ? ` · ${p.loyaltyPoints} points` : ''}`} />
                    <Detail label="Marketing consent"
                      value={p.marketingConsent ? `Given ${p.consentAt ? timestamp(p.consentAt) : ''}` : 'Not given'} />
                    <Detail label="Created" value={timestamp(p.createdAt)} />
                    <Detail label="Updated" value={timestamp(p.updatedAt)} />
                    <div className="md:col-span-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-1.5">Preferences</p>
                      {(p.preferences ?? []).length === 0
                        ? <p className="text-[12px] text-dash-muted">None recorded</p>
                        : (
                          <div className="flex flex-wrap gap-1.5">
                            {p.preferences.map((pref: string) => <Pill key={pref} tone="lilac">{pref}</Pill>)}
                          </div>
                        )}
                    </div>
                    {p.notes && (
                      <div className="md:col-span-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-1.5">Notes</p>
                        <p className="text-[12px]">{p.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )}

            {tab === 'stays' && (
              <Card>
                {(p.stays ?? []).length === 0 ? (
                  <p className="text-[12px] text-dash-muted py-8 text-center">No stays recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto scroll-thin">
                    <table className="w-full min-w-[46rem] text-[12px]">
                      <thead>
                        <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                          <th className="pb-2">Confirmation</th>
                          <th className="pb-2">Dates</th>
                          <th className="pb-2">Room type</th>
                          <th className="pb-2">Rate</th>
                          <th className="pb-2">Source</th>
                          <th className="pb-2 text-right">Total</th>
                          <th className="pb-2 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.stays.map((s: any) => (
                          <tr
                            key={s.id}
                            onClick={() => navigate('guest-dashboard', { reservationId: s.id })}
                            className="border-b border-black/[0.03] cursor-pointer hover:bg-dash-bg align-top"
                          >
                            <td className="py-2.5 font-mono text-[11px]">{s.confirmation}</td>
                            <td className="py-2.5">
                              {longDate(s.arrival)} → {longDate(s.departure)} ({s.nights}n)
                            </td>
                            <td className="py-2.5">
                              <p>{s.roomType}</p>
                              {/* What the guest actually bought. Without this a
                                  profile records that somebody stayed and
                                  nothing about what they came for. */}
                              {(s.preferences ?? []).length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {s.preferences.map((tag: string) => (
                                    <Pill key={tag} tone="lilac">{bookingPreference(tag)}</Pill>
                                  ))}
                                </div>
                              )}
                              {s.specialRequests && (
                                <p className="text-[10px] text-dash-muted mt-1.5 max-w-[22rem]">
                                  “{s.specialRequests}”
                                </p>
                              )}
                            </td>
                            <td className="py-2.5 font-mono text-[10px]">{s.rateCode}</td>
                            <td className="py-2.5 text-dash-muted">
                              {s.source}
                              {s.channel && <span className="block text-[10px]">{s.channel}</span>}
                            </td>
                            <td className="py-2.5 text-right tabular-nums font-bold">{money(s.totalMinor)}</td>
                            <td className="py-2.5 text-right"><Pill tone={statusTone(s.status)}>{s.status}</Pill></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}

            {tab === 'documents' && (
              <QueryState query={documents} loadingRows={3}>
                {(d) => (
                  <div className="space-y-3">
                    <InfoNote>
                      These belong to the bookings, not to the profile. Each one is stored
                      encrypted and deleted automatically {d.retentionDays} days after the guest
                      departs, so this list empties itself — it is a window onto the stays, not an
                      archive of passports. Opening one is recorded in the audit trail.
                    </InfoNote>

                    {d.documents.length === 0 ? (
                      <Card>
                        <p className="text-[12px] text-dash-muted py-8 text-center">
                          Nothing on file. A passport photograph and signature are captured at
                          check-in, or by the guest on their own phone through the check-in QR
                          code — and are removed again once the retention window passes.
                        </p>
                      </Card>
                    ) : (
                      <div className="grid md:grid-cols-2 gap-3">
                        {d.documents.map((doc) => (
                          <Card key={doc.id}>
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="min-w-0">
                                <p className="text-[13px] font-bold">
                                  {doc.label ?? (doc.kind === 'signature' ? 'Signature' : 'Identity document')}
                                </p>
                                <p className="text-[10px] text-dash-muted mt-0.5">
                                  {doc.confirmation} · {longDate(doc.arrival)} →{' '}
                                  {longDate(doc.departure)}
                                </p>
                                <p className="text-[10px] text-dash-muted">
                                  {formatBytes(doc.sizeBytes)} · added {timestamp(doc.uploadedAt)}
                                  {doc.uploadedBy ? ` by ${doc.uploadedBy}` : ''}
                                </p>
                              </div>
                              <Pill tone={doc.kind === 'identity' ? 'yellow' : 'sky'}>
                                {doc.kind === 'identity' ? 'ID' : 'Signature'}
                              </Pill>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[10px] text-dash-muted">
                                Deleted on {longDate(doc.deletesOn)}
                              </p>
                              <PermissionButton
                                permission="reservations.read"
                                size="sm"
                                variant="secondary"
                                icon={<Eye className="w-3 h-3" />}
                                onClick={async () => {
                                  try {
                                    const full = await fetchDocument(doc.id);
                                    setViewing({
                                      mime: full.mime,
                                      data: `data:${full.mime};base64,${full.dataBase64}`,
                                      label: doc.label
                                        ?? (doc.kind === 'signature' ? 'Signature' : 'Document'),
                                    });
                                  } catch (e) { toast.fail(e, 'Could not open that document'); }
                                }}
                              >
                                View
                              </PermissionButton>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </QueryState>
            )}

            {/* Opened on request, never on render: each read is audited. */}
            <Modal
              open={!!viewing}
              onClose={() => setViewing(null)}
              title={viewing?.label ?? 'Document'}
              size="lg"
            >
              {viewing && (viewing.mime === 'application/pdf' ? (
                <object data={viewing.data} type="application/pdf" className="w-full h-[70vh] rounded-xl">
                  <p className="text-[12px] text-dash-muted">
                    This browser cannot display the PDF inline.
                  </p>
                </object>
              ) : (
                <img
                  src={viewing.data}
                  alt={viewing.label}
                  className="w-full max-h-[70vh] object-contain rounded-xl bg-dash-bg"
                />
              ))}
            </Modal>

            {tab === 'duplicates' && (
              <QueryState query={duplicates} loadingRows={3}
                empty="No possible duplicates found"
                emptyHint="Matching is by email, phone or exact name.">
                {(rows) => (
                  <div className="space-y-2">
                    {rows.map((d) => (
                      <Card key={d.id}>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-[13px] font-bold">{d.name}</p>
                            <p className="text-[11px] text-dash-muted">
                              {[d.email, d.phone].filter(Boolean).join(' · ')} ·
                              {' '}{d.stays ?? 0} stay(s) · {money(d.totalRevenueMinor ?? 0)}
                            </p>
                            <div className="flex gap-1.5 mt-2">
                              {(d as any).matchOn?.map((m: string) => (
                                <Pill key={m} tone="yellow">matches {m}</Pill>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost"
                              onClick={() => navigate('profile-detail', { profileId: d.id })}>
                              Open
                            </Button>
                            <PermissionButton permission="profiles.write" size="sm" variant="secondary"
                              icon={<Merge className="w-3 h-3" />}
                              onClick={() => setMergeTarget({ id: d.id, name: d.name })}>
                              Merge into this profile
                            </PermissionButton>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </QueryState>
            )}

            <Modal
              open={blacklistOpen}
              onClose={() => setBlacklistOpen(false)}
              title={`Blacklist ${p.name}?`}
              footer={
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setBlacklistOpen(false)}>Cancel</Button>
                  <Button variant="danger" disabled={!blacklistReason.trim() || updateProfile.isPending}
                    onClick={async () => {
                      try {
                        await updateProfile.mutateAsync({
                          id: p.id, body: { blacklist: true, blacklistReason: blacklistReason.trim() },
                        });
                        toast.success('Guest blacklisted');
                        setBlacklistOpen(false);
                      } catch (e) { toast.fail(e); }
                    }}>
                    Blacklist guest
                  </Button>
                </div>
              }
            >
              <div className="space-y-3">
                <p className="text-[12px] text-dash-muted">
                  The guest stays bookable, but staff are warned whenever the profile is selected.
                  The action is recorded in the audit trail.
                </p>
                <Field label="Reason" required>
                  <TextInput value={blacklistReason} onChange={setBlacklistReason} />
                </Field>
              </div>
            </Modal>

            <ConfirmDialog
              open={!!mergeTarget}
              title={`Merge ${mergeTarget?.name} into ${p.name}?`}
              body="All reservations, messages and history move to this profile. The other profile is retired and cannot be un-merged."
              confirmLabel="Merge profiles"
              danger
              busy={mergeProfiles.isPending}
              onCancel={() => setMergeTarget(null)}
              onConfirm={async () => {
                if (!mergeTarget) return;
                try {
                  await mergeProfiles.mutateAsync({ id: p.id, sourceId: mergeTarget.id });
                  toast.success('Profiles merged');
                } catch (e) { toast.fail(e); }
                setMergeTarget(null);
              }}
            />
          </>
        )}
      </QueryState>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-0.5">{label}</p>
      <p className="text-[13px] font-semibold">{value}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-1">{label}</p>
      <p className="text-[16px] font-black tabular-nums">{value}</p>
    </div>
  );
}
