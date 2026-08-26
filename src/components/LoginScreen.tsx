import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const DEMO = [
  { u: "admin", p: "admin123", label: "مدير النظام" },
  { u: "supervisor", p: "sup123", label: "مشرف" },
  { u: "employee", p: "emp123", label: "موظف" },
];

export function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = login(username, password);
    setError(res.ok ? "" : (res.error ?? "تعذر تسجيل الدخول"));
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">السجل اليومي الإلكتروني</CardTitle>
          <CardDescription>سجّل الدخول بحسابك للمتابعة (بيانات تجريبية محلية)</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">اسم المستخدم</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            <Button type="submit" className="w-full">
              دخول
            </Button>
          </form>

          <div className="mt-6 space-y-2 rounded-lg border border-border bg-muted/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground">حسابات تجريبية</p>
            {DEMO.map((d) => (
              <button
                key={d.u}
                type="button"
                onClick={() => {
                  setUsername(d.u);
                  setPassword(d.p);
                  setError("");
                }}
                className="flex w-full items-center justify-between rounded-md bg-card px-3 py-2 text-sm hover:bg-accent"
              >
                <span>{d.label}</span>
                <span className="text-muted-foreground">
                  {d.u} / {d.p}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
