import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { NavContext } from './nav';
import { useAuthStore } from './stores';
import type { ScreenName, ScreenState } from './types';
import { AppShell } from './layout';
import { ErrorBoundary } from './ErrorBoundary';

// ─── What loads when ────────────────────────────────────────────
//
// The gates below stay eager. They are the first thing anyone sees, they are
// small, and a receptionist waiting on a second chunk before the login form
// appears would be a worse start than the one bundle ever was.
import { LoginScreen } from './screens/Login';
import { PasswordChangeScreen } from './screens/PasswordChange';
import { SetupScreen } from './screens/Setup';
import { PropertySelectScreen } from './screens/PropertySelect';

// Everything inside the shell is fetched when it is first opened.
//
// All twenty-five used to be pulled into one 1.6 MB chunk, so the desk
// downloaded the charting library for Reports and the QR encoder for Security
// in order to look at this morning's arrivals. Splitting them also means a
// change to one screen no longer invalidates the whole bundle for every
// installed copy — which for a PWA that precaches is the difference between
// re-downloading 1.6 MB after a deploy and re-downloading the part that moved.
//
// The service worker still precaches every chunk (`globPatterns` in
// vite.config.ts covers them), so an installed app remains fully offline-capable
// rather than trading startup speed for a screen that cannot open on bad wifi.
const DashboardScreen = lazy(() => import('./screens/Dashboard').then((m) => ({ default: m.DashboardScreen })));
const ReservationsScreen = lazy(() => import('./screens/Reservations').then((m) => ({ default: m.ReservationsScreen })));
const NewReservationScreen = lazy(() => import('./screens/NewReservation').then((m) => ({ default: m.NewReservationScreen })));
const ArrivalsScreen = lazy(() => import('./screens/Arrivals').then((m) => ({ default: m.ArrivalsScreen })));
const CheckInScreen = lazy(() => import('./screens/CheckIn').then((m) => ({ default: m.CheckInScreen })));
const InHouseScreen = lazy(() => import('./screens/InHouse').then((m) => ({ default: m.InHouseScreen })));
const GuestDashboardScreen = lazy(() => import('./screens/GuestDashboard').then((m) => ({ default: m.GuestDashboardScreen })));
const DeparturesScreen = lazy(() => import('./screens/Departures').then((m) => ({ default: m.DeparturesScreen })));
const CheckOutScreen = lazy(() => import('./screens/CheckOut').then((m) => ({ default: m.CheckOutScreen })));
const CashierScreen = lazy(() => import('./screens/Cashier').then((m) => ({ default: m.CashierScreen })));
const HousekeepingScreen = lazy(() => import('./screens/Housekeeping').then((m) => ({ default: m.HousekeepingScreen })));
const NightAuditScreen = lazy(() => import('./screens/NightAudit').then((m) => ({ default: m.NightAuditScreen })));
const InboxScreen = lazy(() => import('./screens/Inbox').then((m) => ({ default: m.InboxScreen })));
const OverbookingScreen = lazy(() => import('./screens/Overbooking').then((m) => ({ default: m.OverbookingScreen })));
const ProfilesScreen = lazy(() => import('./screens/Profiles').then((m) => ({ default: m.ProfilesScreen })));
const ProfileDetailScreen = lazy(() => import('./screens/ProfileDetail').then((m) => ({ default: m.ProfileDetailScreen })));
const ReportsScreen = lazy(() => import('./screens/Reports').then((m) => ({ default: m.ReportsScreen })));
const CalendarScreen = lazy(() => import('./screens/Calendar').then((m) => ({ default: m.CalendarScreen })));
const ChannelManagerScreen = lazy(() => import('./screens/ChannelManager').then((m) => ({ default: m.ChannelManagerScreen })));
const BookingEngineScreen = lazy(() => import('./screens/BookingEngine').then((m) => ({ default: m.BookingEngineTab })));
const ManualScreen = lazy(() => import('./screens/Manual').then((m) => ({ default: m.ManualScreen })));
const RatesInventoryScreen = lazy(() => import('./screens/RatesInventory').then((m) => ({ default: m.RatesInventoryScreen })));
const PackagesScreen = lazy(() => import('./screens/Packages').then((m) => ({ default: m.PackagesScreen })));
const GroupsScreen = lazy(() => import('./screens/Groups').then((m) => ({ default: m.GroupsScreen })));
const AccountsReceivableScreen = lazy(() => import('./screens/AccountsReceivable').then((m) => ({ default: m.AccountsReceivableScreen })));
const ConfigurationScreen = lazy(() => import('./screens/Configuration').then((m) => ({ default: m.ConfigurationScreen })));
const AdministrationScreen = lazy(() => import('./screens/Administration').then((m) => ({ default: m.AdministrationScreen })));

// ─── Hash routing ───────────────────────────────────────────────
// Auth-flow states (login / setup / property-select) are gated by session
// state rather than the URL, so they are deliberately not routes.
const VALID_ROUTES = new Set<ScreenName>([
  'dashboard', 'calendar', 'reservations', 'new-reservation',
  'arrivals', 'check-in', 'in-house', 'guest-dashboard',
  'departures', 'check-out', 'cashier', 'housekeeping',
  'night-audit', 'inbox', 'overbooking', 'profiles', 'profile-detail', 'reports',
  'rates-inventory', 'packages', 'channel-manager', 'booking-engine', 'groups', 'ar', 'config', 'admin',
  'manual',
]);

const PARAM_KEYS: Partial<Record<ScreenName, string>> = {
  'check-in': 'reservationId',
  'guest-dashboard': 'reservationId',
  'check-out': 'reservationId',
  'profile-detail': 'profileId',
  'cashier': 'folioId',
  'ar': 'companyId',
  'new-reservation': 'reservationId',
};

function screenToHash(s: ScreenState): string {
  const parts: string[] = [s.name];
  const paramKey = PARAM_KEYS[s.name];
  if (paramKey && s.params?.[paramKey]) parts.push(encodeURIComponent(s.params[paramKey]));
  return '#/' + parts.join('/');
}

function hashToScreen(hash: string): ScreenState {
  const path = hash.replace(/^#\/?/, '').trim();
  if (!path) return { name: 'dashboard' };
  const [name, ...rest] = path.split('/');
  if (!VALID_ROUTES.has(name as ScreenName)) return { name: 'dashboard' };
  const screenName = name as ScreenName;
  const paramKey = PARAM_KEYS[screenName];
  if (paramKey && rest[0]) {
    return { name: screenName, params: { [paramKey]: decodeURIComponent(rest[0]) } };
  }
  return { name: screenName };
}

export default function App() {
  const phase = useAuthStore((s) => s.phase);
  const boot = useAuthStore((s) => s.boot);
  const storeLogout = useAuthStore((s) => s.logout);
  const switchPropertyAction = useAuthStore((s) => s.switchProperty);
  const bootError = useAuthStore((s) => s.error);

  const [screen, setScreen] = useState<ScreenState>(() =>
    typeof window !== 'undefined' ? hashToScreen(window.location.hash) : { name: 'dashboard' },
  );

  useEffect(() => { boot(); }, [boot]);

  useEffect(() => {
    const onChange = () => setScreen(hashToScreen(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((name: ScreenName, params?: Record<string, string>) => {
    if (!VALID_ROUTES.has(name)) return;
    const newHash = screenToHash({ name, params });
    if (window.location.hash === newHash) {
      setScreen({ name, params });
      return;
    }
    window.location.hash = newHash;
  }, []);

  const back = useCallback(() => { window.history.back(); }, []);

  const logout = useCallback(async () => {
    await storeLogout();
    window.location.hash = '#/dashboard';
  }, [storeLogout]);

  const switchProperty = useCallback(() => switchPropertyAction(), [switchPropertyAction]);

  // ─── Boot & auth gates ──────────────────────────────────────
  if (phase === 'booting') return <BootScreen />;
  if (phase === 'unreachable') return <UnreachableScreen message={bootError} onRetry={boot} />;
  if (phase === 'setup') return <SetupScreen />;
  if (phase === 'login') return <LoginScreen />;
  if (phase === 'password-change') return <PasswordChangeScreen />;
  if (phase === 'property-select') return <PropertySelectScreen />;

  return (
    <NavContext.Provider value={{ screen, navigate, back, logout, switchProperty }}>
      <AppShell breadcrumb={breadcrumbFor(screen)}>
        {/* Inside the shell, not around it: a screen that fails to render must
            leave the navigation, search and property switcher working, so the
            desk can carry on from somewhere else. Keyed by screen so moving
            away clears the error rather than carrying it to the next page. */}
        <ErrorBoundary
          resetKey={`${screen.name}:${JSON.stringify(screen.params ?? {})}`}
          onGoHome={() => navigate('dashboard')}
        >
          {/* Inside the boundary, so a chunk that fails to arrive — a deploy
              mid-shift, a dropped connection — lands on the same "something went
              wrong, go home" panel as any other screen failure rather than
              leaving the desk on a spinner that never resolves. */}
          <Suspense fallback={<ScreenLoading />}>
            {renderScreen(screen)}
          </Suspense>
        </ErrorBoundary>
      </AppShell>
    </NavContext.Provider>
  );
}

/**
 * Shown while a screen's chunk is on its way.
 *
 * Deliberately quiet and centred in the content area rather than a full-page
 * spinner: the shell — navigation, search, the property switcher — is already
 * on screen and stays usable, so this must read as one panel filling in, not as
 * the application restarting.
 */
function ScreenLoading() {
  return (
    <div className="flex items-center justify-center py-24" role="status" aria-label="Loading">
      <div className="w-8 h-8 border-[3px] border-black/10 border-t-black rounded-full animate-spin" />
    </div>
  );
}

function BootScreen() {
  return (
    <div className="h-screen bg-dash-bg flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 border-[3px] border-black/10 border-t-black rounded-full animate-spin" />
      <p className="text-[12px] font-bold text-dash-muted">Connecting to Helio…</p>
    </div>
  );
}

function UnreachableScreen({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <div className="h-screen bg-dash-bg flex items-center justify-center p-6">
      <div className="panel p-8 max-w-lg text-center">
        <div className="w-12 h-12 rounded-2xl bg-red-50 text-status-bad flex items-center justify-center mx-auto mb-4 text-2xl">!</div>
        <h1 className="text-lg font-bold tracking-tight mb-2">Cannot reach the Helio server</h1>
        <p className="text-[12px] text-dash-muted mb-1">{message}</p>
        <p className="text-[11px] text-dash-muted mb-6">
          Start the API with <span className="font-mono bg-black/5 px-1.5 py-0.5 rounded">npm start</span> in
          {' '}<span className="font-mono">backend</span>, then try again.
        </p>
        <button
          onClick={onRetry}
          className="px-5 py-2.5 rounded-full bg-black text-white text-[12px] font-bold hover:bg-black/85"
        >
          Retry connection
        </button>
      </div>
    </div>
  );
}

function renderScreen(s: ScreenState) {
  switch (s.name) {
    case 'dashboard':        return <DashboardScreen />;
    case 'calendar':         return <CalendarScreen />;
    case 'reservations':     return <ReservationsScreen />;
    case 'new-reservation':  return <NewReservationScreen reservationId={s.params?.reservationId} />;
    case 'arrivals':         return <ArrivalsScreen />;
    case 'check-in':         return <CheckInScreen reservationId={s.params?.reservationId} />;
    case 'in-house':         return <InHouseScreen />;
    case 'guest-dashboard':  return <GuestDashboardScreen reservationId={s.params?.reservationId} />;
    case 'departures':       return <DeparturesScreen />;
    case 'check-out':        return <CheckOutScreen reservationId={s.params?.reservationId} />;
    case 'cashier':          return <CashierScreen folioId={s.params?.folioId} />;
    case 'housekeeping':     return <HousekeepingScreen />;
    case 'night-audit':      return <NightAuditScreen />;
    case 'inbox':            return <InboxScreen />;
    case 'overbooking':      return <OverbookingScreen />;
    case 'profiles':         return <ProfilesScreen />;
    case 'profile-detail':   return <ProfileDetailScreen profileId={s.params?.profileId} />;
    case 'reports':          return <ReportsScreen />;
    case 'rates-inventory':  return <RatesInventoryScreen />;
    case 'packages':         return <PackagesScreen />;
    case 'channel-manager':  return <ChannelManagerScreen />;
    case 'booking-engine':   return <BookingEngineScreen />;
    case 'manual':           return <ManualScreen />;
    case 'groups':           return <GroupsScreen />;
    case 'ar':               return <AccountsReceivableScreen companyId={s.params?.companyId} />;
    case 'config':           return <ConfigurationScreen />;
    case 'admin':            return <AdministrationScreen />;
    default:                 return <DashboardScreen />;
  }
}

function breadcrumbFor(s: ScreenState): { label: string; screen?: ScreenName }[] {
  const map: Record<string, { label: string; screen?: ScreenName }[]> = {
    'dashboard':        [{ label: 'Dashboard' }],
    'calendar':         [{ label: 'Calendar' }],
    'reservations':     [{ label: 'Reservations' }],
    'new-reservation':  [{ label: 'Reservations', screen: 'reservations' }, { label: 'New Reservation' }],
    'arrivals':         [{ label: 'Front Office' }, { label: 'Arrivals' }],
    'check-in':         [{ label: 'Front Office' }, { label: 'Arrivals', screen: 'arrivals' }, { label: 'Check-in' }],
    'in-house':         [{ label: 'Front Office' }, { label: 'In-House' }],
    'guest-dashboard':  [{ label: 'Front Office' }, { label: 'In-House', screen: 'in-house' }, { label: 'Guest' }],
    'departures':       [{ label: 'Front Office' }, { label: 'Departures' }],
    'check-out':        [{ label: 'Front Office' }, { label: 'Departures', screen: 'departures' }, { label: 'Check-out' }],
    'cashier':          [{ label: 'Cashier' }],
    'housekeeping':     [{ label: 'Housekeeping' }],
    'night-audit':      [{ label: 'Night Audit' }],
    'inbox':            [{ label: 'Inbox' }],
    'overbooking':      [{ label: 'Overbooking' }],
    'profiles':         [{ label: 'Profiles' }],
    'profile-detail':   [{ label: 'Profiles', screen: 'profiles' }, { label: 'Guest Profile' }],
    'reports':          [{ label: 'Reports' }],
    'rates-inventory':  [{ label: 'Rates & Inventory' }],
    'packages':         [{ label: 'Packages' }],
    'channel-manager':  [{ label: 'Channel Manager' }],
    'booking-engine':   [{ label: 'Booking Page' }],
    'manual':           [{ label: 'User manual' }],
    'groups':           [{ label: 'Groups & Blocks' }],
    'ar':               [{ label: 'Accounts Receivable' }],
    'config':           [{ label: 'Configuration' }],
    'admin':            [{ label: 'Administration' }],
  };
  return map[s.name] ?? [{ label: 'Dashboard' }];
}
