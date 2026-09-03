import {
  getExitTypes,
  getPermits,
  getPersons,
  getSessionUserId,
  getSettings,
  getUsers,
  logAudit,
  readKey,
  setPermits,
  uid,
  writeKey,
} from "./store";
import { businessClock, businessDateOf, createDailyRecord, getStatementTypes, getTemplates, getTopics, renderStatement } from "./daily";
import { ROLE_PERMISSIONS } from "./types";
import type {
  Movement,
  MovementPerson,
  MovementStatus,
  Permission,
  Permit,
  Person,
  User,
} from "./types";

const K = { movements: "sijil.movements" } as const;

export const getMovements = () => readKey<Movement[]>(K.movements, []);
const setMovements = (m: Movement[]) => writeKey(K.movements, m);

const nowIso = () => new Date().toISOString();

function userCan(user: User, p: Permission): boolean {
  return new Set([...ROLE_PERMISSIONS[user.role], ...(user.extraPermissions ?? [])]).has(p);
}

/** authoritative actor resolution — identity/signature always from the store */
function actor(caller: User): User | null {
  const stored = getUsers().find((u) => u.id === caller.id);
  if (!stored || !stored.active) return null;
  const sessionId = getSessionUserId();
  if (sessionId && sessionId !== stored.id) return null;
  return stored;
}

const toMinutes = (hhmm: string) => {
  const [h = "0", m = "0"] = hhmm.split(":");
  return Number(h) * 60 + Number(m);
};

export const minutesBetween = (fromIso: string, toIso: string) =>
  Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000);

export function expectedReturnIso(permit: Permit): string {
  const date = permit.expectedReturnDate || businessDateOf();
  const time = permit.expectedReturnTime || "23:59";
  const d = new Date(`${date}T${time}:00`);
  return Number.isNaN(d.getTime()) ? new Date(`${date}T23:59:00Z`).toISOString() : d.toISOString();
}

/** derived state from actual data (never from statement text) */
export function statusOf(m: Movement, at: Date = new Date()): MovementStatus {
  if (m.return) return "returned";
  const late = minutesBetween(m.expectedReturnAt, at.toISOString());
  if (late <= 0) return "out";
  return late >= getSettings().absenceAfterMinutes ? "absent" : "late";
}

export const isOpen = (m: Movement) => !m.return;

export const openMovements = (at: Date = new Date()) =>
  getMovements()
    .filter(isOpen)
    .map((m) => ({ ...m, status: statusOf(m, at) }))
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));

export const movementsOfPerson = (personId: string) =>
  getMovements().filter((m) => m.persons.some((p) => p.personId === personId));

export const openMovementOfPerson = (personId: string) =>
  getMovements().find((m) => isOpen(m) && m.persons.some((p) => p.personId === personId)) ?? null;

/** persists derived late/absent status so the stored state is structured data */
export function refreshMovementStatuses(at: Date = new Date()) {
  const list = getMovements();
  let changed = false;
  const next = list.map((m) => {
    const s = statusOf(m, at);
    if (s !== m.status) {
      changed = true;
      return { ...m, status: s, updatedAt: at.toISOString() };
    }
    return m;
  });
  if (changed) setMovements(next);
  return next;
}

/* ---------- statement building through the existing template system ---------- */

function statementTypeIdByName(name: string): string | null {
  return getStatementTypes().find((t) => t.active && t.name === name)?.id ?? null;
}

function topicIdByName(name: string): string | null {
  const topics = getTopics().filter((t) => t.active);
  return topics.find((t) => t.name === name)?.id ?? null;
}

function pickTemplate(statementTypeName: string, movementTypeId: string | null, many: boolean) {
  const typeId = statementTypeIdByName(statementTypeName);
  const list = getTemplates().filter((t) => t.active && t.statementTypeId === typeId);
  const wants = (t: (typeof list)[number]) => t.pattern.includes(many ? "{PERSONS}" : "{PERSON}");
  return (
    list.find((t) => t.movementTypeId === movementTypeId && wants(t)) ??
    list.find((t) => t.movementTypeId === movementTypeId) ??
    list.find(wants) ??
    list[0] ??
    null
  );
}

/* ---------- start of movement (تسجيل القيام) ---------- */

export interface StartMovementInput {
  permitId: string;
  /** idempotency key generated once per submission attempt */
  requestId: string;
  at?: Date;
}

export interface MovementResult {
  ok: boolean;
  error?: string;
  movement?: Movement;
}

let writeLock = false;

export function startMovement(caller: User, input: StartMovementInput): MovementResult {
  if (writeLock) return { ok: false, error: "طلب قيد التنفيذ، حاول مجددًا" };
  writeLock = true;
  try {
    const user = actor(caller);
    if (!user) return { ok: false, error: "جلسة غير صالحة" };
    if (!userCan(user, "movements.start")) return { ok: false, error: "لا تملك صلاحية تسجيل القيام" };

    const all = getMovements();
    const duplicate = all.find((m) => m.requestId === input.requestId);
    if (duplicate) return { ok: true, movement: duplicate };

    const permit = getPermits().find((p) => p.id === input.permitId);
    if (!permit) return { ok: false, error: "التصريح غير موجود" };
    if (permit.status === "used") return { ok: false, error: "التصريح مستخدم مسبقًا" };
    if (permit.status === "cancelled") return { ok: false, error: "التصريح ملغى" };
    if (permit.status === "expired") return { ok: false, error: "التصريح منتهي" };
    if (permit.status !== "ready") return { ok: false, error: "التصريح غير قابل للاستخدام" };
    if (all.some((m) => isOpen(m) && m.permitId === permit.id)) {
      return { ok: false, error: "التصريح مستخدم مسبقًا" };
    }

    const exitType = getExitTypes().find((t) => t.id === permit.exitTypeId);
    if (!exitType || !exitType.active) return { ok: false, error: "نوع الخروج غير مفعل" };

    const persons = getPersons();
    const linked: Person[] = [];
    for (const rel of permit.persons) {
      const person = persons.find((p) => p.id === rel.personId);
      if (!person) return { ok: false, error: "الشخص غير موجود" };
      if (!person.active) return { ok: false, error: `الشخص ${person.fullName} غير نشط` };
      if (openMovementOfPerson(person.id)) return { ok: false, error: `${person.fullName} خارج بالفعل` };
      linked.push(person);
    }
    if (linked.length === 0) return { ok: false, error: "التصريح بدون أشخاص" };

    const at = input.at ?? new Date();
    const s = getSettings();
    if (toMinutes(businessClock(at)) < toMinutes(s.exitAllowedFrom)) {
      return { ok: false, error: `الخروج غير مسموح قبل ${s.exitAllowedFrom}` };
    }

    const movementPersons: MovementPerson[] = linked.map((p) => ({
      personId: p.id,
      fullNameAtStart: p.fullName,
      sNumberAtStart: p.sNumber,
      shortCodeAtStart: p.shortCode,
    }));

    const movement: Movement = {
      id: uid(),
      permitId: permit.id,
      exitTypeId: exitType.id,
      exitTypeName: exitType.name,
      persons: movementPersons,
      startedAt: at.toISOString(),
      businessDate: businessDateOf(at),
      expectedReturnAt: expectedReturnIso(permit),
      status: "out",
      startedBy: user.id,
      startedByName: user.fullName,
      signatureName: user.signatureName || user.fullName,
      createdAt: nowIso(),
      startRecordId: null,
      returnRecordId: null,
      requestId: input.requestId,
    };

    // permit is consumed only here — never on view
    setPermits(
      getPermits().map((p) =>
        p.id === permit.id && p.status === "ready"
          ? { ...p, status: "used" as const, usedAt: movement.startedAt, usedBy: user.id }
          : p,
      ),
    );
    setMovements([movement, ...all]);

    const many = linked.length > 1;
    const movementTypeId = statementTypeIdByName(exitType.name);
    const tpl = pickTemplate("قيام", movementTypeId, many);
    const text = tpl
      ? renderStatement(tpl.pattern, linked)
      : `قيام ${linked.map((p) => p.fullName).join("، ")} س ${linked.map((p) => p.sNumber ?? "-").join("، ")} ${exitType.name}.`;

    const rec = createDailyRecord(user, {
      statementText: text,
      topicId: tpl?.topicId ?? topicIdByName("قيام"),
      statementTypeId: statementTypeIdByName("قيام"),
      movementTypeId,
      templateId: tpl?.id ?? null,
      permitId: permit.id,
      movementId: movement.id,
      entryMode: tpl ? "template" : "system",
      persons: linked,
      variableValues: {
        "{PERSON}": linked[0]?.fullName ?? "",
        "{PERSONS}": linked.map((p) => p.fullName).join("، "),
        "{S_NUMBER}": linked.map((p) => String(p.sNumber ?? "-")).join("، "),
      },
      requestId: `mv-start-${movement.id}`,
      at,
    });

    const saved: Movement = { ...movement, startRecordId: rec.record?.id ?? null };
    setMovements([saved, ...all]);
    logAudit(user, "تسجيل قيام", movement.id, text.slice(0, 120));
    return { ok: true, movement: saved };
  } finally {
    writeLock = false;
  }
}

/* ---------- return (تسجيل العودة) ---------- */

export interface ReturnInput {
  movementId: string;
  requestId: string;
  at?: Date;
}

export function registerReturn(caller: User, input: ReturnInput): MovementResult {
  if (writeLock) return { ok: false, error: "طلب قيد التنفيذ، حاول مجددًا" };
  writeLock = true;
  try {
    const user = actor(caller);
    if (!user) return { ok: false, error: "جلسة غير صالحة" };
    if (!userCan(user, "movements.return")) return { ok: false, error: "لا تملك صلاحية تسجيل العودة" };

    const all = getMovements();
    const movement = all.find((m) => m.id === input.movementId);
    if (!movement) return { ok: false, error: "لا توجد حركة خروج مسجلة" };
    if (movement.return) return { ok: true, movement };
    if (movement.persons.length === 0) return { ok: false, error: "الحركة بدون أشخاص" };

    const at = input.at ?? new Date();
    const atIso = at.toISOString();
    const lateMinutes = Math.max(0, minutesBetween(movement.expectedReturnAt, atIso));
    const wasAbsent = statusOf(movement, at) === "absent";

    const returned: Movement = {
      ...movement,
      status: "returned",
      updatedAt: atIso,
      return: {
        at: atIso,
        byUserId: user.id,
        byUserName: user.fullName,
        signatureName: user.signatureName || user.fullName,
        expectedReturnAt: movement.expectedReturnAt,
        durationMinutes: Math.max(0, minutesBetween(movement.startedAt, atIso)),
        onTime: lateMinutes === 0,
        late: lateMinutes > 0,
        lateMinutes,
        fromAbsence: wasAbsent,
        absenceMinutes: wasAbsent ? lateMinutes : 0,
      },
    };
    // history is never deleted — the movement stays, only its state closes
    setMovements(all.map((m) => (m.id === movement.id ? returned : m)));

    const persons = getPersons();
    const linked = movement.persons
      .map((rel) => persons.find((p) => p.id === rel.personId))
      .filter(Boolean) as Person[];
    const many = movement.persons.length > 1;
    const typeName = wasAbsent ? "عودة من غياب" : "عودة";
    const movementTypeId = statementTypeIdByName(movement.exitTypeName);
    const tpl = pickTemplate(typeName, movementTypeId, many) ?? pickTemplate("عودة", movementTypeId, many);

    const names = movement.persons.map((p) => p.fullNameAtStart).join("، ");
    const sNums = movement.persons.map((p) => p.sNumberAtStart ?? "-").join("، ");
    const fallback = wasAbsent
      ? `عودة ${names} س ${sNums} من غياب.`
      : `عودة ${names} س ${sNums} من ${movement.exitTypeName}.`;
    const text = tpl && linked.length === movement.persons.length ? renderStatement(tpl.pattern, linked) : fallback;

    // the return statement belongs to the business date of the actual return
    const rec = createDailyRecord(user, {
      statementText: text,
      topicId: (wasAbsent ? topicIdByName("عودة من غياب") : null) ?? tpl?.topicId ?? topicIdByName("عودة"),
      statementTypeId: statementTypeIdByName(typeName) ?? statementTypeIdByName("عودة"),
      movementTypeId,
      templateId: tpl?.id ?? null,
      permitId: movement.permitId,
      movementId: movement.id,
      entryMode: tpl ? "template" : "system",
      persons: linked,
      variableValues: {
        "{PERSON}": movement.persons[0]?.fullNameAtStart ?? "",
        "{PERSONS}": names,
        "{S_NUMBER}": sNums,
      },
      requestId: `mv-return-${movement.id}`,
      at,
    });

    const saved: Movement = { ...returned, returnRecordId: rec.record?.id ?? null };
    setMovements(getMovements().map((m) => (m.id === movement.id ? saved : m)));
    logAudit(
      user,
      wasAbsent ? "تسجيل عودة من غياب" : "تسجيل عودة",
      movement.id,
      `تأخير ${lateMinutes} دقيقة · مدة ${saved.return?.durationMinutes} دقيقة`,
    );
    return { ok: true, movement: saved };
  } finally {
    writeLock = false;
  }
}
