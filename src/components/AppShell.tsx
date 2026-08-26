import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { ROLE_LABEL, type Permission } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ClipboardList, LayoutDashboard, LogOut, ShieldCheck, Users } from "lucide-react";
import { LoginScreen } from "@/components/LoginScreen";

const NAV: { to: string; label: string; icon: typeof Users; perm?: Permission }[] = [
  { to: "/", label: "الرئيسية", icon: LayoutDashboard },
  { to: "/log", label: "السجل اليومي", icon: ClipboardList },
  { to: "/users", label: "المستخدمون", icon: Users, perm: "users.manage" },
  { to: "/audit", label: "سجل العمليات", icon: ShieldCheck, perm: "audit.view" },
];

export function AppShell({ children, requires }: { children: ReactNode; requires?: Permission }) {
  const { user, ready, logout, can } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });

  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">جارٍ التحميل…</div>;
  }

  if (!user) return <LoginScreen />;

  const allowed = NAV.filter((n) => !n.perm || can(n.perm));

  return (
    <div className="min-h-screen bg-muted/40 pb-20 md:pb-0">
      <header className="sticky top-0 z-20 border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold">السجل اليومي الإلكتروني</h1>
            <p className="truncate text-xs text-muted-foreground">
              {user.fullName} · <Badge variant="secondary" className="align-middle">{ROLE_LABEL[user.role]}</Badge>
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut className="size-4" />
            خروج
          </Button>
        </div>
        <nav className="mx-auto hidden max-w-5xl gap-1 px-4 pb-2 md:flex">
          {allowed.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent",
                path === n.to && "bg-primary/10 text-primary",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5">
        {requires && !can(requires) ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="font-semibold text-destructive">لا تملك صلاحية الوصول لهذه الصفحة</p>
          </div>
        ) : (
          children
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-card md:hidden">
        {allowed.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2 text-[11px] text-muted-foreground",
              path === n.to && "text-primary",
            )}
          >
            <n.icon className="size-5" />
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
