import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { useStoreData } from "@/hooks/use-store-data";
import { getUsers, logAudit, resetDemoData, setUsers, uid } from "@/lib/store";
import { ROLE_LABEL, type Role, type User } from "@/lib/types";
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

function UsersPage() {
  const { user } = useAuth();
  const { users } = useStoreData();
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    password: "",
    department: "التشغيل",
    role: "employee" as Role,
  });

  if (!user) return null;

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim() || !form.username.trim() || form.password.length < 6) {
      toast.error("الاسم واسم المستخدم مطلوبان، وكلمة المرور ٦ أحرف على الأقل");
      return;
    }
    if (getUsers().some((u) => u.username.toLowerCase() === form.username.trim().toLowerCase())) {
      toast.error("اسم المستخدم مستخدم بالفعل");
      return;
    }
    const created: User = {
      id: uid(),
      username: form.username.trim(),
      password: form.password,
      fullName: form.fullName.trim(),
      role: form.role,
      department: form.department.trim() || "غير محدد",
      active: true,
      createdAt: new Date().toISOString(),
    };
    setUsers([...getUsers(), created]);
    logAudit(user, "إضافة مستخدم", created.username, `الدور: ${ROLE_LABEL[created.role]}`);
    setForm({ ...form, fullName: "", username: "", password: "" });
    toast.success("تمت إضافة المستخدم");
  };

  const patch = (id: string, changes: Partial<User>, action: string, details?: string) => {
    const list = getUsers().map((u) => (u.id === id ? { ...u, ...changes } : u));
    setUsers(list);
    const target = list.find((u) => u.id === id);
    logAudit(user, action, target?.username ?? id, details);
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
              <Label>الدور</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
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
        {users.map((u) => (
          <Card key={u.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium">
                  {u.fullName} {u.id === user.id && <span className="text-xs text-muted-foreground">(أنت)</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {u.username} · {u.department}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={u.active ? "secondary" : "destructive"}>{u.active ? "نشط" : "موقوف"}</Badge>
                <Select
                  value={u.role}
                  onValueChange={(v) =>
                    patch(u.id, { role: v as Role }, "تغيير دور مستخدم", `الدور الجديد: ${ROLE_LABEL[v as Role]}`)
                  }
                  disabled={u.id === user.id}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={u.id === user.id}
                  onClick={() => patch(u.id, { active: !u.active }, u.active ? "إيقاف مستخدم" : "تفعيل مستخدم")}
                >
                  {u.active ? "إيقاف" : "تفعيل"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
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
