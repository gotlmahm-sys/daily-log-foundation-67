export type Role = "owner" | "admin" | "supervisor" | "employee";

export interface User {
  id: string;
  username: string;
  /** optional email login (owner uses email) */
  email?: string;
  password: string;
  fullName: string;
  /** name used on official signature; falls back to fullName */
  signatureName?: string;
  role: Role;
  department: string;
  active: boolean;
  createdAt: string;
  /** permissions granted individually by the owner, on top of the role */
  extraPermissions?: Permission[];
}

export type EntryStatus = "draft" | "submitted" | "approved" | "rejected";

export interface Signature {
  userId: string;
  fullName: string;
  role: Role;
  signedAt: string;
  /** data URL of the drawn signature */
  image: string;
}

export interface LogEntry {
  id: string;
  date: string;
  shift: "morning" | "evening" | "night";
  department: string;
  title: string;
  body: string;
  authorId: string;
  authorName: string;
  status: EntryStatus;
  reviewerNote?: string;
  signatures: Signature[];
  createdAt: string;
  updatedAt: string;
}

export interface AuditEvent {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  action: string;
  target: string;
  details?: string;
}

/* ---------- Persons ---------- */

/** number of S groups; configurable, currently 1..18 */
export const S_COUNT = 18;
export const S_LIST = Array.from({ length: S_COUNT }, (_, i) => i + 1);

export interface Person {
  /** stable internal identity — never the name, code or S */
  id: string;
  fullName: string;
  nationalId?: string;
  shortCode: string;
  sNumber: number | null;
  active: boolean;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  updatedAt?: string;
}

export type ShortCodeStrategy = "first2last2" | "last4" | "middle4" | "manual";

export const SHORT_CODE_STRATEGY_LABEL: Record<ShortCodeStrategy, string> = {
  first2last2: "أول رقمين + آخر رقمين",
  last4: "آخر أربعة أرقام",
  middle4: "أربعة أرقام من المنتصف",
  manual: "كود يدوي",
};

/* ---------- Permits ---------- */

export interface ExitType {
  id: string;
  name: string;
  requiresPermit: boolean;
  hasReturnTime: boolean;
  allowsNextDayReturn: boolean;
  active: boolean;
}

export type PermitStatus = "ready" | "used" | "cancelled" | "expired";

export const PERMIT_STATUS_LABEL: Record<PermitStatus, string> = {
  ready: "جاهز",
  used: "منفذ",
  cancelled: "ملغى",
  expired: "منتهي",
};

export interface PermitPerson {
  personId: string;
}

export interface Permit {
  id: string;
  /** structured relation — supports group permits */
  persons: PermitPerson[];
  exitTypeId: string;
  exitTime: string;
  expectedReturnTime: string;
  expectedReturnDate: string;
  durationMinutes?: number;
  notes?: string;
  issuedBy: string;
  issuedByName: string;
  issuedAt: string;
  status: PermitStatus;
  /** set only when a movement consumes the permit (Prompt 4) */
  usedAt?: string;
  usedBy?: string;
  updatedAt?: string;
}

/* ---------- Messages (structure only) ---------- */

export interface Message {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  body: string;
  at: string;
  read: boolean;
}

/* ---------- Daily register (Prompt 3) ---------- */

/** dynamic statement / movement type — extendable, never hard-coded in UI */
export interface StatementType {
  id: string;
  name: string;
  /** optional grouping: movement types are a subset of statement types */
  isMovement: boolean;
  active: boolean;
}

export interface Topic {
  id: string;
  name: string;
  /** words that indicate this topic when a statement starts with them */
  keywords: string[];
  active: boolean;
}

export type TemplateSource = "template" | "manual";

export const TEMPLATE_VARIABLES = ["{PERSON}", "{PERSONS}", "{S_NUMBER}"] as const;
export type TemplateVariable = string;

export interface StatementTemplate {
  id: string;
  name: string;
  /** statement pattern, may contain variables like {PERSON} */
  pattern: string;
  topicId: string | null;
  statementTypeId: string | null;
  movementTypeId: string | null;
  variables: TemplateVariable[];
  usageCount: number;
  lastUsedAt?: string;
  active: boolean;
  source: TemplateSource;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DailyRegister {
  id: string;
  businessDate: string;
  status: "open" | "closed";
  openedAt: string;
  openedBy: string;
  openedByName: string;
  closedAt?: string;
  closedBy?: string;
  closedByName?: string;
}

/** structured relation: daily record -> person */
export interface RecordPerson {
  personId: string;
  /** historical snapshot for display only — identity stays personId */
  fullNameAtCreation: string;
  sNumberAtCreation: number | null;
  shortCodeAtCreation: string;
}

export type RecordEntryMode = "template" | "manual" | "system";

export interface DailyRecord {
  id: string;
  registerId: string;
  businessDate: string;
  sequence: number;
  /** actual operation time, independent of business date */
  createdAt: string;
  /** final rendered statement text, frozen at creation */
  statementText: string;
  topicId: string | null;
  topicName: string;
  statementTypeId: string | null;
  statementTypeName: string;
  movementTypeId: string | null;
  templateId: string | null;
  entryMode: RecordEntryMode;
  /** structured variable values used at render time */
  variableValues: Record<string, string>;
  persons: RecordPerson[];
  createdBy: string;
  createdByName: string;
  /** historical signature snapshot of the creating user */
  signatureName: string;
  /** future link (Prompt 4) — never inferred from text */
  permitId?: string | null;
  /** idempotency guard against duplicate submissions */
  requestId: string;
}

/* ---------- Permissions ---------- */

export type Permission =
  | "log.view.own"
  | "log.view.all"
  | "log.create"
  | "log.edit.own"
  | "log.review"
  | "log.sign"
  | "users.manage"
  | "audit.view"
  | "persons.manage"
  | "permits.issue"
  | "permits.edit"
  | "permits.cancel"
  | "permits.ready.view"
  | "records.view"
  | "records.create"
  | "records.manual"
  | "templates.use"
  | "templates.manage";

export const PERMISSION_LABEL: Record<Permission, string> = {
  "log.view.own": "عرض قيوده",
  "log.view.all": "عرض كل القيود",
  "log.create": "إنشاء قيد",
  "log.edit.own": "تعديل قيوده",
  "log.review": "اعتماد القيود",
  "log.sign": "التوقيع",
  "users.manage": "إدارة المستخدمين",
  "audit.view": "سجل العمليات",
  "persons.manage": "إدارة الأشخاص",
  "permits.issue": "إصدار التصاريح",
  "permits.edit": "تعديل التصاريح",
  "permits.cancel": "إلغاء التصاريح",
  "permits.ready.view": "عرض التصاريح الجاهزة",
  "records.view": "مشاهدة السجل اليومي",
  "records.create": "إضافة بيان",
  "records.manual": "الكتابة اليدوية",
  "templates.use": "استخدام القوالب",
  "templates.manage": "إضافة/حفظ قالب",
};

/** permissions the owner may grant individually to any user */
export const GRANTABLE_PERMISSIONS: Permission[] = [
  "persons.manage",
  "permits.issue",
  "permits.edit",
  "permits.cancel",
  "permits.ready.view",
  "records.view",
  "records.create",
  "records.manual",
  "templates.use",
  "templates.manage",
];


export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [
    "log.view.own",
    "log.view.all",
    "log.create",
    "log.edit.own",
    "log.review",
    "log.sign",
    "users.manage",
    "audit.view",
    "persons.manage",
    "permits.issue",
    "permits.edit",
    "permits.cancel",
    "permits.ready.view",
  ],
  admin: [
    "log.view.own",
    "log.view.all",
    "log.create",
    "log.edit.own",
    "log.review",
    "log.sign",
    "users.manage",
    "audit.view",
  ],
  supervisor: ["log.view.own", "log.view.all", "log.create", "log.edit.own", "log.review", "log.sign"],
  employee: ["log.view.own", "log.create", "log.edit.own", "log.sign"],
};

export const ROLE_LABEL: Record<Role, string> = {
  owner: "المالك",
  admin: "مدير النظام",
  supervisor: "مشرف",
  employee: "موظف",
};

/** roles that can be assigned from the UI — owner is never assignable */
export const ASSIGNABLE_ROLES: Role[] = ["admin", "supervisor", "employee"];

export const STATUS_LABEL: Record<EntryStatus, string> = {
  draft: "مسودة",
  submitted: "بانتظار الاعتماد",
  approved: "معتمد",
  rejected: "مرفوض",
};

export const SHIFT_LABEL: Record<LogEntry["shift"], string> = {
  morning: "صباحية",
  evening: "مسائية",
  night: "ليلية",
};
