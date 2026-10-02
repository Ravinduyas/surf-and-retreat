import { useState, useEffect, useMemo, type ReactNode } from 'react';
import {
  Bell, Search, Settings, LogOut, ChevronDown, ChevronRight, ChevronsLeft,
  Home, CalendarDays, LogIn, LogOut as LogOutIcon, Bed, BookUser, DollarSign, MessageSquare,
  Volume2, VolumeX,
  Sparkles, Moon, Users, BarChart3, Sliders, ShieldCheck,
  Wallet, HelpCircle, Plus, X, Menu, ZapIcon, ScanLine, FileText,
  PanelRightOpen, CircleAlert, CheckCircle2, AlertTriangle, Building2, Clock,
  Wifi, WifiOff, Activity, CalendarRange, RadioTower, TrendingUp, UsersRound, Package,
  Globe,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useNav } from './nav';
import { OfflineBar } from './OfflineBar';
import { useAlertWatcher } from './alerts';
import {
  useNotifications, useTasks, useSearch, useChannelHealth, useCashierShift,
  useAcknowledgeAllAlerts, fetchAlertFeed,
  useMarkAllNotificationsRead, useMarkNotificationRead, useFrontDesk,
} from './queries';
import { useUiStore, useConnectivityStore, useAuthStore, usePermission } from './stores';
import { InstallButton, UpdateAvailableBanner } from './pwa';
import { Pill, StatusDot } from './ui';
import { relativeTime, initials, money, clock } from './format';
import type { ScreenName } from './types';

// ─── Sidebar ────────────────────────────────────────────────────────────────
interface NavItem {
  label: string;
  icon: any;
  screen?: ScreenName;
  permission?: string;
  children?: NavItem[];
}

const NAV: NavItem[] = [
  { label: 'Dashboard', icon: Home, screen: 'dashboard', permission: 'dashboard.read' },
  { label: 'Calendar', icon: CalendarRange, screen: 'calendar', permission: 'reservations.read' },
  {
    label: 'Front Office', icon: Bed, permission: 'frontdesk.read', children: [
      { label: 'Arrivals', icon: LogIn, screen: 'arrivals' },
      { label: 'In-House', icon: Bed, screen: 'in-house' },
      { label: 'Departures', icon: LogOutIcon, screen: 'departures' },
    ],
  },
  { label: 'Reservations', icon: CalendarDays, screen: 'reservations', permission: 'reservations.read' },
  { label: 'Groups & Blocks', icon: UsersRound, screen: 'groups', permission: 'groups.read' },
  { label: 'Rates & Inventory', icon: TrendingUp, screen: 'rates-inventory', permission: 'rates.read' },
  { label: 'Packages', icon: Package, screen: 'packages', permission: 'rates.read' },
  { label: 'Booking Page', icon: Globe, screen: 'booking-engine', permission: 'config.read' },
  { label: 'Channel Manager', icon: RadioTower, screen: 'channel-manager', permission: 'channels.read' },
  { label: 'Cashier', icon: DollarSign, screen: 'cashier', permission: 'folio.read' },
  { label: 'Housekeeping', icon: Sparkles, screen: 'housekeeping', permission: 'housekeeping.read' },
  { label: 'Night Audit', icon: Moon, screen: 'night-audit', permission: 'nightaudit.read' },
  { label: 'Overbooking', icon: AlertTriangle, screen: 'overbooking', permission: 'reservations.read' },
  { label: 'Inbox', icon: MessageSquare, screen: 'inbox', permission: 'profiles.read' },
  { label: 'Profiles', icon: BookUser, screen: 'profiles', permission: 'profiles.read' },
  { label: 'Accounts Receivable', icon: Wallet, screen: 'ar', permission: 'ar.read' },
  { label: 'Reports', icon: BarChart3, screen: 'reports', permission: 'reports.read' },
  { label: 'Configuration', icon: Sliders, screen: 'config', permission: 'config.read' },
  { label: 'Administration', icon: ShieldCheck, screen: 'admin', permission: 'admin.users' },
];

/**
 * True from `lg` up — the width at which the sidebar is a rail, not a drawer.
 *
 * Tailwind can hide and show at a breakpoint, but it cannot change what a
 * component *computes*, and several decisions here are behavioural rather than
 * visual: whether a submenu may expand, whether a tooltip stands in for a label,
 * whether tapping a link should dismiss anything. Those need the real answer.
 */
function useIsDesktop() {
  const query = '(min-width: 1024px)';
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    // Rotating a phone or docking a laptop changes the answer without a reload.
    onChange();
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isDesktop;
}

/**
 * The navigation rail on a desktop, a drawer on a phone.
 *
 * It used to be neither: a fixed 230px column that was always mounted at every
 * width. On a 400px screen that is well over half the viewport, and what was
 * left could not hold a screen — headings broke mid-word, tables clipped, and
 * the "Accounts Receivable" title wrapped into four lines beside an empty white
 * strip. A phone is where a housekeeper and a receptionist actually stand, so
 * this is not a nice-to-have.
 *
 * Below `lg` it slides in over the content and the rest of the app gets the
 * whole width. From `lg` up nothing changes — `collapsed` still drives the
 * 72/230 rail, and that preference is deliberately ignored on mobile, where a
 * drawer you have opened on purpose should show its labels.
 */
export function Sidebar({ collapsed, onToggle, mobileOpen = false, onNavigate }: {
  collapsed: boolean; onToggle: () => void; mobileOpen?: boolean; onNavigate?: () => void;
}) {
  const { screen, navigate } = useNav();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ 'Front Office': true });
  const can = useAuthStore((s) => s.can);

  const labelOf = (raw: string): string => {
    const key: Record<string, string> = {
      'Dashboard': 'nav.dashboard', 'Calendar': 'nav.calendar', 'Front Office': 'nav.frontOffice',
      'Arrivals': 'nav.arrivals', 'In-House': 'nav.inHouse', 'Departures': 'nav.departures',
      'Reservations': 'nav.reservations', 'Rates & Inventory': 'nav.ratesInventory',
      'Channel Manager': 'nav.channelManager', 'Booking Page': 'nav.bookingPage',
      'Cashier': 'nav.cashier',
      'Housekeeping': 'nav.housekeeping', 'Night Audit': 'nav.nightAudit',
      'Profiles': 'nav.profiles', 'Accounts Receivable': 'nav.ar', 'Reports': 'nav.reports',
      'Configuration': 'nav.configuration', 'Administration': 'nav.administration',
    };
    return key[raw] ? t(key[raw]) : raw;
  };

  // Unconditionally, before any early return or short-circuit: `collapsed &&
  // useIsDesktop()` would skip the hook whenever the sidebar is expanded and
  // break the hook order on the next render.
  const isDesktop = useIsDesktop();

  const isActive = (s?: ScreenName) => s === screen.name;
  const visible = NAV.filter((item) => !item.permission || can(item.permission));

  // Collapsing is a desktop preference and must not follow the sidebar into the
  // drawer: a 72px column of unlabelled icons is not what somebody opened a menu
  // to see, and with `collapsed` stored in localStorage they would have got one
  // on their phone because of something they clicked on a desktop last week.
  const compact = collapsed && isDesktop;

  // Go where you tapped, then get out of the way. A drawer left open over the
  // screen it just navigated to hides the very thing it was asked for.
  const go = (s: ScreenName) => { navigate(s); onNavigate?.(); };

  return (
    <aside
      className={`shrink-0 bg-white/40 backdrop-blur-md border border-white/60 rounded-[2rem]
                  flex flex-col py-5 transition-transform duration-300
                  fixed inset-y-2 left-2 z-50 w-[15rem] max-w-[85vw] shadow-2xl
                  ${mobileOpen ? 'translate-x-0' : '-translate-x-[calc(100%+1rem)]'}
                  lg:static lg:inset-auto lg:translate-x-0 lg:shadow-none lg:max-w-none
                  lg:transition-all lg:duration-300 ${collapsed ? 'lg:w-[72px]' : 'lg:w-[230px]'}`}
    >
      <div className="px-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-9 h-9 bg-black rounded-xl flex items-center justify-center shrink-0">
            <div className="w-4 h-4 border-[2.5px] border-dash-yellow rounded-full border-t-transparent" />
          </div>
          {!compact && (
            <div className="overflow-hidden">
              <p className="text-[13px] font-black tracking-tight leading-none">helio<span className="text-status-warn">.</span>pms</p>
              <p className="text-[9px] text-dash-muted font-semibold mt-0.5">Property management</p>
            </div>
          )}
        </div>
        {/* The same corner does the job the width calls for: narrow the rail on
            a desktop, dismiss the drawer on a phone. A collapse control in a
            drawer would leave a 72px sliver floating over the content. */}
        <button
          onClick={isDesktop ? onToggle : onNavigate}
          className="text-dash-muted hover:text-black p-1 -m-1 min-w-9 min-h-9 flex items-center justify-center lg:min-w-0 lg:min-h-0"
          aria-label={isDesktop ? 'Collapse sidebar' : 'Close menu'}
        >
          {isDesktop
            ? <ChevronsLeft className={`w-4 h-4 transition-transform ${compact ? 'rotate-180' : ''}`} />
            : <X className="w-4 h-4" />}
        </button>
      </div>

      <nav className="flex-1 px-2 overflow-y-auto scroll-thin">
        {visible.map((item) => {
          const Icon = item.icon;
          const childActive = item.children?.some((c) => isActive(c.screen));
          const open = expanded[item.label] && !compact;
          return (
            <div key={item.label} className="mb-0.5">
              <button
                onClick={() => {
                  if (item.children) setExpanded((e) => ({ ...e, [item.label]: !e[item.label] }));
                  else if (item.screen) go(item.screen);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[12px] font-bold transition-colors ${
                  isActive(item.screen) || childActive ? 'bg-white shadow-sm' : 'hover:bg-white/60 text-dash-muted'
                }`}
                title={compact ? labelOf(item.label) : undefined}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive(item.screen) || childActive ? 'text-black' : ''}`} />
                {!compact && (
                  <>
                    <span className={`flex-1 text-left ${isActive(item.screen) || childActive ? 'text-black' : ''}`}>
                      {labelOf(item.label)}
                    </span>
                    {item.children && (
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-90' : ''}`} />
                    )}
                  </>
                )}
              </button>

              {open && item.children && (
                <div className="ml-7 mt-1 mb-2 space-y-0.5">
                  {item.children.map((c) => (
                    <button
                      key={c.label}
                      onClick={() => c.screen && go(c.screen)}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                        isActive(c.screen) ? 'text-black bg-dash-yellow/40' : 'text-dash-muted hover:text-black'
                      }`}
                    >
                      <span className="w-1 h-1 rounded-full bg-current opacity-60" />
                      {labelOf(c.label)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* The manual is in the app rather than on a website. Documentation that
          lives somewhere else is documentation nobody reads at 2am, and the
          address this used to point at was a repository that does not exist. */}
      <div className="px-3 mt-3">
        <button
          onClick={() => navigate('manual')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[12px] font-bold transition-colors ${
            screen.name === 'manual'
              ? 'bg-black text-white'
              : 'text-dash-muted hover:bg-white/60'}`}
        >
          <HelpCircle className="w-4 h-4 shrink-0" />
          {!compact && <span>{t('nav.help')}</span>}
        </button>
      </div>
    </aside>
  );
}

// ─── Global search ──────────────────────────────────────────────────────────
function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { navigate } = useNav();
  const [term, setTerm] = useState('');
  const search = useSearch(term);

  useEffect(() => { if (!open) setTerm(''); }, [open]);

  const go = (r: { kind: string; id: string }) => {
    onClose();
    if (r.kind === 'reservation') navigate('guest-dashboard', { reservationId: r.id });
    else if (r.kind === 'profile') navigate('profile-detail', { profileId: r.id });
    else if (r.kind === 'room') navigate('housekeeping');
    else if (r.kind === 'company') navigate('ar', { companyId: r.id });
    else if (r.kind === 'group') navigate('groups');
  };

  if (!open) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="absolute z-40 left-0 right-0 mt-2 panel p-4"
    >
      <div className="flex items-center gap-3 border-b subtle-divider pb-3 mb-3">
        <Search className="w-4 h-4 text-dash-muted" />
        <input
          autoFocus
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
          placeholder="Guest name, confirmation, room, phone, OTA reference…"
          className="flex-1 text-sm bg-transparent outline-none"
        />
        <button onClick={onClose} className="text-dash-muted hover:text-black"><X className="w-4 h-4" /></button>
      </div>

      {term.trim().length < 2 && (
        <p className="text-[11px] text-dash-muted px-1 py-3">Type at least two characters to search.</p>
      )}
      {search.isLoading && term.trim().length >= 2 && (
        <p className="text-[11px] text-dash-muted px-1 py-3">Searching…</p>
      )}
      {search.data && search.data.results.length === 0 && (
        <p className="text-[11px] text-dash-muted px-1 py-3">Nothing matched “{term}”.</p>
      )}
      <div className="max-h-[360px] overflow-y-auto scroll-thin">
        {search.data?.results.map((r) => (
          <button
            key={`${r.kind}-${r.id}`}
            onClick={() => go(r)}
            className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-dash-bg text-left"
          >
            <span className="w-7 h-7 rounded-lg bg-dash-bg flex items-center justify-center text-[9px] font-black uppercase text-dash-muted shrink-0">
              {r.kind.slice(0, 3)}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold truncate">{r.title}</p>
              <p className="text-[10px] text-dash-muted truncate">{r.subtitle}</p>
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Top Bar ────────────────────────────────────────────────────────────────
export function TopBar({
  onQuickAction, onToggleRight, onMenu,
}: {
  onQuickAction: () => void;
  onToggleRight: () => void;
  onMenu?: () => void;
}) {
  const { navigate, logout, switchProperty } = useNav();
  const { t, i18n } = useTranslation();
  const language = useUiStore((s) => s.language);
  const user = useAuthStore((s) => s.user);
  const property = useAuthStore((s) => s.property);
  const properties = useAuthStore((s) => s.properties);

  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [now, setNow] = useState(new Date());

  const notifications = useNotifications();
  const health = useChannelHealth();
  const markAll = useMarkAllNotificationsRead();
  const markOne = useMarkNotificationRead();

  const unread = notifications.data?.unread ?? 0;
  const items = notifications.data?.notifications ?? [];

  // The alert watcher. Lives in the header because the header is on every
  // screen — an alarm that only sounds while you are looking at the
  // overbooking desk is an alarm for a problem you already know about.
  const alerts = useAlertWatcher(fetchAlertFeed);
  const acknowledgeAll = useAcknowledgeAllAlerts();
  const channelSummary = useMemo(() => {
    const list = health.data ?? [];
    return {
      connected: list.filter((c) => c.health === 'healthy').length,
      problems: list.filter((c) => c.health === 'down' || c.health === 'degraded').length,
      configured: list.filter((c) => c.health !== 'not-configured').length,
      total: list.length,
    };
  }, [health.data]);

  useEffect(() => { i18n.changeLanguage(language); }, [language, i18n]);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // ⌘K / Ctrl-K opens search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className="flex items-center gap-2 sm:gap-3 mb-4 px-1 shrink-0 min-w-0">
      {/* Only door to the navigation once the sidebar becomes a drawer. */}
      <button
        onClick={onMenu}
        className="lg:hidden glass-pill rounded-full w-10 h-10 shrink-0 flex items-center justify-center hover:bg-white"
        aria-label="Open menu"
      >
        <Menu className="w-4 h-4" />
      </button>

      {/*
        The property pill carries four things on a desktop. On a phone only two
        of them earn their width: which property you are in, and the business
        date — the date decides what every screen behind it is showing, so it is
        the last thing that may be dropped. The code, city and clock are hidden
        rather than shrunk; a 9px line squeezed to three characters is not a
        smaller version of the information, it is a worse one.
      */}
      <button
        onClick={() => properties.length > 1 && switchProperty()}
        className="glass-pill rounded-full px-3 sm:px-4 py-1.5 flex items-center gap-2 sm:gap-3 hover:bg-white/70 transition-colors min-w-0"
        title={properties.length > 1 ? 'Switch property' : undefined}
      >
        <Building2 className="w-3.5 h-3.5 text-dash-muted shrink-0 hidden sm:block" />
        <div className="leading-tight text-left min-w-0 hidden sm:block">
          <p className="text-[10px] font-bold truncate">{property?.name ?? '—'}</p>
          <p className="text-[9px] text-dash-muted truncate hidden sm:block">
            {property?.code}{property?.city ? ` · ${property.city}` : ''}
          </p>
        </div>
        <div className="w-px h-6 bg-black/10 mx-1 shrink-0 hidden sm:block" />
        <div className="leading-tight text-left shrink-0">
          <p className="text-[9px] font-bold uppercase tracking-widest text-dash-muted hidden sm:block">Business date</p>
          <p className="text-[11px] font-black whitespace-nowrap">{property?.businessDate ?? '—'}</p>
        </div>
        <div className="w-px h-6 bg-black/10 mx-1 hidden md:block" />
        <div className="hidden md:flex items-center gap-1.5 text-[11px] font-bold">
          <Clock className="w-3 h-3 text-dash-muted" />
          {now.toTimeString().slice(0, 5)}
        </div>
      </button>

      <button
        onClick={() => navigate('channel-manager')}
        className="hidden md:flex glass-pill rounded-full px-3 py-1.5 items-center gap-2 hover:bg-white transition-colors shrink-0"
        title="Channel manager"
      >
        <RadioTower className="w-3.5 h-3.5 text-dash-muted" />
        <div className="leading-tight text-left">
          <p className="text-[9px] font-bold uppercase tracking-widest text-dash-muted">Channels</p>
          <div className="flex items-center gap-1.5 text-[10px] font-black">
            {channelSummary.total === 0 ? (
              <span className="text-dash-muted">Not set up</span>
            ) : (
              <>
                <span className={`w-1.5 h-1.5 rounded-full ${channelSummary.problems ? 'bg-status-bad' : 'bg-status-ok'} ${channelSummary.problems ? '' : 'pulse-dot'}`} />
                {channelSummary.connected} live
                {channelSummary.problems > 0 && ` · ${channelSummary.problems} issue`}
              </>
            )}
          </div>
        </div>
      </button>

      <div className="relative shrink-0 md:flex-1 md:min-w-0">
        <button
          onClick={() => setSearchOpen(true)}
          className="glass-pill rounded-full w-10 h-10 justify-center md:w-full md:h-auto md:px-5 md:py-2 flex items-center gap-3 text-[12px] text-dash-muted hover:bg-white/80 transition-colors"
          aria-label="Search"
        >
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span className="font-semibold hidden md:inline truncate">Search reservations, guests, rooms, companies…</span>
          <span className="ml-auto px-2 py-0.5 rounded-md bg-black/5 font-mono text-[10px] hidden lg:inline">⌘K</span>
        </button>
        <AnimatePresence>
          <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
        </AnimatePresence>
      </div>

      <InstallButton />

      <button
        onClick={onQuickAction}
        className="glass-pill rounded-full w-10 h-10 justify-center sm:w-auto sm:h-auto sm:pl-3 sm:pr-4 sm:py-2 flex items-center gap-2 hover:bg-dash-yellow transition-colors shrink-0"
        aria-label="Quick actions"
      >
        <ZapIcon className="w-3.5 h-3.5 shrink-0" />
        <span className="text-[11px] font-bold hidden sm:inline">Quick actions</span>
      </button>

      <div className="relative flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* An unacknowledged overbooking is loud on screen as well as audibly —
            the sound gets attention, this says what for and stops the alarm. */}
        {alerts.unacknowledged > 0 && (
          <button
            onClick={async () => {
              try { await acknowledgeAll.mutateAsync({ kind: 'overbooking' }); } catch { /* retry next poll */ }
              navigate('overbooking');
            }}
            className="rounded-full h-10 px-3.5 flex items-center gap-2 bg-status-bad text-white text-[11px] font-black animate-pulse"
            aria-label={`${alerts.unacknowledged} overbooking alerts — open and silence`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {alerts.unacknowledged} overbooking{alerts.unacknowledged === 1 ? '' : 's'}
          </button>
        )}

        {/* Browsers block audio until someone interacts. Saying so is the
            difference between a silent alarm and a broken one. */}
        {alerts.blocked && (
          <button
            onClick={() => void alerts.unblock()}
            className="rounded-full h-10 px-3.5 flex items-center gap-2 bg-dash-yellow text-black text-[11px] font-black"
            aria-label="Enable alert sounds on this device"
          >
            <Volume2 className="w-3.5 h-3.5" />
            Enable sound
          </button>
        )}

        <button
          onClick={() => alerts.setMuted(!alerts.muted)}
          className="glass-pill rounded-full w-10 h-10 shrink-0 hidden sm:flex items-center justify-center hover:bg-white"
          title={alerts.muted
            ? 'Alert sounds are muted on this device'
            : 'Alert sounds are on for this device'}
          aria-label={alerts.muted ? 'Unmute alert sounds' : 'Mute alert sounds'}
        >
          {alerts.muted
            ? <VolumeX className="w-4 h-4 text-status-warn" />
            : <Volume2 className="w-4 h-4" />}
        </button>

        <button
          onClick={() => setNotifOpen((v) => !v)}
          className="glass-pill rounded-full w-10 h-10 flex items-center justify-center hover:bg-white relative"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        >
          <Bell className="w-4 h-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-status-bad text-white rounded-full text-[9px] font-black flex items-center justify-center">
              {unread}
            </span>
          )}
        </button>
        <AnimatePresence>
          {notifOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              className="absolute right-0 top-full z-40 mt-2 w-[min(23rem,calc(100vw-1.5rem))] panel p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm">Notifications</h3>
                {unread > 0 && (
                  <button
                    onClick={() => markAll.mutate()}
                    className="text-[11px] text-dash-muted hover:text-black font-semibold"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="space-y-2 max-h-[400px] overflow-y-auto scroll-thin -mx-1 px-1">
                {items.length === 0 && (
                  <p className="text-[11px] text-dash-muted py-6 text-center">Nothing to report.</p>
                )}
                {items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      if (n.unread) markOne.mutate({ id: n.id });
                      // A feed you cannot act from is a log file with a bell
                      // on it, so every entry opens the thing it is about.
                      if (n.link) { window.location.hash = n.link.replace(/^#/, ''); setNotifOpen(false); }
                    }}
                    className={`w-full text-left p-3 rounded-2xl ${n.unread ? 'bg-dash-bg' : ''} flex gap-3 items-start hover:bg-dash-grey/50`}
                  >
                    <div className="mt-0.5">
                      {n.severity === 'critical' && <CircleAlert className="w-4 h-4 text-status-bad" />}
                      {n.severity === 'warn' && <AlertTriangle className="w-4 h-4 text-status-warn" />}
                      {n.severity === 'success' && <CheckCircle2 className="w-4 h-4 text-status-ok" />}
                      {n.severity === 'info' && <CheckCircle2 className="w-4 h-4 text-status-info" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold">{n.title}</p>
                      {n.message && <p className="text-[11px] text-dash-muted mt-0.5">{n.message}</p>}
                      <p className="text-[10px] text-dash-muted mt-1">{n.source} · {relativeTime(n.ts)}</p>
                    </div>
                    {n.unread && <span className="w-2 h-2 bg-dash-yellow rounded-full mt-1.5 shrink-0" />}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <button
        onClick={onToggleRight}
        className="glass-pill rounded-full w-10 h-10 shrink-0 hidden lg:flex items-center justify-center hover:bg-white"
        title="Activity panel"
      >
        <PanelRightOpen className="w-4 h-4" />
      </button>

      <div className="relative">
        <button
          onClick={() => setUserOpen((v) => !v)}
          className="glass-pill rounded-full pl-1 pr-3 py-1 flex items-center gap-2 hover:bg-white"
        >
          <span className="w-8 h-8 rounded-full bg-black text-white text-[11px] font-black flex items-center justify-center">
            {initials(user?.name)}
          </span>
          <div className="leading-tight text-left hidden md:block">
            <p className="text-[11px] font-bold">{user?.name.split(' ')[0]}</p>
            <p className="text-[9px] text-dash-muted">{user?.roleLabel}</p>
          </div>
          <ChevronDown className="w-3 h-3 text-dash-muted" />
        </button>
        <AnimatePresence>
          {userOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              className="absolute right-0 z-40 mt-2 w-56 panel p-2"
            >
              <div className="px-3 py-3 border-b subtle-divider mb-2">
                <p className="text-[12px] font-bold">{user?.name}</p>
                <p className="text-[10px] text-dash-muted">{user?.email}</p>
                <Pill tone="grey" className="mt-2">{user?.roleLabel}</Pill>
              </div>
              {[
                { label: 'Administration', icon: ShieldCheck, action: () => navigate('admin'), permission: 'admin.users' },
                { label: 'Switch property', icon: Building2, action: switchProperty, show: properties.length > 1 },
                { label: 'Configuration', icon: Settings, action: () => navigate('config'), permission: 'config.read' },
              ].filter((m) => m.show !== false).map((m) => {
                const I = m.icon;
                return (
                  <button
                    key={m.label}
                    onClick={() => { setUserOpen(false); m.action?.(); }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[12px] font-semibold hover:bg-dash-bg text-left"
                  >
                    <I className="w-3.5 h-3.5 text-dash-muted" />
                    {m.label}
                  </button>
                );
              })}
              <div className="border-t subtle-divider mt-2 pt-2">
                <button
                  onClick={() => { setUserOpen(false); logout(); }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[12px] font-semibold hover:bg-red-50 text-status-bad"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign out
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}

// ─── Status Bar ─────────────────────────────────────────────────────────────
export function StatusBar() {
  const online = useConnectivityStore((s) => s.online);
  const apiReachable = useConnectivityStore((s) => s.apiReachable);
  const lastCheck = useConnectivityStore((s) => s.lastCheck);
  const user = useAuthStore((s) => s.user);
  const shift = useCashierShift();
  const health = useChannelHealth();

  const channelState = (() => {
    const list = health.data ?? [];
    if (list.length === 0) return { label: 'Not configured', tone: 'text-dash-muted' };
    if (list.some((c) => c.health === 'down')) return { label: 'Error', tone: 'text-status-bad' };
    if (list.some((c) => c.health === 'degraded')) return { label: 'Degraded', tone: 'text-status-warn' };
    if (list.every((c) => c.health === 'not-configured')) return { label: 'Not connected', tone: 'text-dash-muted' };
    return { label: 'Connected', tone: 'text-black' };
  })();

  // Hidden below `lg`, and not for want of room — the floating quick bar is
  // fixed to the bottom of the viewport and sat directly on top of this,
  // leaving "Cashier shift: Closed" and the signed-in user legible only in the
  // gaps between five buttons. Every fact here has a home elsewhere: the
  // offline state has its own bar under the header, channel health is a pill in
  // the top bar, and the user is behind the avatar menu.
  return (
    <footer className="hidden lg:flex items-center gap-4 mt-3 px-3 text-[10px] text-dash-muted shrink-0 flex-wrap">
      <div className="flex items-center gap-1.5">
        {online && apiReachable ? (
          <><Wifi className="w-3 h-3" /><StatusDot tone="ok" pulse /> Online</>
        ) : !online ? (
          <><WifiOff className="w-3 h-3 text-status-bad" /><StatusDot tone="bad" pulse />
            <span className="font-bold text-status-bad">Offline</span> · showing last loaded data</>
        ) : (
          <><WifiOff className="w-3 h-3 text-status-warn" /><StatusDot tone="warn" pulse />
            <span className="font-bold text-status-warn">Server unreachable</span></>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <RadioTower className="w-3 h-3" />
        Channels: <span className={`font-bold ${channelState.tone}`}>{channelState.label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Activity className="w-3 h-3" />
        Cashier shift:{' '}
        <span className={`font-bold ${shift.data?.open ? 'text-status-ok' : 'text-dash-muted'}`}>
          {shift.data?.open ? `Open since ${clock(shift.data.openedAt)}` : 'Closed'}
        </span>
        {shift.data?.open && shift.data.paymentsMinor !== undefined && (
          <span>· {money(shift.data.paymentsMinor)} taken</span>
        )}
      </div>
      <div>User: <span className="font-bold text-black">{user?.name}</span> · {user?.roleLabel}</div>
      <div className="ml-auto flex items-center gap-3">
        {lastCheck && <span>Checked {relativeTime(lastCheck)}</span>}
      </div>
    </footer>
  );
}

// ─── Breadcrumb ─────────────────────────────────────────────────────────────
export function Breadcrumb({ items }: { items: { label: string; screen?: ScreenName }[] }) {
  const { navigate } = useNav();
  return (
    <nav className="flex items-center gap-1.5 text-[11px] mb-4">
      {items.map((it, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {it.screen && !isLast ? (
              <button onClick={() => navigate(it.screen!)} className="text-dash-muted hover:text-black font-semibold">
                {it.label}
              </button>
            ) : (
              <span className={isLast ? 'font-bold text-black' : 'text-dash-muted'}>{it.label}</span>
            )}
            {!isLast && <ChevronRight className="w-3 h-3 text-dash-muted" />}
          </span>
        );
      })}
    </nav>
  );
}

// ─── Right Activity Panel ───────────────────────────────────────────────────
export function RightPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { navigate } = useNav();
  const tasks = useTasks();
  const frontDesk = useFrontDesk();
  const canSeeAudit = usePermission('reports.read');
  const notifications = useNotifications();
  const recent = notifications.data?.notifications ?? [];

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 320, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 32 }}
          // A 280px column beside a 400px screen leaves 120px for the app. On a
          // phone this covers it instead, the way the drawer does, and returns
          // to being a side column from `lg` up.
          className="panel p-4 overflow-y-auto scroll-thin
                     fixed inset-y-2 right-2 z-50 w-[19rem] max-w-[90vw] shadow-2xl
                     lg:static lg:inset-auto lg:z-auto lg:shadow-none lg:w-[280px] lg:max-w-none lg:shrink-0 lg:ml-3"
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">Activity panel</p>
            <button onClick={onClose} className="text-dash-muted hover:text-black"><X className="w-3.5 h-3.5" /></button>
          </div>

          <div className="mb-5">
            <p className="text-[11px] font-bold mb-2">Open tasks</p>
            <div className="space-y-2">
              {(tasks.data ?? []).length === 0 && (
                <p className="text-[10px] text-dash-muted">Nothing outstanding.</p>
              )}
              {tasks.data?.slice(0, 5).map((t) => (
                <div key={t.id} className="bg-dash-bg rounded-xl p-2.5">
                  <p className="text-[11px] font-bold">{t.title}</p>
                  <p className="text-[10px] text-dash-muted mt-0.5">
                    {t.category}{t.dueAt ? ` · due ${clock(t.dueAt)}` : ''} · {t.assignee}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-5">
            <p className="text-[11px] font-bold mb-2">In-house now</p>
            <div className="space-y-2">
              {(frontDesk.data?.inHouse ?? []).length === 0 && (
                <p className="text-[10px] text-dash-muted">No guests in-house.</p>
              )}
              {frontDesk.data?.inHouse.slice(0, 5).map((r) => (
                <button
                  key={r.id}
                  onClick={() => navigate('guest-dashboard', { reservationId: r.id })}
                  className="w-full bg-dash-bg rounded-xl p-2.5 text-left hover:bg-dash-grey"
                >
                  <p className="text-[11px] font-bold">{r.guest}</p>
                  <p className="text-[10px] text-dash-muted mt-0.5">
                    {r.room ? `Room ${r.room}` : 'Unassigned'} · departs {r.departure}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {canSeeAudit && (
            <div>
              <p className="text-[11px] font-bold mb-2">Recent activity</p>
              <div className="space-y-1.5 text-[10px] text-dash-muted">
                {recent.slice(0, 6).map((n) => (
                  <p key={n.id}>{relativeTime(n.ts)} — {n.title}</p>
                ))}
                {recent.length === 0 && <p>No activity yet today.</p>}
              </div>
            </div>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

// ─── Quick Actions ──────────────────────────────────────────────────────────
export function QuickActions({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { navigate } = useNav();
  const can = useAuthStore((s) => s.can);
  const actions = [
    { label: 'New reservation', icon: CalendarDays, screen: 'new-reservation' as const, tone: 'pink' as const, permission: 'reservations.write' },
    { label: 'Walk-in', icon: ScanLine, screen: 'new-reservation' as const, tone: 'yellow' as const, permission: 'frontdesk.write' },
    { label: 'Check-in', icon: LogIn, screen: 'arrivals' as const, tone: 'mint' as const, permission: 'frontdesk.read' },
    { label: 'Check-out', icon: LogOutIcon, screen: 'departures' as const, tone: 'peach' as const, permission: 'frontdesk.read' },
    { label: 'Find guest', icon: Users, screen: 'profiles' as const, tone: 'purple' as const, permission: 'profiles.read' },
    { label: 'Post charge', icon: DollarSign, screen: 'cashier' as const, tone: 'lilac' as const, permission: 'folio.read' },
    { label: 'Reports', icon: FileText, screen: 'reports' as const, tone: 'sky' as const, permission: 'reports.read' },
    { label: 'Room status', icon: Bed, screen: 'housekeeping' as const, tone: 'grey' as const, permission: 'housekeeping.read' },
  ].filter((a) => can(a.permission));

  const toneCls: Record<string, string> = {
    pink: 'bg-dash-pink', yellow: 'bg-dash-yellow', mint: 'bg-dash-mint', peach: 'bg-dash-peach',
    purple: 'bg-dash-purple', lilac: 'bg-dash-lilac', sky: 'bg-dash-sky', grey: 'bg-dash-grey',
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-[18vh] p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl panel p-6"
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-dash-muted">Quick actions</p>
                <h3 className="text-lg font-bold tracking-tight">What do you want to do?</h3>
              </div>
              <button onClick={onClose} className="text-dash-muted hover:text-black"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {actions.map((a) => {
                const I = a.icon;
                return (
                  <button
                    key={a.label}
                    onClick={() => { navigate(a.screen); onClose(); }}
                    className={`${toneCls[a.tone]} rounded-2xl p-4 text-left hover:scale-[1.02] transition-transform border border-black/5`}
                  >
                    <I className="w-5 h-5 mb-3" />
                    <p className="text-[12px] font-bold leading-tight">{a.label}</p>
                  </button>
                );
              })}
            </div>
            <div className="border-t subtle-divider mt-6 pt-4 flex items-center justify-between">
              <p className="text-[10px] text-dash-muted">
                Press <span className="px-1.5 py-0.5 rounded-md bg-black/5 font-mono">⌘K</span> to search
              </p>
              <button onClick={onClose} className="text-[11px] font-bold text-dash-muted hover:text-black">Close</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function FloatingQuickBar({ onMenu }: { onMenu: () => void }) {
  const { navigate } = useNav();
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 glass-pill px-3 py-2 rounded-full shadow-2xl z-40">
      <button onClick={() => navigate('dashboard')} className="w-8 h-8 rounded-full hover:bg-white flex items-center justify-center" title="Dashboard"><Home className="w-3.5 h-3.5" /></button>
      <button onClick={() => navigate('arrivals')} className="w-8 h-8 rounded-full hover:bg-white flex items-center justify-center" title="Arrivals"><LogIn className="w-3.5 h-3.5" /></button>
      <button onClick={onMenu} className="w-10 h-10 bg-black rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform" title="Quick actions">
        <Plus className="w-5 h-5 text-white" />
      </button>
      <button onClick={() => navigate('housekeeping')} className="w-8 h-8 rounded-full hover:bg-white flex items-center justify-center" title="Housekeeping"><Sparkles className="w-3.5 h-3.5" /></button>
      <button onClick={() => navigate('cashier')} className="w-8 h-8 rounded-full hover:bg-white flex items-center justify-center" title="Cashier"><DollarSign className="w-3.5 h-3.5" /></button>
    </div>
  );
}

// ─── App Shell ──────────────────────────────────────────────────────────────
export function AppShell({ children, breadcrumb }: { children: ReactNode; breadcrumb?: { label: string; screen?: ScreenName }[] }) {
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);
  const rightOpen = useUiStore((s) => s.rightPanelOpen);
  const setRightOpen = useUiStore((s) => s.setRightPanelOpen);
  const [quickOpen, setQuickOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  // Deliberately not persisted, unlike `sidebarCollapsed`. A drawer is a thing
  // you opened a moment ago, not a preference — restoring it over the dashboard
  // on next launch would be a bug, not a courtesy.

  return (
    <div className="flex flex-col h-screen bg-dash-bg p-2 sm:p-3">
      <div className="flex flex-1 min-h-0 gap-3">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          mobileOpen={navOpen}
          onNavigate={() => setNavOpen(false)}
        />

        {/* Tapping beside an open drawer closes it — the gesture everyone tries
            first. Only below `lg`, where a drawer exists to be dismissed. */}
        {navOpen && (
          <button
            onClick={() => setNavOpen(false)}
            className="lg:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
            aria-label="Close menu"
          />
        )}

        <main className="flex-1 flex flex-col min-w-0">
          <TopBar
            onQuickAction={() => setQuickOpen(true)}
            onToggleRight={() => setRightOpen(!rightOpen)}
            onMenu={() => setNavOpen(true)}
          />
          {/* Directly under the top bar, above everything a person acts on:
              whether the desk is online changes what they are allowed to do,
              so it cannot be a toast that disappears before they read it. */}
          <OfflineBar />
          {/* `pb-24` clears the floating quick bar, which is fixed to the bottom
              of the viewport and otherwise sits on top of the last row of every
              list — reachable only by scrolling past the end. */}
          <div className="flex-1 panel p-3 sm:p-5 lg:p-7 pb-24 sm:pb-24 lg:pb-7 min-h-0 flex flex-col overflow-hidden">
            {breadcrumb && <Breadcrumb items={breadcrumb} />}
            {/*
              `overflow-x-hidden` is doing real work, not tidying up. CSS resolves
              a `visible` overflow on one axis to `auto` when the other axis is
              not visible, so `overflow-y-auto` alone made this pane scroll
              *sideways* as well. A wide table then stretched the pane instead of
              scrolling inside its own wrapper, and dragged the section header,
              the stat cards and the tab strip off-screen with it — the whole
              screen slid, and the column headings slid away from their rows.
              Pinning the horizontal axis here is what lets each table scroll on
              its own. `min-w-0` stops this flex child from refusing to shrink
              below its content, which is what makes the constraint stick.
            */}
            <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden scroll-thin -mx-2 px-2">
              {children}
            </div>
          </div>
          <StatusBar />
        </main>

        <RightPanel open={rightOpen} onClose={() => setRightOpen(false)} />
      </div>

      <QuickActions open={quickOpen} onClose={() => setQuickOpen(false)} />
      <FloatingQuickBar onMenu={() => setQuickOpen(true)} />
      <UpdateAvailableBanner />
    </div>
  );
}
