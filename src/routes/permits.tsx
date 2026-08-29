import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { useStoreData } from "@/hooks/use-store-data";
import { getPermits, logAudit, setPermits, uid } from "@/lib/store";
import { PERMIT_STATUS_LABEL, S_LIST, type Permit, type Person } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/permits")({
  head: () => ({
    meta: [
      { title: "التصاريح | السجل اليومي الإلكتروني" },
      { name: "description", content: "إصدار التصاريح واختيار الشخص بالاسم أو الكود المختصر أو رقم S، مع التصاريح الجاهزة." },
      { property: "og:title", content: "إدارة التصاريح" },
      { property: "og:description", content: "إصدار وتعديل وإلغاء التصاريح ومتابعة التصاريح الجاهزة." },
    ],
  }),
  component: () => (
    <AppShell requires="permits.issue">
      <PermitsPage />
    </AppShell>
  ),
});

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

function PermitsPage() {
  const { user, can } = useAuth();
  const { persons, permits, exitTypes } = useStoreData();
  const now = useClock();

  const [tab, setTab] = useState<"new" | "mine" | "ready">("new");
  const [q, setQ] = useState("");
  const [sFilter, setSFilter] = useState<number | null>(null);
  const [selected, setSelected] = useState<Person[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    exitTypeId: "",
    exitTime: "08:00",
    expectedReturnTime: "14:00",
    expectedReturnDate: todayStr(),
    durationMinutes: "",
    notes: "",
  });

  const activeTypes = exitTypes.filter((t) => t.active);
  const personById = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);

  const matches = useMemo(() => {
    const term = q.trim();
    const sFromTerm = /^s\s*\d{1,3}$/i.test(term) ? Number(term.replace(/\D/g, "")) : null;
    const s = sFromTerm ?? sFilter;
    return persons
      .filter((p) => p.active)
      .filter((p) => {
        if (s && p.sNumber !== s) return false;
        if (!term || sFromTerm) return !!s || !!term === false;
        return p.fullName.includes(term) || p.shortCode.includes(term);
      })
      .slice(0, 30);
  }, [persons, q, sFilter]);

  if (!user) return null;

  const resetForm = () => {
    setSelected([]);
    setEditingId(null);
    setForm({
      exitTypeId: "",
      exitTime: "08:00",
      expectedReturnTime: "14:00",
      expectedReturnDate: todayStr(),
      durationMinutes: "",
      notes: "",
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selected.length === 0) return toast.error("اختر شخصًا واحدًا على الأقل");
    if (!form.exitTypeId) return toast.error("اختر نوع الخروج");

    if (editingId) {
      if (!can("permits.edit")) return toast.error("لا تملك صلاحية تعديل التصاريح");
      const list = getPermits();
      const before = list.find((p) => p.id === editingId);
      if (!before || before.status !== "ready") return toast.error("لا يمكن تعديل هذا التصريح");
      setPermits(
        list.map((p) =>
          p.id === editingId
            ? {
                ...p,
                persons: selected.map((s) => ({ personId: s.id })),
                exitTypeId: form.exitTypeId,
                exitTime: form.exitTime,
                expectedReturnTime: form.expectedReturnTime,
                expectedReturnDate: form.expectedReturnDate,
                ...(form.durationMinutes ? { durationMinutes: Number(form.durationMinutes) } : {}),
                notes: form.notes,
                updatedAt: new Date().toISOString(),
                // issued_by is immutable
              }
            : p,
        ),
      );
      logAudit(user, "تعديل تصريح", editingId, `الأشخاص: ${selected.map((s) => s.fullName).join(" / ")}`);
      toast.success("تم تعديل التصريح");
      resetForm();
      return;
    }

    const permit: Permit = {
      id: uid(),
      persons: selected.map((s) => ({ personId: s.id })),
      exitTypeId: form.exitTypeId,
      exitTime: form.exitTime,
      expectedReturnTime: form.expectedReturnTime,
      expectedReturnDate: form.expectedReturnDate,
      ...(form.durationMinutes ? { durationMinutes: Number(form.durationMinutes) } : {}),
      notes: form.notes,
      issuedBy: user.id,
      issuedByName: user.signatureName || user.fullName,
      issuedAt: new Date().toISOString(),
      status: "ready",
    };
    setPermits([permit, ...getPermits()]);
    logAudit(user, "إصدار تصريح", permit.id, `الأشخاص: ${selected.map((s) => s.fullName).join(" / ")}`);
    toast.success("تم إصدار التصريح بحالة (جاهز) — لم يتم تسجيل خروج فعلي");
    resetForm();
  };

  const cancel = (permit: Permit) => {
    if (!can("permits.cancel")) return toast.error("لا تملك صلاحية إلغاء التصاريح");
    setPermits(
      getPermits().map((p) =>
        p.id === permit.id && p.status === "ready"
          ? { ...p, status: "cancelled" as const, updatedAt: new Date().toISOString() }
          : p,
      ),
    );
    logAudit(user, "إلغاء تصريح", permit.id);
    toast.success("تم إلغاء التصريح");
  };

  const typeName = (id: string) => exitTypes.find((t) => t.id === id)?.name ?? "—";
  const mine = permits.filter((p) => p.issuedBy === user.id);
  const readyList = permits
    .filter((p) => p.status === "ready")
    .filter((p) => (sFilter ? p.persons.some((pp) => personById.get(pp.personId)?.sNumber === sFilter) : true))
    .sort((a, b) => a.issuedAt.localeCompare(b.issuedAt));

  const PermitCard = ({ p }: { p: Permit }) => (
    <Card key={p.id}>
      <CardContent className="space-y-1 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">
            {p.persons.map((x) => personById.get(x.personId)?.fullName ?? "—").join(" / ")}
          </p>
          <Badge variant={p.status === "ready" ? "default" : "secondary"}>{PERMIT_STATUS_LABEL[p.status]}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {typeName(p.exitTypeId)} · خروج {p.exitTime} · عودة {p.expectedReturnTime} — {p.expectedReturnDate}
        </p>
        <p className="text-xs text-muted-foreground">
          S:{" "}
          {p.persons
            .map((x) => {
              const s = personById.get(x.personId)?.sNumber;
              return s ? `S${s}` : "—";
            })
            .join(" ، ")}{" "}
          · أصدره: {p.issuedByName}
        </p>
        {p.notes && <p className="text-xs">ملاحظات: {p.notes}</p>}
        {p.status === "ready" && (
          <div className="flex gap-2 pt-1">
            {can("permits.edit") && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingId(p.id);
                  setSelected(p.persons.map((x) => personById.get(x.personId)).filter(Boolean) as Person[]);
                  setForm({
                    exitTypeId: p.exitTypeId,
                    exitTime: p.exitTime,
                    expectedReturnTime: p.expectedReturnTime,
                    expectedReturnDate: p.expectedReturnDate,
                    durationMinutes: p.durationMinutes ? String(p.durationMinutes) : "",
                    notes: p.notes ?? "",
                  });
                  setTab("new");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                تعديل
              </Button>
            )}
            {can("permits.cancel") && (
              <Button size="sm" variant="outline" onClick={() => cancel(p)}>
                إلغاء
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
          <div>
            <p className="font-bold">{user.signatureName || user.fullName}</p>
            <p className="text-xs text-muted-foreground">{now.toLocaleDateString("ar-EG")}</p>
          </div>
          <p className="font-mono text-lg">{now.toLocaleTimeString("ar-EG")}</p>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button size="sm" variant={tab === "new" ? "default" : "outline"} onClick={() => setTab("new")}>
          إضافة تصريح
        </Button>
        <Button size="sm" variant={tab === "mine" ? "default" : "outline"} onClick={() => setTab("mine")}>
          تصاريحي
        </Button>
        {can("permits.ready.view") && (
          <Button size="sm" variant={tab === "ready" ? "default" : "outline"} onClick={() => setTab("ready")}>
            التصاريح الجاهزة
          </Button>
        )}
      </div>

      {tab === "new" && (
        <form onSubmit={submit} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">اختيار الشخص</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="بحث بالاسم أو الكود المختصر أو S12"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                inputMode="search"
              />
              <div className="flex flex-wrap gap-1.5">
                <Button type="button" size="sm" variant={sFilter === null ? "default" : "outline"} onClick={() => setSFilter(null)}>
                  الكل
                </Button>
                {S_LIST.map((s) => (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    variant={sFilter === s ? "default" : "outline"}
                    onClick={() => setSFilter(s)}
                  >
                    S{s}
                  </Button>
                ))}
              </div>

              {selected.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selected.map((s) => (
                    <Badge key={s.id} variant="secondary" className="cursor-pointer" onClick={() => setSelected(selected.filter((x) => x.id !== s.id))}>
                      {s.fullName} ✕
                    </Badge>
                  ))}
                </div>
              )}

              <div className="max-h-64 space-y-1 overflow-y-auto">
                {matches.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => setSelected((cur) => (cur.some((x) => x.id === p.id) ? cur : [...cur, p]))}
                    className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-right text-sm hover:bg-accent"
                  >
                    <span>{p.fullName}</span>
                    <span className="text-xs text-muted-foreground">
                      {p.shortCode} · {p.sNumber ? `S${p.sNumber}` : "—"}
                    </span>
                  </button>
                ))}
                {matches.length === 0 && <p className="text-sm text-muted-foreground">ابحث بالاسم أو الكود أو اختر S.</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{editingId ? "تعديل التصريح" : "بيانات التصريح"}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>نوع الخروج</Label>
                <Select value={form.exitTypeId} onValueChange={(v) => setForm({ ...form, exitTypeId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر النوع" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="exitTime">وقت الخروج المسموح</Label>
                <Input id="exitTime" type="time" value={form.exitTime} onChange={(e) => setForm({ ...form, exitTime: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="retTime">موعد العودة</Label>
                <Input
                  id="retTime"
                  type="time"
                  value={form.expectedReturnTime}
                  onChange={(e) => setForm({ ...form, expectedReturnTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="retDate">تاريخ العودة</Label>
                <Input
                  id="retDate"
                  type="date"
                  value={form.expectedReturnDate}
                  onChange={(e) => setForm({ ...form, expectedReturnDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dur">مدة التصريح (دقائق)</Label>
                <Input
                  id="dur"
                  inputMode="numeric"
                  value={form.durationMinutes}
                  onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="notes">ملاحظات</Label>
                <Textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="flex gap-2 md:col-span-2">
                <Button type="submit" className="flex-1">
                  {editingId ? "حفظ التعديل" : "إصدار التصريح"}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    إلغاء
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground md:col-span-2">
                التوقيع الرسمي يؤخذ تلقائيًا من حسابك: {user.signatureName || user.fullName}. إصدار التصريح لا يعني القيام.
              </p>
            </CardContent>
          </Card>
        </form>
      )}

      {tab === "mine" && (
        <div className="space-y-2">
          {mine.map((p) => (
            <PermitCard key={p.id} p={p} />
          ))}
          {mine.length === 0 && <p className="text-sm text-muted-foreground">لم تصدر أي تصريح بعد.</p>}
        </div>
      )}

      {tab === "ready" && can("permits.ready.view") && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant={sFilter === null ? "default" : "outline"} onClick={() => setSFilter(null)}>
              الكل
            </Button>
            {S_LIST.map((s) => (
              <Button key={s} size="sm" variant={sFilter === s ? "default" : "outline"} onClick={() => setSFilter(s)}>
                S{s}
              </Button>
            ))}
          </div>
          {readyList.map((p) => (
            <PermitCard key={p.id} p={p} />
          ))}
          {readyList.length === 0 && <p className="text-sm text-muted-foreground">لا توجد تصاريح جاهزة.</p>}
        </div>
      )}
    </div>
  );
}
