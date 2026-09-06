import {
  DEFAULT_SETTINGS,
  OWNER_ID,
  getSessionUserId,
  getSettings,
  getUsers,
  logAudit,
  setSettings,
  setUsers,
  uid,
  type Settings,
} from "./store";
import { ASSIGNABLE_ROLES, ROLE_LABEL, ROLE_PERMISSIONS, type Permission, type Role, type User } from "./types";

export interface Result {
  ok: boolean;
  error?: string;
}

/** authoritative permission check based on stored data, never on UI state */
export function userCan(u: User, p: Permission): boolean {
  return new Set<Permission>([...ROLE_PERMISSIONS[u.role], ...(u.extraPermissions ?? [])]).has(p);
}

/** resolves the real acting user from the session, ignoring anything the UI claims */
function actor(caller: User): User | null {
  const sessionId = getSessionUserId();
  if (!sessionId || sessionId !== caller.id) return null;
  const found = getUsers().find((u) => u.id === sessionId);
  return found && found.active ? found : null;
}

export interface NewUserInput {
  fullName: string;
  username: string;
  password: string;
  department: string;
  role: Role;
  signatureName?: string;
}

export function createUser(caller: User, input: NewUserInput): Result {
  const me = actor(caller);
  if (!me) return { ok: false, error: "الجلسة غير صالحة" };
  if (!userCan(me, "users.manage")) return { ok: false, error: "لا تملك صلاحية إدارة المستخدمين" };
  if (!ASSIGNABLE_ROLES.includes(input.role)) return { ok: false, error: "لا يمكن إنشاء حساب مالك" };
  if (!input.fullName.trim() || !input.username.trim()) return { ok: false, error: "الاسم واسم المستخدم مطلوبان" };
  if (input.password.length < 6) return { ok: false, error: "كلمة المرور ٦ أحرف على الأقل" };
  const list = getUsers();
  if (list.some((u) => u.username.toLowerCase() === input.username.trim().toLowerCase())) {
    return { ok: false, error: "اسم المستخدم مستخدم بالفعل" };
  }
  const created: User = {
    id: uid(),
    username: input.username.trim(),
    password: input.password,
    fullName: input.fullName.trim(),
    signatureName: input.signatureName?.trim() || input.fullName.trim(),
    role: input.role,
    department: input.department.trim() || "غير محدد",
    active: true,
    createdAt: new Date().toISOString(),
  };
  setUsers([...list, created]);
  logAudit(me, "إنشاء مستخدم", created.username, `الدور: ${ROLE_LABEL[created.role]}`);
  return { ok: true };
}

export type UserChanges = Partial<
  Pick<User, "fullName" | "signatureName" | "password" | "department" | "role" | "active" | "extraPermissions">
>;

export function updateUser(caller: User, targetId: string, changes: UserChanges, action: string): Result {
  const me = actor(caller);
  if (!me) return { ok: false, error: "الجلسة غير صالحة" };
  if (!userCan(me, "users.manage")) return { ok: false, error: "لا تملك صلاحية إدارة المستخدمين" };

  const list = getUsers();
  const target = list.find((u) => u.id === targetId);
  if (!target) return { ok: false, error: "المستخدم غير موجود" };

  const self = target.id === me.id;
  if (self && (changes.role !== undefined || changes.extraPermissions !== undefined || changes.active !== undefined)) {
    return { ok: false, error: "لا يمكنك تعديل دورك أو صلاحياتك أو حالتك" };
  }
  if (changes.role !== undefined && !ASSIGNABLE_ROLES.includes(changes.role)) {
    return { ok: false, error: "لا يمكن ترقية أي مستخدم إلى مالك" };
  }
  if (target.id === OWNER_ID && (changes.role !== undefined || changes.active !== undefined || changes.extraPermissions !== undefined)) {
    return { ok: false, error: "حساب المالك محمي" };
  }
  if (changes.password !== undefined && changes.password.length < 6) {
    return { ok: false, error: "كلمة المرور ٦ أحرف على الأقل" };
  }

  const before = {
    role: target.role,
    active: target.active,
    permissions: (target.extraPermissions ?? []).length,
    signature: target.signatureName ?? target.fullName,
  };
  const updated: User = { ...target, ...changes };
  setUsers(list.map((u) => (u.id === targetId ? updated : u)));
  const after = {
    role: updated.role,
    active: updated.active,
    permissions: (updated.extraPermissions ?? []).length,
    signature: updated.signatureName ?? updated.fullName,
  };
  logAudit(
    me,
    action,
    updated.username,
    `قبل: ${before.role}/${before.active ? "نشط" : "موقوف"}/صلاحيات ${before.permissions}/توقيع ${before.signature} ← بعد: ${after.role}/${after.active ? "نشط" : "موقوف"}/صلاحيات ${after.permissions}/توقيع ${after.signature}`,
  );
  return { ok: true };
}

export function updateSettings(caller: User, next: Partial<Settings>): Result {
  const me = actor(caller);
  if (!me) return { ok: false, error: "الجلسة غير صالحة" };
  if (!userCan(me, "settings.manage")) return { ok: false, error: "لا تملك صلاحية إدارة الإعدادات" };

  const before = getSettings();
  const merged: Settings = { ...DEFAULT_SETTINGS, ...before, ...next };
  const changed = (Object.keys(next) as (keyof Settings)[])
    .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(merged[k]))
    .map((k) => `${String(k)}: ${JSON.stringify(before[k])} ← ${JSON.stringify(merged[k])}`);
  setSettings(merged);
  if (changed.length) logAudit(me, "تعديل الإعدادات", "إعدادات النظام", changed.join(" · "));
  return { ok: true };
}
