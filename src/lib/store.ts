import type {
  AuditEvent,
  ExitType,
  LogEntry,
  Message,
  Permit,
  Person,
  ShortCodeStrategy,
  User,
} from "./types";

const KEYS = {
  users: "sijil.users",
  entries: "sijil.entries",
  audit: "sijil.audit",
  session: "sijil.session",
  persons: "sijil.persons",
  permits: "sijil.permits",
  exitTypes: "sijil.exitTypes",
  messages: "sijil.messages",
  settings: "sijil.settings",
} as const;

const isBrowser = () => typeof window !== "undefined";

function read<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event("sijil:changed"));
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const today = () => new Date().toISOString().slice(0, 10);

/** the single, immutable owner account id */
export const OWNER_ID = "u-owner";
export const OWNER_EMAIL = "abdallaaboalhadid@gmail.com";

const SEED_USERS: User[] = [
  {
    id: OWNER_ID,
    username: "owner",
    email: OWNER_EMAIL,
    password: "1@Sdd.com",
    fullName: "عبدالله أبوالحديد",
    signatureName: "عبدالله أبوالحديد",
    role: "owner",
    department: "الإدارة العليا",
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "u-admin",
    username: "admin",
    password: "admin123",
    fullName: "وفاء حسن",
    role: "admin",
    department: "الإدارة العامة",
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "u-sup",
    username: "supervisor",
    password: "sup123",
    fullName: "سالم المطيري",
    role: "supervisor",
    department: "التشغيل",
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "u-emp",
    username: "employee",
    password: "emp123",
    fullName: "نورة العتيبي",
    role: "employee",
    department: "التشغيل",
    active: true,
    createdAt: new Date().toISOString(),
  },
];

const SEED_ENTRIES: LogEntry[] = [
  {
    id: "e-1",
    date: today(),
    shift: "morning",
    department: "التشغيل",
    title: "تسليم واستلام الوردية الصباحية",
    body: "تم استلام الوردية بدون ملاحظات، جميع الأجهزة تعمل بشكل طبيعي.",
    authorId: "u-emp",
    authorName: "نورة العتيبي",
    status: "submitted",
    signatures: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "e-2",
    date: today(),
    shift: "night",
    department: "التشغيل",
    title: "ملاحظات الوردية الليلية",
    body: "انقطاع مؤقت في التيار لمدة ٥ دقائق وتمت المعالجة.",
    authorId: "u-sup",
    authorName: "سالم المطيري",
    status: "draft",
    signatures: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const SEED_EXIT_TYPES: ExitType[] = [
  { id: "t-fosha", name: "فسحة", requiresPermit: true, hasReturnTime: true, allowsNextDayReturn: false, active: true },
  {
    id: "t-hospital",
    name: "فسحة مستشفى",
    requiresPermit: true,
    hasReturnTime: true,
    allowsNextDayReturn: true,
    active: true,
  },
  { id: "t-leave", name: "إجازة", requiresPermit: true, hasReturnTime: true, allowsNextDayReturn: true, active: true },
  {
    id: "t-mission",
    name: "مأمورية",
    requiresPermit: true,
    hasReturnTime: true,
    allowsNextDayReturn: true,
    active: true,
  },
];

export interface DayStatementDefault {
  time: string;
  text: string;
  topic: string;
  statementTypeName: string;
}

export interface Settings {
  shortCodeStrategy: ShortCodeStrategy;
  /** IANA timezone used to derive business_date consistently */
  timeZone: string;
  /** day boundaries (local business time) */
  dayStart: string;
  dayEnd: string;
  exitAllowedFrom: string;
  defaultOutingEnd: string;
  openingStatement: DayStatementDefault;
  closingStatement: DayStatementDefault;
  /** persisted template sort preference */
  templateSort: "usage" | "recent";
}

export const DEFAULT_SETTINGS: Settings = {
  shortCodeStrategy: "first2last2",
  timeZone: "Africa/Cairo",
  dayStart: "00:05",
  dayEnd: "23:55",
  exitAllowedFrom: "04:00",
  defaultOutingEnd: "22:00",
  openingStatement: {
    time: "00:05",
    text: "افتتاح عمل اليوم على بركة الله",
    topic: "افتتاح",
    statementTypeName: "افتتاح",
  },
  closingStatement: {
    time: "23:55",
    text: "نهاية عمل اليوم",
    topic: "نهاية",
    statementTypeName: "نهاية",
  },
  templateSort: "usage",
};


export function ensureSeed() {
  if (!isBrowser()) return;
  if (!window.localStorage.getItem(KEYS.users)) write(KEYS.users, SEED_USERS);
  if (!window.localStorage.getItem(KEYS.entries)) write(KEYS.entries, SEED_ENTRIES);
  if (!window.localStorage.getItem(KEYS.audit)) write(KEYS.audit, [] as AuditEvent[]);
  if (!window.localStorage.getItem(KEYS.exitTypes)) write(KEYS.exitTypes, SEED_EXIT_TYPES);
  if (!window.localStorage.getItem(KEYS.persons)) write(KEYS.persons, [] as Person[]);
  if (!window.localStorage.getItem(KEYS.permits)) write(KEYS.permits, [] as Permit[]);
  if (!window.localStorage.getItem(KEYS.messages)) write(KEYS.messages, [] as Message[]);
  if (!window.localStorage.getItem(KEYS.settings)) write(KEYS.settings, DEFAULT_SETTINGS);

  // migration: make sure the owner account exists exactly once and stays intact
  const users = read<User[]>(KEYS.users, []);
  const seedOwner = SEED_USERS[0]!;
  const withOwner = users.some((u) => u.id === OWNER_ID) ? users : [seedOwner, ...users];
  write(KEYS.users, normalizeUsers(withOwner));
}

/** enforces: exactly one owner (the seeded one), never disabled, never demoted */
function normalizeUsers(list: User[]): User[] {
  return list.map((u) =>
    u.id === OWNER_ID
      ? { ...u, role: "owner" as const, active: true, email: OWNER_EMAIL, password: u.password || "1@Sdd.com" }
      : u.role === "owner"
        ? { ...u, role: "admin" as const }
        : u,
  );
}

export const getUsers = () => normalizeUsers(read<User[]>(KEYS.users, []));
export const setUsers = (u: User[]) => write(KEYS.users, normalizeUsers(u));

export const getEntries = () => read<LogEntry[]>(KEYS.entries, []);
export const setEntries = (e: LogEntry[]) => write(KEYS.entries, e);

export const getAudit = () => read<AuditEvent[]>(KEYS.audit, []);

export const getSettings = () => read<Settings>(KEYS.settings, DEFAULT_SETTINGS);
export const setSettings = (s: Settings) => write(KEYS.settings, s);

/* ---------- persons ---------- */

export const getPersons = () => read<Person[]>(KEYS.persons, []);
export const setPersons = (p: Person[]) => write(KEYS.persons, p);

export function generateShortCode(nationalId: string, strategy = getSettings().shortCodeStrategy): string {
  const digits = (nationalId || "").replace(/\D/g, "");
  if (!digits) return "";
  switch (strategy) {
    case "last4":
      return digits.slice(-4);
    case "middle4": {
      const start = Math.max(0, Math.floor(digits.length / 2) - 2);
      return digits.slice(start, start + 4);
    }
    case "manual":
      return "";
    case "first2last2":
    default:
      return digits.slice(0, 2) + digits.slice(-2);
  }
}

/* ---------- exit types ---------- */

export const getExitTypes = () => read<ExitType[]>(KEYS.exitTypes, SEED_EXIT_TYPES);
export const setExitTypes = (t: ExitType[]) => write(KEYS.exitTypes, t);

/* ---------- permits ---------- */

export const getPermits = () => read<Permit[]>(KEYS.permits, []);
export const setPermits = (p: Permit[]) => write(KEYS.permits, p);

/**
 * Single-use guard for permits. Returns false when the permit was already
 * consumed / cancelled, so double clicks or parallel tabs cannot reuse it.
 */
export function consumePermit(permitId: string, userId: string): { ok: boolean; error?: string } {
  const list = getPermits();
  const permit = list.find((p) => p.id === permitId);
  if (!permit) return { ok: false, error: "التصريح غير موجود" };
  if (permit.status !== "ready") return { ok: false, error: "التصريح غير قابل للاستخدام" };
  setPermits(
    list.map((p) =>
      p.id === permitId && p.status === "ready"
        ? { ...p, status: "used" as const, usedAt: new Date().toISOString(), usedBy: userId }
        : p,
    ),
  );
  return { ok: true };
}

/* ---------- messages ---------- */

export const getMessages = () => read<Message[]>(KEYS.messages, []);
export const setMessages = (m: Message[]) => write(KEYS.messages, m);

/* ---------- audit ---------- */

export function logAudit(
  actor: { id: string; fullName: string },
  action: string,
  target: string,
  details?: string,
) {
  const events = getAudit();
  events.unshift({
    id: uid(),
    at: new Date().toISOString(),
    actorId: actor.id,
    actorName: actor.fullName,
    action,
    target,
    ...(details ? { details } : {}),
  });
  write(KEYS.audit, events.slice(0, 500));
}

export const getSessionUserId = () => read<string | null>(KEYS.session, null);
export const setSessionUserId = (id: string | null) => write(KEYS.session, id);

export function resetDemoData() {
  if (!isBrowser()) return;
  Object.values(KEYS).forEach((k) => window.localStorage.removeItem(k));
  ensureSeed();
}

export function subscribe(cb: () => void) {
  if (!isBrowser()) return () => {};
  window.addEventListener("sijil:changed", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("sijil:changed", cb);
    window.removeEventListener("storage", cb);
  };
}
