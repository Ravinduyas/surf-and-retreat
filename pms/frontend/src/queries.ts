// ─────────────────────────────────────────────────────────────
// Server state: TanStack Query hooks over the Helio API.
//
// Every hook here hits the real backend. Mutations invalidate the query keys
// that the change can affect, so a check-in updates the arrivals list, the
// room board, the dashboard and availability without a manual refresh.
// ─────────────────────────────────────────────────────────────
import {
  QueryClient, useQuery, useQueries, useMutation, useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { api, qs, ApiError } from './api';
import { useAuthStore } from './stores';
import type {
  LedgerEntry,
  Reservation, ReservationDetail, RoomType, Room, Bed, RoomBlock, RatePlan,
  RateCalendarRow, Restriction, YieldRule, Promotion, Tax, TransactionCode,
  Folio, FolioSummary, Invoice, InvoiceDocument, InvoiceBranding, Company, ArAccount, CashierShift,
  BoardRoom, HkTask, WorkOrder, LostFoundItem, AuditPreflight, DailyStats,
  Profile, ProfileDetail, KpiSummary, DashboardSnapshot, FrontDeskLists, ProductionRow,
  BookingConfirmation, RegistrationLink, CashBox, CashBoxEvent, CashCountResult, CashTransaction, FxRates, PaymentMethodList, PaymentSettings,
  HostelworldSettings, HostelworldApplyResult, HostelworldRefreshResult,
  Channel, ChannelMapping, SyncLogEntry, AriCell, ChannelConflict, ChannelHealth,
  DiscoveredUnit, Group, Notification, TaskItem, AuditEntry, SearchResult,
  Policy, StaffUser, Property, AvailabilityCell, QuoteResponse,
} from './types';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: true,
      retry: (count, error) => {
        // Never retry a rejection the user has to act on.
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return count < 2;
      },
    },
  },
});

// ─── Query keys ──────────────────────────────────────────────
export const keys = {
  session: ['session'] as const,
  property: ['property'] as const,
  properties: ['properties'] as const,
  settings: ['settings'] as const,

  roomTypes: ['room-types'] as const,
  rooms: ['rooms'] as const,
  beds: ['beds'] as const,
  roomBlocks: ['room-blocks'] as const,
  availability: (from: string, to: string) => ['availability', from, to] as const,
  freeRooms: (from: string, to: string, rt?: string, ex?: string) =>
    ['free-rooms', from, to, rt ?? '', ex ?? ''] as const,
  tape: (from: string, to: string) => ['tape', from, to] as const,

  ratePlans: ['rate-plans'] as const,
  rateCalendar: (from: string, to: string, rt?: string, rp?: string) =>
    ['rate-calendar', from, to, rt ?? '', rp ?? ''] as const,
  restrictions: ['restrictions'] as const,
  closeouts: ['closeouts'] as const,
  yieldRules: ['yield-rules'] as const,
  promotions: ['promotions'] as const,
  taxes: ['taxes'] as const,
  transactionCodes: ['transaction-codes'] as const,
  policies: ['policies'] as const,

  reservations: (filters?: Record<string, unknown>) => ['reservations', filters ?? {}] as const,
  reservation: (id?: string) => ['reservation', id ?? ''] as const,
  documents: (id?: string) => ['documents', id ?? ''] as const,
  frontDesk: (date?: string) => ['front-desk', date ?? 'today'] as const,
  groups: ['groups'] as const,
  group: (id?: string) => ['group', id ?? ''] as const,
  waitlist: ['waitlist'] as const,

  folios: (status?: string) => ['folios', status ?? 'all'] as const,
  folio: (id?: string) => ['folio', id ?? ''] as const,
  reservationFolios: (id?: string) => ['reservation-folios', id ?? ''] as const,
  invoices: ['invoices'] as const,
  companies: ['companies'] as const,
  ar: ['ar'] as const,
  arAccount: (id?: string) => ['ar', id ?? ''] as const,
  shift: ['cashier-shift'] as const,
  outstanding: ['outstanding'] as const,

  hkBoard: (date?: string) => ['hk-board', date ?? 'today'] as const,
  hkTasks: (date?: string) => ['hk-tasks', date ?? 'today'] as const,
  hkForecast: (date?: string) => ['hk-forecast', date ?? 'today'] as const,
  workOrders: (status?: string) => ['work-orders', status ?? 'all'] as const,
  lostFound: ['lost-found'] as const,

  auditPreflight: ['audit-preflight'] as const,
  auditHistory: ['audit-history'] as const,
  auditReport: (date?: string) => ['audit-report', date ?? ''] as const,

  profiles: (search?: string) => ['profiles', search ?? ''] as const,
  profile: (id?: string) => ['profile', id ?? ''] as const,
  messages: (reservationId?: string) => ['messages', reservationId ?? ''] as const,

  dashboard: ['dashboard'] as const,
  kpis: (from: string, to: string) => ['kpis', from, to] as const,
  production: (from: string, to: string, dim: string) => ['production', from, to, dim] as const,
  pace: (from: string, to: string) => ['pace', from, to] as const,
  pickup: (from: string, to: string) => ['pickup', from, to] as const,
  revenue: (from: string, to: string) => ['revenue', from, to] as const,
  dailyStats: (from: string, to: string) => ['daily-stats', from, to] as const,
  occupancyForecast: (from: string, to: string) => ['occ-forecast', from, to] as const,

  channels: ['channels'] as const,
  channelHealth: ['channel-health'] as const,
  channelCatalogue: ['channel-catalogue'] as const,
  mappings: (channelId?: string) => ['channel-mappings', channelId ?? ''] as const,
  syncLog: (channelId?: string) => ['sync-log', channelId ?? ''] as const,
  ari: (from: string, to: string, rt?: string, rp?: string, ch?: string) =>
    ['ari', from, to, rt ?? '', rp ?? '', ch ?? ''] as const,
  conflicts: ['channel-conflicts'] as const,
  channelQueue: ['channel-queue'] as const,
  channelContent: (id?: string) => ['channel-content', id ?? ''] as const,
  discover: (id?: string) => ['channel-discover', id ?? ''] as const,

  notifications: ['notifications'] as const,
  tasks: ['tasks'] as const,
  auditLog: (filters?: Record<string, unknown>) => ['audit-log', filters ?? {}] as const,
  search: (q: string) => ['search', q] as const,
  users: ['users'] as const,
  roles: ['roles'] as const,
  sessions: ['sessions'] as const,
};

// Groups of keys that a given kind of change can invalidate.
const OPERATIONAL = [
  'dashboard', 'front-desk', 'reservations', 'reservation', 'availability',
  'tape', 'hk-board', 'hk-tasks', 'rate-calendar', 'outstanding', 'notifications',
  'ari', 'free-rooms', 'occ-forecast', 'kpis',
];
const FINANCIAL = ['folio', 'folios', 'reservation-folios', 'outstanding', 'cashier-shift',
  'dashboard', 'invoices', 'ar', 'reservation', 'reservations'];

/**
 * Invalidate every query under the given key prefixes.
 *
 * `property` needs a second step. The property — and with it the **business
 * date** — is mirrored in the auth store, which is where nineteen screens read
 * it from, and React Query cannot invalidate a Zustand store. So the mutations
 * that declare `'property'` refetched the query and left the store holding
 * whatever was loaded at sign-in, until the page was reloaded.
 *
 * The night audit is where that showed: closing a day advanced the date on the
 * server, the audit card refreshed to the new one, and the header chip beside it
 * went on displaying the old one — the same screen stating two different
 * business dates at once. Check-in is the version that matters more, because it
 * decides whether to warn about an early arrival by comparing against this
 * value, and a stale date makes that warning wrong in both directions.
 *
 * `refreshProperty` already existed and already did the right thing; it was
 * simply only ever called from the Configuration screen. Calling it here covers
 * every mutation that changes the property, not just the one that was noticed.
 */
function useInvalidate() {
  const qc = useQueryClient();
  return (prefixes: string[]) => {
    for (const p of prefixes) {
      qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === p });
    }
    if (prefixes.includes('property')) {
      // Not awaited: invalidation is fire-and-forget everywhere else here, and
      // a slow property fetch must not hold up the mutation's own callbacks.
      void useAuthStore.getState().refreshProperty();
    }
  };
}

type Opts<T> = Omit<UseQueryOptions<T, ApiError, T, any>, 'queryKey' | 'queryFn'>;

// ─── Property & session ──────────────────────────────────────
export function useProperty(opts?: Opts<Property>) {
  return useQuery({ queryKey: keys.property, queryFn: () => api.get<Property>('/api/property'), ...opts });
}
export function useProperties() {
  return useQuery({ queryKey: keys.properties, queryFn: () => api.get<Property[]>('/api/properties') });
}
export function useSettings() {
  return useQuery({ queryKey: keys.settings, queryFn: () => api.get<Record<string, any>>('/api/settings') });
}

/**
 * What the property accepts. One list, from the server.
 *
 * There were four hardcoded copies of this in the front end and they had
 * already drifted — the cashier offered Voucher, check-in offered OTA prepaid,
 * the guest dashboard offered neither. Long staleTime because it changes about
 * once a year, in Configuration.
 */
/**
 * Today's exchange rates, for the panel that takes money.
 *
 * Kept fresh but never blocking: the server answers from its cache and
 * refreshes behind the request, so a desk with a guest in front of it is not
 * waiting on a rate feed. Refetched every fifteen minutes because a shift is
 * long and a rate that moved this morning should not still be on screen this
 * evening.
 */
/**
 * The cash drawer, currency by currency.
 *
 * Refetched on a short clock and after every payment, because the figure a
 * cashier is looking at is the figure they are about to count against.
 */
export function useCashbox() {
  return useQuery({
    queryKey: ['cashbox'] as const,
    queryFn: () => api.get<CashBox>('/api/cashbox'),
    refetchInterval: 60_000,
  });
}

/**
 * Everything that moved money, newest first.
 *
 * Payments and cash-box events in one list, on the same short clock as the
 * drawer itself — a desk watching this is watching money change hands.
 */
export function useCashLedger(date?: string, limit = 60) {
  return useQuery({
    queryKey: ['cashbox-ledger', date ?? 'recent', limit] as const,
    queryFn: () => api.get<{ entries: LedgerEntry[] }>(
      `/api/cashbox/ledger?limit=${limit}${date ? `&date=${date}` : ''}`),
    refetchInterval: 60_000,
  });
}

export function useCashboxHistory(limit = 20) {
  return useQuery({
    queryKey: ['cashbox-history', limit] as const,
    queryFn: () => api.get<{ events: CashBoxEvent[] }>(`/api/cashbox/history?limit=${limit}`),
  });
}

/** Every payment taken on a business date, in the money it was taken in. */
export function useCashTransactions(date?: string) {
  return useQuery({
    queryKey: ['cashbox-transactions', date ?? 'today'] as const,
    queryFn: () => api.get<{ date: string; transactions: CashTransaction[] }>(
      `/api/cashbox/transactions${date ? `?date=${date}` : ''}`),
    refetchInterval: 60_000,
  });
}

export function useCashCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { counts: { currency: string; amountMinor: number }[]; note?: string }) =>
      api.post<CashCountResult>('/api/cashbox/count', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cashbox'] });
      qc.invalidateQueries({ queryKey: ['cashbox-history'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useCashWithdraw() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { items: { currency: string; amountMinor: number }[]; note?: string }) =>
      api.post<{ groupId: string }>('/api/cashbox/withdraw', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cashbox'] });
      qc.invalidateQueries({ queryKey: ['cashbox-history'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useFxRates(enabled = true) {
  return useQuery({
    queryKey: ['fx-rates'] as const,
    queryFn: () => api.get<FxRates>('/api/fx/rates'),
    staleTime: 15 * 60_000,
    enabled,
  });
}

export function usePaymentMethods() {
  return useQuery({
    queryKey: ['payment-methods'] as const,
    queryFn: () => api.get<PaymentMethodList>('/api/payment-methods'),
    staleTime: 5 * 60_000,
  });
}

export function usePaymentSettings() {
  return useQuery({
    queryKey: ['payment-settings'] as const,
    queryFn: () => api.get<PaymentSettings>('/api/payment-settings'),
  });
}

export const useSavePaymentSettings = mutation<Record<string, unknown>>(
  (body) => api.put('/api/payment-settings', body),
  ['payment-settings', 'payment-methods', 'settings']);

// ─── Hostelworld money split ─────────────────────────────────
export function useHostelworldSettings() {
  return useQuery({
    queryKey: ['hostelworld-settings'] as const,
    queryFn: () => api.get<HostelworldSettings>('/api/config/hostelworld'),
    staleTime: 5 * 60 * 1000,
  });
}

// Saving can post or strike folio credits on every open Hostelworld booking,
// so the financial and operational views are refreshed along with the setting.
export const useSaveHostelworldSettings = mutation<Partial<HostelworldSettings>,
  HostelworldSettings & { applied: HostelworldApplyResult }>(
  (body) => api.put('/api/config/hostelworld', body),
  ['hostelworld-settings', 'settings', ...FINANCIAL, ...OPERATIONAL]);

export const useApplyHostelworldSettings = mutation<void, HostelworldApplyResult>(
  () => api.post('/api/config/hostelworld/apply', {}),
  ['hostelworld-settings', ...FINANCIAL, ...OPERATIONAL]);

export const useRefreshHostelworldFromChannel = mutation<void, HostelworldRefreshResult>(
  () => api.post('/api/config/hostelworld/refresh', {}),
  ['hostelworld-settings', 'sync-log', ...FINANCIAL, ...OPERATIONAL]);

// ─── Inventory ───────────────────────────────────────────────
export function useRoomTypes(opts?: Opts<RoomType[]>) {
  return useQuery({
    queryKey: keys.roomTypes,
    queryFn: () => api.get<RoomType[]>('/api/room-types'),
    staleTime: 5 * 60 * 1000,
    ...opts,
  });
}
export function useRooms() {
  return useQuery({ queryKey: keys.rooms, queryFn: () => api.get<Room[]>('/api/rooms'), staleTime: 60_000 });
}
export function useBeds() {
  return useQuery({ queryKey: keys.beds, queryFn: () => api.get<Bed[]>('/api/beds'), staleTime: 60_000 });
}
export function useRoomBlocks() {
  return useQuery({ queryKey: keys.roomBlocks, queryFn: () => api.get<RoomBlock[]>('/api/room-blocks') });
}
export function useAvailability(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: keys.availability(from, to),
    queryFn: () => api.get<{ from: string; to: string; cells: AvailabilityCell[] }>(
      `/api/availability${qs({ from, to })}`),
    enabled: enabled && !!from && !!to,
  });
}
export function useFreeRooms(from: string, to: string, roomTypeId?: string, excludeReservationId?: string, enabled = true) {
  return useQuery({
    queryKey: keys.freeRooms(from, to, roomTypeId, excludeReservationId),
    queryFn: () => api.get<{ rooms: Room[]; beds: Bed[] }>(
      `/api/availability/free-rooms${qs({ from, to, roomTypeId, excludeReservationId })}`),
    enabled: enabled && !!from && !!to,
  });
}
export function useTapeChart(from: string, to: string) {
  return useQuery({
    queryKey: keys.tape(from, to),
    queryFn: () => api.get<any>(`/api/calendar/tape${qs({ from, to })}`),
    enabled: !!from && !!to,
  });
}

/**
 * The tape chart as a set of fixed chunks, for the endlessly scrolling view.
 *
 * One query per chunk rather than one wide query, for three reasons that all
 * matter once the chart scrolls without limit:
 *
 *   · the endpoint refuses a range over 400 days, and should;
 *   · a chunk already fetched is served from cache, so scrolling back over
 *     ground you have covered costs nothing;
 *   · a slow month does not hold up the months either side of it — each chunk
 *     paints as it lands.
 *
 * Chunk starts come from `chunkStart()`, which aligns them to a fixed grid, so
 * the same 60 days always has the same cache key however you scrolled into it.
 * Merging the results back into one truthful chart is `mergeChunks`.
 */
export function useTapeChunks(chunkStarts: string[], chunkDays: number) {
  return useQueries({
    queries: chunkStarts.map((from) => {
      const to = addDaysIso(from, chunkDays);
      return {
        queryKey: keys.tape(from, to),
        queryFn: () => api.get<any>(`/api/calendar/tape${qs({ from, to })}`),
        // Time already past does not change, but the near future changes all
        // day. One rule for both keeps it simple and the data honest.
        staleTime: 30_000,
        // Chunks scrolled away from stay warm, so coming back is instant.
        gcTime: 10 * 60_000,
        placeholderData: (prev: unknown) => prev,
      };
    }),
  });
}

// ─── Inventory, on both sides ────────────────────────────────
export function useInventory() {
  return useQuery({
    queryKey: ['inventory'] as const,
    queryFn: () => api.get<any>('/api/inventory'),
  });
}

export function useSetInventory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ roomTypeId, rooms, bedsPerRoom }:
    { roomTypeId: string; rooms: number; bedsPerRoom?: number }) =>
      api.put<any>(`/api/inventory/${roomTypeId}`, { rooms, bedsPerRoom }),
    onSuccess: () => {
      // Rooms, beds and availability all move together — anything showing a
      // count is now stale.
      for (const k of ['inventory', 'room-types', 'rooms', 'availability', 'tape']) {
        void qc.invalidateQueries({ queryKey: [k] });
      }
    },
  });
}

export function useAutoPush() {
  return useQuery({
    queryKey: ['inventory', 'auto-push'] as const,
    queryFn: () => api.get<{ on: boolean }>('/api/inventory/auto-push'),
  });
}

export function useSetAutoPush() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (on: boolean) => api.put<{ on: boolean }>('/api/inventory/auto-push', { on }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['inventory'] }); },
  });
}

export function usePushQuantity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ channelId, roomTypeId, qty }:
    { channelId: string; roomTypeId: string; qty: number }) =>
      api.post<any>(`/api/channels/${channelId}/quantity`, { roomTypeId, qty }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['inventory'] }); },
  });
}

// ─── OTAs behind the hub ─────────────────────────────────────
// Beds24 is the connection; these are the shopfronts guests actually book on.
export function useOtas() {
  return useQuery({
    queryKey: ['otas'] as const,
    queryFn: () => api.get<any>('/api/otas'),
  });
}

export function useRefreshOtas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (channelId: string) => api.post<any>(`/api/channels/${channelId}/otas/refresh`, {}),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['otas'] }); },
  });
}

export function useDeclareOta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ code, live }: { code: string; live: boolean }) =>
      api.patch<any>(`/api/otas/${encodeURIComponent(code)}`, { live }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['otas'] }); },
  });
}

/** Local date maths, so this module does not depend on the display layer. */
function addDaysIso(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─── Rates ───────────────────────────────────────────────────
export function useRatePlans(opts?: Opts<RatePlan[]>) {
  return useQuery({
    queryKey: keys.ratePlans,
    queryFn: () => api.get<RatePlan[]>('/api/rate-plans'),
    staleTime: 5 * 60 * 1000,
    ...opts,
  });
}
export function useRateCalendar(from: string, to: string, roomTypeId?: string, ratePlanId?: string) {
  return useQuery({
    queryKey: keys.rateCalendar(from, to, roomTypeId, ratePlanId),
    queryFn: () => api.get<{ from: string; to: string; dates: string[]; rows: RateCalendarRow[] }>(
      `/api/rates/calendar${qs({ from, to, roomTypeId, ratePlanId })}`),
    enabled: !!from && !!to,
  });
}
export function useRestrictions() {
  return useQuery({ queryKey: keys.restrictions, queryFn: () => api.get<Restriction[]>('/api/restrictions') });
}
// ─── Overbooking and alerts ──────────────────────────────────

export interface OverbookingBooking {
  id: string; confirmation: string; guest: string; status: string;
  arrival: string; departure: string; nights: number; adults: number; children: number;
  totalMinor: number; vip: boolean; source: string; channelCode: string | null;
  commissionBp: number; eta: string | null; groupId: string | null;
  roomId: string | null; room: string | null; roomType: string;
  previousStays: number; bookedAt: string;
}

export interface OverbookingFinding {
  id: string;
  kind: 'type' | 'room' | 'bed' | 'at-risk';
  date: string;
  roomTypeId: string | null; roomType: string | null; roomTypeCode: string | null;
  isDorm: boolean; room: string | null; bed: string | null;
  oversold: number; sellable: number; sold: number;
  cause: string; causeText: string;
  severity: 'critical' | 'urgent' | 'warning' | 'info';
  status: string; daysAway: number;
  channelsClosedAt: string | null; acknowledgedAt: string | null;
  firstSeenAt: string; lastSeenAt: string; note: string | null;
  reservations: OverbookingBooking[];
}

export interface OverbookingSummary {
  total: number; critical: number; urgent: number; roomsOversold: number;
  tonight: number; atRisk: number; atRiskClosed: number; atRiskOpen: number;
  unacknowledged: number;
}

export function useOverbookings(includeAtRisk = false) {
  return useQuery({
    queryKey: ['overbookings', includeAtRisk],
    queryFn: () => api.get<{ findings: OverbookingFinding[]; summary: OverbookingSummary }>(
      `/api/overbookings${includeAtRisk ? '?includeAtRisk=1' : ''}`),
    refetchInterval: 60_000,
  });
}

const OVERBOOK_KEYS = ['overbookings', 'alerts', 'availability', 'front-desk',
  'reservations', 'reservation', 'dashboard', 'tape-chart', 'closeouts', 'rate-calendar'];

export const useScanOverbookings = mutation<void>(
  () => api.post('/api/overbookings/scan', {}), OVERBOOK_KEYS);

export const useAcknowledgeOverbooking = mutation<{ id: string }>(
  ({ id }) => api.post(`/api/overbookings/${id}/acknowledge`, {}), ['overbookings', 'alerts']);

export const useResolveOverbooking = mutation<{ id: string; resolution: string; note?: string }>(
  ({ id, resolution, note }) => api.post(`/api/overbookings/${id}/resolve`, { resolution, note }),
  OVERBOOK_KEYS);

export interface RoomOption {
  roomId: string; number: string; floor: number | null; status: string;
  roomTypeId: string; roomType: string; rateDiffMinor: number;
}

export interface GuestOptions {
  reservationId: string; confirmation: string; guest: string; status: string;
  arrival: string; departure: string; nights: number;
  room: string | null; roomType: string; totalMinor: number;
  movable: boolean; blockedReason?: string;
  sameType: RoomOption[]; upgrades: RoomOption[]; downgrades: RoomOption[];
}

export function useOverbookingOptions(findingId: string | null) {
  return useQuery({
    queryKey: ['overbooking-options', findingId],
    enabled: !!findingId,
    staleTime: 0,
    queryFn: () => api.get<{
      findingId: string; date: string; oversold: number;
      guests: GuestOptions[]; spareRooms: number; walkLikely: boolean;
    }>(`/api/overbookings/${findingId}/options`),
  });
}

export const useApplyOverbookingFix = mutation<{
  findingId: string; reservationId: string; roomId: string;
  kind: 'reassign' | 'upgrade' | 'downgrade'; compensationMinor?: number; note?: string;
}>(
  ({ findingId, ...body }) => api.post(`/api/overbookings/${findingId}/fix`, body),
  [...OVERBOOK_KEYS, 'overbooking-options'],
);

export interface ExposureReport {
  from: string; to: string;
  pushes: number; medianSeconds: number; p95Seconds: number; worstSeconds: number;
  totalExposureSeconds: number; queuedNow: number; failedNow: number;
  oldestFailedAt: string | null;
  soldOutNights: number; oversoldNights: number; racesLost: number;
  perChannel: Array<{
    channelId: string; name: string; code: string;
    pushes: number; medianSeconds: number; failed: number;
  }>;
  protection: Array<{
    roomTypeId: string; roomType: string; isDorm: boolean;
    units: number; rooms: number; protectLastRooms: number;
  }>;
  verdict: string;
}

export function useExposure() {
  return useQuery({
    queryKey: ['exposure'],
    queryFn: () => api.get<ExposureReport>('/api/exposure'),
  });
}

export const useSetRoomProtection = mutation<{ roomTypeId: string; protectLastRooms: number }>(
  ({ roomTypeId, protectLastRooms }) =>
    api.put(`/api/room-types/${roomTypeId}/protection`, { protectLastRooms }),
  ['exposure', 'overbookings', 'room-types', 'availability', 'rate-calendar', 'closeouts'],
);

export function useAlertSettings() {
  return useQuery({
    queryKey: ['alert-settings'],
    queryFn: () => api.get<import('./alerts').AlertSettings>('/api/alert-settings'),
  });
}

export const useSaveAlertSettings = mutation<Record<string, unknown>>(
  (body) => api.put('/api/alert-settings', body), ['alert-settings', 'alerts']);

export const useAcknowledgeAllAlerts = mutation<{ kind?: string }>(
  (body) => api.post('/api/alerts/acknowledge-all', body), ['alerts', 'overbookings']);

/** Used by the watcher, which manages its own cursor rather than caching. */
export function fetchAlertFeed(since?: string) {
  return api.get<import('./alerts').AlertFeed>(
    `/api/alerts${since ? `?since=${encodeURIComponent(since)}` : ''}`);
}

// ─── Guest messaging ─────────────────────────────────────────

export interface InboxThread {
  reservationId: string; confirmation: string; guest: string;
  reservationStatus: string; arrival: string; departure: string;
  room: string | null; roomType: string;
  channelCode: string | null; otaReference: string | null;
  canReplyViaChannel: boolean;
  total: number; unread: number; failed: number;
  lastAt: string; lastBody: string; lastDirection: 'in' | 'out'; lastStatus: string;
  inHouse: boolean; arrivingToday: boolean;
}

export interface ThreadMessage {
  id: string; direction: 'in' | 'out'; body: string; status: string;
  channel: string; channelCode: string | null; externalId: string | null;
  author: string | null; ts: string; readAt: string | null;
  acceptedAt: string | null; error: string | null; attempts: number;
}

export interface MessagingChannel {
  code: string; name: string; connected: boolean; carriesMessages: boolean;
}

export function useInbox(filters: Record<string, string> = {}) {
  return useQuery({
    queryKey: ['inbox', filters],
    queryFn: () => api.get<{
      threads: InboxThread[]; unread: number; channels: MessagingChannel[];
    }>(`/api/inbox?${new URLSearchParams(filters)}`),
  });
}

export function useThread(reservationId: string | null) {
  return useQuery({
    queryKey: ['thread', reservationId],
    enabled: !!reservationId,
    queryFn: () => api.get<{ messages: ThreadMessage[] }>(`/api/inbox/${reservationId}`),
  });
}

/** Drives the badge in the app shell, so a guest message is not missed. */
export function useUnreadMessages() {
  return useQuery({
    queryKey: ['inbox-unread'],
    queryFn: () => api.get<{ unread: number }>('/api/inbox/unread'),
    refetchInterval: 60_000,
  });
}

export interface MessageTemplate {
  id: string; code: string; name: string; body: string;
  sortOrder: number; active: boolean;
}

export function useMessageTemplates() {
  return useQuery({
    queryKey: ['message-templates'],
    queryFn: () => api.get<{ templates: MessageTemplate[]; mergeFields: string[] }>(
      '/api/message-templates'),
  });
}

const INBOX_KEYS = ['inbox', 'thread', 'inbox-unread', 'messages'];

export const useSendGuestMessage = mutation<{ reservationId: string; body: string }>(
  (body) => api.post('/api/messages', body), INBOX_KEYS);

export const useRetryMessage = mutation<{ id: string }>(
  ({ id }) => api.post(`/api/messages/${id}/send`, {}), INBOX_KEYS);

export const useMarkThreadRead = mutation<{ reservationId: string }>(
  ({ reservationId }) => api.post(`/api/inbox/${reservationId}/read`, {}), INBOX_KEYS);

export const usePollMessages = mutation<void>(
  () => api.post('/api/inbox/poll', {}), INBOX_KEYS);

export const useUpsertMessageTemplate = mutation<{ id?: string; body: Record<string, unknown> }>(
  ({ id, body }) => (id
    ? api.patch(`/api/message-templates/${id}`, body)
    : api.post('/api/message-templates', body)),
  ['message-templates']);

export const useDeleteMessageTemplate = mutation<{ id: string }>(
  ({ id }) => api.delete(`/api/message-templates/${id}`), ['message-templates']);

// ─── Telling the channel what happened ───────────────────────

export interface ChannelReportState {
  kind: string; label: string;
  status: 'not-reported' | 'reported' | 'failed';
  reportedAt: string | null; error: string | null; attempts: number;
  request: unknown; response: unknown;
  windowClosesOn: string; daysLeft: number; windowPassed: boolean;
  unconfirmed: boolean;
  kinds: Array<{ kind: string; label: string; windowDays: number }>;
}

export interface ChannelReportEligibility {
  reportable: boolean; reason?: string;
  channelId?: string; channelName?: string; channelCode?: string;
  otaReference?: string; daysLeft?: number; windowDays?: number;
  windowClosesOn?: string; windowPassed?: boolean; unconfirmed: boolean;
}

export interface PendingChannelReport {
  id: string; confirmation: string; guest: string; arrival: string;
  channelCode: string; channelName: string; channelConnected: boolean;
  otaReference: string; noShowAt: string | null;
  status: string; error: string | null; attempts: number;
  windowClosesOn: string; daysLeft: number; windowPassed: boolean;
}

export function useChannelReport(reservationId: string | null) {
  return useQuery({
    queryKey: ['channel-report', reservationId],
    enabled: !!reservationId,
    queryFn: () => api.get<ChannelReportState>(`/api/reservations/${reservationId}/channel-report`),
  });
}

export function useChannelReportEligibility(reservationId: string | null, kind: string) {
  return useQuery({
    queryKey: ['channel-report-eligibility', reservationId, kind],
    enabled: !!reservationId,
    staleTime: 0,
    queryFn: () => api.get<ChannelReportEligibility>(
      `/api/reservations/${reservationId}/channel-report/eligibility?kind=${kind}`),
  });
}

export function usePendingChannelReports() {
  return useQuery({
    queryKey: ['channel-reports-pending'],
    queryFn: () => api.get<PendingChannelReport[]>('/api/channel-reports/pending'),
  });
}

export const useReportToChannel = mutation<{ id: string; kind: string }>(
  ({ id, kind }) => api.post(`/api/reservations/${id}/channel-report`, { kind }),
  ['channel-report', 'channel-report-eligibility', 'channel-reports-pending',
    'reservation', 'reservations', 'channels', 'sync-log'],
);

// ─── Price planning ──────────────────────────────────────────

export interface PlannedCell {
  roomTypeId: string; roomType: string;
  ratePlanId: string; ratePlan: string;
  date: string; fromMinor: number; toMinor: number; inherited: boolean;
}

export interface ChangePlan {
  cellCount: number; changedCount: number; unchangedCount: number;
  dates: number; roomTypes: number; ratePlans: number;
  minFrom: number | null; maxFrom: number | null;
  minTo: number | null; maxTo: number | null;
  averageFromMinor: number; averageToMinor: number;
  biggestMovers: PlannedCell[];
  sample: PlannedCell[];
  warnings: string[];
}

/** A preview is a POST because the change it describes is a whole object. */
export function useRatePreview(body: Record<string, unknown> | null) {
  return useQuery({
    queryKey: ['rate-preview', body],
    enabled: !!body,
    staleTime: 0,
    queryFn: () => api.post<ChangePlan>('/api/rates/preview', body!),
  });
}

export function useCopyPreview(body: Record<string, unknown> | null) {
  return useQuery({
    queryKey: ['rate-copy-preview', body],
    enabled: !!body,
    staleTime: 0,
    queryFn: () => api.post<ChangePlan>('/api/rates/copy/preview', body!),
  });
}

export interface Season {
  id: string; name: string; colour: string | null;
  from: string; to: string; nights: number; priority: number;
  note: string | null; active: boolean; createdBy: string | null; createdAt: string;
}

export function useSeasons() {
  return useQuery({ queryKey: ['seasons'], queryFn: () => api.get<Season[]>('/api/seasons') });
}

export interface ScheduledRateChange {
  id: string; name: string; effectiveDate: string;
  status: 'scheduled' | 'applied' | 'cancelled' | 'failed';
  cellsChanged: number | null; error: string | null;
  createdBy: string | null; createdAt: string;
  appliedAt: string | null; cancelledAt: string | null;
  due: boolean;
  change: {
    from: string; to: string;
    priceMinor?: number; adjustPercentBp?: number; adjustMinor?: number;
    daysOfWeek?: string[]; reason?: string;
  };
}

export function useScheduledRateChanges() {
  return useQuery({
    queryKey: ['rate-scheduled'],
    queryFn: () => api.get<ScheduledRateChange[]>('/api/rates/scheduled'),
  });
}

export interface RateHistoryEntry {
  id: string; date: string;
  roomTypeId: string; roomType: string;
  ratePlanId: string; ratePlan: string;
  fromMinor: number | null; toMinor: number; deltaMinor: number | null;
  source: string; reason: string | null;
  changedBy: string | null; changedAt: string;
}

export function useRateHistory(filters: Record<string, string> = {}) {
  return useQuery({
    queryKey: ['rate-history', filters],
    queryFn: () => api.get<RateHistoryEntry[]>(`/api/rates/history?${new URLSearchParams(filters)}`),
  });
}

// A price change moves what every rate-facing screen shows.
const RATE_KEYS = ['rate-calendar', 'ari', 'rate-preview', 'rate-copy-preview',
  'rate-history', 'rate-scheduled', 'seasons', 'channels'];

export const useCopyRates = mutation<Record<string, unknown>>(
  (body) => api.post('/api/rates/copy', body), RATE_KEYS);

export const useUpsertSeason = mutation<{ id?: string; body: Record<string, unknown> }>(
  ({ id, body }) => (id ? api.patch(`/api/seasons/${id}`, body) : api.post('/api/seasons', body)),
  ['seasons', 'rate-calendar']);

export const useDeleteSeason = mutation<{ id: string }>(
  ({ id }) => api.delete(`/api/seasons/${id}`), ['seasons', 'rate-calendar']);

export const useScheduleRateChange = mutation<Record<string, unknown>>(
  (body) => api.post('/api/rates/scheduled', body), ['rate-scheduled']);

export const useCancelScheduledRateChange = mutation<{ id: string }>(
  ({ id }) => api.delete(`/api/rates/scheduled/${id}`), ['rate-scheduled']);

export const useRunDueRateChanges = mutation<void>(
  () => api.post('/api/rates/scheduled/run', {}), RATE_KEYS);

export interface StayChangePreview {
  ok: boolean;
  kind: 'extend' | 'shorten' | 'move' | 'none';
  current: { arrival: string; departure: string; nights: number; totalMinor: number };
  proposed: { arrival: string; departure: string; nights: number; totalMinor: number };
  addedNights: Array<{ date: string; rateMinor: number }>;
  removedNights: Array<{ date: string; rateMinor: number; posted: boolean }>;
  keptNights: number;
  deltaMinor: number;
  currency: string;
  roomKept: boolean;
  roomNumber: string | null;
  alternativeRooms: Array<{ id: string; number: string; floor: number | null; status: string }>;
  blockers: string[];
  violations: Array<{ type: string; date: string; message: string }>;
}

/**
 * What a date change would do, without doing it.
 *
 * Enabled only once a date is chosen, and kept out of the cache for long — the
 * answer depends on what every other booking is doing, so a stale preview is a
 * quote for a room somebody else has since taken.
 */
export function useStayPreview(
  reservationId: string | null, arrival?: string, departure?: string,
) {
  return useQuery({
    queryKey: ['stay-preview', reservationId, arrival, departure],
    enabled: !!reservationId && (!!arrival || !!departure),
    staleTime: 0,
    queryFn: () => {
      const p = new URLSearchParams();
      if (arrival) p.set('arrival', arrival);
      if (departure) p.set('departure', departure);
      return api.get<StayChangePreview>(`/api/reservations/${reservationId}/stay-preview?${p}`);
    },
  });
}

export const useChangeStayDates = mutation<{ id: string; body: Record<string, unknown> }>(
  ({ id, body }) => api.post(`/api/reservations/${id}/stay-dates`, body),
  ['reservations', 'reservation', 'front-desk', 'availability', 'rate-calendar',
    'dashboard', 'tape-chart', 'stay-preview'],
);

export interface Closeout {
  id: string; from: string; to: string; nights: number;
  roomTypeId: string | null; ratePlanId: string | null; channelCode: string | null;
  scope: string; reason: string | null; createdBy: string | null; createdAt: string;
  expired: boolean; active: boolean; upcoming: boolean;
}

export function useCloseouts(includeExpired = false) {
  return useQuery({
    queryKey: [...keys.closeouts, includeExpired],
    queryFn: () => api.get<{
      closeouts: Closeout[]; expiredCount: number;
      pendingPushes: number; failedPushes: number;
    }>(`/api/closeouts${includeExpired ? '?includeExpired=1' : ''}`),
  });
}

export function useYieldRules() {
  return useQuery({ queryKey: keys.yieldRules, queryFn: () => api.get<YieldRule[]>('/api/yield-rules') });
}
export function usePromotions() {
  return useQuery({ queryKey: keys.promotions, queryFn: () => api.get<Promotion[]>('/api/promotions') });
}
export function useTaxes() {
  return useQuery({ queryKey: keys.taxes, queryFn: () => api.get<Tax[]>('/api/taxes'), staleTime: 5 * 60 * 1000 });
}
export function useTransactionCodes() {
  return useQuery({
    queryKey: keys.transactionCodes,
    queryFn: () => api.get<TransactionCode[]>('/api/transaction-codes'),
    staleTime: 5 * 60 * 1000,
  });
}
export function usePolicies() {
  return useQuery({ queryKey: keys.policies, queryFn: () => api.get<Policy[]>('/api/policies') });
}

export function useQuote() {
  return useMutation<QuoteResponse, ApiError, Record<string, unknown>>({
    mutationFn: (body) => api.post<QuoteResponse>('/api/rates/quote', body),
  });
}

// ─── Reservations ────────────────────────────────────────────
export function useReservations(filters: Record<string, string | number | undefined> = {}, enabled = true) {
  return useQuery({
    queryKey: keys.reservations(filters),
    queryFn: () => api.get<Reservation[]>(`/api/reservations${qs(filters)}`),
    enabled,
  });
}
export function useReservation(id?: string) {
  return useQuery({
    queryKey: keys.reservation(id),
    queryFn: () => api.get<ReservationDetail>(`/api/reservations/${id}`),
    enabled: !!id,
  });
}
/**
 * The party behind a pending website booking, and the rooms or beds still free.
 *
 * Not cached: it is read as the confirm dialog opens, and a bed list that is
 * thirty seconds stale is a bed list that offers one somebody else just took.
 */
export function useBookingConfirmation(id?: string, enabled = true) {
  return useQuery({
    queryKey: ['booking-confirmation', id ?? ''] as const,
    queryFn: () => api.get<BookingConfirmation>(`/api/reservations/${id}/confirmation`),
    enabled: !!id && enabled,
    staleTime: 0,
    gcTime: 0,
  });
}
/**
 * The state of the QR handed to the guest, polled while it is live.
 *
 * Polling rather than pushing because the desk is watching for one event —
 * "they have sent it" — and a five-second poll on one reservation is cheaper to
 * reason about than a socket that has to survive the receptionist's wifi.
 */
export function useRegistrationLink(reservationId?: string, enabled = true) {
  return useQuery({
    queryKey: ['registration-link', reservationId ?? ''] as const,
    queryFn: () => api.get<RegistrationLink>(`/api/reservations/${reservationId}/registration-link`),
    enabled: !!reservationId && enabled,
    staleTime: 0,
    refetchInterval: (q) => {
      const d = q.state.data as RegistrationLink | undefined;
      // Stop once there is something to look at, or once the link is spent.
      if (!d?.exists || !d.live || d.submitted) return false;
      return 5000;
    },
  });
}

const REGISTRATION_KEYS = ['registration-link', 'reservation', 'documents', 'front-desk'];

export const useCreateRegistrationLink = mutation<{ id: string }>(
  ({ id }) => api.post(`/api/reservations/${id}/registration-link`), REGISTRATION_KEYS);

export const useRevokeRegistrationLink = mutation<{ id: string }>(
  ({ id }) => api.delete(`/api/reservations/${id}/registration-link`), REGISTRATION_KEYS);

export const useAcceptRegistration = mutation<{ id: string }>(
  ({ id }) => api.post(`/api/reservations/${id}/registration-link/accept`),
  [...REGISTRATION_KEYS, 'profile', 'profiles']);

export const useDiscardRegistration = mutation<{ id: string }>(
  ({ id }) => api.post(`/api/reservations/${id}/registration-link/discard`), REGISTRATION_KEYS);

export function useFrontDesk(date?: string) {
  return useQuery({
    queryKey: keys.frontDesk(date),
    queryFn: () => api.get<FrontDeskLists>(`/api/front-desk${qs({ date })}`),
    staleTime: 10_000,
  });
}
export function useGroups() {
  return useQuery({ queryKey: keys.groups, queryFn: () => api.get<Group[]>('/api/groups') });
}
export function useGroup(id?: string) {
  return useQuery({
    queryKey: keys.group(id),
    queryFn: () => api.get<any>(`/api/groups/${id}`),
    enabled: !!id,
  });
}
export function useWaitlist() {
  return useQuery({ queryKey: keys.waitlist, queryFn: () => api.get<any[]>('/api/waitlist') });
}

// ─── Folios ──────────────────────────────────────────────────
export function useFolios(status?: string) {
  return useQuery({
    queryKey: keys.folios(status),
    queryFn: () => api.get<FolioSummary[]>(`/api/folios${qs({ status })}`),
  });
}
export function useFolio(id?: string) {
  return useQuery({
    queryKey: keys.folio(id),
    queryFn: () => api.get<Folio>(`/api/folios/${id}`),
    enabled: !!id,
  });
}
export function useReservationFolios(reservationId?: string) {
  return useQuery({
    queryKey: keys.reservationFolios(reservationId),
    queryFn: () => api.get<FolioSummary[]>(`/api/reservations/${reservationId}/folios`),
    enabled: !!reservationId,
  });
}
export function useInvoices() {
  return useQuery({ queryKey: keys.invoices, queryFn: () => api.get<Invoice[]>('/api/invoices') });
}

/**
 * The printable document behind one invoice.
 *
 * Fetched only when an invoice is actually opened: it carries every folio line
 * and the property's logo, which is far more than the list needs and would be
 * wasteful to hold for three hundred rows.
 */
export function useInvoiceDocument(invoiceId: string | null | undefined) {
  return useQuery({
    queryKey: ['invoice-document', invoiceId] as const,
    queryFn: () => api.get<InvoiceDocument>(`/api/invoices/${invoiceId}/document`),
    enabled: !!invoiceId,
  });
}

export function useInvoiceBranding() {
  return useQuery({
    queryKey: ['invoice-branding'] as const,
    queryFn: () => api.get<InvoiceBranding>('/api/config/invoice-branding'),
  });
}
export function useCompanies() {
  return useQuery({ queryKey: keys.companies, queryFn: () => api.get<Company[]>('/api/companies') });
}
export function useArAccounts() {
  return useQuery({ queryKey: keys.ar, queryFn: () => api.get<ArAccount[]>('/api/ar') });
}
export function useArAccount(companyId?: string) {
  return useQuery({
    queryKey: keys.arAccount(companyId),
    queryFn: () => api.get<any>(`/api/ar/${companyId}`),
    enabled: !!companyId,
  });
}
export function useCashierShift() {
  return useQuery({ queryKey: keys.shift, queryFn: () => api.get<CashierShift>('/api/cashier/shift') });
}
export function useOutstanding() {
  return useQuery({ queryKey: keys.outstanding, queryFn: () => api.get<any[]>('/api/reports/outstanding') });
}

// ─── Housekeeping ────────────────────────────────────────────
export function useHkBoard(date?: string) {
  return useQuery({
    queryKey: keys.hkBoard(date),
    queryFn: () => api.get<{ date: string; statuses: string[]; rooms: BoardRoom[] }>(
      `/api/housekeeping/board${qs({ date })}`),
    staleTime: 10_000,
  });
}
export function useHkTasks(date?: string, filters: Record<string, string | undefined> = {}) {
  return useQuery({
    queryKey: [...keys.hkTasks(date), filters],
    queryFn: () => api.get<HkTask[]>(`/api/housekeeping/tasks${qs({ date, ...filters })}`),
  });
}
export function useHkForecast(date?: string) {
  return useQuery({
    queryKey: keys.hkForecast(date),
    queryFn: () => api.get<any>(`/api/housekeeping/forecast${qs({ date })}`),
  });
}
export function useWorkOrders(status?: string) {
  return useQuery({
    queryKey: keys.workOrders(status),
    queryFn: () => api.get<WorkOrder[]>(`/api/work-orders${qs({ status })}`),
  });
}
export function useLostFound() {
  return useQuery({ queryKey: keys.lostFound, queryFn: () => api.get<LostFoundItem[]>('/api/lost-found') });
}

// ─── Night audit ─────────────────────────────────────────────
export function useAuditPreflight() {
  return useQuery({
    queryKey: keys.auditPreflight,
    queryFn: () => api.get<AuditPreflight>('/api/night-audit/preflight'),
    staleTime: 5_000,
  });
}
export function useAuditHistory() {
  return useQuery({ queryKey: keys.auditHistory, queryFn: () => api.get<any[]>('/api/night-audit/history') });
}
export function useAuditReport(date?: string) {
  return useQuery({
    queryKey: keys.auditReport(date),
    queryFn: () => api.get<any>(`/api/night-audit/report${qs({ date })}`),
  });
}

// ─── CRM ─────────────────────────────────────────────────────
export function useProfiles(search?: string) {
  return useQuery({
    queryKey: keys.profiles(search),
    queryFn: () => api.get<Profile[]>(`/api/profiles${qs({ search })}`),
  });
}
export function useProfile(id?: string) {
  return useQuery({
    queryKey: keys.profile(id),
    queryFn: () => api.get<ProfileDetail>(`/api/profiles/${id}`),
    enabled: !!id,
  });
}
export function useProfileDuplicates(id?: string) {
  return useQuery({
    queryKey: ['profile-duplicates', id ?? ''],
    queryFn: () => api.get<Profile[]>(`/api/profiles/${id}/duplicates`),
    enabled: !!id,
  });
}
export function useMessages(reservationId?: string) {
  return useQuery({
    queryKey: keys.messages(reservationId),
    queryFn: () => api.get<any[]>(`/api/messages${qs({ reservationId })}`),
    enabled: !!reservationId,
  });
}

// ─── Reporting ───────────────────────────────────────────────
export function useDashboard() {
  return useQuery({
    queryKey: keys.dashboard,
    queryFn: () => api.get<DashboardSnapshot>('/api/dashboard'),
    staleTime: 15_000,
  });
}
export function useKpis(from: string, to: string) {
  return useQuery({
    queryKey: keys.kpis(from, to),
    queryFn: () => api.get<KpiSummary>(`/api/reports/kpis${qs({ from, to })}`),
    enabled: !!from && !!to,
  });
}
export function useProduction(from: string, to: string, dimension: string) {
  return useQuery({
    queryKey: keys.production(from, to, dimension),
    queryFn: () => api.get<{ rows: ProductionRow[] }>(
      `/api/reports/production${qs({ from, to, dimension })}`),
    enabled: !!from && !!to,
  });
}
export function usePace(from: string, to: string) {
  return useQuery({
    queryKey: keys.pace(from, to),
    queryFn: () => api.get<any>(`/api/reports/pace${qs({ from, to })}`),
    enabled: !!from && !!to,
  });
}
export function usePickup(from: string, to: string) {
  return useQuery({
    queryKey: keys.pickup(from, to),
    queryFn: () => api.get<any>(`/api/reports/pickup${qs({ from, to })}`),
    enabled: !!from && !!to,
  });
}
export function useRevenueBreakdown(from: string, to: string) {
  return useQuery({
    queryKey: keys.revenue(from, to),
    queryFn: () => api.get<any>(`/api/reports/revenue${qs({ from, to })}`),
    enabled: !!from && !!to,
  });
}
export function useDailyStats(from: string, to: string) {
  return useQuery({
    queryKey: keys.dailyStats(from, to),
    queryFn: () => api.get<DailyStats[]>(`/api/reports/daily-stats${qs({ from, to })}`),
    enabled: !!from && !!to,
  });
}
export function useOccupancyForecast(from: string, to: string) {
  return useQuery({
    queryKey: keys.occupancyForecast(from, to),
    queryFn: () => api.get<any>(`/api/reports/occupancy-forecast${qs({ from, to })}`),
    enabled: !!from && !!to,
  });
}

// ─── Channel manager ─────────────────────────────────────────
export function useChannels() {
  return useQuery({ queryKey: keys.channels, queryFn: () => api.get<Channel[]>('/api/channels') });
}
export function useChannelHealth() {
  return useQuery({ queryKey: keys.channelHealth, queryFn: () => api.get<ChannelHealth[]>('/api/channels/health') });
}
export function useChannelCatalogue() {
  return useQuery({
    queryKey: keys.channelCatalogue,
    queryFn: () => api.get<{ code: string; name: string; kind: string }[]>('/api/channels/catalogue'),
    staleTime: Infinity,
  });
}
export function useChannelMappings(channelId?: string) {
  return useQuery({
    queryKey: keys.mappings(channelId),
    queryFn: () => api.get<ChannelMapping[]>(`/api/channel-mappings${qs({ channelId })}`),
  });
}
export function useSyncLog(channelId?: string, limit = 100) {
  return useQuery({
    queryKey: [...keys.syncLog(channelId), limit],
    queryFn: () => api.get<SyncLogEntry[]>(`/api/channels/sync-log${qs({ channelId, limit })}`),
  });
}
export function useAri(from: string, to: string, roomTypeId?: string, ratePlanId?: string, channelCode?: string) {
  return useQuery({
    queryKey: keys.ari(from, to, roomTypeId, ratePlanId, channelCode),
    queryFn: () => api.get<{ cells: AriCell[] }>(
      `/api/channels/ari${qs({ from, to, roomTypeId, ratePlanId, channelCode })}`),
    enabled: !!from && !!to,
  });
}
export function useConflicts(status = 'open') {
  return useQuery({
    queryKey: [...keys.conflicts, status],
    queryFn: () => api.get<ChannelConflict[]>(`/api/channels/conflicts${qs({ status })}`),
  });
}
export function useChannelQueue() {
  return useQuery({ queryKey: keys.channelQueue, queryFn: () => api.get<any[]>('/api/channels/queue') });
}
export function useChannelContent(channelId?: string) {
  return useQuery({
    queryKey: keys.channelContent(channelId),
    queryFn: () => api.get<any[]>(`/api/channels/${channelId}/content`),
    enabled: !!channelId,
  });
}
export function useDiscoveredUnits(channelId?: string, enabled = false) {
  return useQuery({
    queryKey: keys.discover(channelId),
    queryFn: () => api.get<DiscoveredUnit[]>(`/api/channels/${channelId}/discover`),
    enabled: enabled && !!channelId,
    retry: false,
  });
}

// ─── Operations ──────────────────────────────────────────────

export interface NotificationFeed {
  notifications: Notification[];
  unread: number;
  sources: Array<{ source: string; n: number; unread: number }>;
  now: string;
}

/**
 * The notification feed.
 *
 * Polled every 15 seconds rather than every 60. A booking that landed four
 * minutes ago is not "live", and the bell is the one thing in the shell whose
 * whole job is to be current — the payload is small and the query is indexed,
 * so the cost of asking often is low.
 */
export function useNotifications(filters: { source?: string; unreadOnly?: boolean } = {}) {
  const params = qs({
    source: filters.source,
    unread: filters.unreadOnly ? '1' : undefined,
  });
  return useQuery({
    queryKey: [...keys.notifications, filters.source ?? '', filters.unreadOnly ?? false],
    queryFn: () => api.get<NotificationFeed>(`/api/notifications${params}`),
    refetchInterval: 15_000,
    // Keeps the bell counting while the tab is in the background, which is
    // where a front-desk browser spends most of its day.
    refetchIntervalInBackground: true,
  });
}
export function useTasks(status = 'open') {
  return useQuery({
    queryKey: [...keys.tasks, status],
    queryFn: () => api.get<TaskItem[]>(`/api/tasks${qs({ status })}`),
  });
}
export function useAuditLog(filters: Record<string, string | number | undefined> = {}) {
  return useQuery({
    queryKey: keys.auditLog(filters),
    queryFn: () => api.get<AuditEntry[]>(`/api/audit-log${qs(filters)}`),
  });
}
export function useSearch(query: string) {
  return useQuery({
    queryKey: keys.search(query),
    queryFn: () => api.get<{ query: string; results: SearchResult[] }>(`/api/search${qs({ q: query })}`),
    enabled: query.trim().length >= 2,
    staleTime: 30_000,
  });
}
export function useUsers() {
  return useQuery({ queryKey: keys.users, queryFn: () => api.get<StaffUser[]>('/api/users') });
}
export function useRoles() {
  return useQuery({
    queryKey: keys.roles,
    queryFn: () => api.get<{ value: string; label: string; permissions: string[] }[]>('/api/roles'),
    staleTime: Infinity,
  });
}
export function useSessions() {
  return useQuery({ queryKey: keys.sessions, queryFn: () => api.get<any[]>('/api/sessions') });
}

// ─── Security ────────────────────────────────────────────────
export function useMfaStatus() {
  return useQuery({
    queryKey: ['mfa-status'],
    queryFn: () => api.get<{ enabled: boolean; enrolledAt: string | null; recoveryCodesRemaining: number }>(
      '/api/auth/mfa'),
  });
}

export function useLoginActivity(scope?: 'all') {
  return useQuery({
    queryKey: ['login-activity', scope ?? 'mine'],
    queryFn: () => api.get<any[]>(`/api/auth/activity${qs({ scope })}`),
  });
}

// ─── Booking page ────────────────────────────────────
export interface BookingLink {
  enabled: boolean;
  url: string;
  tagline: string;
  intro: string;
  property: { code: string; name: string; currency: string };
  readiness: {
    ready: boolean;
    roomTypes: number;
    sellableUnits: number;
    pricedDaysAhead: number;
    blocking: string[];
  };
}

export function useBookingLink() {
  return useQuery({
    queryKey: ['booking-link'],
    queryFn: () => api.get<BookingLink>('/api/booking-engine/link'),
  });
}

export interface BookingMoney {
  deposit: {
    mode: 'none' | 'percent' | 'first_night' | 'full';
    percentBp: number; message: string; methods: string[];
  };
  holdHours: number;
  limits: { minHoldHours: number; maxHoldHours: number };
  currency: string;
  activeHolds: {
    id: string; confirmation: string; guestName: string; email: string | null;
    arrival: string; departure: string; totalMinor: number;
    expiresAt: string; minutesLeft: number;
  }[];
}

export function useBookingMoney() {
  return useQuery({
    queryKey: ['booking-money'],
    queryFn: () => api.get<BookingMoney>('/api/booking-engine/money'),
    // The hold countdown is only meaningful if it moves.
    refetchInterval: 60_000,
  });
}

export const useUpdateBookingMoney = mutation<Record<string, unknown>>(
  (body) => api.patch('/api/booking-engine/money', body), ['booking-money', 'booking-link']);

/** Add-ons the property's own website sells beside the room, with their prices. */
export interface WebsiteAddon {
  id: string;
  group: 'surf' | 'skate' | 'yoga' | 'coworking';
  name: string;
  unit: string;
  priceMinor: number;
}

export function useWebsiteAddons() {
  return useQuery({
    queryKey: ['website-addons'],
    queryFn: () => api.get<{ currency: string; addons: WebsiteAddon[] }>('/api/booking-engine/website-addons'),
  });
}

export const useUpdateWebsiteAddons = mutation<{ prices: Record<string, number> }>(
  (body) => api.patch('/api/booking-engine/website-addons', body), ['website-addons']);

export const useUpdateBookingLink = mutation<
  { enabled?: boolean; tagline?: string; intro?: string }
>((body) => api.patch('/api/booking-engine/link', body), ['booking-link']);

// ─── Backups ─────────────────────────────────────────────────
export function useBackups() {
  return useQuery({
    queryKey: ['backups'],
    queryFn: () => api.get<{ status: any; backups: any[]; orphanedFiles: string[] }>('/api/system/backups'),
    refetchInterval: 60_000,
  });
}

export const useRunBackup = mutation<void>(
  () => api.post('/api/system/backups'), ['backups']);

export const useVerifyBackup = mutation<{ id: string }>(
  ({ id }) => api.post(`/api/system/backups/${id}/verify`), ['backups']);

export const useDeleteBackup = mutation<{ id: string }>(
  ({ id }) => api.delete(`/api/system/backups/${id}`), ['backups']);

export function useDatabaseHealth() {
  return useQuery({
    queryKey: ['database-health'],
    queryFn: () => api.get<{ health: any; checks: any[] }>('/api/system/database'),
    refetchInterval: 60_000,
  });
}

export const useIntegrityCheck = mutation<void>(
  () => api.post('/api/system/database/check'), ['database-health']);

export const useMaintenance = mutation<{ action: string }>(
  ({ action }) => api.post('/api/system/database/maintenance', { action }), ['database-health']);

export function useResetRequests(enabled = true) {
  return useQuery({
    queryKey: ['reset-requests'],
    queryFn: () => api.get<any[]>('/api/auth/reset-requests'),
    enabled,
  });
}

// ═════════════════════════════════════════════════════════════
// Mutations
// ═════════════════════════════════════════════════════════════

function mutation<TVars, TData = any>(
  fn: (vars: TVars) => Promise<TData>,
  invalidate: string[],
) {
  return function useIt() {
    const inv = useInvalidate();
    return useMutation<TData, ApiError, TVars>({
      mutationFn: fn,
      onSuccess: () => inv(invalidate),
    });
  };
}

// Reservations & front desk
export const useCreateReservation = mutation<Record<string, unknown>>(
  (body) => api.post('/api/reservations', body), OPERATIONAL);

export const useUpdateReservation = mutation<{ id: string; body: Record<string, unknown> }>(
  ({ id, body }) => api.patch(`/api/reservations/${id}`, body), OPERATIONAL);

export const useCancelReservation = mutation<{ id: string; reason: string; chargeMinor?: number }>(
  ({ id, ...body }) => api.post(`/api/reservations/${id}/cancel`, body), [...OPERATIONAL, ...FINANCIAL]);

export const useCheckIn = mutation<{ id: string; body?: Record<string, unknown> }>(
  ({ id, body }) => api.post(`/api/reservations/${id}/check-in`, body ?? {}), [...OPERATIONAL, ...FINANCIAL]);

export const useCheckOut = mutation<{ id: string; body?: Record<string, unknown> }>(
  ({ id, body }) => api.post(`/api/reservations/${id}/check-out`, body ?? {}), [...OPERATIONAL, ...FINANCIAL]);

export const useAssignRoom = mutation<{ id: string; body: Record<string, unknown> }>(
  ({ id, body }) => api.post(`/api/reservations/${id}/assign-room`, body), OPERATIONAL);

/**
 * Accept a website booking and commit its room or beds.
 *
 * Invalidates the financial keys as well as the operational ones: confirming
 * is the moment the stay starts consuming inventory, so the forecast, the
 * tape chart and the availability grid all move with it.
 */
export const useConfirmBooking = mutation<{
  id: string;
  assignments?: { reservationId: string; roomId?: string | null; bedId?: string | null }[];
  auto?: boolean;
}>(({ id, ...body }) => api.post(`/api/reservations/${id}/confirm`, body),
  [...OPERATIONAL, ...FINANCIAL]);

export const useMoveRoom = mutation<{ id: string; body: Record<string, unknown> }>(
  ({ id, body }) => api.post(`/api/reservations/${id}/move-room`, body), OPERATIONAL);

export const useMarkNoShow = mutation<{ id: string; chargeMinor?: number }>(
  ({ id, ...body }) => api.post(`/api/reservations/${id}/no-show`, body), [...OPERATIONAL, ...FINANCIAL]);

export const useWalkIn = mutation<Record<string, unknown>>(
  (body) => api.post('/api/walk-in', body), [...OPERATIONAL, ...FINANCIAL]);

export const useAddNote = mutation<{ id: string; body: string; category?: string }>(
  ({ id, ...rest }) => api.post(`/api/reservations/${id}/notes`, rest), ['reservation']);

export interface ReservationDocument {
  id: string;
  reservationId: string;
  kind: 'identity' | 'signature';
  label: string | null;
  guestName: string | null;
  mime: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy: string | null;
}

/** Metadata only — the images are fetched one at a time, and audited. */
export function useDocuments(reservationId?: string) {
  return useQuery({
    queryKey: keys.documents(reservationId),
    queryFn: () => api.get<ReservationDocument[]>(`/api/reservations/${reservationId}/documents`),
    enabled: !!reservationId,
  });
}

/** One document, seen from the guest rather than from a single booking. */
export interface ProfileDocument extends ReservationDocument {
  confirmation: string;
  arrival: string;
  departure: string;
  reservationStatus: string;
  /** The day the retention sweep will delete it. */
  deletesOn: string;
}

/**
 * The registration documents across a guest's stays.
 *
 * A view, not an archive: these belong to the bookings and disappear as the
 * retention sweep runs, which is why the screen shows the date each one goes.
 */
export function useProfileDocuments(profileId?: string) {
  return useQuery({
    queryKey: ['profile-documents', profileId ?? ''] as const,
    queryFn: () => api.get<{ documents: ProfileDocument[]; retentionDays: number }>(
      `/api/profiles/${profileId}/documents`),
    enabled: !!profileId,
  });
}

/**
 * Fetch one document's image. Deliberately not a hook that runs on render:
 * every read is written to the audit trail, so it happens when somebody asks
 * to see the document and not when a screen mounts.
 */
export function fetchDocument(documentId: string) {
  return api.get<{ mime: string; dataBase64: string; kind: string; label: string | null }>(
    `/api/documents/${documentId}`);
}

export const useUploadDocument = mutation<{
  reservationId: string;
  kind: 'identity' | 'signature';
  mime: string;
  data: string;
  label?: string;
  guestName?: string;
}>(({ reservationId, ...body }) =>
  api.post(`/api/reservations/${reservationId}/documents`, body), ['documents', 'reservation']);

export const useDeleteDocument = mutation<{ documentId: string }>(
  ({ documentId }) => api.delete(`/api/documents/${documentId}`), ['documents', 'reservation']);

export const useAddGuest = mutation<{ id: string; body: Record<string, unknown> }>(
  ({ id, body }) => api.post(`/api/reservations/${id}/guests`, body), ['reservation']);

// Groups
export const useCreateGroup = mutation<Record<string, unknown>>(
  (body) => api.post('/api/groups', body), ['groups', ...OPERATIONAL]);
export const useSetGroupBlock = mutation<{ id: string; body: Record<string, unknown> }>(
  ({ id, body }) => api.post(`/api/groups/${id}/blocks`, body), ['groups', 'group', ...OPERATIONAL]);
export const useRoomingList = mutation<{ id: string; rows: any[] }>(
  ({ id, rows }) => api.post(`/api/groups/${id}/rooming-list`, { rows }), ['groups', 'group', ...OPERATIONAL]);
export const useAddWaitlist = mutation<Record<string, unknown>>(
  (body) => api.post('/api/waitlist', body), ['waitlist']);

export const useSaveInvoiceBranding = mutation<Partial<InvoiceBranding>>(
  (body) => api.put('/api/config/invoice-branding', body),
  // Every open invoice re-renders with the new logo without a reload.
  ['invoice-branding', 'invoice-document']);

// Folios
export const usePostCharge = mutation<{ folioId: string; body: Record<string, unknown> }>(
  ({ folioId, body }) => api.post(`/api/folios/${folioId}/charges`, body), FINANCIAL);

export const usePostPayment = mutation<{ folioId: string; body: Record<string, unknown> }>(
  ({ folioId, body }) => api.post(`/api/folios/${folioId}/payments`, body), FINANCIAL);

export const useVoidLine = mutation<{ lineId: string; reason: string }>(
  ({ lineId, reason }) => api.post(`/api/folio-lines/${lineId}/void`, { reason }), FINANCIAL);

export const useTransferLine = mutation<{ lineId: string; targetFolioId: string }>(
  ({ lineId, targetFolioId }) => api.post(`/api/folio-lines/${lineId}/transfer`, { targetFolioId }), FINANCIAL);

export const useSplitFolio = mutation<{ reservationId: string; body: Record<string, unknown> }>(
  ({ reservationId, body }) => api.post(`/api/reservations/${reservationId}/folios`, body), FINANCIAL);

export const useCloseFolio = mutation<{ folioId: string; allowBalance?: boolean }>(
  ({ folioId, allowBalance }) => api.post(`/api/folios/${folioId}/close`, { allowBalance }), FINANCIAL);

export const useCreateInvoice = mutation<{ folioId: string; body: Record<string, unknown> }>(
  ({ folioId, body }) => api.post(`/api/folios/${folioId}/invoice`, body), FINANCIAL);

export const useOpenShift = mutation<{ openingFloatMinor: number }>(
  (body) => api.post('/api/cashier/shift/open', body), ['cashier-shift']);

export const useCloseShift = mutation<{ countedMinor: number; note?: string }>(
  (body) => api.post('/api/cashier/shift/close', body), ['cashier-shift']);

export const useArPayment = mutation<{ companyId: string; body: Record<string, unknown> }>(
  ({ companyId, body }) => api.post(`/api/ar/${companyId}/payment`, body), ['ar', 'invoices', 'companies']);

// Housekeeping
export const useSetRoomStatus = mutation<{ roomId: string; status: string; note?: string }>(
  ({ roomId, ...body }) => api.post(`/api/rooms/${roomId}/status`, body),
  ['hk-board', 'rooms', 'dashboard', 'front-desk']);

export const useGenerateHkTasks = mutation<{ date?: string }>(
  (body) => api.post('/api/housekeeping/tasks/generate', body), ['hk-tasks', 'hk-board']);

export const useUpdateHkTask = mutation<{ id: string; body: Record<string, unknown> }>(
  ({ id, body }) => api.patch(`/api/housekeeping/tasks/${id}`, body),
  ['hk-tasks', 'hk-board', 'rooms', 'dashboard']);

export const useBlockRoom = mutation<Record<string, unknown>>(
  (body) => api.post('/api/room-blocks', body), ['room-blocks', 'hk-board', 'rooms', ...OPERATIONAL]);

export const useReleaseBlock = mutation<{ id: string }>(
  ({ id }) => api.delete(`/api/room-blocks/${id}`), ['room-blocks', 'hk-board', 'rooms', ...OPERATIONAL]);

export const useCreateWorkOrder = mutation<Record<string, unknown>>(
  (body) => api.post('/api/work-orders', body), ['work-orders', 'hk-board', 'dashboard']);

export const useUpdateWorkOrder = mutation<{ id: string; body: Record<string, unknown> }>(
  ({ id, body }) => api.patch(`/api/work-orders/${id}`, body), ['work-orders', 'hk-board', 'dashboard']);

export const useCreateLostFound = mutation<Record<string, unknown>>(
  (body) => api.post('/api/lost-found', body), ['lost-found']);

export const useUpdateLostFound = mutation<{ id: string; body: Record<string, unknown> }>(
  ({ id, body }) => api.patch(`/api/lost-found/${id}`, body), ['lost-found']);

// Night audit
export const useRunNightAudit = mutation<{ force?: boolean; noShowChargePolicy?: string }>(
  (body) => api.post('/api/night-audit/run', body),
  [...OPERATIONAL, ...FINANCIAL, 'audit-preflight', 'audit-history', 'daily-stats', 'property']);

// Rates
export const useBulkRates = mutation<Record<string, unknown>>(
  (body) => api.post('/api/rates/bulk', body),
  ['rate-calendar', 'ari', 'channel-queue', 'availability', 'kpis']);

export const useAdjustInventory = mutation<Record<string, unknown>>(
  (body) => api.post('/api/inventory/adjust', body), ['availability', 'rate-calendar', 'ari', 'tape']);

export const useCreateRatePlan = mutation<Record<string, unknown>>(
  (body) => api.post('/api/rate-plans', body), ['rate-plans', 'rate-calendar']);

export const useUpdateRatePlan = mutation<{ id: string; body: Record<string, unknown> }>(
  ({ id, body }) => api.patch(`/api/rate-plans/${id}`, body), ['rate-plans', 'rate-calendar', 'ari']);

/**
 * Create the booking-engine package plans the property does not have yet.
 *
 * Idempotent on the server, so pressing the button twice cannot produce two
 * sets of packages.
 */
export const useEnsurePackagePlans = mutation<void>(
  () => api.post('/api/rate-plans/packages', {}), ['rate-plans', 'rate-calendar']);

export const useCreateRestriction = mutation<Record<string, unknown>>(
  (body) => api.post('/api/restrictions', body), ['restrictions', 'rate-calendar', 'ari']);

export const useUpdateRestriction = mutation<{ id: string; body: Record<string, unknown> }>(
  ({ id, body }) => api.patch(`/api/restrictions/${id}`, body), ['restrictions', 'rate-calendar', 'ari']);

export const useDeleteRestriction = mutation<{ id: string }>(
  ({ id }) => api.delete(`/api/restrictions/${id}`), ['restrictions', 'rate-calendar', 'ari']);

// Closing a date changes what every screen shows about that date — the
// calendar, the close-out list, the ARI preview and the channel queue — so all
// of them are invalidated together.
const CLOSEOUT_KEYS = ['closeouts', 'restrictions', 'rate-calendar', 'ari', 'channels'];

export const useCloseDates = mutation<Record<string, unknown>>(
  (body) => api.post('/api/closeouts/close', body), CLOSEOUT_KEYS);

export const useOpenDates = mutation<Record<string, unknown>>(
  (body) => api.post('/api/closeouts/open', body), CLOSEOUT_KEYS);

export const useReopenCloseout = mutation<{ id: string }>(
  ({ id }) => api.post(`/api/closeouts/${id}/open`, {}), CLOSEOUT_KEYS);

export const usePurgeExpiredCloseouts = mutation<void>(
  () => api.post('/api/closeouts/purge-expired', {}), CLOSEOUT_KEYS);

export const useCreateYieldRule = mutation<Record<string, unknown>>(
  (body) => api.post('/api/yield-rules', body), ['yield-rules', 'rate-calendar', 'ari']);

export const useUpdateYieldRule = mutation<{ id: string; body: Record<string, unknown> }>(
  ({ id, body }) => api.patch(`/api/yield-rules/${id}`, body), ['yield-rules', 'rate-calendar', 'ari']);

export const useDeleteYieldRule = mutation<{ id: string }>(
  ({ id }) => api.delete(`/api/yield-rules/${id}`), ['yield-rules', 'rate-calendar', 'ari']);

export const useCreatePromotion = mutation<Record<string, unknown>>(
  (body) => api.post('/api/promotions', body), ['promotions']);

export const useUpdatePromotion = mutation<{ id: string; body: Record<string, unknown> }>(
  ({ id, body }) => api.patch(`/api/promotions/${id}`, body), ['promotions']);

// Configuration
export const useUpdatePropertyConfig = mutation<Record<string, unknown>>(
  (body) => api.patch('/api/property', body), ['property', 'properties']);

export const useCreateRoomType = mutation<Record<string, unknown>>(
  (body) => api.post('/api/room-types', body), ['room-types', 'availability', 'property']);

export const useUpdateRoomType = mutation<{ id: string; body: Record<string, unknown> }>(
  ({ id, body }) => api.patch(`/api/room-types/${id}`, body), ['room-types', 'availability', 'rate-calendar']);

export const useDeleteRoomType = mutation<{ id: string }>(
  ({ id }) => api.delete(`/api/room-types/${id}`), ['room-types', 'availability']);

export const useCreateRoom = mutation<Record<string, unknown>>(
  (body) => api.post('/api/rooms', body), ['rooms', 'room-types', 'availability', 'hk-board', 'property']);

export const useBulkRooms = mutation<Record<string, unknown>>(
  (body) => api.post('/api/rooms/bulk', body), ['rooms', 'room-types', 'availability', 'hk-board', 'property']);

export const useUpdateRoom = mutation<{ id: string; body: Record<string, unknown> }>(
  ({ id, body }) => api.patch(`/api/rooms/${id}`, body), ['rooms', 'hk-board', 'availability']);

export const useDeleteRoom = mutation<{ id: string }>(
  ({ id }) => api.delete(`/api/rooms/${id}`), ['rooms', 'room-types', 'availability', 'hk-board']);

export const useCreateTax = mutation<Record<string, unknown>>(
  (body) => api.post('/api/taxes', body), ['taxes']);

export const useUpdateTax = mutation<{ id: string; body: Record<string, unknown> }>(
  ({ id, body }) => api.patch(`/api/taxes/${id}`, body), ['taxes']);

export const useDeleteTax = mutation<{ id: string }>(
  ({ id }) => api.delete(`/api/taxes/${id}`), ['taxes']);

export const useCreateTransactionCode = mutation<Record<string, unknown>>(
  (body) => api.post('/api/transaction-codes', body), ['transaction-codes']);

export const useUpdateTransactionCode = mutation<{ id: string; body: Record<string, unknown> }>(
  ({ id, body }) => api.patch(`/api/transaction-codes/${id}`, body), ['transaction-codes']);

export const useSavePolicy = mutation<Record<string, unknown>>(
  (body) => api.post('/api/policies', body), ['policies']);

export const useDeletePolicy = mutation<{ id: string }>(
  ({ id }) => api.delete(`/api/policies/${id}`), ['policies']);

export const useCreateCompany = mutation<Record<string, unknown>>(
  (body) => api.post('/api/companies', body), ['companies', 'ar']);

export const useUpdateCompany = mutation<{ id: string; body: Record<string, unknown> }>(
  ({ id, body }) => api.patch(`/api/companies/${id}`, body), ['companies', 'ar']);

export const useSaveSetting = mutation<{ key: string; value: unknown }>(
  ({ key, value }) => api.put(`/api/settings/${key}`, { value }), ['settings']);

// Channels
export const useSaveChannel = mutation<Record<string, unknown>>(
  (body) => api.post('/api/channels', body), ['channels', 'channel-health']);

export const useUpdateChannel = mutation<{ id: string; body: Record<string, unknown> }>(
  ({ id, body }) => api.patch(`/api/channels/${id}`, body), ['channels', 'channel-health']);

export const useConnectChannel = mutation<{ id: string; body: Record<string, unknown> }>(
  ({ id, body }) => api.post(`/api/channels/${id}/connect`, body),
  ['channels', 'channel-health', 'sync-log']);

export const useTestChannel = mutation<{ id: string }>(
  ({ id }) => api.post(`/api/channels/${id}/test`), ['channels', 'channel-health', 'sync-log']);

export const useDisconnectChannel = mutation<{ id: string }>(
  ({ id }) => api.post(`/api/channels/${id}/disconnect`), ['channels', 'channel-health']);

// ─── Guided channel connection ───────────────────────────────
export interface ScopeNeed {
  scope: string; label: string; needed: string; required: boolean;
}
export interface ConnectionGuide {
  hub: string;
  steps: { title: string; detail: string }[];
  scopes: ScopeNeed[];
  tokens: { name: string; lifetime: string; role: string }[];
}
export interface ConnectionDiagnosis {
  channel: { id: string; code: string; name: string; status: string };
  reachable: boolean;
  error: string | null;
  credentialUnreadable: boolean;
  credential: {
    hasRefreshToken: boolean; hasAccessToken: boolean;
    accessTokenExpiresAt: string | null; accessTokenMinutesLeft: number | null;
  };
  scopes: {
    known: boolean; granted: string[]; missing: ScopeNeed[];
    blocking: ScopeNeed[]; extra: string[];
  };
  ownerId: string | null;
  properties: { id: string; name: string }[];
  boundPropertyId: string | null;
  boundPropertyName: string | null;
  boundPropertyMissing: boolean;
  credits: { remaining: number | null; limit: number | null; resetsInSeconds: number | null };
}
export interface RoomSuggestion {
  channelRoomId: string; channelRoomName: string; channelQty: number | null;
  roomTypeId: string | null; roomTypeName: string | null;
  confidence: 'exact' | 'close' | 'none'; reason: string; alreadyMapped: boolean;
}

export function useConnectionGuide() {
  return useQuery({
    queryKey: ['connection-guide'],
    queryFn: () => api.get<ConnectionGuide>('/api/channels/connection-guide'),
    // The instructions never change between deploys; there is no reason to
    // ask for them again while somebody is working through them.
    staleTime: Infinity,
  });
}

export function useConnectionDiagnosis(channelId: string | null) {
  return useQuery({
    queryKey: ['connection-diagnosis', channelId],
    queryFn: () => api.get<ConnectionDiagnosis>(`/api/channels/${channelId}/diagnosis`),
    enabled: !!channelId,
    // Every call here costs Beds24 API credit, so it is fetched when somebody
    // opens the screen or presses Re-check, and never on a timer.
    refetchInterval: false,
    staleTime: 30_000,
    retry: false,
  });
}

export function useRoomSuggestions(channelId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['room-suggestions', channelId],
    queryFn: () => api.get<{ rooms: RoomSuggestion[]; roomTypes: any[] }>(
      `/api/channels/${channelId}/room-suggestions`),
    enabled: !!channelId && enabled,
    refetchInterval: false,
    retry: false,
  });
}

export const useApplyRoomSuggestions = mutation<
  { id: string; mappings: Record<string, unknown>[] }
>(({ id, mappings }) => api.post(`/api/channels/${id}/room-suggestions/apply`, { mappings }),
  ['channel-mappings', 'room-suggestions', 'channels']);

export const useSaveMapping = mutation<Record<string, unknown>>(
  (body) => api.post('/api/channel-mappings', body), ['channel-mappings', 'channels']);

export const useDeleteMapping = mutation<{ id: string }>(
  ({ id }) => api.delete(`/api/channel-mappings/${id}`), ['channel-mappings', 'channels']);

export const usePushChannel = mutation<{ id: string; body?: Record<string, unknown> }>(
  ({ id, body }) => api.post(`/api/channels/${id}/push`, body ?? {}),
  ['channels', 'sync-log', 'channel-queue', 'channel-health']);

export const useProcessQueue = mutation<{ maxBatches?: number }>(
  (body) => api.post('/api/channels/queue/process', body),
  ['channels', 'sync-log', 'channel-queue', 'channel-health']);

export const useImportBookings = mutation<{ id: string; since?: string }>(
  ({ id, ...body }) => api.post(`/api/channels/${id}/import`, body),
  [...OPERATIONAL, 'channels', 'sync-log', 'channel-conflicts']);

export const useResolveConflict = mutation<{ id: string; body: Record<string, unknown> }>(
  ({ id, body }) => api.post(`/api/channels/conflicts/${id}/resolve`, body),
  ['channel-conflicts', ...OPERATIONAL]);

export const useIgnoreConflict = mutation<{ id: string }>(
  ({ id }) => api.post(`/api/channels/conflicts/${id}/ignore`), ['channel-conflicts']);

export const useDetectDrift = mutation<{ id: string; body?: Record<string, unknown> }>(
  ({ id, body }) => api.post(`/api/channels/${id}/drift`, body ?? {}), ['sync-log']);

export const useSaveChannelContent = mutation<{ id: string; body: Record<string, unknown> }>(
  ({ id, body }) => api.put(`/api/channels/${id}/content`, body), ['channel-content']);

// CRM
export const useCreateProfile = mutation<Record<string, unknown>>(
  (body) => api.post('/api/profiles', body), ['profiles']);

export const useUpdateProfile = mutation<{ id: string; body: Record<string, unknown> }>(
  ({ id, body }) => api.patch(`/api/profiles/${id}`, body), ['profiles', 'profile']);

export const useMergeProfiles = mutation<{ id: string; sourceId: string }>(
  ({ id, sourceId }) => api.post(`/api/profiles/${id}/merge`, { sourceId }),
  ['profiles', 'profile', 'profile-duplicates', 'reservations']);

export const useSendMessage = mutation<Record<string, unknown>>(
  (body) => api.post('/api/messages', body), ['messages']);

// Operations
export const useMarkNotificationRead = mutation<{ id: string }>(
  ({ id }) => api.post(`/api/notifications/${id}/read`), ['notifications']);

export const useMarkAllNotificationsRead = mutation<{ source?: string } | void>(
  (body) => api.post('/api/notifications/read-all', body ?? {}), ['notifications']);

export const useCreateTask = mutation<Record<string, unknown>>(
  (body) => api.post('/api/tasks', body), ['tasks']);

export const useUpdateTask = mutation<{ id: string; body: Record<string, unknown> }>(
  ({ id, body }) => api.patch(`/api/tasks/${id}`, body), ['tasks']);

// Administration
export const useCreateUser = mutation<Record<string, unknown>>(
  (body) => api.post('/api/users', body), ['users']);

export const useUpdateUser = mutation<{ id: string; body: Record<string, unknown> }>(
  ({ id, body }) => api.patch(`/api/users/${id}`, body), ['users']);

export const useRevokeSession = mutation<{ id: string }>(
  ({ id }) => api.delete(`/api/sessions/${id}`), ['sessions']);

export const useChangePassword = mutation<{ currentPassword: string; newPassword: string }>(
  (body) => api.post<{ ok: boolean; otherSessionsRevoked: boolean }>('/api/auth/change-password', body),
  ['session', 'sessions']);

export const useCreatePropertyRecord = mutation<Record<string, unknown>>(
  (body) => api.post('/api/properties', body), ['properties']);
