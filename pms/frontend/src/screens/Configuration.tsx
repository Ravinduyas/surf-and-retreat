// Configuration — where a property is made operational. Nothing in Helio is
// pre-filled: room types, rooms, taxes and transaction codes are defined here.
import { useState } from 'react';
import { Building2, Bed, Layers, Percent, Receipt, FileText, Plus, Save, Trash2 } from 'lucide-react';
import {
  useProperty, useUpdatePropertyConfig, useRoomTypes, useCreateRoomType, useUpdateRoomType,
  useDeleteRoomType, useRooms, useCreateRoom, useBulkRooms, useUpdateRoom, useDeleteRoom,
  useTaxes, useCreateTax, useUpdateTax, useDeleteTax, useTransactionCodes, useCreateTransactionCode,
  useUpdateTransactionCode, usePolicies, useSavePolicy, useDeletePolicy, useBeds,
  useInventory, useSetInventory, useAutoPush, useSetAutoPush,
} from '../queries';
import { AlertSettingsPanel } from './AlertSettings';
import { PaymentSettingsTab } from './PaymentSettings';
import { InvoiceBrandingTab } from './InvoiceBranding';
import { HostelworldSettingsTab } from './HostelworldSettings';
import { useAuthStore } from '../stores';
import { Card, Pill, Button, SectionHeader, Tabs, Field, Select, TextInput, Modal } from '../ui';
import {
  QueryState, useToast, MoneyInput, NumberInput, PermissionButton, Toggle, ConfirmDialog,
  RequirePermission, InfoNote,
} from '../components';
import { money, bpToPercent, percentToBp } from '../format';

export function ConfigurationScreen() {
  const [tab, setTab] = useState<
    'property' | 'roomTypes' | 'rooms' | 'taxes' | 'codes' | 'payments' | 'hostelworld' | 'policies'
    | 'alerts' | 'invoice'
  >('property');

  return (
    <RequirePermission permission="config.read">
      <SectionHeader
        eyebrow="Setup"
        title="Configuration"
        action={
          <Tabs
            tabs={[
              { value: 'property', label: 'Property' },
              { value: 'roomTypes', label: 'Room types' },
              { value: 'rooms', label: 'Rooms' },
              { value: 'taxes', label: 'Taxes' },
              { value: 'codes', label: 'Transaction codes' },
              { value: 'payments', label: 'Payments' },
              { value: 'hostelworld', label: 'Hostelworld' },
              { value: 'policies', label: 'Policies' },
              { value: 'alerts', label: 'Alert sounds' },
              { value: 'invoice', label: 'Invoice branding' },
            ]}
            active={tab}
            onChange={setTab}
          />
        }
      />
      {tab === 'property' && <PropertyTab />}
      {tab === 'roomTypes' && <RoomTypesTab />}
      {tab === 'rooms' && <RoomsTab />}
      {tab === 'taxes' && <TaxesTab />}
      {tab === 'codes' && <CodesTab />}
      {tab === 'payments' && <PaymentSettingsTab />}
      {tab === 'hostelworld' && <HostelworldSettingsTab />}
      {tab === 'policies' && <PoliciesTab />}
      {tab === 'alerts' && <AlertSettingsPanel />}
      {tab === 'invoice' && <InvoiceBrandingTab />}
    </RequirePermission>
  );
}

/**
 * The currencies a property can be held in.
 *
 * Picked from a list rather than typed: the code is not a label, it is what
 * every screen, folio, invoice and channel push formats money with, and a
 * mistyped one — LRK, EURO, usd — reaches all of them before anybody notices.
 * The list is the codes properties on this system actually use; a property
 * already set to something else keeps it, at the top, rather than being
 * silently moved to a currency nobody chose.
 */
const CURRENCIES: { code: string; name: string }[] = [
  { code: 'LKR', name: 'Sri Lankan rupee' },
  { code: 'USD', name: 'US dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'Pound sterling' },
  { code: 'AUD', name: 'Australian dollar' },
  { code: 'CAD', name: 'Canadian dollar' },
  { code: 'CHF', name: 'Swiss franc' },
  { code: 'AED', name: 'UAE dirham' },
  { code: 'INR', name: 'Indian rupee' },
  { code: 'MVR', name: 'Maldivian rufiyaa' },
  { code: 'SGD', name: 'Singapore dollar' },
  { code: 'MYR', name: 'Malaysian ringgit' },
  { code: 'THB', name: 'Thai baht' },
  { code: 'IDR', name: 'Indonesian rupiah' },
  { code: 'JPY', name: 'Japanese yen' },
  { code: 'CNY', name: 'Chinese yuan' },
  { code: 'HKD', name: 'Hong Kong dollar' },
  { code: 'NZD', name: 'New Zealand dollar' },
  { code: 'ZAR', name: 'South African rand' },
  { code: 'SEK', name: 'Swedish krona' },
  { code: 'NOK', name: 'Norwegian krone' },
  { code: 'DKK', name: 'Danish krone' },
];

const currencyOptions = (current: string) => {
  const known = CURRENCIES.some((c) => c.code === current);
  const list = current && !known
    ? [{ code: current, name: 'in use on this property' }, ...CURRENCIES]
    : CURRENCIES;
  return list.map((c) => ({ label: `${c.code} · ${c.name}`, value: c.code }));
};

// ─── Property ────────────────────────────────────────────────
function PropertyTab() {
  const toast = useToast();
  const property = useProperty();
  const update = useUpdatePropertyConfig();
  const refreshProperty = useAuthStore((s) => s.refreshProperty);
  const [draft, setDraft] = useState<Record<string, any> | null>(null);

  return (
    <QueryState query={property} loadingRows={5}>
      {(p) => {
        const d = draft ?? {
          name: p.name, legalName: p.legalName ?? '', kind: p.kind, address: p.address ?? '',
          city: p.city ?? '', country: p.country ?? '', timezone: p.timezone, currency: p.currency,
          checkInTime: p.checkInTime, checkOutTime: p.checkOutTime, phone: p.phone ?? '',
          email: p.email ?? '', website: p.website ?? '', taxId: p.taxId ?? '',
        };
        return (
          <div className="grid lg:grid-cols-3 gap-3">
            <Card className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-4 h-4 text-dash-muted" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">Property details</p>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Name" required>
                  <TextInput value={d.name} onChange={(v) => setDraft({ ...d, name: v })} />
                </Field>
                <Field label="Legal / billing name">
                  <TextInput value={d.legalName} onChange={(v) => setDraft({ ...d, legalName: v })} />
                </Field>
                <Field label="Type">
                  <Select value={d.kind} onChange={(v) => setDraft({ ...d, kind: v })} options={[
                    { label: 'Hotel', value: 'hotel' }, { label: 'Hostel', value: 'hostel' },
                    { label: 'Mixed', value: 'mixed' },
                  ]} />
                </Field>
                <Field label="Tax / VAT number">
                  <TextInput value={d.taxId} onChange={(v) => setDraft({ ...d, taxId: v })} />
                </Field>
                <Field label="Address"><TextInput value={d.address} onChange={(v) => setDraft({ ...d, address: v })} /></Field>
                <Field label="City"><TextInput value={d.city} onChange={(v) => setDraft({ ...d, city: v })} /></Field>
                <Field label="Country"><TextInput value={d.country} onChange={(v) => setDraft({ ...d, country: v })} /></Field>
                <Field label="Timezone"><TextInput value={d.timezone} onChange={(v) => setDraft({ ...d, timezone: v })} /></Field>
                <Field label="Currency" hint="Every screen, folio and report is shown in this currency · changing it does not convert existing amounts">
                  <Select value={d.currency} onChange={(v) => setDraft({ ...d, currency: v })}
                    options={currencyOptions(d.currency)} />
                </Field>
                <Field label="Phone"><TextInput value={d.phone} onChange={(v) => setDraft({ ...d, phone: v })} /></Field>
                <Field label="Email"><TextInput value={d.email} onChange={(v) => setDraft({ ...d, email: v })} /></Field>
                <Field label="Website"><TextInput value={d.website} onChange={(v) => setDraft({ ...d, website: v })} /></Field>
                <Field label="Check-in time">
                  <input type="time" value={d.checkInTime} onChange={(e) => setDraft({ ...d, checkInTime: e.target.value })}
                    className="w-full bg-white border border-black/10 rounded-xl px-4 py-2.5 text-[13px] outline-none focus:border-black/40" />
                </Field>
                <Field label="Check-out time">
                  <input type="time" value={d.checkOutTime} onChange={(e) => setDraft({ ...d, checkOutTime: e.target.value })}
                    className="w-full bg-white border border-black/10 rounded-xl px-4 py-2.5 text-[13px] outline-none focus:border-black/40" />
                </Field>
              </div>
              <div className="flex justify-end mt-5">
                <PermissionButton permission="config.write" icon={<Save className="w-3.5 h-3.5" />}
                  disabled={!draft || update.isPending}
                  onClick={async () => {
                    try {
                      await update.mutateAsync(d);
                      await refreshProperty();
                      toast.success('Property updated');
                      setDraft(null);
                    } catch (e) { toast.fail(e); }
                  }}>
                  Save changes
                </PermissionButton>
              </div>
            </Card>

            <div className="space-y-3">
              <Card tone="dark">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-3">Current state</p>
                <div className="space-y-2">
                  <DarkRow label="Property code" value={p.code} />
                  <DarkRow label="Business date" value={p.businessDate} />
                  <DarkRow label="Room types" value={String(p.roomTypes ?? 0)} />
                  <DarkRow label="Rooms" value={String(p.rooms)} />
                  <DarkRow label="Rate plans" value={String(p.ratePlans ?? 0)} />
                </div>
              </Card>
              <Card>
                <InfoNote>
                  The business date only moves when the night audit runs. That keeps postings, statistics and
                  the ledger in step — it cannot be edited here.
                </InfoNote>
              </Card>
            </div>
          </div>
        );
      }}
    </QueryState>
  );
}

// ─── Room types ──────────────────────────────────────────────
function RoomTypesTab() {
  const toast = useToast();
  const roomTypes = useRoomTypes();
  const create = useCreateRoomType();
  const update = useUpdateRoomType();
  const remove = useDeleteRoomType();

  const inventory = useInventory();
  const setInventory = useSetInventory();
  const autoPush = useAutoPush();
  const setAutoPush = useSetAutoPush();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const blank = {
    code: '', name: '', kind: 'room', baseOccupancy: 2, maxOccupancy: 2, maxAdults: 2,
    maxChildren: 0, defaultRateMinor: 0, extraAdultMinor: 0, extraChildMinor: 0,
    genderPolicy: '', amenities: '',
    // How much of it exists. Part of the same form because it is part of the
    // same question — "what is this room type?" is not answered without it, and
    // splitting it into a second dialog is why the list could show 2 × 8 while
    // the edit screen had no way to change it.
    rooms: 1, bedsPerRoom: 1,
  };
  const [form, setForm] = useState<any>(blank);

  const lineFor = (roomTypeId: string) =>
    (inventory.data?.lines ?? []).find((l: any) => l.roomTypeId === roomTypeId);

  /** One way in, from either button, carrying everything the type is made of. */
  const openEditor = (rt: any) => {
    const line = lineFor(rt.id);
    setEditing(rt);
    setForm({
      ...rt,
      amenities: rt.amenities.join(', '),
      genderPolicy: rt.genderPolicy ?? '',
      rooms: line?.rooms ?? 0,
      bedsPerRoom: line?.bedsPerRoom || 1,
    });
    setOpen(true);
  };

  return (
    <>
      <div className="flex justify-end mb-3">
        <PermissionButton permission="config.write" icon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => { setForm(blank); setEditing(null); setOpen(true); }}>
          New room type
        </PermissionButton>
      </div>

      <QueryState query={roomTypes} loadingRows={4}
        empty="No room types yet"
        emptyHint="A room type is what you sell — a Deluxe King, or a 6-bed mixed dorm.">
        {(rows) => (
          <div className="space-y-2">
            {rows.map((rt) => (
              <Card key={rt.id}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="text-[14px] font-bold">{rt.name}</p>
                      <Pill tone="grey">{rt.code}</Pill>
                      <Pill tone={rt.kind === 'dorm' ? 'lilac' : 'sky'}>{rt.kind}</Pill>
                      {!rt.active && <Pill tone="peach">Inactive</Pill>}
                    </div>
                    <div className="flex flex-wrap gap-3 text-[11px] text-dash-muted">
                      <span>{rt.kind === 'dorm' ? `${rt.beds} beds` : `${rt.rooms} rooms`}</span>
                      <span>Base {rt.baseOccupancy} · max {rt.maxOccupancy}</span>
                      <span>Default {money(rt.defaultRateMinor)}</span>
                      {rt.extraAdultMinor > 0 && <span>Extra adult {money(rt.extraAdultMinor)}</span>}
                      {rt.extraChildMinor > 0 && <span>Extra child {money(rt.extraChildMinor)}</span>}
                      {rt.genderPolicy && <span>{rt.genderPolicy}</span>}
                    </div>
                    <InventoryLine roomTypeId={rt.id} onEdit={() => openEditor(rt)} />
                    {rt.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {rt.amenities.map((a) => <Pill key={a} tone="mint">{a}</Pill>)}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <PermissionButton permission="config.write" size="sm" variant="secondary"
                      onClick={() => openEditor(rt)}>
                      Edit
                    </PermissionButton>
                    <PermissionButton permission="config.write" size="sm" variant="ghost"
                      icon={<Trash2 className="w-3 h-3" />} onClick={() => setDeleteId(rt.id)} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </QueryState>

      <Modal open={open} onClose={() => setOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'New room type'} size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!form.code || !form.name || create.isPending || update.isPending
              || setInventory.isPending}
              onClick={async () => {
                const { rooms, bedsPerRoom, ...rest } = form;
                const body = {
                  ...rest,
                  genderPolicy: form.genderPolicy || undefined,
                  amenities: String(form.amenities ?? '').split(',').map((s: string) => s.trim()).filter(Boolean),
                };
                try {
                  // Attributes first, then how many of them there are. Two
                  // calls because they are two different things to get wrong,
                  // and the second can be refused — a booked bed cannot be
                  // deleted — without that invalidating the first.
                  const rt = editing
                    ? await update.mutateAsync({ id: editing.id, body })
                    : await create.mutateAsync(body);

                  const line = editing ? lineFor(editing.id) : null;
                  const countChanged = !line
                    || line.rooms !== Number(rooms)
                    || (form.kind === 'dorm' && line.bedsPerRoom !== Number(bedsPerRoom));

                  if (!countChanged) {
                    toast.success('Room type updated');
                    setOpen(false);
                    return;
                  }

                  const res = await setInventory.mutateAsync({
                    roomTypeId: editing ? editing.id : rt.id,
                    rooms: Number(rooms),
                    bedsPerRoom: Number(bedsPerRoom),
                  });
                  const saved = `${form.name} — ${res.line.sellable} `
                    + `${form.kind === 'dorm' ? 'beds' : 'rooms'} for sale`;

                  // Three outcomes, said as three. Folding a refused channel
                  // write into "saved" is how the two sides drift while the
                  // screen looks fine.
                  if (res.push?.attempted && res.push.ok) {
                    toast.success(saved, `The channel was updated to ${res.push.qty}`);
                  } else if (res.push?.attempted) {
                    toast.push({
                      kind: 'warn',
                      title: `${saved} — but the channel was not updated`,
                      body: res.push.error,
                    });
                  } else {
                    toast.success(saved);
                  }
                  setOpen(false);
                } catch (e) { toast.fail(e); }
              }}>
              {editing ? 'Save changes' : 'Create room type'}
            </Button>
          </div>
        }>
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Code" required hint="Short code used in reports and channel mappings">
              <TextInput value={form.code} onChange={(v) => setForm({ ...form, code: v.toUpperCase() })} />
            </Field>
            <Field label="Name" required>
              <TextInput value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            </Field>
            <Field label="Kind" hint="Dorm types sell individual beds rather than whole rooms">
              <Select value={form.kind} onChange={(v) => setForm({ ...form, kind: v })} options={[
                { label: 'Room', value: 'room' }, { label: 'Dorm (per bed)', value: 'dorm' },
              ]} disabled={!!editing} />
            </Field>
            {form.kind === 'dorm' && (
              <Field label="Gender policy">
                <Select value={form.genderPolicy} onChange={(v) => setForm({ ...form, genderPolicy: v })} options={[
                  { label: 'Mixed', value: 'mixed' }, { label: 'Female only', value: 'female' },
                  { label: 'Male only', value: 'male' },
                ]} />
              </Field>
            )}
            <Field label="Base occupancy" hint="Guests included in the rate">
              <NumberInput value={form.baseOccupancy} onChange={(v) => setForm({ ...form, baseOccupancy: v })} min={1} max={40} />
            </Field>
            <Field label="Maximum occupancy">
              <NumberInput value={form.maxOccupancy} onChange={(v) => setForm({ ...form, maxOccupancy: v })} min={1} max={40} />
            </Field>
            <Field label="Max adults">
              <NumberInput value={form.maxAdults} onChange={(v) => setForm({ ...form, maxAdults: v })} min={0} max={40} />
            </Field>
            <Field label="Max children">
              <NumberInput value={form.maxChildren} onChange={(v) => setForm({ ...form, maxChildren: v })} min={0} max={20} />
            </Field>
            <Field label="Default rate" hint="Used when no rate plan or calendar price applies">
              <MoneyInput valueMinor={form.defaultRateMinor} onChange={(v) => setForm({ ...form, defaultRateMinor: v })} />
            </Field>
            <Field label="Extra adult supplement">
              <MoneyInput valueMinor={form.extraAdultMinor} onChange={(v) => setForm({ ...form, extraAdultMinor: v })} />
            </Field>
            <Field label="Extra child supplement">
              <MoneyInput valueMinor={form.extraChildMinor} onChange={(v) => setForm({ ...form, extraChildMinor: v })} />
            </Field>
          </div>
          <Field label="Amenities" hint="Comma separated">
            <TextInput value={form.amenities} onChange={(v) => setForm({ ...form, amenities: v })} />
          </Field>

          {/* How much of it exists, and what the channel thinks.
              In the same dialog as everything else, because the list already
              shows "16 beds (2 × 8)" and an Edit screen that could not change
              that number was a dead end. */}
          <div className="pt-4 border-t subtle-divider">
            <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-3">
              How many exist
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label={form.kind === 'dorm' ? 'Rooms of this type' : 'How many rooms'}
                hint={editing ? undefined : 'Created with the room type'}>
                <NumberInput value={form.rooms} min={0} max={500}
                  onChange={(v) => setForm({ ...form, rooms: v })} />
              </Field>
              {form.kind === 'dorm' && (
                <Field label="Beds in each room">
                  <NumberInput value={form.bedsPerRoom} min={1} max={64}
                    onChange={(v) => setForm({ ...form, bedsPerRoom: v })} />
                </Field>
              )}
            </div>

            {(() => {
              const line = editing ? lineFor(editing.id) : null;
              const next = form.kind === 'dorm'
                ? Number(form.rooms) * Number(form.bedsPerRoom)
                : Number(form.rooms);
              const unit = form.kind === 'dorm' ? 'beds' : 'rooms';
              return (
                <div className="mt-3 p-3 rounded-xl bg-dash-bg">
                  <p className="text-[12px] font-bold">
                    {line && line.sellable !== next
                      ? `${line.sellable} → ${next} ${unit} for sale`
                      : `${next} ${unit} for sale`}
                  </p>
                  {line?.externalQty !== null && line !== null && (
                    <p className="text-[11px] text-dash-muted mt-1">
                      The channel sells {line.externalQty}.
                      {next !== line.externalQty
                        ? ' Saving will send the new number if auto-send is on below.'
                        : ' That matches.'}
                    </p>
                  )}
                  {!!line?.sold && (
                    <p className="text-[11px] text-dash-muted mt-1">
                      {line.sold} booked and cannot be removed.
                    </p>
                  )}
                </div>
              );
            })()}

            {editing && lineFor(editing.id)?.externalRoomId && (
              <div className="mt-3">
                <Toggle
                  checked={autoPush.data?.on ?? false}
                  label="Send count changes to the channel automatically"
                  onChange={async (v) => {
                    try {
                      await setAutoPush.mutateAsync(v);
                      toast.success(v
                        ? 'Count changes will go straight to the channel'
                        : 'Count changes will stay in Helio until you send them');
                    } catch (e) { toast.fail(e); }
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete this room type?"
        body={
          // Deleting here does not delete anything on the channel — the
          // connector pushes rates and availability, never room definitions. So
          // the OTA carries on selling a room Helio no longer has, and stops
          // being told how many are left. Say that before, not after.
          'If it has reservations it will be deactivated instead of deleted, so history stays intact.'
          + '\n\nIf it is mapped to a channel, the channel keeps the room and keeps selling it — '
          + 'Helio just stops sending it availability. Remove it on the channel too, or the two '
          + 'will drift.'
        }
        confirmLabel="Delete"
        danger
        busy={remove.isPending}
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => {
          if (!deleteId) return;
          try {
            const res = await remove.mutateAsync({ id: deleteId });
            toast.success(res.deactivated ? 'Room type deactivated' : 'Room type deleted', res.reason);
          } catch (e) { toast.fail(e); }
          setDeleteId(null);
        }}
      />
    </>
  );
}

// ─── Rooms ───────────────────────────────────────────────────
function RoomsTab() {
  const toast = useToast();
  const rooms = useRooms();
  const roomTypes = useRoomTypes();
  const beds = useBeds();
  const create = useCreateRoom();
  const bulk = useBulkRooms();
  const remove = useDeleteRoom();

  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ roomTypeId: '', number: '', floor: 1, hkSection: '', bedCount: 6 });
  const [bulkForm, setBulkForm] = useState({
    roomTypeId: '', floorFrom: 1, floorTo: 3, roomsPerFloor: 10, startAt: 1, pad: 2, bedCount: 6,
  });

  const selectedType = roomTypes.data?.find((rt) => rt.id === form.roomTypeId);
  const bulkType = roomTypes.data?.find((rt) => rt.id === bulkForm.roomTypeId);

  return (
    <>
      <div className="flex justify-end gap-2 mb-3">
        <PermissionButton permission="config.write" variant="secondary" icon={<Layers className="w-3.5 h-3.5" />}
          onClick={() => { setBulkForm({ ...bulkForm, roomTypeId: roomTypes.data?.[0]?.id ?? '' }); setBulkOpen(true); }}>
          Bulk create floors
        </PermissionButton>
        <PermissionButton permission="config.write" icon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => { setForm({ ...form, roomTypeId: roomTypes.data?.[0]?.id ?? '' }); setOpen(true); }}>
          New room
        </PermissionButton>
      </div>

      <QueryState query={rooms} loadingRows={5}
        empty="No rooms yet"
        emptyHint="Rooms are the physical inventory availability is calculated from.">
        {(rows) => {
          const byFloor = new Map<number, typeof rows>();
          for (const r of rows) {
            const list = byFloor.get(r.floor) ?? [];
            list.push(r);
            byFloor.set(r.floor, list);
          }
          return (
            <div className="space-y-4">
              <Card>
                <div className="flex flex-wrap gap-4">
                  <Stat label="Total rooms" value={String(rows.length)} />
                  <Stat label="Active" value={String(rows.filter((r) => r.active).length)} />
                  <Stat label="Dorm beds" value={String(beds.data?.length ?? 0)} />
                  <Stat label="Floors" value={String(byFloor.size)} />
                </div>
              </Card>

              {[...byFloor.entries()].sort((a, b) => a[0] - b[0]).map(([floor, list]) => (
                <div key={floor}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-2">
                    Floor {floor} · {list.length} rooms
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-2">
                    {list.map((r) => (
                      <div key={r.id} className={`p-3 rounded-2xl border ${r.active ? 'border-black/5 bg-white' : 'border-black/5 bg-dash-bg opacity-60'}`}>
                        <div className="flex items-start justify-between">
                          <p className="text-[14px] font-black">{r.number}</p>
                          <PermissionButton permission="config.write" size="sm" variant="ghost"
                            icon={<Trash2 className="w-3 h-3" />} onClick={() => setDeleteId(r.id)} />
                        </div>
                        <p className="text-[9px] text-dash-muted truncate">{r.roomType}</p>
                        {r.beds > 0 && <p className="text-[9px] text-dash-muted">{r.beds} beds</p>}
                        {!r.active && <Pill tone="peach" className="mt-1">Inactive</Pill>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        }}
      </QueryState>

      <Modal open={open} onClose={() => setOpen(false)} title="New room"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!form.roomTypeId || !form.number.trim() || create.isPending}
              onClick={async () => {
                try {
                  await create.mutateAsync({
                    ...form,
                    hkSection: form.hkSection || undefined,
                    bedCount: selectedType?.kind === 'dorm' ? form.bedCount : undefined,
                  });
                  toast.success(`Room ${form.number} created`);
                  setOpen(false); setForm({ ...form, number: '' });
                } catch (e) { toast.fail(e); }
              }}>
              Create room
            </Button>
          </div>
        }>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Room type" required>
            <Select value={form.roomTypeId} onChange={(v) => setForm({ ...form, roomTypeId: v })}
              options={(roomTypes.data ?? []).map((rt) => ({ label: `${rt.name} (${rt.kind})`, value: rt.id }))} />
          </Field>
          <Field label="Room number" required>
            <TextInput value={form.number} onChange={(v) => setForm({ ...form, number: v })} />
          </Field>
          <Field label="Floor"><NumberInput value={form.floor} onChange={(v) => setForm({ ...form, floor: v })} min={-5} max={200} /></Field>
          <Field label="Housekeeping section"><TextInput value={form.hkSection} onChange={(v) => setForm({ ...form, hkSection: v })} /></Field>
          {selectedType?.kind === 'dorm' && (
            <Field label="Beds in this dorm" required hint="Each bed becomes individually sellable">
              <NumberInput value={form.bedCount} onChange={(v) => setForm({ ...form, bedCount: v })} min={1} max={60} />
            </Field>
          )}
        </div>
      </Modal>

      <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} title="Bulk create rooms"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button disabled={!bulkForm.roomTypeId || bulk.isPending}
              onClick={async () => {
                try {
                  const res = await bulk.mutateAsync({
                    ...bulkForm,
                    bedCount: bulkType?.kind === 'dorm' ? bulkForm.bedCount : undefined,
                  });
                  toast.success(`${res.created.length} room(s) created`,
                    res.skipped.length ? `${res.skipped.length} already existed` : undefined);
                  setBulkOpen(false);
                } catch (e) { toast.fail(e); }
              }}>
              Create rooms
            </Button>
          </div>
        }>
        <div className="space-y-4">
          <Field label="Room type" required>
            <Select value={bulkForm.roomTypeId} onChange={(v) => setBulkForm({ ...bulkForm, roomTypeId: v })}
              options={(roomTypes.data ?? []).map((rt) => ({ label: `${rt.name} (${rt.kind})`, value: rt.id }))} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From floor"><NumberInput value={bulkForm.floorFrom} onChange={(v) => setBulkForm({ ...bulkForm, floorFrom: v })} min={-5} max={200} /></Field>
            <Field label="To floor"><NumberInput value={bulkForm.floorTo} onChange={(v) => setBulkForm({ ...bulkForm, floorTo: v })} min={-5} max={200} /></Field>
            <Field label="Rooms per floor"><NumberInput value={bulkForm.roomsPerFloor} onChange={(v) => setBulkForm({ ...bulkForm, roomsPerFloor: v })} min={1} max={200} /></Field>
            <Field label="Numbering starts at"><NumberInput value={bulkForm.startAt} onChange={(v) => setBulkForm({ ...bulkForm, startAt: v })} min={0} max={999} /></Field>
            <Field label="Digits after floor" hint="2 → 101, 102…">
              <NumberInput value={bulkForm.pad} onChange={(v) => setBulkForm({ ...bulkForm, pad: v })} min={1} max={4} />
            </Field>
            {bulkType?.kind === 'dorm' && (
              <Field label="Beds per dorm">
                <NumberInput value={bulkForm.bedCount} onChange={(v) => setBulkForm({ ...bulkForm, bedCount: v })} min={1} max={60} />
              </Field>
            )}
          </div>
          <div className="rounded-xl bg-dash-bg p-3">
            <p className="text-[11px] text-dash-muted">
              Creates{' '}
              <span className="font-bold text-black">
                {Math.max(0, (bulkForm.floorTo - bulkForm.floorFrom + 1) * bulkForm.roomsPerFloor)}
              </span>{' '}
              rooms, numbered {bulkForm.floorFrom}{String(bulkForm.startAt).padStart(bulkForm.pad, '0')} upwards.
              Existing room numbers are skipped.
            </p>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete this room?"
        body="If it has stay history it will be deactivated instead of deleted."
        confirmLabel="Delete"
        danger
        busy={remove.isPending}
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => {
          if (!deleteId) return;
          try {
            const res = await remove.mutateAsync({ id: deleteId });
            toast.success(res.deactivated ? 'Room deactivated' : 'Room deleted', res.reason);
          } catch (e) { toast.fail(e); }
          setDeleteId(null);
        }}
      />
    </>
  );
}

// ─── Taxes ───────────────────────────────────────────────────
function TaxesTab() {
  const toast = useToast();
  const taxes = useTaxes();
  const create = useCreateTax();
  const update = useUpdateTax();
  const remove = useDeleteTax();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: '', name: '', mode: 'percent', percent: 10, amountMinor: 0,
    appliesTo: 'all', inclusive: false, sortOrder: 1,
  });

  return (
    <>
      <InfoNote>
        Taxes are applied in sort order, and percentage taxes compound on the ones above them — so a
        10% service charge listed first, then 8% VAT, produces VAT on the service charge, which is how
        most jurisdictions expect it.
      </InfoNote>

      <div className="flex justify-end my-3">
        <PermissionButton permission="config.write" icon={<Percent className="w-3.5 h-3.5" />}
          onClick={() => setOpen(true)}>
          New tax
        </PermissionButton>
      </div>

      <QueryState query={taxes} loadingRows={3}
        empty="No taxes configured"
        emptyHint="Add VAT, service charge and any city or tourism tax before taking bookings.">
        {(rows) => (
          <Card>
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full min-w-[52rem] text-[12px]">
                <thead>
                  <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                    <th className="pb-2">Order</th>
                    <th className="pb-2">Code</th>
                    <th className="pb-2">Name</th>
                    <th className="pb-2">Mode</th>
                    <th className="pb-2 text-right">Value</th>
                    <th className="pb-2">Applies to</th>
                    <th className="pb-2 text-center">Active</th>
                    <th className="pb-2 text-right" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.id} className={`border-b border-black/[0.03] ${t.active ? '' : 'opacity-40'}`}>
                      <td className="py-2.5 text-dash-muted">{t.sortOrder}</td>
                      <td className="py-2.5 font-mono text-[11px]">{t.code}</td>
                      <td className="py-2.5 font-semibold">{t.name}</td>
                      <td className="py-2.5 text-dash-muted">{describeTaxMode(t.mode)}</td>
                      <td className="py-2.5 text-right font-bold tabular-nums">
                        {t.mode === 'percent' ? `${bpToPercent(t.value)}%` : money(t.value)}
                      </td>
                      <td className="py-2.5"><Pill tone="grey">{t.appliesTo}</Pill></td>
                      <td className="py-2.5">
                        <div className="flex justify-center">
                          <Toggle checked={t.active} onChange={(v) => update.mutate({ id: t.id, body: { active: v } })} />
                        </div>
                      </td>
                      <td className="py-2.5 text-right">
                        <PermissionButton permission="config.write" size="sm" variant="ghost"
                          onClick={async () => {
                            try { await remove.mutateAsync({ id: t.id }); toast.success('Tax removed'); }
                            catch (e) { toast.fail(e); }
                          }}>
                          Remove
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

      <Modal open={open} onClose={() => setOpen(false)} title="New tax"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!form.code || !form.name || create.isPending}
              onClick={async () => {
                try {
                  await create.mutateAsync({
                    code: form.code.toUpperCase(), name: form.name, mode: form.mode,
                    value: form.mode === 'percent' ? percentToBp(form.percent) : form.amountMinor,
                    appliesTo: form.appliesTo, inclusive: form.inclusive, sortOrder: form.sortOrder,
                  });
                  toast.success('Tax created');
                  setOpen(false);
                } catch (e) { toast.fail(e); }
              }}>
              Create tax
            </Button>
          </div>
        }>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Code" required><TextInput value={form.code} onChange={(v) => setForm({ ...form, code: v.toUpperCase() })} /></Field>
          <Field label="Name" required><TextInput value={form.name} onChange={(v) => setForm({ ...form, name: v })} /></Field>
          <Field label="Mode" required>
            <Select value={form.mode} onChange={(v) => setForm({ ...form, mode: v })} options={[
              { label: 'Percentage of the charge', value: 'percent' },
              { label: 'Fixed amount per night', value: 'per_night' },
              { label: 'Fixed amount per person per night', value: 'per_person_night' },
              { label: 'Flat amount once', value: 'flat' },
            ]} />
          </Field>
          {form.mode === 'percent' ? (
            <Field label="Percentage" required>
              <input type="number" step="0.01" value={form.percent}
                onChange={(e) => setForm({ ...form, percent: Number(e.target.value) })}
                className="w-full bg-white border border-black/10 rounded-xl px-4 py-2.5 text-[13px] outline-none focus:border-black/40" />
            </Field>
          ) : (
            <Field label="Amount" required>
              <MoneyInput valueMinor={form.amountMinor} onChange={(v) => setForm({ ...form, amountMinor: v })} />
            </Field>
          )}
          <Field label="Applies to">
            <Select value={form.appliesTo} onChange={(v) => setForm({ ...form, appliesTo: v })} options={[
              { label: 'Everything', value: 'all' },
              { label: 'Room charges only', value: 'room' },
              { label: 'Food & beverage only', value: 'fnb' },
            ]} />
          </Field>
          <Field label="Order" hint="Lower numbers are applied first and are compounded by later percentages">
            <NumberInput value={form.sortOrder} onChange={(v) => setForm({ ...form, sortOrder: v })} min={0} max={99} />
          </Field>
        </div>
        <div className="mt-4">
          <Toggle checked={form.inclusive} onChange={(v) => setForm({ ...form, inclusive: v })}
            label="Already included in the rate (not added on top)" />
        </div>
      </Modal>
    </>
  );
}

// ─── Transaction codes ───────────────────────────────────────
function CodesTab() {
  const toast = useToast();
  const codes = useTransactionCodes();
  const create = useCreateTransactionCode();
  const update = useUpdateTransactionCode();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', category: 'misc', defaultPriceMinor: 0, taxable: true });

  return (
    <>
      <div className="flex justify-end mb-3">
        <PermissionButton permission="config.write" icon={<Receipt className="w-3.5 h-3.5" />}
          onClick={() => setOpen(true)}>
          New transaction code
        </PermissionButton>
      </div>

      <QueryState query={codes} loadingRows={4} empty="No transaction codes">
        {(rows) => (
          <Card>
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full min-w-[40rem] text-[12px]">
                <thead>
                  <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                    <th className="pb-2">Code</th>
                    <th className="pb-2">Name</th>
                    <th className="pb-2">Category</th>
                    <th className="pb-2 text-right">Default price</th>
                    <th className="pb-2 text-center">Taxable</th>
                    <th className="pb-2 text-center">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} className={`border-b border-black/[0.03] ${c.active ? '' : 'opacity-40'}`}>
                      <td className="py-2.5 font-mono text-[11px] font-bold">{c.code}</td>
                      <td className="py-2.5 font-semibold">{c.name}</td>
                      <td className="py-2.5"><Pill tone="grey">{c.category}</Pill></td>
                      <td className="py-2.5 text-right tabular-nums">
                        {c.defaultPriceMinor ? money(c.defaultPriceMinor) : '—'}
                      </td>
                      <td className="py-2.5">
                        <div className="flex justify-center">
                          <Toggle checked={c.taxable} onChange={(v) => update.mutate({ id: c.id, body: { taxable: v } })} />
                        </div>
                      </td>
                      <td className="py-2.5">
                        <div className="flex justify-center">
                          <Toggle checked={c.active} onChange={(v) => update.mutate({ id: c.id, body: { active: v } })} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </QueryState>

      <Modal open={open} onClose={() => setOpen(false)} title="New transaction code"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!form.code || !form.name || create.isPending}
              onClick={async () => {
                try {
                  await create.mutateAsync({ ...form, code: form.code.toUpperCase() });
                  toast.success('Transaction code created');
                  setOpen(false);
                } catch (e) { toast.fail(e); }
              }}>
              Create code
            </Button>
          </div>
        }>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Code" required><TextInput value={form.code} onChange={(v) => setForm({ ...form, code: v.toUpperCase() })} /></Field>
          <Field label="Name" required><TextInput value={form.name} onChange={(v) => setForm({ ...form, name: v })} /></Field>
          <Field label="Category">
            <Select value={form.category} onChange={(v) => setForm({ ...form, category: v })} options={[
              { label: 'Room', value: 'room' }, { label: 'Food & beverage', value: 'fnb' },
              { label: 'Miscellaneous', value: 'misc' }, { label: 'Payment', value: 'payment' },
              { label: 'Commission', value: 'commission' },
            ]} />
          </Field>
          <Field label="Default price" hint="Pre-fills the cashier when this code is chosen">
            <MoneyInput valueMinor={form.defaultPriceMinor} onChange={(v) => setForm({ ...form, defaultPriceMinor: v })} />
          </Field>
        </div>
        <div className="mt-4">
          <Toggle checked={form.taxable} onChange={(v) => setForm({ ...form, taxable: v })}
            label="Taxes apply to this code" />
        </div>
      </Modal>
    </>
  );
}

// ─── Policies ────────────────────────────────────────────────
function PoliciesTab() {
  const toast = useToast();
  const policies = usePolicies();
  const save = useSavePolicy();
  const remove = useDeletePolicy();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ kind: 'cancellation', name: '', scope: 'property', summary: '', details: '' });

  return (
    <>
      <div className="flex justify-end mb-3">
        <PermissionButton permission="config.write" icon={<FileText className="w-3.5 h-3.5" />}
          onClick={() => setOpen(true)}>
          New policy
        </PermissionButton>
      </div>

      <QueryState query={policies} loadingRows={3}
        empty="No policies recorded"
        emptyHint="Cancellation, deposit, no-show, children and pet policies are published to channels and shown to guests.">
        {(rows) => (
          <div className="space-y-2">
            {rows.map((p) => (
              <Card key={p.id}>
                <div className="flex items-start justify-between gap-3 sm:gap-4">
                  {/* `min-w-0` so the name and its two pills can give way to the
                      Remove button rather than pushing it off a narrow screen. */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="text-[13px] font-bold">{p.name}</p>
                      <Pill tone="grey">{p.kind}</Pill>
                      <Pill tone="lilac">{p.scope}</Pill>
                    </div>
                    {p.summary && <p className="text-[12px]">{p.summary}</p>}
                    {p.details && <p className="text-[11px] text-dash-muted mt-1.5">{p.details}</p>}
                  </div>
                  <PermissionButton permission="config.write" size="sm" variant="ghost"
                    onClick={async () => {
                      try { await remove.mutateAsync({ id: p.id }); toast.success('Policy removed'); }
                      catch (e) { toast.fail(e); }
                    }}>
                    Remove
                  </PermissionButton>
                </div>
              </Card>
            ))}
          </div>
        )}
      </QueryState>

      <Modal open={open} onClose={() => setOpen(false)} title="New policy"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!form.name || save.isPending}
              onClick={async () => {
                try {
                  await save.mutateAsync(form);
                  toast.success('Policy saved');
                  setOpen(false);
                } catch (e) { toast.fail(e); }
              }}>
              Save policy
            </Button>
          </div>
        }>
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Kind" required>
              <Select value={form.kind} onChange={(v) => setForm({ ...form, kind: v })} options={[
                { label: 'Cancellation', value: 'cancellation' }, { label: 'Deposit', value: 'deposit' },
                { label: 'No-show', value: 'no-show' }, { label: 'Children', value: 'children' },
                { label: 'Pets', value: 'pets' }, { label: 'Smoking', value: 'smoking' },
                { label: 'Extra bed', value: 'extra-bed' }, { label: 'Group', value: 'group' },
                { label: 'Tax', value: 'tax' },
              ]} />
            </Field>
            <Field label="Name" required><TextInput value={form.name} onChange={(v) => setForm({ ...form, name: v })} /></Field>
          </div>
          <Field label="Summary" hint="One line shown to guests and pushed to channels">
            <TextInput value={form.summary} onChange={(v) => setForm({ ...form, summary: v })} />
          </Field>
          <Field label="Full text">
            <textarea value={form.details} rows={4} onChange={(e) => setForm({ ...form, details: e.target.value })}
              className="w-full bg-white border border-black/10 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-black/40" />
          </Field>
        </div>
      </Modal>
    </>
  );
}

function describeTaxMode(mode: string) {
  return {
    percent: 'Percentage', per_night: 'Per night',
    per_person_night: 'Per person / night', flat: 'Flat',
  }[mode] ?? mode;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-1">{label}</p>
      <p className="text-[20px] font-black tabular-nums">{value}</p>
    </div>
  );
}

function DarkRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] text-white/50">{label}</span>
      <span className="text-[12px] font-bold tabular-nums">{value}</span>
    </div>
  );
}

/**
 * What this room type holds, against what the channel says it sells.
 *
 * Two numbers for one physical property. Until they were shown together nothing
 * compared them, and a change on either side drifted silently — which on this
 * number is not a cosmetic bug: if the channel says 16 and eight beds exist,
 * the OTAs sell eight beds that are not there, and nobody finds out until eight
 * guests arrive.
 */
function InventoryLine({ roomTypeId, onEdit }: { roomTypeId: string; onEdit: () => void }) {
  const inventory = useInventory();
  const line = (inventory.data?.lines ?? []).find((l: any) => l.roomTypeId === roomTypeId);
  if (!line) return null;

  const drift = line.drift as number | null;
  const unit = line.kind === 'dorm' ? 'bed' : 'room';

  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      <span className="text-[11px] text-dash-muted">
        Helio <strong className="text-dash-text">{line.sellable}</strong> {unit}
        {line.sellable === 1 ? '' : 's'}
        {line.kind === 'dorm' && ` (${line.rooms} × ${line.bedsPerRoom})`}
      </span>

      {line.externalQty === null ? (
        <Pill tone="grey">not mapped to a channel</Pill>
      ) : drift === 0 ? (
        <Pill tone="mint">channel agrees · {line.externalQty}</Pill>
      ) : (
        // Negative drift is the dangerous direction — the channel is selling
        // more than exists — so it is called out as such rather than as a
        // neutral difference.
        <Pill tone={drift! < 0 ? 'red' : 'peach'}>
          channel says {line.externalQty}
          {drift! < 0
            ? ` · overselling by ${Math.abs(drift!)}`
            : ` · ${drift} not for sale`}
        </Pill>
      )}

      {line.sold > 0 && (
        <span className="text-[10px] text-dash-muted">{line.sold} booked</span>
      )}

      <PermissionButton permission="config.write" size="sm" variant="ghost" onClick={onEdit}>
        Change count
      </PermissionButton>
    </div>
  );
}