import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { useStoreData } from "@/hooks/use-store-data";
import {
  generateShortCode,
  getPermits,
  getPersons,
  getSettings,
  logAudit,
  setPersons,
  setSettings,
  uid,
} from "@/lib/store";
import { movementsOfPerson } from "@/lib/movements";
import { getRecords, formatBusinessTime } from "@/lib/daily";
import { buildDemoPersons, parsePersonsCsv, personsToCsv } from "@/lib/persons-demo";
import {
  MOVEMENT_STATUS_LABEL,
  PERMIT_STATUS_LABEL,
  SHORT_CODE_STRATEGY_LABEL,
  S_LIST,
  type Person,
  type ShortCodeStrategy,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";


export const Route = createFileRoute("/persons")({
  head: () => ({
    meta: [
      { title: "إدارة الأشخاص | السجل اليومي الإلكتروني" },
      { name: "description", content: "قاعدة الأشخاص: الاسم، الكود المختصر، رقم S، الحالة، مع بحث سريع وإدارة كاملة." },
      { property: "og:title", content: "إدارة الأشخاص" },
      { property: "og:description", content: "قاعدة أشخاص ديناميكية مع كود مختصر ورقم S وبحث سريع." },
    ],
  }),
  component: () => (
    <AppShell requires="persons.manage">
      <PersonsPage />
    </AppShell>
  ),
});

const emptyForm = { fullName: "", nationalId: "", shortCode: "", sNumber: "" };

function PersonsPage() {
  const { user } = useAuth();
  const { persons } = useStoreData();
  const [q, setQ] = useState("");
  const [sFilter, setSFilter] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<Person | null>(null);
  const [strategy, setStrategy] = useState<ShortCodeStrategy>(getSettings().shortCodeStrategy);
  const fileRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<Person | null>(null);


  const filtered = useMemo(() => {
    const term = q.trim();
    const sFromTerm = /^s\s*\d{1,3}$/i.test(term) ? Number(term.replace(/\D/g, "")) : null;
    const s = sFromTerm ?? sFilter;
    return persons.filter((p) => {
      if (s && p.sNumber !== s) return false;
      if (!term || sFromTerm) return true;
      return p.fullName.includes(term) || p.shortCode.includes(term) || (p.nationalId ?? "").includes(term);
    });
  }, [persons, q, sFilter]);

  if (!user) return null;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim()) { toast.error("اسم الشخص مطلوب"); return; }
    const sNum = form.sNumber ? Number(form.sNumber) : null;
    const shortCode = form.shortCode.trim() || generateShortCode(form.nationalId, strategy);
    if (editing) {
      const next = getPersons().map((p) =>
        p.id === editing.id
          ? {
              ...p,
              fullName: form.fullName.trim(),
              nationalId: form.nationalId.trim(),
              shortCode,
              sNumber: sNum,
              updatedAt: new Date().toISOString(),
            }
          : p,
      );
      setPersons(next);
      logAudit(user, "تعديل شخص", form.fullName.trim(), `S: ${sNum ?? "—"} · كود: ${shortCode}`);
      toast.success("تم تحديث بيانات الشخص");
    } else {
      const person: Person = {
        id: uid(),
        fullName: form.fullName.trim(),
        nationalId: form.nationalId.trim(),
        shortCode,
        sNumber: sNum,
        active: true,
        createdAt: new Date().toISOString(),
        createdBy: user.id,
        createdByName: user.fullName,
      };
      setPersons([...getPersons(), person]);
      logAudit(user, "إضافة شخص", person.fullName, `S: ${sNum ?? "—"} · كود: ${shortCode}`);
      toast.success("تمت إضافة الشخص");
    }
    setForm(emptyForm);
    setEditing(null);
  };

  const toggle = (p: Person) => {
    setPersons(
      getPersons().map((x) => (x.id === p.id ? { ...x, active: !x.active, updatedAt: new Date().toISOString() } : x)),
    );
    logAudit(user, p.active ? "تعطيل شخص" : "تفعيل شخص", p.fullName);
  };

  const changeStrategy = (v: ShortCodeStrategy) => {
    setStrategy(v);
    setSettings({ ...getSettings(), shortCodeStrategy: v });
    logAudit(user, "تغيير طريقة توليد الكود المختصر", SHORT_CODE_STRATEGY_LABEL[v]);
    toast.success("تم تغيير طريقة توليد الكود (لا تتأثر هوية الأشخاص)");
  };

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold">قاعدة الأشخاص</h2>

      <Card>
        <CardContent className="space-y-3 p-4">
          <Input
            placeholder="بحث بالاسم أو الكود المختصر أو S12"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            inputMode="search"
          />
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{editing ? "تعديل شخص" : "إضافة شخص"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={save} className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="p-name">الاسم الكامل</Label>
              <Input id="p-name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-nid">الرقم التعريفي (تجريبي)</Label>
              <Input
                id="p-nid"
                inputMode="numeric"
                value={form.nationalId}
                onChange={(e) =>
                  setForm({
                    ...form,
                    nationalId: e.target.value,
                    shortCode: generateShortCode(e.target.value, strategy),
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-code">الكود المختصر</Label>
              <Input id="p-code" value={form.shortCode} onChange={(e) => setForm({ ...form, shortCode: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>رقم S</Label>
              <Select value={form.sNumber || "none"} onValueChange={(v) => setForm({ ...form, sNumber: v === "none" ? "" : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="بدون" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون</SelectItem>
                  {S_LIST.map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      S{s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit">{editing ? "حفظ التعديل" : "إضافة"}</Button>
              {editing && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditing(null);
                    setForm(emptyForm);
                  }}
                >
                  إلغاء
                </Button>
              )}
            </div>
          </form>

          <div className="space-y-2 rounded-md border border-border p-3">
            <Label>طريقة توليد الكود المختصر</Label>
            <Select value={strategy} onValueChange={(v) => changeStrategy(v as ShortCodeStrategy)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SHORT_CODE_STRATEGY_LABEL) as ShortCodeStrategy[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {SHORT_CODE_STRATEGY_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPersons([...getPersons(), ...buildDemoPersons(50, user)]);
                logAudit(user, "استيراد أشخاص تجريبيين", "50 شخص وهمي");
                toast.success("تمت إضافة ٥٠ شخصًا تجريبيًا (بيانات وهمية)");
              }}
            >
              إضافة ٥٠ شخصًا تجريبيًا
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              استيراد CSV
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const rows = parsePersonsCsv(await file.text(), user);
                setPersons([...getPersons(), ...rows]);
                logAudit(user, "استيراد أشخاص من CSV", `${rows.length} سجل`);
                toast.success(`تم استيراد ${rows.length} شخصًا`);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const blob = new Blob([personsToCsv(getPersons())], { type: "text/csv;charset=utf-8" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "persons-demo.csv";
                a.click();
              }}
            >
              تصدير CSV تجريبي
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPersons([]);
                logAudit(user, "حذف كل بيانات الأشخاص التجريبية", "الكل");
                toast.success("تم حذف بيانات الأشخاص");
              }}
            >
              حذف كل الأشخاص
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">النتائج: {filtered.length} من {persons.length}</p>

      <div className="space-y-2">
        {filtered.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{p.fullName}</p>
                <p className="text-xs text-muted-foreground">
                  كود: {p.shortCode || "—"} · {p.sNumber ? `S${p.sNumber}` : "بدون S"} · {p.nationalId || "—"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={p.active ? "secondary" : "destructive"}>{p.active ? "نشط" : "غير نشط"}</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditing(p);
                    setForm({
                      fullName: p.fullName,
                      nationalId: p.nationalId ?? "",
                      shortCode: p.shortCode,
                      sNumber: p.sNumber ? String(p.sNumber) : "",
                    });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  تعديل
                </Button>
                <Button size="sm" variant="outline" onClick={() => toggle(p)}>
                  {p.active ? "تعطيل" : "تفعيل"}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setProfile(profile?.id === p.id ? null : p)}>
                  الملف
                </Button>
              </div>
              {profile?.id === p.id && <PersonProfile person={p} />}

            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">لا توجد نتائج.</p>}
      </div>
    </div>
  );
}

function PersonProfile({ person }: { person: Person }) {
  const permits = getPermits().filter((p) => p.persons.some((x) => x.personId === person.id));
  const movements = movementsOfPerson(person.id);
  const returns = movements.filter((m) => m.return);
  const records = getRecords().filter((r) => r.persons.some((x) => x.personId === person.id));

  return (
    <div className="w-full space-y-3 border-t border-border pt-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">التصاريح ({permits.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {permits.map((p) => (
            <p key={p.id} className="text-xs text-muted-foreground">
              {p.exitTime} → {p.expectedReturnDate} {p.expectedReturnTime} ·{" "}
              <Badge variant="secondary">{PERMIT_STATUS_LABEL[p.status]}</Badge>
            </p>
          ))}
          {permits.length === 0 && <p className="text-xs text-muted-foreground">لا توجد تصاريح.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">الحركات ({movements.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {movements.map((m) => (
            <p key={m.id} className="text-xs text-muted-foreground">
              قيام {formatBusinessTime(m.startedAt)} · {m.exitTypeName} ·{" "}
              <Badge variant="secondary">{MOVEMENT_STATUS_LABEL[m.status]}</Badge>
            </p>
          ))}
          {movements.length === 0 && <p className="text-xs text-muted-foreground">لا توجد حركات.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">العودات ({returns.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {returns.map((m) => (
            <p key={m.id} className="text-xs text-muted-foreground">
              عودة {formatBusinessTime(m.return!.at)} · المدة {m.return!.durationMinutes} د ·{" "}
              {m.return!.late ? `تأخير ${m.return!.lateMinutes} د` : "في الوقت"}
              {m.return!.fromAbsence ? ` · بعد غياب ${m.return!.absenceMinutes} د` : ""}
            </p>
          ))}
          {returns.length === 0 && <p className="text-xs text-muted-foreground">لا توجد عودات.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">بيانات السجل اليومي ({records.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {records.map((r) => (
            <p key={r.id} className="text-xs text-muted-foreground">
              #{r.sequence} · {r.businessDate} {formatBusinessTime(r.createdAt)} · {r.statementText}
            </p>
          ))}
          {records.length === 0 && <p className="text-xs text-muted-foreground">لا توجد بيانات.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
