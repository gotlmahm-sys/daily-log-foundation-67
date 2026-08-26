import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { useStoreData } from "@/hooks/use-store-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABEL, STATUS_LABEL } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "السجل اليومي الإلكتروني | لوحة المتابعة" },
      { name: "description", content: "نظام السجل اليومي الإلكتروني: تسجيل الورديات، الاعتماد، التوقيعات الإلكترونية وإدارة الصلاحيات." },
      { property: "og:title", content: "السجل اليومي الإلكتروني" },
      { property: "og:description", content: "تسجيل الورديات والاعتماد والتوقيع الإلكتروني مع نظام صلاحيات متكامل." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <AppShell>
      <Dashboard />
    </AppShell>
  );
}

function Dashboard() {
  const { user, can } = useAuth();
  const { entries } = useStoreData();
  if (!user) return null;

  const visible = can("log.view.all") ? entries : entries.filter((e) => e.authorId === user.id);
  const stats = [
    { label: "إجمالي القيود", value: visible.length },
    { label: "بانتظار الاعتماد", value: visible.filter((e) => e.status === "submitted").length },
    { label: "معتمدة", value: visible.filter((e) => e.status === "approved").length },
    { label: "مسودات", value: visible.filter((e) => e.status === "draft").length },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">مرحبًا {user.fullName}</h2>
        <p className="text-sm text-muted-foreground">
          دورك الحالي: {ROLE_LABEL[user.role]} — القسم: {user.department}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">أحدث القيود</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {visible.slice(0, 5).map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{e.title}</p>
                <p className="text-xs text-muted-foreground">
                  {e.date} · {e.authorName}
                </p>
              </div>
              <Badge variant={e.status === "approved" ? "default" : "secondary"}>{STATUS_LABEL[e.status]}</Badge>
            </div>
          ))}
          {visible.length === 0 && <p className="text-sm text-muted-foreground">لا توجد قيود بعد.</p>}
          <Link to="/log" className="inline-block pt-2 text-sm font-medium text-primary hover:underline">
            الذهاب إلى السجل اليومي
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
