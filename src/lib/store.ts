import type { AuditEvent, LogEntry, User } from "./types";

const KEYS = {
  users: "sijil.users",
  entries: "sijil.entries",
  audit: "sijil.audit",
  session: "sijil.session",
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

const SEED_USERS: User[] = [
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

export function ensureSeed() {
  if (!isBrowser()) return;
  if (!window.localStorage.getItem(KEYS.users)) write(KEYS.users, SEED_USERS);
  if (!window.localStorage.getItem(KEYS.entries)) write(KEYS.entries, SEED_ENTRIES);
  if (!window.localStorage.getItem(KEYS.audit)) write(KEYS.audit, [] as AuditEvent[]);
}

export const getUsers = () => read<User[]>(KEYS.users, []);
export const setUsers = (u: User[]) => write(KEYS.users, u);

export const getEntries = () => read<LogEntry[]>(KEYS.entries, []);
export const setEntries = (e: LogEntry[]) => write(KEYS.entries, e);

export const getAudit = () => read<AuditEvent[]>(KEYS.audit, []);

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
    details,
  });
  write(KEYS.audit, events.slice(0, 500));
}

export const getSessionUserId = () => read<string | null>(KEYS.session, null);
export const setSessionUserId = (id: string | null) => write(KEYS.session, id);

export function resetDemoData() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(KEYS.users);
  window.localStorage.removeItem(KEYS.entries);
  window.localStorage.removeItem(KEYS.audit);
  window.localStorage.removeItem(KEYS.session);
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
