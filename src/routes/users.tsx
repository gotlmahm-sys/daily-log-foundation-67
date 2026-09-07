import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { useStoreData } from "@/hooks/use-store-data";
import { OWNER_ID, resetDemoData } from "@/lib/store";
import { createUser, updateUser } from "@/lib/admin";
import {
  ASSIGNABLE_ROLES,
  GRANTABLE_PERMISSIONS,
  PERMISSION_LABEL,
  ROLE_LABEL,
  type Permission,
  type Role,
  type User,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/users")({
  head: () => ({
    meta: [
      { title: "إدارة المستخدمين | السجل اليومي الإلكتروني" },
      { name: "description", content: "إضافة المستخدمين وتحديد أدوارهم وصلاحياتهم وتفعيل أو إيقاف الحسابات." },
      { property: "og:title", content: "إدارة المستخدمين" },
      { property: "og:description", content: "إدارة الحسابات والأدوار والصلاحيات في نظام السجل اليومي." },
    ],
  }),
  component: () => (
    <AppShell requires="users.manage">
      <UsersPage />
    </AppShell>
  ),
});

const emptyForm = {
  fullName: "",
  username: "",
  password: "",
  department: "التشغيل",
  signatureName: "",
  role: "employee" as Role,
};

function UsersPage() {
  const { user } = useAuth();
  const { users } = useStoreData();
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [edit, setEdit] = useState({ fullName: "", signatureName: "", department: "", password: "" });

  if (!user) return null;

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const res = createUser(user, form);
    if (!res.ok) {
      toast.error(res.error ?? "تعذر إنشاء المستخدم");
      return;
    }
    setForm({ ...form, fullName: "", username: "", password: "", signatureName: "" });
    toast.success("تمت إضافة المستخدم");
  };

  const apply = (targetId: string, changes: Parameters<typeof updateUser>[2], action: string) => {
    const res = updateUser(user, targetId, changes, action);
    if (!res.ok) toast.error(res.error ?? "تعذر التعديل");
    else toast.success("تم الحفظ");
    return res.ok;
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">إضافة مستخدم</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={add} className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">الاسم الكامل</Label>
              <Input id="fullName" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">اسم المستخدم</Label>
              <Input id="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dept">القسم</Label>
              <Input id="dept" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sig">اسم التوقيع (اختياري)</Label>
              <Input id="sig" value={form.signatureName} onChange={(e) => setForm({ ...form, signatureName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>الدور</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full md:w-auto">
                إضافة
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {users.map((u: User) => {
          const self = u.id === user.id;
          const owner = u.id === OWNER_ID;
          return (
            <Card key={u.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium">
                    {u.fullName} {self && <span className="text-xs text-muted-foreground">(أنت)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {u.username} · {u.department} · توقيع: {u.signatureName || u.fullName}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={u.active ? "secondary" : "destructive"}>{u.active ? "نشط" : "موقوف"}</Badge>
                  <Select
                    value={u.role}
                    onValueChange={(v) =>
                      apply(u.id, { role: v as Role }, "تغيير دور مستخدم")
                    }
                    disabled={self || owner}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(owner ? (["owner"] as Role[]) : ASSIGNABLE_ROLES).map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={self || owner}
                    onClick={() => apply(u.id, { active: !u.active }, u.active ? "إيقاف مستخدم" : "تفعيل مستخدم")}
                  >
                    {u.active ? "إيقاف" : "تفعيل"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(editing === u.id ? null : u.id);
                      setEdit({
                        fullName: u.fullName,
                        signatureName: u.signatureName ?? u.fullName,
                        department: u.department,
                        password: "",
                      });
                    }}
                  >
                    تعديل البيانات
                  </Button>
                </div>

                {editing === u.id && (
                  <div className="grid w-full gap-3 border-t border-border pt-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>الاسم الكامل</Label>
                      <Input value={edit.fullName} onChange={(e) => setEdit({ ...edit, fullName: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>اسم التوقيع</Label>
                      <Input value={edit.signatureName} onChange={(e) => setEdit({ ...edit, signatureName: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>القسم</Label>
                      <Input value={edit.department} onChange={(e) => setEdit({ ...edit, department: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>كلمة مرور جديدة (اختياري)</Label>
                      <Input
                        type="password"
                        value={edit.password}
                        onChange={(e) => setEdit({ ...edit, password: e.target.value })}
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          const changes: Parameters<typeof updateUser>[2] = {
                            fullName: edit.fullName.trim() || u.fullName,
                            signatureName: edit.signatureName.trim() || u.fullName,
                            department: edit.department.trim() || u.department,
                          };
                          if (edit.password) changes.password = edit.password;
                          if (apply(u.id, changes, "تعديل بيانات مستخدم")) setEditing(null);
                        }}
                      >
                        حفظ
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
                        إلغاء
                      </Button>
                    </div>
                  </div>
                )}

                {!owner && !self && (
                  <div className="w-full space-y-1 border-t border-border pt-2">
                    <p className="text-xs font-semibold text-muted-foreground">صلاحيات إضافية</p>
                    <div className="flex flex-wrap gap-1.5">
                      {GRANTABLE_PERMISSIONS.map((p) => {
                        const on = (u.extraPermissions ?? []).includes(p);
                        return (
                          <Button
                            key={p}
                            size="sm"
                            variant={on ? "default" : "outline"}
                            onClick={() => {
                              const next = on
                                ? (u.extraPermissions ?? []).filter((x) => x !== p)
                                : ([...(u.extraPermissions ?? []), p] as Permission[]);
                              apply(u.id, { extraPermissions: next }, on ? "سحب صلاحية" : "منح صلاحية");
                            }}
                          >
                            {PERMISSION_LABEL[p]}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {self && (
                  <p className="w-full border-t border-border pt-2 text-xs text-muted-foreground">
                    لا يمكنك تعديل دورك أو صلاحياتك أو حالتك بنفسك.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Button
        variant="ghost"
        onClick={() => {
          resetDemoData();
          toast.success("تمت إعادة ضبط البيانات التجريبية");
        }}
      >
        إعادة ضبط البيانات التجريبية
      </Button>
    </div>
  );
}
