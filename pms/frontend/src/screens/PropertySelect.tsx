import { useState } from 'react';
import { motion } from 'motion/react';
import { Building2, ChevronRight, MapPin, Bed, Calendar, LogOut } from 'lucide-react';
import { useAuthStore } from '../stores';
import { Loading, ErrorNote } from '../components';

export function PropertySelectScreen() {
  const properties = useAuthStore((s) => s.properties);
  const selectProperty = useAuthStore((s) => s.selectProperty);
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const busy = useAuthStore((s) => s.busy);
  const [selected, setSelected] = useState<string | null>(properties[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);

  async function go(id: string) {
    setError(null);
    try {
      await selectProperty(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open that property');
    }
  }

  return (
    <div className="min-h-screen bg-dash-bg flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-black rounded-xl flex items-center justify-center">
              <div className="w-4 h-4 border-[2.5px] border-dash-yellow rounded-full border-t-transparent" />
            </div>
            <div>
              <p className="text-[13px] font-black tracking-tight leading-none">
                helio<span className="text-status-warn">.</span>pms
              </p>
              <p className="text-[10px] text-dash-muted mt-0.5">{user?.name} · {user?.roleLabel}</p>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="text-[11px] font-bold text-dash-muted hover:text-black flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>

        <div className="panel p-7">
          <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted mb-1.5">Choose a property</p>
          <h1 className="text-[22px] font-bold tracking-tight mb-6">Which property are you working in?</h1>

          {error && <div className="mb-4"><ErrorNote error={new Error(error)} /></div>}
          {properties.length === 0 && <Loading label="Loading properties" rows={2} />}

          <div className="space-y-2">
            {properties.map((p, i) => (
              <motion.button
                key={p.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => { setSelected(p.id); go(p.id); }}
                disabled={busy}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-colors ${
                  selected === p.id ? 'border-black/20 bg-dash-bg' : 'border-black/5 hover:bg-dash-bg'
                } disabled:opacity-60`}
              >
                <div className="w-11 h-11 rounded-xl bg-black text-white flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold">{p.name}</p>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-dash-muted flex-wrap">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{p.location || p.city || p.code}</span>
                    <span className="flex items-center gap-1"><Bed className="w-3 h-3" />{p.rooms} rooms</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{p.businessDate}</span>
                    <span className="font-mono">{p.currency}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-dash-muted shrink-0" />
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
