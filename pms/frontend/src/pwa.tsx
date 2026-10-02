// PWA install prompt + service-worker hookup.
import { useEffect, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button, Pill } from './ui';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// ─── "Install app" pill (visible in TopBar) ──────────────────
export function InstallButton() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || !evt) return null;

  return (
    <button
      onClick={async () => {
        await evt.prompt();
        const { outcome } = await evt.userChoice;
        if (outcome === 'accepted') setEvt(null);
      }}
      className="glass-pill rounded-full px-3 py-1.5 flex items-center gap-2 hover:bg-dash-yellow transition-colors"
      title="Install helio.pms as a standalone app"
    >
      <Download className="w-3.5 h-3.5" />
      <span className="text-[11px] font-bold">Install app</span>
    </button>
  );
}

// ─── "Update available" toast ────────────────────────────────
// vite-plugin-pwa fires this when a new SW is waiting to take over.
export function UpdateAvailableBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Periodically check for SW updates.
      if (registration) {
        setInterval(() => registration.update(), 60 * 60 * 1000);
      }
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-24 sm:bottom-20 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50 panel p-4 flex items-center gap-3 shadow-2xl">
      <RefreshCw className="w-4 h-4 text-status-info" />
      <div className="text-[12px]">
        <p className="font-black">A new version is available</p>
        <p className="text-[10px] text-dash-muted">Reload to apply the update</p>
      </div>
      <Button variant="primary" size="sm" onClick={() => updateServiceWorker(true)}>
        Reload
      </Button>
      <button onClick={() => setNeedRefresh(false)} className="text-dash-muted hover:text-black">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── First-time PWA hint pill (one-shot via localStorage) ───
export function FirstRunPwaPill() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const seen = localStorage.getItem('helio.pms.firstRun');
    if (!seen) {
      setShown(true);
      localStorage.setItem('helio.pms.firstRun', '1');
    }
  }, []);
  if (!shown) return null;
  return (
    <Pill tone="mint" solid>
      <span className="w-1.5 h-1.5 rounded-full bg-status-ok pulse-dot" />
      Service worker active — works offline
    </Pill>
  );
}
