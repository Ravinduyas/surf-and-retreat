// Client state: UI preferences, the authenticated session, and connectivity.
// Server data lives in TanStack Query (see queries.ts) — never here.
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  api, health, setToken, getToken, setPropertyId, getPropertyId, onAuthEvent, ApiError,
} from './api';
import { setMoneyContext } from './format';
import type { Property, User } from './types';

// ─── UI preferences (persisted) ───────────────────────────────
interface UiState {
  sidebarCollapsed: boolean;
  rightPanelOpen: boolean;
  density: 'compact' | 'normal' | 'expanded';
  language: string;
  setSidebarCollapsed: (v: boolean) => void;
  setRightPanelOpen: (v: boolean) => void;
  setDensity: (d: 'compact' | 'normal' | 'expanded') => void;
  setLanguage: (l: string) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      rightPanelOpen: false,
      density: 'normal',
      language: 'en',
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      setRightPanelOpen: (v) => set({ rightPanelOpen: v }),
      setDensity: (d) => set({ density: d }),
      setLanguage: (l) => set({ language: l }),
    }),
    { name: 'helio.pms.ui', storage: createJSONStorage(() => localStorage) },
  ),
);

// ─── Session ──────────────────────────────────────────────────
export type AuthPhase =
  | 'booting'          // checking the API and any stored session
  | 'unreachable'      // the API is not answering
  | 'setup'            // no property exists yet — run the first-run wizard
  | 'login'
  | 'password-change'  // signed in, but the password must be replaced first
  | 'property-select'
  | 'ready';

export interface LoginResult {
  mfaRequired?: boolean;
  challengeToken?: string;
  recoveryCodesRemaining?: number;
  user?: { name: string; email: string };
}

interface SessionResponse {
  token: string;
  expiresAt: string;
  user: User;
  properties: Property[];
  property: Property | null;
}

interface AuthStore {
  phase: AuthPhase;
  user: User | null;
  property: Property | null;
  properties: Property[];
  error: string | null;
  busy: boolean;

  boot: () => Promise<void>;
  login: (email: string, password: string, remember?: boolean) => Promise<LoginResult>;
  completeMfa: (challengeToken: string, code: string, remember?: boolean) => Promise<void>;
  adoptSession: (payload: { token: string; user: User; property?: Property | null; properties?: Property[] }) => void;
  selectProperty: (propertyId: string) => Promise<void>;
  switchProperty: () => void;
  logout: () => Promise<void>;
  can: (permission: string) => boolean;
  refreshProperty: () => Promise<void>;
  clearError: () => void;
  passwordChanged: () => Promise<void>;
}

function applyProperty(p: Property | null) {
  if (p) {
    setPropertyId(p.id);
    setMoneyContext(p.currency, p.locale);
  }
}

/**
 * Where a freshly resolved session should land. A password the administrator
 * marked as temporary has to be replaced before anything else is reachable.
 */
function nextPhase(user: User | null, property: Property | null): AuthPhase {
  if (user?.mustChangePassword) return 'password-change';
  return property ? 'ready' : 'property-select';
}

function applySession(set: (partial: Partial<AuthStore>) => void, res: SessionResponse) {
  setToken(res.token);
  applyProperty(res.property);
  set({
    busy: false,
    user: res.user,
    properties: res.properties,
    property: res.property,
    phase: nextPhase(res.user, res.property),
  });
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  phase: 'booting',
  user: null,
  property: null,
  properties: [],
  error: null,
  busy: false,

  async boot() {
    set({ phase: 'booting', error: null });
    let status;
    try {
      status = await health();
    } catch (e) {
      set({ phase: 'unreachable', error: e instanceof Error ? e.message : 'API unreachable' });
      return;
    }
    if (status.setupRequired) {
      set({ phase: 'setup' });
      return;
    }
    if (!getToken()) {
      set({ phase: 'login' });
      return;
    }
    try {
      const me = await api.get<{ user: User; properties: Property[]; property: Property | null }>('/api/auth/me');
      applyProperty(me.property);
      set({
        user: me.user,
        properties: me.properties,
        property: me.property,
        phase: nextPhase(me.user, me.property),
      });
    } catch {
      setToken(null);
      set({ phase: 'login', user: null, property: null });
    }
  },

  async login(email, password, remember = false) {
    set({ busy: true, error: null });
    try {
      const res = await api.post<SessionResponse & LoginResult>(
        '/api/auth/login', { email, password, remember },
      );
      // An account with two-factor on gets a challenge, not a session.
      if (res.mfaRequired) {
        set({ busy: false });
        return {
          mfaRequired: true,
          challengeToken: res.challengeToken,
          recoveryCodesRemaining: res.recoveryCodesRemaining,
          user: res.user as any,
        };
      }
      applySession(set, res);
      return {};
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Sign-in failed';
      set({ busy: false, error: message });
      throw e;
    }
  },

  async completeMfa(challengeToken, code, remember = false) {
    set({ busy: true, error: null });
    try {
      const res = await api.post<SessionResponse>(
        '/api/auth/mfa/verify', { challengeToken, code, remember },
      );
      applySession(set, res);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'That code was not accepted';
      set({ busy: false, error: message });
      throw e;
    }
  },

  adoptSession({ token, user, property, properties }) {
    setToken(token);
    applyProperty(property ?? null);
    set({
      user,
      property: property ?? null,
      properties: properties ?? (property ? [property] : []),
      phase: nextPhase(user, property ?? null),
      error: null,
    });
  },

  clearError() {
    set({ error: null });
  },

  /** Called after a forced password change so the app can carry on. */
  async passwordChanged() {
    const user = get().user;
    set({
      user: user ? { ...user, mustChangePassword: false } : user,
      phase: get().property ? 'ready' : 'property-select',
    });
  },

  async selectProperty(propertyId) {
    set({ busy: true });
    try {
      const res = await api.post<{ property: Property }>('/api/auth/select-property', { propertyId });
      applyProperty(res.property);
      set({ property: res.property, phase: 'ready', busy: false });
    } catch (e) {
      set({ busy: false, error: e instanceof ApiError ? e.message : 'Could not select that property' });
      throw e;
    }
  },

  switchProperty() {
    set({ phase: 'property-select' });
  },

  async logout() {
    try { await api.post('/api/auth/logout'); } catch { /* session may already be gone */ }
    setToken(null);
    setPropertyId(null);
    set({ phase: 'login', user: null, property: null, properties: [] });
  },

  can(permission) {
    const perms = get().user?.permissions ?? [];
    if (perms.includes('*')) return true;
    if (perms.includes(permission)) return true;
    return perms.includes(`${permission.split('.')[0]}.*`);
  },

  async refreshProperty() {
    try {
      const p = await api.get<Property>('/api/property');
      applyProperty(p);
      set({ property: p });
    } catch { /* keep the previous value */ }
  },
}));

// A rejected session anywhere in the app drops straight back to sign-in.
onAuthEvent((event) => {
  const store = useAuthStore.getState();
  if (event === 'unauthenticated' && store.phase === 'ready') {
    useAuthStore.setState({
      phase: 'login', user: null, property: null,
      error: 'Your session expired — please sign in again',
    });
  }
  if (event === 'setup-required') {
    useAuthStore.setState({ phase: 'setup' });
  }
});

/** Convenience hook: `usePermission('rates.write')`. */
export function usePermission(permission: string): boolean {
  return useAuthStore((s) => {
    const perms = s.user?.permissions ?? [];
    if (perms.includes('*')) return true;
    if (perms.includes(permission)) return true;
    return perms.includes(`${permission.split('.')[0]}.*`);
  });
}

// ─── Connectivity ─────────────────────────────────────────────
interface ConnectivityState {
  online: boolean;
  apiReachable: boolean;
  lastCheck: string | null;
  setOnline: (v: boolean) => void;
  setApiReachable: (v: boolean, at?: string) => void;
}

export const useConnectivityStore = create<ConnectivityState>((set) => ({
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  apiReachable: true,
  lastCheck: null,
  setOnline: (v) => set({ online: v }),
  setApiReachable: (v, at) => set({ apiReachable: v, lastCheck: at ?? new Date().toISOString() }),
}));

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => useConnectivityStore.getState().setOnline(true));
  window.addEventListener('offline', () => useConnectivityStore.getState().setOnline(false));

  // Light heartbeat so the status bar reflects reality rather than a guess.
  setInterval(async () => {
    try {
      await health();
      useConnectivityStore.getState().setApiReachable(true);
    } catch {
      useConnectivityStore.getState().setApiReachable(false);
    }
  }, 30_000);
}

export { getPropertyId };
