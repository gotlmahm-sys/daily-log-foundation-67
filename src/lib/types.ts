export type Role = "admin" | "supervisor" | "employee";

export interface User {
  id: string;
  username: string;
  password: string;
  fullName: string;
  role: Role;
  department: string;
  active: boolean;
  createdAt: string;
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

export type Permission =
  | "log.view.own"
  | "log.view.all"
  | "log.create"
  | "log.edit.own"
  | "log.review"
  | "log.sign"
  | "users.manage"
  | "audit.view";

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
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
  admin: "مدير النظام",
  supervisor: "مشرف",
  employee: "موظف",
};

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
