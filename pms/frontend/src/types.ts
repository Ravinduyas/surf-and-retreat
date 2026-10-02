// Domain types — these mirror the API response shapes exactly.
// Money fields ending in `Minor` are integer minor units (cents).
// Fields ending in `Bp` are basis points (10000 = 100%).

export type ScreenName =
  | 'login'
  | 'setup'
  | 'property-select'
  | 'dashboard'
  | 'calendar'
  | 'reservations'
  | 'new-reservation'
  | 'arrivals'
  | 'check-in'
  | 'in-house'
  | 'guest-dashboard'
  | 'departures'
  | 'check-out'
  | 'cashier'
  | 'housekeeping'
  | 'night-audit'
  | 'inbox'
  | 'overbooking'
  | 'profiles'
  | 'profile-detail'
  | 'reports'
  | 'rates-inventory'
  | 'packages'
  | 'channel-manager'
  | 'booking-engine'
  | 'manual'
  | 'groups'
  | 'ar'
  | 'config'
  | 'admin';

export interface ScreenState {
  name: ScreenName;
  params?: Record<string, string>;
}

// ─── Identity ────────────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  permissions: string[];
  mustChangePassword?: boolean;
}

export interface Property {
  id: string;
  code: string;
  name: string;
  legalName?: string | null;
  kind: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  location?: string;
  timezone: string;
  currency: string;
  locale: string;
  businessDate: string;
  checkInTime: string;
  checkOutTime: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  taxId?: string | null;
  rooms: number;
  roomTypes?: number;
  ratePlans?: number;
  active: boolean;
}

export interface Session {
  token: string;
  expiresAt: string;
  user: User;
  properties: Property[];
  property: Property | null;
}

// ─── Inventory ───────────────────────────────────────────────
export type RoomStatus =
  | 'Vacant Clean'
  | 'Vacant Dirty'
  | 'Vacant Inspected'
  | 'Occupied Clean'
  | 'Occupied Dirty'
  | 'Out of Order'
  | 'Out of Service';

export interface RoomType {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  kind: 'room' | 'dorm';
  baseOccupancy: number;
  maxOccupancy: number;
  maxAdults: number;
  maxChildren: number;
  defaultRateMinor: number;
  extraAdultMinor: number;
  extraChildMinor: number;
  amenities: string[];
  genderPolicy?: string | null;
  sortOrder: number;
  active: boolean;
  rooms: number;
  beds: number;
}

export interface Room {
  id: string;
  number: string;
  floor: number;
  wing?: string | null;
  roomTypeId: string;
  roomType: string;
  roomTypeCode?: string;
  status: RoomStatus;
  hkSection?: string | null;
  attendantId?: string | null;
  lastCleanedAt?: string | null;
  features: string[];
  notes?: string | null;
  connectingTo?: string | null;
  active: boolean;
  beds: number;
}

export interface Bed {
  id: string;
  code: string;
  roomId: string;
  room: string;
  floor: number;
  roomTypeId: string;
  roomType: string;
  gender?: string | null;
  bunk: 'top' | 'bottom' | 'single';
  status: string;
  active: boolean;
}

export interface RoomBlock {
  id: string;
  roomId: string;
  room: string;
  roomType: string;
  kind: 'OOO' | 'OOS';
  fromDate: string;
  toDate: string;
  reason?: string | null;
  createdBy?: string | null;
  createdAt: string;
  releasedAt?: string | null;
}

export interface AvailabilityCell {
  roomTypeId: string;
  roomTypeCode: string;
  roomTypeName: string;
  kind: 'room' | 'dorm';
  date: string;
  physical: number;
  blocked: number;
  sold: number;
  groupHeld: number;
  hold: number;
  overbook: number;
  available: number;
  occupancyBp: number;
}

// ─── Reservations ────────────────────────────────────────────
export type ReservationStatus =
  | 'Tentative'
  | 'Confirmed'
  | 'Guaranteed'
  | 'Checked-in'
  | 'Checked-out'
  | 'Cancelled'
  | 'No-show';

export interface Reservation {
  id: string;
  confirmation: string;
  status: ReservationStatus;
  guest: string;
  profileId?: string | null;
  email: string;
  phone: string;
  arrival: string;
  departure: string;
  nights: number;
  adults: number;
  children: number;
  roomTypeId: string;
  roomType: string;
  roomTypeCode: string;
  roomTypeKind: 'room' | 'dorm';
  room?: string;
  roomId?: string;
  bed?: string;
  bedId?: string;
  ratePlanId: string;
  rateCode: string;
  ratePlanName: string;
  rateMinor: number;
  totalMinor: number;
  balanceMinor: number;
  depositRequiredMinor: number;
  commissionMinor: number;
  /**
   * Hostelworld money — see `hostelworld.tsx`.
   *
   * `hostelworld` is true for any Hostelworld booking. The three figures are
   * only filled in when Configuration → Hostelworld is switched on and the
   * booking has a collected amount; otherwise they are null and every screen
   * shows the plain total, exactly as it did before.
   */
  hostelworld?: boolean;
  otaTotalMinor?: number | null;
  otaCollectedMinor?: number | null;
  businessMinor?: number | null;
  /** The Hostelworld credit already on the folio, as a positive number. */
  otaCreditMinor?: number;
  /**
   * Hostelworld's full statement — nights, promotion, paid / due, reference,
   * deadlines — shown whether or not the split is on. Null for other
   * channels and for bookings imported before it was kept.
   */
  hostelworldDetail?: HostelworldDetail | null;
  currency: string;
  source: string;
  channel?: string;
  /** The OTA behind a hub connection, e.g. "Hostelworld". */
  otaChannel?: string;
  otaReference?: string;
  segment: string;
  company?: string;
  companyId?: string;
  groupId?: string;
  group?: string;
  vip: boolean;
  eta?: string;
  etd?: string;
  specialRequests?: string;
  preferences: string[];
  paymentMethod?: string;
  cardLast4?: string;
  origin: string;
  /**
   * A website booking the property has not accepted yet.
   *
   * Decided by the server (`pendingbookings.ts`), never re-derived here from
   * status and origin — one rule, one place.
   */
  awaitingConfirmation?: boolean;
  /** Set on the other beds of a dorm party; the lead booking has none. */
  parentId?: string;
  createdBy: string;
  createdOn: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
}

export interface ReservationNight {
  id: string;
  date: string;
  roomTypeId: string;
  roomType: string;
  roomId?: string | null;
  room?: string;
  ratePlanId: string;
  rateCode: string;
  rateMinor: number;
  adults: number;
  children: number;
  posted: boolean;
}

export interface ReservationDetail extends Reservation {
  nightRows: ReservationNight[];
  folios: FolioSummary[];
  guests: { id: string; name: string; profileId?: string; isPrimary: boolean; kind: string; registered: boolean }[];
  notes: { id: string; ts: string; user: string; category: string; body: string }[];
}

// ─── Rates ───────────────────────────────────────────────────

/**
 * The four things the public booking engine sells.
 *
 * The last two are packages: the guest buys a surf trip under one price rather
 * than a room with lessons added to it, so the property prices each of them
 * with its own rate plan and moves that price here like any other rate.
 */
export const BOOKING_MODELS = [
  'rooms', 'rooms-coworking', 'rooms-surf', 'rooms-coworking-surf',
] as const;

export type BookingModel = (typeof BOOKING_MODELS)[number];

export const BOOKING_MODEL_LABELS: Record<BookingModel, string> = {
  rooms: 'Rooms',
  'rooms-coworking': 'Rooms + coworking',
  'rooms-surf': 'Rooms + surf',
  'rooms-coworking-surf': 'Rooms + coworking + surf',
};

/** The models the booking engine expects to find a package plan for. */
export const PACKAGE_MODELS: readonly BookingModel[] = ['rooms-surf', 'rooms-coworking-surf'];

export interface RatePlan {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  parentCode?: string | null;
  offsetType?: 'percent' | 'fixed' | null;
  offsetValue: number;
  refundable: boolean;
  flexible: boolean;
  kind: string;
  /**
   * Which booking-engine package this plan prices — the site's own model key,
   * e.g. 'rooms-surf'. Null on a plain room rate, which is every plan the
   * front desk sells from.
   */
  bookingModel?: BookingModel | null;
  marketSegment?: string | null;
  minLos?: number | null;
  maxLos?: number | null;
  minAdvance?: number | null;
  maxAdvance?: number | null;
  inclusions: string[];
  companyId?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  depositPctBp: number;
  sortOrder: number;
  active: boolean;
  roomTypes: { roomTypeId: string; roomType: string; roomTypeCode: string; baseRateMinor: number }[];
}

export interface RateCalendarCell {
  date: string;
  priceMinor: number;
  source: string;
  available: number;
  sold: number;
  physical: number;
  occupancyBp: number;
  minStay: number | null;
  maxStay: number | null;
  cta: boolean;
  ctd: boolean;
  stopSell: boolean;
  /** Why the date is closed, shown on hover. Null when it is open or unexplained. */
  closeReason: string | null;
}

export interface RateCalendarRow {
  roomTypeId: string;
  roomType: string;
  roomTypeCode: string;
  ratePlanId: string;
  ratePlan: string;
  ratePlanCode: string;
  derived: boolean;
  /** Set when the row prices a booking-engine package rather than a room. */
  bookingModel?: BookingModel | null;
  cells: RateCalendarCell[];
}

export type RestrictionType =
  | 'stop-sell' | 'min-stay' | 'max-stay' | 'min-stay-through'
  | 'cta' | 'ctd' | 'min-advance' | 'max-advance' | 'release';

export interface Restriction {
  id: string;
  roomTypeId?: string | null;
  roomType: string;
  ratePlanId?: string | null;
  ratePlan: string;
  channelCode?: string | null;
  dateFrom: string;
  dateTo: string;
  type: RestrictionType;
  value?: number | null;
  note?: string | null;
  active: boolean;
  createdBy?: string | null;
  createdAt: string;
}

export interface YieldRule {
  id: string;
  name: string;
  active: boolean;
  metric: 'occupancy' | 'lead_time' | 'dow' | 'los';
  operator: string;
  threshold: string;
  secondaryMetric?: string | null;
  secondaryOperator?: string | null;
  secondaryThreshold?: string | null;
  adjustType: 'percent' | 'fixed';
  adjustValue: number;
  ratePlanId?: string | null;
  ratePlan: string;
  roomTypeId?: string | null;
  roomType: string;
  priority: number;
  appliedCount: number;
}

export interface Promotion {
  id: string;
  code: string;
  name: string;
  kind: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  stayFrom?: string | null;
  stayTo?: string | null;
  bookFrom?: string | null;
  bookTo?: string | null;
  minLos?: number | null;
  maxLos?: number | null;
  minAdvance?: number | null;
  maxAdvance?: number | null;
  ratePlanIds: string[];
  channels: string[];
  deliveryMode: 'price' | 'native_promo';
  usageLimit: number;
  usedCount: number;
  active: boolean;
}

export interface Tax {
  id: string;
  code: string;
  name: string;
  mode: 'percent' | 'per_night' | 'per_person_night' | 'flat';
  value: number;
  appliesTo: 'room' | 'fnb' | 'all';
  inclusive: boolean;
  sortOrder: number;
  active: boolean;
}

export interface QuoteNight {
  date: string;
  baseMinor: number;
  occupancyMinor: number;
  yieldMinor: number;
  promoMinor: number;
  channelMinor: number;
  rateMinor: number;
  appliedRules: string[];
}

export interface QuoteOption {
  roomTypeId: string;
  roomType: string;
  roomTypeCode: string;
  kind: 'room' | 'dorm';
  maxOccupancy: number;
  ratePlanId: string;
  ratePlan: string;
  ratePlanCode: string;
  refundable: boolean;
  inclusions: string[];
  available: number;
  sellable: boolean;
  violations: { type: string; date: string; message: string }[];
  nights: QuoteNight[];
  roomTotalMinor: number;
  taxes: { code: string; name: string; amountMinor: number }[];
  taxTotalMinor: number;
  grandTotalMinor: number;
  averageNightlyMinor: number;
  promotionCode?: string;
}

export interface QuoteResponse {
  arrival: string;
  departure: string;
  nights: number;
  adults: number;
  children: number;
  currency: string;
  options: QuoteOption[];
  availablePromotions: { code: string; name: string; discountType: string; discountValue: number }[];
  taxes: { code: string; name: string; mode: string; value: number }[];
}

// ─── Folios ──────────────────────────────────────────────────
export interface FolioSummary {
  id: string;
  number: string;
  name: string;
  type: string;
  windowNo: number;
  status: 'open' | 'closed';
  balanceMinor: number;
  reservationId?: string | null;
  confirmation?: string;
  guest?: string;
  room?: string | null;
  reservationStatus?: string;
  openedAt?: string;
}

export interface FolioLine {
  id: string;
  businessDate: string;
  postedAt: string;
  kind: 'charge' | 'tax' | 'payment' | 'adjustment' | 'transfer';
  code: string;
  description: string;
  qty: number;
  unitMinor: number;
  amountMinor: number;
  method?: string | null;
  reference?: string | null;
  parentLineId?: string | null;
  postedBy?: string | null;
  voided: boolean;
  voidOf?: string | null;
}

export interface Folio extends FolioSummary {
  chargesMinor: number;
  taxesMinor: number;
  paymentsMinor: number;
  adjustmentsMinor: number;
  groupId?: string | null;
  companyId?: string | null;
  closedAt?: string | null;
  reservation: {
    id: string; confirmation: string; guest: string; status: string;
    arrival: string; departure: string; room?: string | null; roomType: string;
    adults: number; children: number; vip: boolean;
  } | null;
  lines: FolioLine[];
}

export interface TransactionCode {
  id: string;
  code: string;
  name: string;
  category: string;
  defaultPriceMinor: number;
  taxable: boolean;
  active: boolean;
}

export interface Invoice {
  id: string;
  number: string;
  folioId: string;
  issuedAt: string;
  dueAt?: string | null;
  billTo: string;
  company?: string | null;
  netMinor: number;
  taxMinor: number;
  totalMinor: number;
  paidMinor: number;
  status: string;
  currency: string;
}

/** The logo and wording a property puts on the invoices it issues. */
export interface InvoiceBranding {
  logoDataUrl: string | null;
  headerName: string | null;
  footerNote: string | null;
  terms: string | null;
  showTaxId: boolean;
}

export interface InvoiceDocumentLine {
  date: string;
  code: string;
  description: string;
  qty: number;
  unitMinor: number;
  amountMinor: number;
}

/**
 * Everything printed on one invoice.
 *
 * Distinct from `Invoice`, which is the row in the list: that says an invoice
 * exists and what it came to, this says what was on it. Assembled by the API
 * from the folio the invoice was cut from, so a reprint shows the same paper
 * the guest was handed rather than a folio that has moved on since.
 */
export interface InvoiceDocument {
  invoice: {
    id: string; number: string; issuedAt: string; dueAt: string | null;
    status: string; currency: string;
    netMinor: number; taxMinor: number; totalMinor: number;
    paidMinor: number; balanceMinor: number;
    createdBy: string | null;
  };
  from: {
    name: string; legalName: string | null; address: string | null;
    city: string | null; country: string | null;
    phone: string | null; email: string | null; website: string | null;
    taxId: string | null;
  };
  billTo: { name: string; address: string | null; company: string | null };
  stay: {
    confirmation: string | null; guest: string | null;
    arrival: string | null; departure: string | null; nights: number | null;
    roomNumber: string | null; roomType: string | null;
  } | null;
  lines: InvoiceDocumentLine[];
  taxes: { code: string; description: string; amountMinor: number }[];
  payments: { date: string; description: string; method: string | null; amountMinor: number }[];
  branding: InvoiceBranding;
}

export interface Company {
  id: string;
  code: string;
  name: string;
  type: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxId?: string | null;
  arEnabled: boolean;
  creditLimitMinor: number;
  commissionBp: number;
  paymentTermsDays: number;
  active: boolean;
  balanceMinor: number;
}

export interface ArAccount {
  companyId: string;
  code: string;
  name: string;
  type: string;
  creditLimitMinor: number;
  paymentTermsDays: number;
  balanceMinor: number;
  oldestChargeDate?: string | null;
  overLimit: boolean;
}

export interface CashierShift {
  open: boolean;
  id?: string;
  openedAt?: string;
  openingFloatMinor?: number;
  paymentsMinor?: number;
  chargesMinor?: number;
  lines?: number;
  expectedCashMinor?: number;
  byMethod?: { method: string; totalMinor: number }[];
}

// ─── Housekeeping ────────────────────────────────────────────
export interface BoardRoom {
  id: string;
  number: string;
  floor: number;
  roomTypeId: string;
  roomType: string;
  status: RoomStatus;
  hkSection?: string | null;
  attendant?: string | null;
  lastCleaned?: string | null;
  notes?: string | null;
  occupied: boolean;
  guest?: string | null;
  reservationId?: string | null;
  departing: boolean;
  arriving: boolean;
  arrivalGuest?: string | null;
  discrepancy?: string | null;
  blocked?: { kind: string; reason: string | null; to: string } | null;
  openWorkOrders: number;
  task?: { id: string; type: string; status: string; assignee: string | null; priority: string } | null;
}

export interface HkTask {
  id: string;
  date: string;
  roomId: string;
  room: string;
  floor: number;
  roomStatus: string;
  roomType: string;
  type: string;
  status: 'pending' | 'in-progress' | 'done' | 'inspected' | 'blocked';
  assigneeId?: string | null;
  assignee?: string | null;
  section?: string | null;
  priority: string;
  credits: number;
  startedAt?: string | null;
  finishedAt?: string | null;
  inspectedBy?: string | null;
  inspectedAt?: string | null;
  notes?: string | null;
}

export interface WorkOrder {
  id: string;
  room?: string | null;
  roomId?: string | null;
  location?: string | null;
  category: string;
  priority: string;
  status: string;
  title: string;
  description?: string | null;
  reportedBy?: string | null;
  assignee?: string | null;
  assignedTo?: string | null;
  blocksRoom: boolean;
  createdAt: string;
  resolvedAt?: string | null;
  resolution?: string | null;
}

export interface LostFoundItem {
  id: string;
  room?: string | null;
  foundOn: string;
  foundBy?: string | null;
  description: string;
  storageRef?: string | null;
  status: string;
  returnedAt?: string | null;
  note?: string | null;
}

// ─── Night audit ─────────────────────────────────────────────
export interface AuditIssue {
  kind: string;
  severity: 'block' | 'warn';
  count: number;
  message: string;
  items: { id: string; label: string }[];
}

export interface AuditPreflight {
  businessDate: string;
  nextDate: string;
  issues: AuditIssue[];
  canRun: boolean;
  counts: { inHouse: number; arrivals: number; departures: number; roomsToPost: number };
}

export interface AuditRun {
  businessDate: string;
  newBusinessDate: string;
  roomChargesPosted: number;
  roomRevenueMinor: number;
  taxPostedMinor: number;
  noShows: number;
  stats: any;
  warnings: string[];
  runId: string;
}

export interface DailyStats {
  date: string;
  roomsTotal: number;
  roomsOoo: number;
  roomsSold: number;
  occupancyBp: number;
  roomRevenueMinor: number;
  otherRevenueMinor: number;
  taxMinor: number;
  paymentsMinor: number;
  adrMinor: number;
  revparMinor: number;
  arrivals: number;
  departures: number;
  noShows: number;
  cancellations: number;
  inHouse: number;
}

// ─── CRM ─────────────────────────────────────────────────────
export interface Profile {
  id: string;
  type: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  nationality?: string | null;
  language?: string | null;
  dob?: string | null;
  idType?: string | null;
  idNumber?: string | null;
  idExpiry?: string | null;
  address?: any;
  loyalty: 'None' | 'Silver' | 'Gold' | 'Platinum';
  loyaltyPoints: number;
  vip: boolean;
  blacklist: boolean;
  blacklistReason?: string | null;
  marketingConsent: boolean;
  consentAt?: string | null;
  preferences: string[];
  notes?: string | null;
  mergedInto?: string | null;
  createdAt: string;
  updatedAt: string;
  stays?: number;
  totalNights?: number;
  lastStay?: string | null;
  totalRevenueMinor?: number;
}

/** One stay on a guest's history, with what that booking actually included. */
export interface ProfileStay {
  id: string;
  confirmation: string;
  arrival: string;
  departure: string;
  nights: number;
  status: ReservationStatus;
  roomType: string;
  rateCode: string;
  ratePlan?: string;
  source: string;
  channel?: string | null;
  totalMinor: number;
  /**
   * What the guest chose when they booked — the package, coworking desks, surf
   * lessons, airport pickup. Machine tags; run them through
   * `bookingPreference()` before showing them to anybody.
   */
  preferences: string[];
  specialRequests?: string | null;
}

/**
 * `GET /api/profiles/:id`.
 *
 * Note `stays`: the list endpoint returns a *count* under that name, the detail
 * endpoint returns the *rows*. The two are genuinely different shapes from the
 * same key, so this interface overrides it rather than pretending otherwise.
 */
export interface ProfileDetail extends Omit<Profile, 'stays'> {
  stays: ProfileStay[];
  completedStays: number;
  totalNights: number;
  lifetimeValueMinor: number;
  averageStayNights: number;
  lastStay: string | null;
}

// ─── Reporting ───────────────────────────────────────────────
export interface KpiPoint {
  date: string;
  roomsAvailable: number;
  roomsSold: number;
  occupancyBp: number;
  roomRevenueMinor: number;
  adrMinor: number;
  revparMinor: number;
  actual: boolean;
}

export interface KpiSummary {
  from: string;
  to: string;
  roomsSold: number;
  roomsAvailable: number;
  occupancyBp: number;
  roomRevenueMinor: number;
  adrMinor: number;
  revparMinor: number;
  series: KpiPoint[];
}

export interface DashboardSnapshot {
  businessDate: string;
  snapshot: {
    businessDate: string;
    rooms: { physical: number; blocked: number; sold: number; available: number; denominator: number };
    occupancyBp: number;
    adrMinor: number;
    revparMinor: number;
    arrivals: { due: number; done: number; total: number };
    departures: { due: number; done: number; total: number };
    inHouse: number;
    inHouseGuests: number;
    roomRevenueMinor: number;
    otherRevenueMinor: number;
    paymentsMinor: number;
    expectedRoomRevenueMinor: number;
    outstandingBalanceMinor: number;
  };
  forecast7: KpiPoint[];
  housekeeping: { date: string; departureCleans: number; stayoverCleans: number; arrivals: number; totalCredits: number };
  arrivalsToday: number;
  departuresToday: number;
  alerts: {
    unassignedArrivals: number;
    dirtyRooms: number;
    openWorkOrders: number;
    channelConflicts: number;
    nightAuditBlockers: number;
  };
  topArrivals: FrontDeskRow[];
  topDepartures: FrontDeskRow[];
}

export interface FrontDeskRow {
  id: string;
  confirmation: string;
  guest: string;
  status: ReservationStatus;
  arrival: string;
  departure: string;
  nights: number;
  adults: number;
  children: number;
  roomType: string;
  room?: string;
  roomId?: string;
  roomStatus?: string;
  rateCode: string;
  vip: boolean;
  eta?: string | null;
  etd?: string | null;
  source: string;
  channel?: string | null;
  balanceMinor: number;
  totalMinor: number;
  specialRequests?: string | null;
  awaitingConfirmation?: boolean;
}

export interface FrontDeskLists {
  date: string;
  arrivals: FrontDeskRow[];
  /**
   * Website bookings arriving today that nobody has accepted yet.
   *
   * Kept out of `arrivals` because they have no room and cannot be checked in,
   * so offering them to the arrivals run would only offer an action that fails.
   */
  awaitingConfirmation: FrontDeskRow[];
  arrived: FrontDeskRow[];
  departures: FrontDeskRow[];
  departed: FrontDeskRow[];
  inHouse: FrontDeskRow[];
}

// ─── Taking money ────────────────────────────────────────────

export type PaymentMethodKind = 'cash' | 'card' | 'transfer' | 'account' | 'other';

export interface PaymentMethod {
  code: string;
  label: string;
  kind: PaymentMethodKind;
  active: boolean;
  /** Overrides the property card rate; null means "use the default". */
  surchargeBp: number | null;
}

/** `GET /api/payment-methods` — what every screen offers. */
export interface PaymentMethodList {
  methods: PaymentMethod[];
  cardSurchargeEnabled: boolean;
  cardSurchargeBp: number;
  cardSurchargeLabel: string;
  /** The property's own currency — what the folio is kept in. */
  currency?: string;
  /** Everything the desk may be handed, the property's own money first. */
  currencies?: string[];
}

/** One currency's worth of the cash drawer. */
export interface CashBoxBalance {
  currency: string;
  /** What is in the box now, in this currency. */
  amountMinor: number;
  openingMinor: number;
  receivedMinor: number;
  changeMinor: number;
  withdrawnMinor: number;
  depositedMinor: number;
}

/** `GET /api/cashbox` — what is in the drawer and who may take it out. */
export interface CashBox {
  /** When the box was last counted. Null when it never has been. */
  since: string | null;
  /** The property's own currency. */
  base: string;
  currencies: CashBoxBalance[];
  lastWithdrawal: {
    groupId: string; at: string; businessDate: string; userName: string;
    items: { currency: string; amountMinor: number }[];
  } | null;
  /** True only for administrators — the one role that may empty the box. */
  canWithdraw: boolean;
}

/**
 * One movement of money — a payment or something done to the cash box.
 *
 * Both are told in the same shape because a cashier reconciling a day does not
 * think in two tables: what came in, what went back out, whose stay it was for.
 */
export interface LedgerEntry {
  id: string;
  at: string;
  businessDate: string;
  kind: 'payment' | 'withdrawal' | 'deposit' | 'opening_count' | 'close_count';
  what: string;
  guest: string | null;
  room: string | null;
  roomType: string | null;
  confirmation: string | null;
  folio: string | null;
  by: string | null;
  note: string | null;
  /** Whether a payment cleared the folio. Null for cash-box events. */
  settles: 'full' | 'partial' | null;
  inCurrency: string | null;
  inMinor: number | null;
  outCurrency: string | null;
  outMinor: number | null;
  settledMinor: number | null;
  currency: string;
  outstandingMinor: number | null;
  rate: number | null;
  voided: boolean;
}

/** One thing that was done to the cash box. */
export interface CashBoxEvent {
  groupId: string;
  kind: 'opening_count' | 'close_count' | 'withdrawal' | 'deposit';
  at: string;
  businessDate: string;
  by: string;
  note: string | null;
  lines: {
    currency: string;
    amountMinor: number;
    expectedMinor: number | null;
    varianceMinor: number | null;
  }[];
}

/** One payment as the cashier page shows it, in the money it was taken in. */
export interface CashTransaction {
  id: string;
  at: string;
  businessDate: string;
  description: string;
  method: string;
  guest: string | null;
  confirmation: string | null;
  folio: string;
  reference: string | null;
  postedBy: string | null;
  voided: boolean;
  /** Credited to the folio, always the property's own currency. */
  settledMinor: number;
  currency: string;
  tenderCurrency: string | null;
  tenderAmountMinor: number | null;
  tenderRate: number | null;
  changeCurrency: string | null;
  changeAmountMinor: number | null;
  changeRate: number | null;
  tenderedBaseMinor: number | null;
  changeBaseMinor: number | null;
}

/** What a start-of-day count found, and whether it raised a warning. */
export interface CashCountResult {
  groupId: string;
  warned: boolean;
  comparedWith: { at: string; businessDate: string; by: string } | null;
  lines: {
    currency: string; countedMinor: number; expectedMinor: number; varianceMinor: number;
  }[];
}

/** `GET /api/fx/rates` — today's rates for the currencies the desk accepts. */
export interface FxRates {
  /** The property's own currency. Every rate converts into this. */
  base: string;
  fetchedAt: string | null;
  source: string | null;
  /** Why the last refresh failed, when it did. The cached rates still stand. */
  error: string | null;
  rates: {
    currency: string;
    /** Units of `base` per one unit of `currency`. Null when none is known. */
    rate: number | null;
    fetchedAt: string | null;
    stale: boolean;
  }[];
}

/** `GET /api/payment-settings` — the Configuration view, inactive ones included. */
export interface PaymentSettings extends PaymentMethodList {
  /** Currencies accepted across the counter, besides the property's own. */
  currencies: string[];
  cardSurchargeTaxable: boolean;
  roundSurchargeToUnit: boolean;
}

/**
 * `GET /api/config/hostelworld` — how Hostelworld bookings are split into the
 * total, what Hostelworld collected, and the business price. Off by default.
 */
export interface HostelworldSettings {
  enabled: boolean;
  /** Where the collected figure comes from: the channel, or a fixed percentage. */
  collectedMode: 'channel' | 'percent';
  /** Basis points of the total: 1500 = 15%. */
  percentBp: number;
  /** Take Hostelworld's total as the booking total instead of re-pricing. */
  useChannelTotal: boolean;
  /** Post the collected amount to the folio as a credit. */
  postCredit: boolean;
}

/** What a save or "apply to existing bookings" did to the bookings on the books. */
export interface HostelworldApplyResult {
  scanned: number;
  filled: number;
  posted: number;
  replaced: number;
  removed: number;
}

/** What "refresh from Beds24" found and changed. */
export interface HostelworldRefreshResult {
  channels: number;
  fetched: number;
  matched: number;
  repriced: number;
  collected: number;
  errors: string[];
}

/** One night of a Hostelworld booking: what it sold for, and what was on sale. */
export interface HostelworldNight {
  date: string;
  /** Beds booked that night. */
  pax: number;
  /** What Hostelworld sold the night for, all beds. */
  rateMinor: number;
  /** The price on sale on the channel for that night when the booking was read; null when unknown. */
  sellMinor: number | null;
  rateId: string | null;
}

/** What a Hostelworld promotion took off the nights that were on sale. */
export interface HostelworldPromotion {
  /** The discounted nights at the prices on sale, added up. */
  listMinor: number;
  /** listMinor − what those nights sold for. */
  discountMinor: number;
  /** discount ÷ list, in basis points: 600 = 6% off. */
  percentBp: number;
  /** How many nights were discounted. */
  nights: number;
  /** True when every discounted night was cut by the same percentage. */
  uniform: boolean;
}

/**
 * Hostelworld's statement for a booking, as read from Beds24 — the same
 * figures the confirmation email carries, plus the nightly breakdown.
 */
export interface HostelworldDetail {
  /** Hostelworld's own booking reference, e.g. "336798-580229521". */
  ref: string | null;
  bookedAt: string | null;
  currency: string | null;
  /** "Total Price" / "Booking Price" on the confirmation email. */
  totalMinor: number;
  /** "Deposit Paid": what Hostelworld collected and keeps. */
  paidMinor: number | null;
  /** "Balance Due - On Arrival": what the desk collects. */
  dueMinor: number | null;
  cancellableUntil: string | null;
  freeCancellableUntil: string | null;
  /** Who collects what, in Beds24's words. */
  collectNote: string | null;
  /** Beds24's raw fields, for anyone checking the reading. */
  channel: { priceMinor: number; commissionMinor: number; depositMinor: number };
  nights: HostelworldNight[];
  promotion: HostelworldPromotion | null;
  readAt: string;
}

/** What a payment will actually come to, worked out by the server. */
export interface PaymentQuote {
  method: string;
  methodLabel: string;
  kind: PaymentMethodKind;
  settleMinor: number;
  surchargeBp: number;
  surchargeMinor: number;
  surchargeLabel: string;
  totalMinor: number;
  takesCash: boolean;
}

// ─── Guest self-registration (the QR at the desk) ────────────

/** What the guest filled in on their own phone, before anyone accepted it. */
export interface GuestRegistrationSubmission {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  nationality?: string | null;
  dob?: string | null;
  idType?: string | null;
  idNumber?: string | null;
  idExpiry?: string | null;
  address?: {
    line1?: string | null; line2?: string | null; city?: string | null;
    postcode?: string | null; country?: string | null;
  } | null;
  idPhoto?: { mime: string; dataBase64: string } | null;
  signature?: { mime: string; dataBase64: string } | null;
  marketingConsent?: boolean;
}

export interface RegistrationLink {
  exists: boolean;
  live: boolean;
  /** Why it stopped working, when it has. */
  endedBecause?: 'accepted' | 'revoked' | 'checked-in' | null;
  createdAt?: string;
  createdBy?: string;
  submitted: boolean;
  submittedAt?: string | null;
  submissions?: number;
  acceptedAt?: string | null;
  acceptedBy?: string | null;
  submission: GuestRegistrationSubmission | null;
  /** Returned only when the link is minted — the token is never readable again. */
  url?: string;
  token?: string;
}

// ─── Confirming a website booking ────────────────────────────

export interface BookingConfirmationMember {
  id: string;
  confirmation: string;
  guest: string;
  status: ReservationStatus;
  awaitingConfirmation: boolean;
  roomId?: string | null;
  bedId?: string | null;
  room?: string | null;
  bed?: string | null;
  totalMinor: number;
  /**
   * This member's own room type, and what is free in it.
   *
   * A booking is not always one room type repeated: a party can take a double
   * and a dorm bed, and each part is its own reservation here. Every part is
   * given a room or a bed out of its own type, which is why these are per
   * member rather than read off the booking as a whole.
   */
  roomTypeId: string;
  roomType: string;
  roomTypeKind: 'room' | 'dorm';
  rooms: { id: string; number: string; floor: number; status: string }[];
  beds: { id: string; code: string; roomId: string; room: string; bunk: string }[];
}

/** The party behind one pending booking, and what is still free to give it. */
export interface BookingConfirmation {
  reservationId: string;
  confirmation: string;
  guest: string;
  arrival: string;
  departure: string;
  nights: number;
  roomTypeId: string;
  roomType: string;
  roomTypeKind: 'room' | 'dorm';
  source: string;
  awaitingConfirmation: boolean;
  /** One entry per bed for a dorm party; one entry for a room. */
  members: BookingConfirmationMember[];
  unitsNeeded: number;
  rooms: { id: string; number: string; floor: number; status: string }[];
  beds: { id: string; code: string; roomId: string; room: string; bunk: string }[];
}

export interface ProductionRow {
  dimension: string;
  reservations: number;
  roomNights: number;
  revenueMinor: number;
  commissionMinor: number;
  adrMinor: number;
}

// ─── Channel manager ─────────────────────────────────────────
export interface Channel {
  id: string;
  code: string;
  name: string;
  kind: string;
  active: boolean;
  commissionBp: number;
  priceMultiplierBp: number;
  allotment?: number | null;
  status: 'not-configured' | 'connected' | 'error' | 'paused';
  configured: boolean;
  externalPropertyId?: string | null;
  lastSyncAt?: string | null;
  lastError?: string | null;
  mappings: number;
  pushedToday: number;
  pulledToday: number;
  failuresToday: number;
  queued: number;
  settings: Record<string, unknown>;
}

export interface ChannelMapping {
  id: string;
  channelId: string;
  channelCode: string;
  channelName: string;
  roomTypeId?: string | null;
  roomType?: string | null;
  roomTypeCode?: string | null;
  ratePlanId?: string | null;
  ratePlan?: string | null;
  ratePlanCode?: string | null;
  externalRoomId?: string | null;
  externalRateId?: string | null;
  externalName?: string | null;
  active: boolean;
}

export interface SyncLogEntry {
  id: string;
  ts: string;
  direction: 'push' | 'pull';
  channel: string;
  channelCode?: string | null;
  action: string;
  status: 'success' | 'failed' | 'pending' | 'skipped';
  payloadBytes: number;
  durationMs: number;
  attempt: number;
  error?: string | null;
}

export interface AriCell {
  roomTypeId: string;
  roomTypeCode: string;
  ratePlanId: string;
  ratePlanCode: string;
  date: string;
  available: number;
  priceMinor: number;
  minStay: number | null;
  maxStay: number | null;
  cta: boolean;
  ctd: boolean;
  stopSell: boolean;
}

export interface ChannelConflict {
  id: string;
  channel: string;
  receivedAt: string;
  otaReference?: string | null;
  guest?: string | null;
  roomTypeRaw?: string | null;
  ratePlanRaw?: string | null;
  reason: string;
  status: string;
  raw?: any;
}

export interface ChannelHealth {
  channelId: string;
  code: string;
  name: string;
  health: 'healthy' | 'degraded' | 'down' | 'not-configured';
  status: string;
  lastSyncAt?: string | null;
  lastError?: string | null;
  recentFailures: number;
  queued: number;
  mappings: number;
  /**
   * False when the server runs with `HELIO_CHANNEL_READONLY` set: bookings still
   * import, but nothing queued will ever be sent out. Distinct from `health`,
   * because this is a deliberate setting rather than a fault — and distinct
   * from `queued > 0`, because a backlog that is draining is normal.
   */
  publishing: boolean;
  /** When the oldest unsent change was queued, or null if nothing is waiting. */
  oldestQueuedAt?: string | null;
}

export interface DiscoveredUnit {
  externalId: string;
  name: string;
  kind: string;
  quantity: number;
  maxPeople: number;
  status: 'mapped' | 'suggested' | 'unmapped';
  mappedRoomTypeId?: string | null;
  suggestedRoomTypeId?: string | null;
  suggestedRoomType?: string | null;
}

// ─── Groups ──────────────────────────────────────────────────
export interface Group {
  id: string;
  code: string;
  name: string;
  companyId?: string | null;
  company?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  arrival: string;
  departure: string;
  cutoffDate?: string | null;
  ratePlanId?: string | null;
  ratePlanCode?: string | null;
  status: string;
  masterFolio: boolean;
  notes?: string | null;
  blockedNights: number;
  pickedUpNights: number;
  reservations: number;
  pickupBp: number;
}

// ─── Operations ──────────────────────────────────────────────
export interface Notification {
  id: string;
  title: string;
  message?: string | null;
  source: string;
  severity: 'info' | 'success' | 'warn' | 'critical';
  ts: string;
  unread: boolean;
  link?: string | null;
}

export interface TaskItem {
  id: string;
  title: string;
  category: string;
  dueAt?: string | null;
  assigneeId?: string | null;
  assignee: string;
  priority: 'low' | 'normal' | 'high';
  status: string;
  link?: string | null;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  ts: string;
  user: string;
  action: string;
  entity: string;
  entityId?: string | null;
  entityRef?: string | null;
  channel?: string | null;
  before?: any;
  after?: any;
  ip: string;
  elevated: boolean;
}

export interface SearchResult {
  kind: 'reservation' | 'profile' | 'room' | 'company' | 'group';
  id: string;
  title: string;
  subtitle: string;
}

export interface Policy {
  id: string;
  kind: string;
  name: string;
  scope: string;
  scopeRef?: string | null;
  summary?: string | null;
  details?: string | null;
  channels: string[];
  active: boolean;
  updatedAt: string;
}

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  phone?: string | null;
  active: boolean;
  lastLoginAt?: string | null;
  mustChangePassword: boolean;
  locked: boolean;
  properties: string[];
}
