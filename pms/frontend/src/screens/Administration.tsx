import { useState } from 'react';
import { ShieldCheck, UserPlus, KeyRound, History, Monitor, Building2, Plus } from 'lucide-react';
import {
  useUsers, useCreateUser, useUpdateUser, useRoles, useSessions, useRevokeSession,
  useAuditLog, useChangePassword, useProperties, useCreatePropertyRecord,
} from '../queries';
import { useAuthStore } from '../stores';
import { Card, Pill, Button, SectionHeader, Tabs, Field, Select, TextInput, Modal } from '../ui';
import {
  QueryState, useToast, PermissionButton, Toggle, RequirePermission, ConfirmDialog, DateInput,
} from '../components';
import { relativeTime, timestamp } from '../format';
import { SecurityCentre } from './Security';
import { BackupsTab } from './Backups';
import { DatabaseTab } from './Database';

export function AdministrationScreen() {
  const [tab, setTab] = useState<
  'users' | 'sessions' | 'audit' | 'properties' | 'security' | 'backups' | 'database'>('users');

  return (
    <RequirePermission permission="admin.users">
      <SectionHeader
        eyebrow="System"
        title="Administration"
        action={
          <Tabs
            tabs={[
              { value: 'users', label: 'Users & roles' },
              { value: 'sessions', label: 'Sessions' },
              { value: 'audit', label: 'Audit trail' },
              { value: 'properties', label: 'Properties' },
              { value: 'security', label: 'Security' },
              { value: 'backups', label: 'Backups' },
              { value: 'database', label: 'Database' },
            ]}
            active={tab}
            onChange={setTab}
          />
        }
      />
      {tab === 'users' && <UsersTab />}
      {tab === 'sessions' && <SessionsTab />}
      {tab === 'audit' && <AuditTab />}
      {tab === 'properties' && <PropertiesTab />}
      {tab === 'security' && <SecurityCentre />}
      {tab === 'backups' && <BackupsTab />}
      {tab === 'database' && <DatabaseTab />}
    </RequirePermission>
  );
}

function UsersTab() {
  const toast = useToast();
  const users = useUsers();
  const roles = useRoles();
  const create = useCreateUser();
  const update = useUpdateUser();
  const me = useAuthStore((s) => s.user);

  const [open, setOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<any>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [form, setForm] = useState({ name: '', email: '', role: 'front_office', password: '', phone: '' });

  return (
    <>
      <div className="flex justify-end mb-3">
        <PermissionButton permission="admin.users" icon={<UserPlus className="w-3.5 h-3.5" />}
          onClick={() => setOpen(true)}>
          New user
        </PermissionButton>
      </div>

      <QueryState query={users} loadingRows={4} empty="No users">
        {(rows) => (
          <div className="space-y-2">
            {rows.map((u) => (
              <Card key={u.id}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center text-[12px] font-black shrink-0">
                      {u.name.split(' ').slice(0, 2).map((n) => n[0]).join('')}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <p className="text-[13px] font-bold">{u.name}</p>
                        <Pill tone={u.role === 'admin' ? 'purple' : 'grey'}>{u.roleLabel}</Pill>
                        {!u.active && <Pill tone="peach">Disabled</Pill>}
                        {u.locked && <Pill tone="red">Locked</Pill>}
                        {u.mustChangePassword && <Pill tone="yellow">Must change password</Pill>}
                        {u.id === me?.id && <Pill tone="sky">You</Pill>}
                      </div>
                      <p className="text-[11px] text-dash-muted">
                        {u.email}{u.phone ? ` · ${u.phone}` : ''} ·
                        {u.lastLoginAt ? ` last signed in ${relativeTime(u.lastLoginAt)}` : ' never signed in'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="w-full sm:w-[180px]">
                      <Select
                        value={u.role}
                        onChange={async (v) => {
                          try {
                            await update.mutateAsync({ id: u.id, body: { role: v } });
                            toast.success(`${u.name} is now ${v}`);
                          } catch (e) { toast.fail(e); }
                        }}
                        options={(roles.data ?? []).map((r) => ({ label: r.label, value: r.value }))}
                      />
                    </div>
                    {u.locked && (
                      <PermissionButton permission="admin.users" size="sm" variant="secondary"
                        onClick={() => update.mutate({ id: u.id, body: { unlock: true } })}>
                        Unlock
                      </PermissionButton>
                    )}
                    <PermissionButton permission="admin.users" size="sm" variant="secondary"
                      icon={<KeyRound className="w-3 h-3" />}
                      onClick={() => { setResetTarget(u); setResetPassword(''); }}>
                      Reset password
                    </PermissionButton>
                    <Toggle checked={u.active}
                      onChange={(v) => update.mutate({ id: u.id, body: { active: v } })} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </QueryState>

      <Card className="mt-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-3">
          What each role can do
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
          {(roles.data ?? []).map((r) => (
            <div key={r.value} className="rounded-2xl border border-black/5 p-3">
              <p className="text-[12px] font-bold mb-1.5">{r.label}</p>
              <div className="flex flex-wrap gap-1">
                {r.permissions.slice(0, 8).map((p) => (
                  <span key={p} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/[0.05]">{p}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="New user"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!form.name || !form.email || form.password.length < 8 || create.isPending}
              onClick={async () => {
                try {
                  await create.mutateAsync(form);
                  toast.success('User created', 'They will be asked to change their password at first sign-in');
                  setOpen(false);
                  setForm({ name: '', email: '', role: 'front_office', password: '', phone: '' });
                } catch (e) { toast.fail(e); }
              }}>
              Create user
            </Button>
          </div>
        }>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Full name" required><TextInput value={form.name} onChange={(v) => setForm({ ...form, name: v })} /></Field>
          <Field label="Email" required><TextInput value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" /></Field>
          <Field label="Role" required>
            <Select value={form.role} onChange={(v) => setForm({ ...form, role: v })}
              options={(roles.data ?? []).map((r) => ({ label: r.label, value: r.value }))} />
          </Field>
          <Field label="Phone"><TextInput value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} /></Field>
          <Field label="Temporary password" required hint="At least 8 characters with letters and numbers">
            <TextInput value={form.password} onChange={(v) => setForm({ ...form, password: v })} type="password" />
          </Field>
        </div>
      </Modal>

      <Modal open={!!resetTarget} onClose={() => setResetTarget(null)}
        title={`Reset password for ${resetTarget?.name ?? ''}`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setResetTarget(null)}>Cancel</Button>
            <Button disabled={resetPassword.length < 8 || update.isPending}
              onClick={async () => {
                try {
                  await update.mutateAsync({ id: resetTarget.id, body: { password: resetPassword } });
                  toast.success('Password reset', 'The user must change it at next sign-in');
                  setResetTarget(null);
                } catch (e) { toast.fail(e); }
              }}>
              Reset password
            </Button>
          </div>
        }>
        <Field label="New temporary password" required hint="At least 8 characters with letters and numbers">
          <TextInput value={resetPassword} onChange={setResetPassword} type="password" />
        </Field>
      </Modal>
    </>
  );
}

function SessionsTab() {
  const toast = useToast();
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const [target, setTarget] = useState<string | null>(null);

  return (
    <>
      <QueryState query={sessions} loadingRows={4} empty="No active sessions">
        {(rows: any[]) => (
          <Card>
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full min-w-[40rem] text-[12px]">
                <thead>
                  <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                    <th className="pb-2">User</th>
                    <th className="pb-2">Signed in</th>
                    <th className="pb-2">Last seen</th>
                    <th className="pb-2">Expires</th>
                    <th className="pb-2">IP</th>
                    <th className="pb-2 text-right" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id} className={`border-b border-black/[0.03] ${s.revoked ? 'opacity-40' : ''}`}>
                      <td className="py-2.5">
                        <span className="font-semibold">{s.user}</span>
                        {s.current && <Pill tone="sky" className="ml-2">This device</Pill>}
                        {s.revoked && <Pill tone="grey" className="ml-2">Revoked</Pill>}
                      </td>
                      <td className="py-2.5 text-dash-muted">{relativeTime(s.createdAt)}</td>
                      <td className="py-2.5 text-dash-muted">{relativeTime(s.lastSeenAt)}</td>
                      <td className="py-2.5 text-dash-muted">{timestamp(s.expiresAt)}</td>
                      <td className="py-2.5 font-mono text-[10px] text-dash-muted">{s.ip}</td>
                      <td className="py-2.5 text-right">
                        {!s.revoked && !s.current && (
                          <PermissionButton permission="admin.users" size="sm" variant="ghost"
                            onClick={() => setTarget(s.id)}>
                            Revoke
                          </PermissionButton>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-dash-muted mt-3">
              Sessions last 12 hours. Only a hash of each token is stored, so the list cannot be used to
              impersonate anyone.
            </p>
          </Card>
        )}
      </QueryState>

      <ConfirmDialog
        open={!!target}
        title="Revoke this session?"
        body="The user will be signed out on that device immediately."
        confirmLabel="Revoke"
        danger
        busy={revoke.isPending}
        onCancel={() => setTarget(null)}
        onConfirm={async () => {
          if (!target) return;
          try { await revoke.mutateAsync({ id: target }); toast.success('Session revoked'); }
          catch (e) { toast.fail(e); }
          setTarget(null);
        }}
      />
    </>
  );
}

function AuditTab() {
  const [entity, setEntity] = useState('');
  const [since, setSince] = useState('');
  const log = useAuditLog({ entity: entity || undefined, since: since || undefined, limit: 300 });

  return (
    <>
      <div className="flex items-end gap-3 mb-4 flex-wrap">
        <div className="w-full sm:w-[200px]">
          <Field label="Entity">
            <Select value={entity} onChange={setEntity} options={[
              { label: 'Everything', value: '' },
              { label: 'Reservations', value: 'RESERVATION' },
              { label: 'Folios', value: 'FOLIO' },
              { label: 'Rooms', value: 'ROOM' },
              { label: 'Rate plans', value: 'RATE_PLAN' },
              { label: 'Channels', value: 'CHANNEL' },
              { label: 'Users', value: 'USER' },
              { label: 'Property', value: 'PROPERTY' },
              { label: 'Profiles', value: 'PROFILE' },
            ]} />
          </Field>
        </div>
        <div className="w-full sm:w-[160px]">
          <Field label="Since"><DateInput value={since} onChange={setSince} /></Field>
        </div>
      </div>

      <QueryState query={log} loadingRows={6} empty="Nothing recorded yet">
        {(rows) => (
          <Card>
            <div className="max-h-[600px] overflow-auto scroll-thin">
              <table className="w-full min-w-[40rem] text-[12px]">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-dash-muted border-b subtle-divider">
                    <th className="pb-2">When</th>
                    <th className="pb-2">User</th>
                    <th className="pb-2">Action</th>
                    <th className="pb-2">Entity</th>
                    <th className="pb-2">Change</th>
                    <th className="pb-2">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id} className={`border-b border-black/[0.03] ${a.elevated ? 'bg-dash-peach/20' : ''}`}>
                      <td className="py-2 text-dash-muted whitespace-nowrap">{timestamp(a.ts)}</td>
                      <td className="py-2 font-semibold">{a.user}</td>
                      <td className="py-2">
                        <span className="font-mono text-[10px]">{a.action}</span>
                        {a.elevated && <Pill tone="peach" className="ml-1.5">elevated</Pill>}
                      </td>
                      <td className="py-2 text-dash-muted">
                        {a.entity}{a.entityRef ? ` · ${a.entityRef}` : ''}
                      </td>
                      <td className="py-2 text-[10px] text-dash-muted max-w-[280px] truncate"
                        title={JSON.stringify({ before: a.before, after: a.after })}>
                        {a.after ? JSON.stringify(a.after) : '—'}
                      </td>
                      <td className="py-2 font-mono text-[10px] text-dash-muted">{a.ip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </QueryState>
    </>
  );
}

function PropertiesTab() {
  const toast = useToast();
  const properties = useProperties();
  const create = useCreatePropertyRecord();
  const switchProperty = useAuthStore((s) => s.switchProperty);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: '', name: '', kind: 'hotel', city: '', country: '', currency: 'USD',
    timezone: 'UTC', businessDate: new Date().toISOString().slice(0, 10),
  });

  return (
    <>
      <div className="flex justify-end mb-3">
        <PermissionButton permission="admin.users" icon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => setOpen(true)}>
          Add property
        </PermissionButton>
      </div>

      <QueryState query={properties} loadingRows={3} empty="No properties">
        {(rows) => (
          <div className="space-y-2">
            {rows.map((p) => (
              <Card key={p.id}>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-bold">{p.name}</p>
                        <Pill tone="grey">{p.code}</Pill>
                        {!p.active && <Pill tone="peach">Inactive</Pill>}
                      </div>
                      <p className="text-[11px] text-dash-muted">
                        {p.location || '—'} · {p.rooms} rooms · {p.currency} · business date {p.businessDate}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="secondary" onClick={switchProperty}>Switch to</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </QueryState>

      <Modal open={open} onClose={() => setOpen(false)} title="Add a property"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!form.code || !form.name || create.isPending}
              onClick={async () => {
                try {
                  await create.mutateAsync(form);
                  toast.success('Property created', 'Switch to it to configure rooms and rates');
                  setOpen(false);
                } catch (e) { toast.fail(e); }
              }}>
              Create property
            </Button>
          </div>
        }>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Code" required><TextInput value={form.code} onChange={(v) => setForm({ ...form, code: v.toUpperCase() })} /></Field>
          <Field label="Name" required><TextInput value={form.name} onChange={(v) => setForm({ ...form, name: v })} /></Field>
          <Field label="Type">
            <Select value={form.kind} onChange={(v) => setForm({ ...form, kind: v })} options={[
              { label: 'Hotel', value: 'hotel' }, { label: 'Hostel', value: 'hostel' }, { label: 'Mixed', value: 'mixed' },
            ]} />
          </Field>
          <Field label="Currency"><TextInput value={form.currency} onChange={(v) => setForm({ ...form, currency: v.toUpperCase() })} /></Field>
          <Field label="City"><TextInput value={form.city} onChange={(v) => setForm({ ...form, city: v })} /></Field>
          <Field label="Country"><TextInput value={form.country} onChange={(v) => setForm({ ...form, country: v })} /></Field>
          <Field label="Timezone"><TextInput value={form.timezone} onChange={(v) => setForm({ ...form, timezone: v })} /></Field>
          <Field label="Opening business date"><DateInput value={form.businessDate} onChange={(v) => setForm({ ...form, businessDate: v })} /></Field>
        </div>
      </Modal>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] text-dash-muted">{label}</span>
      <span className="text-[12px] font-bold">{value}</span>
    </div>
  );
}
