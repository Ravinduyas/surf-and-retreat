import { useState } from 'react';
import { Search, Plus, Star, Ban, Users } from 'lucide-react';
import { useNav } from '../nav';
import { useProfiles, useCreateProfile } from '../queries';
import { Card, Pill, Button, SectionHeader, DataGrid, Field, TextInput, Select, Modal, type GridCol } from '../ui';
import { QueryState, useToast, PermissionButton, Toggle } from '../components';
import { money, longDate } from '../format';
import type { Profile } from '../types';

export function ProfilesScreen() {
  const { navigate } = useNav();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const profiles = useProfiles(search.trim().length >= 2 ? search.trim() : undefined);
  const createProfile = useCreateProfile();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [nationality, setNationality] = useState('');
  const [loyalty, setLoyalty] = useState('None');
  const [vip, setVip] = useState(false);
  const [consent, setConsent] = useState(false);

  const cols: GridCol<Profile>[] = [
    {
      key: 'name', header: 'Guest', width: '26%',
      render: (p) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold truncate">{p.name}</span>
            {p.vip && <Pill tone="yellow" solid>VIP</Pill>}
            {p.blacklist && <Pill tone="red">Blacklisted</Pill>}
          </div>
          <p className="text-[10px] text-dash-muted truncate">
            {[p.email, p.phone].filter(Boolean).join(' · ') || 'No contact details'}
          </p>
        </div>
      ),
    },
    { key: 'nationality', header: 'Nationality', render: (p) => <span>{p.nationality || '—'}</span> },
    {
      key: 'loyalty', header: 'Loyalty',
      render: (p) => p.loyalty === 'None'
        ? <span className="text-dash-muted">—</span>
        : <Pill tone={p.loyalty === 'Platinum' ? 'purple' : p.loyalty === 'Gold' ? 'yellow' : 'grey'}>{p.loyalty}</Pill>,
    },
    { key: 'stays', header: 'Stays', align: 'center', render: (p) => <span className="font-semibold">{p.stays ?? 0}</span> },
    {
      key: 'revenue', header: 'Lifetime value', align: 'right',
      render: (p) => <span className="tabular-nums font-bold">{money(p.totalRevenueMinor ?? 0)}</span>,
    },
    {
      key: 'lastStay', header: 'Last stay', align: 'right',
      render: (p) => <span className="text-dash-muted">{p.lastStay ? longDate(p.lastStay) : 'Never'}</span>,
    },
  ];

  return (
    <div>
      <SectionHeader
        eyebrow="CRM"
        title="Guest profiles"
        action={
          <PermissionButton permission="profiles.write" icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setOpen(true)}>
            New profile
          </PermissionButton>
        }
      />

      <div className="relative mb-4">
        <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-dash-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, phone or ID number…"
          className="w-full bg-white border border-black/10 rounded-full pl-9 pr-4 py-2.5 text-[12px] outline-none focus:border-black/30"
        />
      </div>

      <QueryState
        query={profiles}
        loadingRows={6}
        empty={search ? 'No guests match that search' : 'No guest profiles yet'}
        emptyHint={search ? undefined : 'Profiles are created automatically when you take a reservation.'}
      >
        {(rows) => {
          const vips = rows.filter((p) => p.vip).length;
          const repeat = rows.filter((p) => (p.stays ?? 0) > 1).length;
          const value = rows.reduce((s, p) => s + (p.totalRevenueMinor ?? 0), 0);
          return (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <Card><Metric label="Profiles" value={String(rows.length)} icon={<Users className="w-4 h-4" />} /></Card>
                <Card tone="yellow"><Metric label="VIPs" value={String(vips)} icon={<Star className="w-4 h-4" />} /></Card>
                <Card tone="mint"><Metric label="Repeat guests" value={String(repeat)} /></Card>
                <Card tone="sky"><Metric label="Lifetime value" value={money(value)} /></Card>
              </div>

              <DataGrid
                rows={rows}
                cols={cols}
                onRowClick={(p) => navigate('profile-detail', { profileId: p.id })}
                emptyTitle="No guests match"
              />
            </>
          );
        }}
      </QueryState>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New guest profile"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={name.trim().length < 2 || createProfile.isPending}
              onClick={async () => {
                try {
                  const p = await createProfile.mutateAsync({
                    name: name.trim(),
                    email: email.trim() || undefined,
                    phone: phone.trim() || undefined,
                    nationality: nationality.trim() || undefined,
                    loyalty,
                    vip,
                    marketingConsent: consent,
                  });
                  toast.success('Profile created');
                  setOpen(false);
                  setName(''); setEmail(''); setPhone(''); setNationality(''); setVip(false); setConsent(false);
                  navigate('profile-detail', { profileId: p.id });
                } catch (e) { toast.fail(e); }
              }}
            >
              Create profile
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Full name" required><TextInput value={name} onChange={setName} /></Field>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Email"><TextInput value={email} onChange={setEmail} type="email" /></Field>
            <Field label="Phone"><TextInput value={phone} onChange={setPhone} /></Field>
            <Field label="Nationality"><TextInput value={nationality} onChange={setNationality} /></Field>
            <Field label="Loyalty tier">
              <Select value={loyalty} onChange={setLoyalty} options={[
                { label: 'None', value: 'None' }, { label: 'Silver', value: 'Silver' },
                { label: 'Gold', value: 'Gold' }, { label: 'Platinum', value: 'Platinum' },
              ]} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-6 pt-1">
            <Toggle checked={vip} onChange={setVip} label="VIP" />
            <Toggle checked={consent} onChange={setConsent} label="Marketing consent given" />
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <>
      <div className="flex items-start justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">{label}</p>
        {icon && <span className="opacity-50">{icon}</span>}
      </div>
      <p className="text-[22px] font-black leading-none tabular-nums">{value}</p>
    </>
  );
}
