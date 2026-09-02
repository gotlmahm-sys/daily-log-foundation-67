import { getSettings, logAudit, readKey, uid, writeKey } from "./store";
import type {
  DailyRecord,
  DailyRegister,
  Person,
  RecordEntryMode,
  RecordPerson,
  StatementTemplate,
  StatementType,
  Topic,
  User,
} from "./types";

const K = {
  registers: "sijil.registers",
  records: "sijil.records",
  templates: "sijil.templates",
  topics: "sijil.topics",
  statementTypes: "sijil.statementTypes",
} as const;

/* ---------- seeds (dynamic data, never hard-coded in the UI) ---------- */

const SEED_STATEMENT_TYPES: StatementType[] = [
  { id: "st-qiyam", name: "قيام", isMovement: true, active: true },
  { id: "st-return", name: "عودة", isMovement: true, active: true },
  { id: "st-absence", name: "غياب", isMovement: true, active: true },
  { id: "st-return-absence", name: "عودة من غياب", isMovement: true, active: true },
  { id: "st-fosha", name: "فسحة", isMovement: true, active: true },
  { id: "st-hospital", name: "فسحة مستشفى", isMovement: true, active: true },
  { id: "st-leave", name: "إجازة", isMovement: true, active: true },
  { id: "st-mission", name: "مأمورية", isMovement: true, active: true },
  { id: "st-open", name: "افتتاح", isMovement: false, active: true },
  { id: "st-end", name: "نهاية", isMovement: false, active: true },
];

const SEED_TOPICS: Topic[] = [
  { id: "tp-open", name: "افتتاح", keywords: ["افتتاح", "بداية"], active: true },
  { id: "tp-end", name: "نهاية", keywords: ["نهاية", "ختام"], active: true },
  { id: "tp-qiyam", name: "قيام", keywords: ["قيام", "خروج", "توجه"], active: true },
  { id: "tp-return", name: "عودة", keywords: ["عودة", "عاد", "رجوع"], active: true },
  { id: "tp-absence", name: "غياب", keywords: ["غياب", "تخلف"], active: true },
  { id: "tp-note", name: "ملاحظة", keywords: ["ملاحظة", "تنويه"], active: true },
];

const now = () => new Date().toISOString();

const SEED_TEMPLATES: StatementTemplate[] = [
  {
    id: "tpl-fosha",
    name: "قيام فسحة (شخص واحد)",
    pattern: "قيام المجند {PERSON} س {S_NUMBER} فسحة.",
    topicId: "tp-qiyam",
    statementTypeId: "st-qiyam",
    movementTypeId: "st-fosha",
    variables: ["{PERSON}", "{S_NUMBER}"],
    usageCount: 0,
    active: true,
    source: "template",
    createdBy: "system",
    createdByName: "النظام",
    createdAt: now(),
  },
  {
    id: "tpl-fosha-group",
    name: "قيام فسحة (مجموعة)",
    pattern: "قيام كلًا من المجندين الآتي أسماؤهم: {PERSONS} فسحة.",
    topicId: "tp-qiyam",
    statementTypeId: "st-qiyam",
    movementTypeId: "st-fosha",
    variables: ["{PERSONS}"],
    usageCount: 0,
    active: true,
    source: "template",
    createdBy: "system",
    createdByName: "النظام",
    createdAt: now(),
  },
  {
    id: "tpl-hospital",
    name: "قيام فسحة مستشفى",
    pattern: "قيام المجند {PERSON} س {S_NUMBER} فسحة مستشفى.",
    topicId: "tp-qiyam",
    statementTypeId: "st-qiyam",
    movementTypeId: "st-hospital",
    variables: ["{PERSON}", "{S_NUMBER}"],
    usageCount: 0,
    active: true,
    source: "template",
    createdBy: "system",
    createdByName: "النظام",
    createdAt: now(),
  },
  {
    id: "tpl-return",
    name: "عودة من الفسحة",
    pattern: "عودة المجند {PERSON} س {S_NUMBER} من الفسحة.",
    topicId: "tp-return",
    statementTypeId: "st-return",
    movementTypeId: "st-return",
    variables: ["{PERSON}", "{S_NUMBER}"],
    usageCount: 0,
    active: true,
    source: "template",
    createdBy: "system",
    createdByName: "النظام",
    createdAt: now(),
  },
];

export function ensureDailySeed() {
  if (typeof window === "undefined") return;
  if (!window.localStorage.getItem(K.statementTypes)) writeKey(K.statementTypes, SEED_STATEMENT_TYPES);
  if (!window.localStorage.getItem(K.topics)) writeKey(K.topics, SEED_TOPICS);
  if (!window.localStorage.getItem(K.templates)) writeKey(K.templates, SEED_TEMPLATES);
  if (!window.localStorage.getItem(K.registers)) writeKey(K.registers, [] as DailyRegister[]);
  if (!window.localStorage.getItem(K.records)) writeKey(K.records, [] as DailyRecord[]);
}

/* ---------- accessors ---------- */

export const getStatementTypes = () => readKey<StatementType[]>(K.statementTypes, SEED_STATEMENT_TYPES);
export const getTopics = () => readKey<Topic[]>(K.topics, SEED_TOPICS);
export const setTopics = (t: Topic[]) => writeKey(K.topics, t);
export const getTemplates = () => readKey<StatementTemplate[]>(K.templates, SEED_TEMPLATES);
export const setTemplates = (t: StatementTemplate[]) => writeKey(K.templates, t);
export const getRegisters = () => readKey<DailyRegister[]>(K.registers, []);
export const getRecords = () => readKey<DailyRecord[]>(K.records, []);

/* ---------- business date ---------- */

/** wall-clock parts of a date in the configured business timezone */
function zoned(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    date: `${parts["year"]}-${parts["month"]}-${parts["day"]}`,
    minutes: Number(parts["hour"] === "24" ? "0" : parts["hour"]) * 60 + Number(parts["minute"]),
  };
}

const toMinutes = (hhmm: string) => {
  const [h = "0", m = "0"] = hhmm.split(":");
  return Number(h) * 60 + Number(m);
};

const shiftDate = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * business_date is derived from system settings (timezone + day start),
 * never from raw UTC or the device clock alone.
 */
export function businessDateOf(at: Date = new Date()): string {
  const s = getSettings();
  const { date, minutes } = zoned(at, s.timeZone);
  return minutes < toMinutes(s.dayStart) ? shiftDate(date, -1) : date;
}

export function businessClock(at: Date = new Date()) {
  const s = getSettings();
  const { minutes } = zoned(at, s.timeZone);
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function formatBusinessTime(iso: string) {
  const s = getSettings();
  return new Intl.DateTimeFormat("ar-EG", {
    timeZone: s.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/* ---------- registers ---------- */

export function getRegister(businessDate: string) {
  return getRegisters().find((r) => r.businessDate === businessDate) ?? null;
}

export function openRegister(user: User, businessDate = businessDateOf()): DailyRegister {
  const list = getRegisters();
  const existing = list.find((r) => r.businessDate === businessDate);
  if (existing) return existing;
  const reg: DailyRegister = {
    id: `reg-${businessDate}`,
    businessDate,
    status: "open",
    openedAt: now(),
    openedBy: user.id,
    openedByName: user.fullName,
  };
  writeKey(K.registers, [reg, ...list]);
  logAudit(user, "فتح يوم عمل", businessDate);
  return reg;
}

export function closeRegister(user: User, businessDate: string) {
  writeKey(
    K.registers,
    getRegisters().map((r) =>
      r.businessDate === businessDate
        ? { ...r, status: "closed" as const, closedAt: now(), closedBy: user.id, closedByName: user.fullName }
        : r,
    ),
  );
  logAudit(user, "إغلاق يوم عمل", businessDate);
}

export const getRecordsFor = (businessDate: string) =>
  getRecords()
    .filter((r) => r.businessDate === businessDate)
    .sort((a, b) => a.sequence - b.sequence);

/* ---------- template rendering ---------- */

export const personLabel = (p: Person) => p.fullName;

export function renderStatement(pattern: string, persons: Person[]): string {
  const first = persons[0];
  const names = persons.map(personLabel);
  const sNumbers = persons.map((p) => (p.sNumber ?? "-")).join("، ");
  return pattern
    .replaceAll("{PERSONS}", names.join("، "))
    .replaceAll("{PERSON}", first ? personLabel(first) : "")
    .replaceAll("{S_NUMBER}", persons.length > 1 ? sNumbers : String(first?.sNumber ?? "-"));
}

export function templateVariables(pattern: string): string[] {
  return Array.from(new Set(pattern.match(/\{[A-Z_]+\}/g) ?? []));
}

export const templateNeedsPersons = (pattern: string) =>
  templateVariables(pattern).some((v) => v === "{PERSON}" || v === "{PERSONS}" || v === "{S_NUMBER}");

export function sortTemplates(list: StatementTemplate[], mode: "usage" | "recent") {
  return [...list]
    .filter((t) => t.active)
    .sort((a, b) =>
      mode === "usage"
        ? b.usageCount - a.usageCount || (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? "")
        : (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? "") || b.usageCount - a.usageCount,
    );
}

/* ---------- topic detection (meaning of the statement opening) ---------- */

const normalize = (s: string) => s.replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/[^\p{L}\p{N}\s]/gu, " ");

export function suggestTopic(text: string): Topic | null {
  const words = normalize(text).trim().split(/\s+/).slice(0, 3);
  const topics = getTopics().filter((t) => t.active);
  for (const w of words) {
    const hit = topics.find((t) => t.keywords.some((k) => normalize(k) === w || w.startsWith(normalize(k))));
    if (hit) return hit;
  }
  return null;
}

/** proposes a reusable pattern by turning the selected persons' data into variables */
export function suggestPattern(text: string, persons: Person[]): string {
  let out = text;
  if (persons.length > 1) {
    const joined = persons.map(personLabel).join("، ");
    if (out.includes(joined)) out = out.replaceAll(joined, "{PERSONS}");
    else persons.forEach((p) => (out = out.replaceAll(personLabel(p), "{PERSONS}")));
  } else {
    persons.forEach((p) => (out = out.replaceAll(personLabel(p), "{PERSON}")));
  }
  persons.forEach((p) => {
    if (p.sNumber != null) out = out.replace(new RegExp(`(س\\s*)${p.sNumber}(?!\\d)`, "g"), "$1{S_NUMBER}");
    if (p.shortCode) out = out.replaceAll(p.shortCode, "{S_NUMBER}");
  });
  return out;
}

/* ---------- record creation ---------- */

export interface CreateRecordInput {
  statementText: string;
  topicId: string | null;
  statementTypeId: string | null;
  movementTypeId?: string | null;
  templateId?: string | null;
  entryMode: RecordEntryMode;
  persons: Person[];
  variableValues?: Record<string, string>;
  /** idempotency key, generated once per submission attempt */
  requestId: string;
  at?: Date;
}

export interface CreateRecordResult {
  ok: boolean;
  error?: string;
  record?: DailyRecord;
}

/** in-tab guard so rapid double clicks cannot interleave a read-modify-write */
let writeLock = false;

/** data-layer permission check: never trust the UI having hidden a button */
function userCan(user: User, p: Permission): boolean {
  return new Set([...ROLE_PERMISSIONS[user.role], ...(user.extraPermissions ?? [])]).has(p);
}

/**
 * Resolves the authoritative actor from the store: identity, name and signature
 * always come from the persisted user record, never from the caller's object.
 */
function actor(user: User): User | null {
  const stored = getUsers().find((u) => u.id === user.id);
  if (!stored || !stored.active) return null;
  const sessionId = getSessionUserId();
  if (sessionId && sessionId !== stored.id) return null;
  return stored;
}

/**
 * Creates a daily record. Sequence is assigned by the store (never by the UI),
 * restarts at 1 for each business_date, and is protected against duplicates by
 * a request-id guard plus a uniqueness check on (business_date, sequence).
 */
export function createDailyRecord(caller: User, input: CreateRecordInput): CreateRecordResult {
  if (writeLock) return { ok: false, error: "طلب قيد التنفيذ، حاول مجددًا" };
  writeLock = true;
  try {
    const user = actor(caller);
    if (!user) return { ok: false, error: "جلسة غير صالحة" };
    if (!userCan(user, "records.create")) return { ok: false, error: "لا تملك صلاحية إضافة بيان" };
    if (input.entryMode === "manual" && !userCan(user, "records.manual")) {
      return { ok: false, error: "لا تملك صلاحية الكتابة اليدوية" };
    }
    if (input.entryMode === "template" && !userCan(user, "templates.use")) {
      return { ok: false, error: "لا تملك صلاحية استخدام القوالب" };
    }

    const text = input.statementText.trim();
    if (!text) return { ok: false, error: "نص البيان مطلوب" };

    const all = getRecords();
    const duplicate = all.find((r) => r.requestId === input.requestId);
    if (duplicate) return { ok: true, record: duplicate };

    // creation time is taken from the system clock, never from user input
    const at = input.entryMode === "system" && input.at ? input.at : new Date();
    const businessDate = businessDateOf(at);
    const register = openRegister(user, businessDate);
    if (register.status === "closed") return { ok: false, error: "اليوم مغلق" };

    const sameDay = all.filter((r) => r.businessDate === businessDate);
    const sequence = sameDay.reduce((m, r) => Math.max(m, r.sequence), 0) + 1;
    if (sameDay.some((r) => r.sequence === sequence)) return { ok: false, error: "تعارض في التسلسل، أعد المحاولة" };


    const topics = getTopics();
    const types = getStatementTypes();
    const recordPersons: RecordPerson[] = input.persons.map((p) => ({
      personId: p.id,
      fullNameAtCreation: p.fullName,
      sNumberAtCreation: p.sNumber,
      shortCodeAtCreation: p.shortCode,
    }));

    const record: DailyRecord = {
      id: uid(),
      registerId: register.id,
      businessDate,
      sequence,
      createdAt: at.toISOString(),
      statementText: text,
      topicId: input.topicId,
      topicName: topics.find((t) => t.id === input.topicId)?.name ?? "",
      statementTypeId: input.statementTypeId,
      statementTypeName: types.find((t) => t.id === input.statementTypeId)?.name ?? "",
      movementTypeId: input.movementTypeId ?? null,
      templateId: input.templateId ?? null,
      entryMode: input.entryMode,
      variableValues: input.variableValues ?? {},
      persons: recordPersons,
      createdBy: user.id,
      createdByName: user.fullName,
      signatureName: user.signatureName || user.fullName,
      permitId: null,
      requestId: input.requestId,
    };

    writeKey(K.records, [...all, record]);

    if (input.templateId) {
      setTemplates(
        getTemplates().map((t) =>
          t.id === input.templateId ? { ...t, usageCount: t.usageCount + 1, lastUsedAt: record.createdAt } : t,
        ),
      );
    }

    logAudit(user, "إضافة بيان", `${businessDate} #${sequence}`, text.slice(0, 120));
    return { ok: true, record };
  } finally {
    writeLock = false;
  }
}

export function saveTemplate(
  user: User,
  data: {
    name: string;
    pattern: string;
    topicId: string | null;
    statementTypeId: string | null;
    movementTypeId?: string | null;
    source: StatementTemplate["source"];
  },
): { ok: boolean; error?: string; template?: StatementTemplate } {
  const pattern = data.pattern.trim();
  if (!data.name.trim() || !pattern) return { ok: false, error: "اسم القالب وصيغة البيان مطلوبان" };
  const tpl: StatementTemplate = {
    id: uid(),
    name: data.name.trim(),
    pattern,
    topicId: data.topicId,
    statementTypeId: data.statementTypeId,
    movementTypeId: data.movementTypeId ?? null,
    variables: templateVariables(pattern),
    usageCount: 0,
    active: true,
    source: data.source,
    createdBy: user.id,
    createdByName: user.fullName,
    createdAt: now(),
  };
  setTemplates([tpl, ...getTemplates()]);
  logAudit(user, "حفظ قالب", tpl.name);
  return { ok: true, template: tpl };
}

/** creates the configurable opening statement of the day */
export function createOpeningRecord(user: User, businessDate = businessDateOf()): CreateRecordResult {
  const s = getSettings();
  const topics = getTopics();
  const types = getStatementTypes();
  const existing = getRecordsFor(businessDate);
  if (existing.some((r) => r.statementTypeName === s.openingStatement.statementTypeName)) {
    return { ok: false, error: "تم افتتاح اليوم مسبقًا" };
  }
  return createDailyRecord(user, {
    statementText: s.openingStatement.text,
    topicId: topics.find((t) => t.name === s.openingStatement.topic)?.id ?? null,
    statementTypeId: types.find((t) => t.name === s.openingStatement.statementTypeName)?.id ?? null,
    entryMode: "system",
    persons: [],
    requestId: `open-${businessDate}`,
  });
}

/** structure for the end-of-day statement (no reports or dashboards here) */
export function createClosingRecord(user: User, businessDate = businessDateOf()): CreateRecordResult {
  const s = getSettings();
  const topics = getTopics();
  const types = getStatementTypes();
  const res = createDailyRecord(user, {
    statementText: s.closingStatement.text,
    topicId: topics.find((t) => t.name === s.closingStatement.topic)?.id ?? null,
    statementTypeId: types.find((t) => t.name === s.closingStatement.statementTypeName)?.id ?? null,
    entryMode: "system",
    persons: [],
    requestId: `close-${businessDate}`,
  });
  if (res.ok) closeRegister(user, businessDate);
  return res;
}
