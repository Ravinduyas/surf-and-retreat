import { useState } from 'react';
import { Plus, Users, Upload, CalendarRange } from 'lucide-react';
import { useNav } from '../nav';
import {
  useGroups, useGroup, useCreateGroup, useSetGroupBlock, useRoomingList,
  useRoomTypes, useRatePlans, useCompanies, useWaitlist, useAddWaitlist,
} from '../queries';
import { useAuthStore } from '../stores';
import { Card, Pill, Button, SectionHeader, Tabs, Field, Select, TextInput, Modal } from '../ui';
import {
  QueryState, useToast, MoneyInput, NumberInput, DateInput, PermissionButton, OccupancyBar, statusTone,
} from '../components';
import { money, longDate, pct, addDays } from '../format';

export function GroupsScreen() {
  const { navigate } = useNav();
  const toast = useToast();
  const property = useAuthStore((s) => s.property);
  const today = property?.businessDate ?? new Date().toISOString().slice(0, 10);

  const groups = useGroups();
  const roomTypes = useRoomTypes();
  const ratePlans = useRatePlans();
  const companies = useCompanies();
  const waitlist = useWaitlist();
  const createGroup = useCreateGroup();
  const setBlock = useSetGroupBlock();
  const roomingList = useRoomingList();
  const addWaitlist = useAddWaitlist();

  const [tab, setTab] = useState<'groups' | 'waitlist'>('groups');
  const [selectedId, setSelectedId] = useState<string>('');
  const detail = useGroup(selectedId || undefined);

  const [createOpen, setCreateOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [roomingOpen, setRoomingOpen] = useState(false);
  const [waitOpen, setWaitOpen] = useState(false);

  const [g, setG] = useState({
    code: '', name: '', arrival: today, departure: addDays(today, 2),
    cutoffDate: '', ratePlanId: '', companyId: '', contactName: '', contactEmail: '',
  });
  const [blockForm, setBlockForm] = useState({ roomTypeId: '', rooms: 5, rateMinor: 0, from: today, to: addDays(today, 2) });
  const [roomingText, setRoomingText] = useState('');
  const [roomingRoomType, setRoomingRoomType] = useState('');
  const [wait, setWait] = useState({ guestName: '', email: '', phone: '', arrival: today, departure: addDays(today, 1), roomTypeId: '', adults: 2 });

  return (
    <div>
      <SectionHeader
        eyebrow="Sales"
        title="Groups & blocks"
        action={
          <div className="flex items-center gap-2">
            <Tabs
              tabs={[
                { value: 'groups', label: 'Groups', count: groups.data?.length },
                { value: 'waitlist', label: 'Waitlist', count: waitlist.data?.length },
              ]}
              active={tab}
              onChange={setTab}
            />
            {tab === 'groups' ? (
              <PermissionButton permission="groups.write" icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setCreateOpen(true)}>
                New group
              </PermissionButton>
            ) : (
              <PermissionButton permission="reservations.write" icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setWaitOpen(true)}>
                Add to waitlist
              </PermissionButton>
            )}
          </div>
        }
      />

      {tab === 'groups' && (
        <div className="grid lg:grid-cols-3 gap-3">
          <div className="lg:col-span-1">
            <QueryState query={groups} loadingRows={4} empty="No groups yet"
              emptyHint="A group holds rooms for a block of dates and tracks pick-up against them.">
              {(rows) => (
                <div className="space-y-2">
                  {rows.map((grp) => (
                    <button key={grp.id} onClick={() => setSelectedId(grp.id)}
                      className={`w-full text-left p-4 rounded-2xl border transition-colors ${
                        selectedId === grp.id ? 'border-black bg-dash-bg' : 'border-black/5 hover:bg-dash-bg'
                      }`}>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-[13px] font-bold">{grp.name}</p>
                        <Pill tone={grp.status === 'definite' ? 'mint' : grp.status === 'cancelled' ? 'red' : 'yellow'}>
                          {grp.status}
                        </Pill>
                      </div>
                      <p className="text-[11px] text-dash-muted">
                        {grp.code} · {longDate(grp.arrival)} → {longDate(grp.departure)}
                      </p>
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-[10px] text-dash-muted mb-1">
                          <span>Pick-up</span>
                          <span>{grp.pickedUpNights} / {grp.blockedNights} room nights</span>
                        </div>
                        <OccupancyBar bp={grp.pickupBp} />
                      </div>
                      {grp.cutoffDate && (
                        <p className="text-[10px] text-dash-muted mt-1.5">Cut-off {longDate(grp.cutoffDate)}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </QueryState>
          </div>

          <div className="lg:col-span-2">
            {!selectedId ? (
              <Card className="h-full flex flex-col items-center justify-center py-20">
                <Users className="w-8 h-8 text-dash-muted mb-3" />
                <p className="text-[13px] font-bold mb-1">Select a group</p>
                <p className="text-[12px] text-dash-muted">Pick a group to manage its block and rooming list.</p>
              </Card>
            ) : (
              <QueryState query={detail} loadingRows={5}>
                {(d: any) => (
                  <div className="space-y-3">
                    <Card>
                      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                        <div>
                          <h3 className="text-[18px] font-bold tracking-tight">{d.name}</h3>
                          <p className="text-[11px] text-dash-muted">
                            {d.code} · {longDate(d.arrival)} → {longDate(d.departure)}
                            {d.cutoffDate ? ` · cut-off ${longDate(d.cutoffDate)}` : ''}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <PermissionButton permission="groups.write" size="sm" variant="secondary"
                            icon={<CalendarRange className="w-3 h-3" />}
                            onClick={() => {
                              setBlockForm({
                                roomTypeId: roomTypes.data?.[0]?.id ?? '', rooms: 5, rateMinor: 0,
                                from: d.arrival, to: addDays(d.departure, -1),
                              });
                              setBlockOpen(true);
                            }}>
                            Set block
                          </PermissionButton>
                          <PermissionButton permission="groups.write" size="sm"
                            icon={<Upload className="w-3 h-3" />}
                            onClick={() => { setRoomingRoomType(roomTypes.data?.[0]?.id ?? ''); setRoomingOpen(true); }}>
                            Rooming list
                          </PermissionButton>
                        </div>
                      </div>

                      {d.blocks.length === 0 ? (
                        <p className="text-[12px] text-dash-muted py-6 text-center">
                          No rooms blocked yet — set a block to hold inventory for this group.
                        </p>
                      ) : (
                        <div className="overflow-x-auto scroll-thin">
                          <table className="w-full min-w-[40rem] text-[12px]">
                            <thead>
                              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                                <th className="pb-2">Date</th>
                                <th className="pb-2">Room type</th>
                                <th className="pb-2 text-right">Blocked</th>
                                <th className="pb-2 text-right">Picked up</th>
                                <th className="pb-2 text-right">Remaining</th>
                                <th className="pb-2 text-right">Rate</th>
                              </tr>
                            </thead>
                            <tbody>
                              {d.blocks.map((b: any) => (
                                <tr key={b.id} className="border-b border-black/[0.03]">
                                  <td className="py-2 whitespace-nowrap">{longDate(b.date)}</td>
                                  <td className="py-2">{b.roomType}</td>
                                  <td className="py-2 text-right font-bold">{b.blocked}</td>
                                  <td className="py-2 text-right">{b.pickedUp}</td>
                                  <td className={`py-2 text-right font-bold ${b.blocked - b.pickedUp > 0 ? 'text-status-warn' : 'text-status-ok'}`}>
                                    {Math.max(0, b.blocked - b.pickedUp)}
                                  </td>
                                  <td className="py-2 text-right tabular-nums">{money(b.rateMinor)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </Card>

                    <Card>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-3">
                        Reservations in this group ({d.reservations.length})
                      </p>
                      {d.reservations.length === 0 ? (
                        <p className="text-[12px] text-dash-muted py-6 text-center">
                          No individual reservations yet — upload a rooming list to create them.
                        </p>
                      ) : (
                        <div className="overflow-x-auto scroll-thin">
                          <table className="w-full min-w-[40rem] text-[12px]">
                            <tbody>
                              {d.reservations.map((r: any) => (
                                <tr key={r.id} onClick={() => navigate('guest-dashboard', { reservationId: r.id })}
                                  className="border-b border-black/[0.03] cursor-pointer hover:bg-dash-bg">
                                  <td className="py-2 font-semibold">{r.guest}</td>
                                  <td className="py-2 font-mono text-[10px]">{r.confirmation}</td>
                                  <td className="py-2">{r.roomType}</td>
                                  <td className="py-2">{r.room ?? '—'}</td>
                                  <td className="py-2 text-right tabular-nums">{money(r.totalMinor)}</td>
                                  <td className="py-2 text-right"><Pill tone={statusTone(r.status)}>{r.status}</Pill></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </Card>
                  </div>
                )}
              </QueryState>
            )}
          </div>
        </div>
      )}

      {tab === 'waitlist' && (
        <QueryState query={waitlist} loadingRows={3} empty="Nobody on the waitlist"
          emptyHint="Add guests here when you are sold out so you can call them back when inventory frees up.">
          {(rows: any[]) => (
            <Card>
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full min-w-[40rem] text-[12px]">
                  <thead>
                    <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                      <th className="pb-2">Guest</th>
                      <th className="pb-2">Contact</th>
                      <th className="pb-2">Dates</th>
                      <th className="pb-2">Room type</th>
                      <th className="pb-2">Guests</th>
                      <th className="pb-2 text-right" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((w) => (
                      <tr key={w.id} className="border-b border-black/[0.03]">
                        <td className="py-2.5 font-semibold">{w.guest}</td>
                        <td className="py-2.5 text-dash-muted">{[w.email, w.phone].filter(Boolean).join(' · ')}</td>
                        <td className="py-2.5 whitespace-nowrap">{longDate(w.arrival)} → {longDate(w.departure)}</td>
                        <td className="py-2.5">{w.roomType ?? 'Any'}</td>
                        <td className="py-2.5">{w.adults}A{w.children ? ` ${w.children}C` : ''}</td>
                        <td className="py-2.5 text-right">
                          <PermissionButton permission="reservations.write" size="sm" variant="secondary"
                            onClick={() => navigate('new-reservation')}>
                            Book now
                          </PermissionButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </QueryState>
      )}

      {/* ── Create group ── */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New group" size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button disabled={!g.code.trim() || !g.name.trim() || createGroup.isPending}
              onClick={async () => {
                try {
                  const res = await createGroup.mutateAsync({
                    ...g,
                    cutoffDate: g.cutoffDate || undefined,
                    ratePlanId: g.ratePlanId || undefined,
                    companyId: g.companyId || undefined,
                    masterFolio: true,
                  });
                  toast.success('Group created');
                  setSelectedId(res.id);
                  setCreateOpen(false);
                } catch (e) { toast.fail(e); }
              }}>
              Create group
            </Button>
          </div>
        }>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Group code" required>
            <TextInput value={g.code} onChange={(v) => setG({ ...g, code: v.toUpperCase() })} placeholder="GRP-2026-001" />
          </Field>
          <Field label="Group name" required>
            <TextInput value={g.name} onChange={(v) => setG({ ...g, name: v })} placeholder="Tech Summit 2026" />
          </Field>
          <Field label="Arrival" required><DateInput value={g.arrival} onChange={(v) => setG({ ...g, arrival: v })} /></Field>
          <Field label="Departure" required>
            <DateInput value={g.departure} onChange={(v) => setG({ ...g, departure: v })} min={addDays(g.arrival, 1)} />
          </Field>
          <Field label="Cut-off date" hint="Unsold rooms are released back after this date">
            <DateInput value={g.cutoffDate} onChange={(v) => setG({ ...g, cutoffDate: v })} />
          </Field>
          <Field label="Rate plan">
            <Select value={g.ratePlanId} onChange={(v) => setG({ ...g, ratePlanId: v })} options={[
              { label: 'Select…', value: '' },
              ...(ratePlans.data ?? []).map((rp) => ({ label: `${rp.code} · ${rp.name}`, value: rp.id })),
            ]} />
          </Field>
          <Field label="Company">
            <Select value={g.companyId} onChange={(v) => setG({ ...g, companyId: v })} options={[
              { label: 'None', value: '' },
              ...(companies.data ?? []).map((c) => ({ label: c.name, value: c.id })),
            ]} />
          </Field>
          <Field label="Contact name"><TextInput value={g.contactName} onChange={(v) => setG({ ...g, contactName: v })} /></Field>
          <Field label="Contact email"><TextInput value={g.contactEmail} onChange={(v) => setG({ ...g, contactEmail: v })} /></Field>
        </div>
      </Modal>

      {/* ── Set block ── */}
      <Modal open={blockOpen} onClose={() => setBlockOpen(false)} title="Set the room block"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setBlockOpen(false)}>Cancel</Button>
            <Button disabled={!blockForm.roomTypeId || setBlock.isPending}
              onClick={async () => {
                try {
                  const res = await setBlock.mutateAsync({ id: selectedId, body: blockForm });
                  toast.success(`Block set across ${res.updated} date(s)`);
                  setBlockOpen(false);
                } catch (e) { toast.fail(e); }
              }}>
              Set block
            </Button>
          </div>
        }>
        <div className="space-y-4">
          <Field label="Room type" required>
            <Select value={blockForm.roomTypeId} onChange={(v) => setBlockForm({ ...blockForm, roomTypeId: v })}
              options={(roomTypes.data ?? []).map((rt) => ({ label: rt.name, value: rt.id }))} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From" required><DateInput value={blockForm.from} onChange={(v) => setBlockForm({ ...blockForm, from: v })} /></Field>
            <Field label="To" required hint="Inclusive"><DateInput value={blockForm.to} onChange={(v) => setBlockForm({ ...blockForm, to: v })} /></Field>
            <Field label="Rooms held" required>
              <NumberInput value={blockForm.rooms} onChange={(v) => setBlockForm({ ...blockForm, rooms: v })} min={0} max={500} />
            </Field>
            <Field label="Group rate">
              <MoneyInput valueMinor={blockForm.rateMinor} onChange={(v) => setBlockForm({ ...blockForm, rateMinor: v })} />
            </Field>
          </div>
          <p className="text-[11px] text-dash-muted">
            Held rooms are removed from general availability until they are picked up or the cut-off passes.
          </p>
        </div>
      </Modal>

      {/* ── Rooming list ── */}
      <Modal open={roomingOpen} onClose={() => setRoomingOpen(false)} title="Upload a rooming list" size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRoomingOpen(false)}>Cancel</Button>
            <Button disabled={!roomingText.trim() || !roomingRoomType || roomingList.isPending}
              onClick={async () => {
                const rows = roomingText.split('\n').map((line) => line.trim()).filter(Boolean)
                  .map((line) => {
                    const [guestName, email, adultsRaw] = line.split(',').map((s) => s.trim());
                    return {
                      guestName, email: email || undefined,
                      adults: Number(adultsRaw) || 1,
                      roomTypeId: roomingRoomType,
                    };
                  })
                  .filter((r) => r.guestName);
                if (!rows.length) return;
                try {
                  const res = await roomingList.mutateAsync({ id: selectedId, rows });
                  toast.push({
                    kind: res.failed.length ? 'warn' : 'ok',
                    title: `${res.created.length} reservation(s) created`,
                    body: res.failed.length
                      ? `${res.failed.length} failed: ${res.failed.map((f: any) => `${f.guest} (${f.error})`).join('; ')}`
                      : undefined,
                  });
                  setRoomingOpen(false); setRoomingText('');
                } catch (e) { toast.fail(e); }
              }}>
              Create reservations
            </Button>
          </div>
        }>
        <div className="space-y-4">
          <Field label="Room type for these rooms" required>
            <Select value={roomingRoomType} onChange={setRoomingRoomType}
              options={(roomTypes.data ?? []).map((rt) => ({ label: rt.name, value: rt.id }))} />
          </Field>
          <Field label="Guests" required hint="One per line: name, email, adults">
            <textarea value={roomingText} onChange={(e) => setRoomingText(e.target.value)} rows={10}
              placeholder={'Jane Smith, jane@example.com, 2\nRavi Kumar, ravi@example.com, 1'}
              className="w-full bg-white border border-black/10 rounded-xl px-4 py-3 text-[13px] font-mono outline-none focus:border-black/40" />
          </Field>
          <p className="text-[11px] text-dash-muted">
            Each line becomes a confirmed reservation against the group's block and rate plan.
          </p>
        </div>
      </Modal>

      {/* ── Waitlist ── */}
      <Modal open={waitOpen} onClose={() => setWaitOpen(false)} title="Add to the waitlist"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setWaitOpen(false)}>Cancel</Button>
            <Button disabled={!wait.guestName.trim() || addWaitlist.isPending}
              onClick={async () => {
                try {
                  await addWaitlist.mutateAsync({ ...wait, roomTypeId: wait.roomTypeId || undefined });
                  toast.success('Added to the waitlist');
                  setWaitOpen(false);
                } catch (e) { toast.fail(e); }
              }}>
              Add
            </Button>
          </div>
        }>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Guest name" required>
            <TextInput value={wait.guestName} onChange={(v) => setWait({ ...wait, guestName: v })} />
          </Field>
          <Field label="Email"><TextInput value={wait.email} onChange={(v) => setWait({ ...wait, email: v })} /></Field>
          <Field label="Phone"><TextInput value={wait.phone} onChange={(v) => setWait({ ...wait, phone: v })} /></Field>
          <Field label="Room type">
            <Select value={wait.roomTypeId} onChange={(v) => setWait({ ...wait, roomTypeId: v })} options={[
              { label: 'Any', value: '' },
              ...(roomTypes.data ?? []).map((rt) => ({ label: rt.name, value: rt.id })),
            ]} />
          </Field>
          <Field label="Arrival" required><DateInput value={wait.arrival} onChange={(v) => setWait({ ...wait, arrival: v })} /></Field>
          <Field label="Departure" required>
            <DateInput value={wait.departure} onChange={(v) => setWait({ ...wait, departure: v })} min={addDays(wait.arrival, 1)} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
