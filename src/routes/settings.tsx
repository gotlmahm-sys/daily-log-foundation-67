import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { getSettings } from "@/lib/store";
import { updateSettings } from "@/lib/admin";
import { SHORT_CODE_STRATEGY_LABEL, type ShortCodeStrategy } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "إعدادات النظام | السجل اليومي الإلكتروني" },
      { name: "description", content: "ضبط بداية ونهاية اليوم، وقت السماح بالخروج، نهاية الفسحة، ومدة اعتبار الغياب." },
      { property: "og:title", content: "إعدادات النظام" },
      { property: "og:description", content: "إعدادات يوم العمل والخروج والغياب في السجل اليومي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell requires="settings.manage">
      <SettingsPage />
    </AppShell>
  ),
});

function SettingsPage() {
  const { user } = useAuth();
  const [s, setS] = useState(() => getSettings());

  if (!user) return null;

  const save = () => {
    const r = updateSettings(user, {
      dayStart: s.dayStart,
      dayEnd: s.dayEnd,
      exitAllowedFrom: s.exitAllowedFrom,
      defaultOutingEnd: s.defaultOutingEnd,
      absenceAfterMinutes: Number(s.absenceAfterMinutes) || 0,
      shortCodeStrategy: s.shortCodeStrategy,
      timeZone: s.timeZone,
    });
    toast[r.ok ? "success" : "error"](r.ok ? "تم حفظ الإعدادات" : (r.error ?? "تعذر الحفظ"));
    if (r.ok) setS(getSettings());
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">إعدادات النظام</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">يوم العمل والخروج</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Field label="بداية اليوم" id="dayStart">
            <Input id="dayStart" type="time" value={s.dayStart} onChange={(e) => setS({ ...s, dayStart: e.target.value })} />
          </Field>
          <Field label="نهاية اليوم" id="dayEnd">
            <Input id="dayEnd" type="time" value={s.dayEnd} onChange={(e) => setS({ ...s, dayEnd: e.target.value })} />
          </Field>
          <Field label="بداية السماح بالخروج" id="exitFrom">
            <Input
              id="exitFrom"
              type="time"
              value={s.exitAllowedFrom}
              onChange={(e) => setS({ ...s, exitAllowedFrom: e.target.value })}
            />
          </Field>
          <Field label="نهاية الفسحة" id="outingEnd">
            <Input
              id="outingEnd"
              type="time"
              value={s.defaultOutingEnd}
              onChange={(e) => setS({ ...s, defaultOutingEnd: e.target.value })}
            />
          </Field>
          <Field label="اعتبار الغياب بعد (دقيقة)" id="absence">
            <Input
              id="absence"
              type="number"
              min={1}
              value={s.absenceAfterMinutes}
              onChange={(e) => setS({ ...s, absenceAfterMinutes: Number(e.target.value) })}
            />
          </Field>
          <Field label="المنطقة الزمنية" id="tz">
            <Input id="tz" value={s.timeZone} onChange={(e) => setS({ ...s, timeZone: e.target.value })} />
          </Field>
          <div className="space-y-2">
            <Label>طريقة توليد الكود المختصر</Label>
            <Select
              value={s.shortCodeStrategy}
              onValueChange={(v) => setS({ ...s, shortCodeStrategy: v as ShortCodeStrategy })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SHORT_CODE_STRATEGY_LABEL) as ShortCodeStrategy[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {SHORT_CODE_STRATEGY_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={save} className="w-full md:w-auto">
              حفظ الإعدادات
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        تغيير الإعدادات لا يعدّل أي بيانات تاريخية مسجلة، ويُسجَّل في سجل العمليات.
      </p>
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
