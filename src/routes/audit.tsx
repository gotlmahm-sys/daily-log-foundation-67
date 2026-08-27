import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useStoreData } from "@/hooks/use-store-data";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { title: "سجل العمليات | السجل اليومي الإلكتروني" },
      { name: "description", content: "تتبع العمليات الإدارية: تسجيل الدخول، تعديل الأدوار، اعتماد القيود والتوقيعات." },
      { property: "og:title", content: "سجل العمليات" },
      { property: "og:description", content: "تتبع كامل للعمليات الإدارية داخل نظام السجل اليومي." },
    ],
  }),
  component: () => (
    <AppShell requires="audit.view">
      <AuditPage />
    </AppShell>
  ),
});

function AuditPage() {
  const { audit } = useStoreData();

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold">سجل العمليات</h2>
      {audit.length === 0 && <p className="text-sm text-muted-foreground">لا توجد عمليات مسجلة بعد.</p>}
      {audit.map((a) => (
        <Card key={a.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {a.action} — {a.target}
              </p>
              <p className="text-xs text-muted-foreground">
                {a.actorName}
                {a.details ? ` · ${a.details}` : ""}
              </p>
            </div>
            <span className="text-xs text-muted-foreground">{new Date(a.at).toLocaleString("ar-EG")}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
