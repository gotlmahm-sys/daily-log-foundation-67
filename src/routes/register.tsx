import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { getPersons, subscribe, uid } from "@/lib/store";
import type { DailyRecord, DailyRegister, Person, StatementTemplate } from "@/lib/types";
import {
  businessClock,
  businessDateOf,
  createClosingRecord,
  createDailyRecord,
  createOpeningRecord,
  formatBusinessTime,
  getRecordsFor,
  getRegister,
  getTemplates,
  openRegister,
  renderStatement,
  saveTemplate,
  sortTemplates,
  suggestPattern,
  suggestTopic,
  templateVariables,
} from "@/lib/daily";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Minus, Plus, CalendarDays, Clock, FileText, Lock, Printer, Sheet, Sparkles } from "lucide-react";
import { exportDailyRecords, printDailyRegister } from "@/lib/export";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "السجل اليومي — السجل اليومي الإلكتروني" },
      { name: "description", content: "تسجيل البيانات اليومية بالتسلسل مع القوالب والكتابة اليدوية وربط الأشخاص." },
      { property: "og:title", content: "السجل اليومي" },
      { property: "og:description", content: "تسجيل البيانات اليومية بالتسلسل مع القوالب والكتابة اليدوية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  return (
    <AppShell requires="records.view">
      <RegisterView />
    </AppShell>
  );
}

function useDaily() {
  const [date, setDate] = useState(() => businessDateOf());
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [register, setRegister] = useState<DailyRegister | null>(null);
  const [persons, setPersons] = useState<Person[]>([]);
  const [templates, setTemplatesState] = useState<StatementTemplate[]>([]);

  const refresh = useCallback(() => {
    const d = businessDateOf();
    setDate(d);
    setRecords(getRecordsFor(d));
    setRegister(getRegister(d));
    setPersons(getPersons().filter((p) => p.active));
    setTemplatesState(getTemplates());
  }, []);

  useEffect(() => {
    refresh();
    return subscribe(refresh);
  }, [refresh]);

  return { date, records, register, persons, templates, refresh };
}

function RegisterView() {
  const { user, can } = useAuth();
  const { date, records, register, persons, templates, refresh } = useDaily();
  const [clock, setClock] = useState(() => businessClock());
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setClock(businessClock()), 1000 * 20);
    return () => clearInterval(t);
  }, []);

  if (!user) return null;

  const closed = register?.status === "closed";

  return (
    <div className="space-y-4">
      <Card className="p-4 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold">{user.fullName}</p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarDays className="size-3.5" /> {date}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="size-3.5" /> {clock}
              </span>
              <Badge variant={register ? (closed ? "destructive" : "secondary") : "outline"}>
                {register ? (closed ? "اليوم مغلق" : "اليوم مفتوح") : "لم يُفتح اليوم"}
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {can("records.create") && !register && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  openRegister(user, date);
                  const r = createOpeningRecord(user, date);
                  toast.success(r.ok ? "تم فتح اليوم" : (r.error ?? "تم فتح اليوم"));
                  refresh();
                }}
              >
                فتح اليوم
              </Button>
            )}
            {can("records.create") && register && !closed && (
              <>
                <Button size="sm" onClick={() => setOpen(true)}>
                  <Plus className="size-4" /> إضافة بيان
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const r = createClosingRecord(user, date);
                    toast[r.ok ? "success" : "error"](r.ok ? "تم إنهاء اليوم" : (r.error ?? "تعذر الإنهاء"));
                    refresh();
                  }}
                >
                  <Lock className="size-4" /> نهاية اليوم
                </Button>
              </>
            )}
            {can("export.excel") && (
              <Button
                size="sm"
                variant="outline"
                disabled={records.length === 0}
                onClick={() => {
                  exportDailyRecords(user, date, records);
                  toast.success("تم تصدير السجل اليومي");
                }}
              >
                <Sheet className="size-4" /> تصدير Excel
              </Button>
            )}
            {can("print.view") && (
              <Button
                size="sm"
                variant="outline"
                disabled={records.length === 0}
                onClick={() => printDailyRegister(user, date, records.length)}
              >
                <Printer className="size-4" /> طباعة
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div className="print-only print-area">
        <h2 style={{ textAlign: "center", marginBottom: 8 }}>السجل اليومي — {date}</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th>التسلسل</th>
              <th>التاريخ/الوقت</th>
              <th>البيان</th>
              <th>الموضوع</th>
              <th>التوقيع</th>
            </tr>
          </thead>
          <tbody>
            {[...records]
              .sort((a, b) => a.sequence - b.sequence)
              .map((r) => (
                <tr key={r.id}>
                  <td>{r.sequence}</td>
                  <td>{`${date} ${formatBusinessTime(r.createdAt)}`}</td>
                  <td>{r.statementText}</td>
                  <td>{r.topicName || "—"}</td>
                  <td>{r.signatureName || r.createdByName}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {records.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          لا توجد بيانات مسجلة اليوم
        </div>
      ) : (
        <ul className="space-y-2">
          {records.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                className="w-full rounded-lg border border-border bg-card p-3 text-right"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                    {r.sequence}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{formatBusinessTime(r.createdAt)}</span>
                      {r.topicName && <Badge variant="secondary">{r.topicName}</Badge>}
                    </div>
                    <p className="mt-1 text-sm leading-6">{r.statementText}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">التوقيع: {r.signatureName}</p>
                  </div>
                </div>

                {expanded === r.id && (
                  <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-[11px] text-muted-foreground">
                    <Detail label="نوع البيان" value={r.statementTypeName || "—"} />
                    <Detail label="طريقة الإدخال" value={MODE_LABEL[r.entryMode]} />
                    <Detail label="المستخدم" value={r.createdByName} />
                    <Detail label="وقت العملية" value={new Date(r.createdAt).toLocaleString("ar-EG")} />
                    <div className="col-span-2">
                      <dt className="font-medium text-foreground">الأشخاص</dt>
                      <dd>
                        {r.persons.length
                          ? r.persons
                              .map((p) => `${p.fullNameAtCreation} (س ${p.sNumberAtCreation ?? "-"})`)
                              .join("، ")
                          : "—"}
                      </dd>
                    </div>
                  </dl>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <AddStatementDialog
          persons={persons}
          templates={templates}
          onClose={() => setOpen(false)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}

const MODE_LABEL: Record<DailyRecord["entryMode"], string> = {
  template: "قالب",
  manual: "كتابة يدوية",
  system: "النظام",
};

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium text-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/* ---------------- add statement ---------------- */

function AddStatementDialog({
  persons,
  templates,
  onClose,
  onSaved,
}: {
  persons: Person[];
  templates: StatementTemplate[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user, can } = useAuth();
  const canTemplates = can("templates.use");
  const canManual = can("records.manual");

  const [mode, setMode] = useState<"template" | "manual">(canTemplates ? "template" : "manual");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [manualText, setManualText] = useState("");
  const [count, setCount] = useState(1);
  const [selected, setSelected] = useState<(string | null)[]>([null]);
  const [query, setQuery] = useState("");
  const [activeSlot, setActiveSlot] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [requestId] = useState(() => uid());
  const [askTemplate, setAskTemplate] = useState(false);
  const [tplName, setTplName] = useState("");
  const [tplPattern, setTplPattern] = useState("");

  const sorted = useMemo(() => sortTemplates(templates, "usage"), [templates]);
  const template = sorted.find((t) => t.id === templateId) ?? null;

  const chosen = useMemo(
    () => selected.map((id) => persons.find((p) => p.id === id)).filter(Boolean) as Person[],
    [selected, persons],
  );

  const matches = useMemo(() => {
    const q = query.trim();
    if (!q) return persons.slice(0, 8);
    const lower = q.toLowerCase();
    return persons
      .filter(
        (p) =>
          p.fullName.toLowerCase().includes(lower) ||
          p.shortCode.includes(q) ||
          String(p.sNumber ?? "") === q,
      )
      .slice(0, 8);
  }, [query, persons]);

  const preview = useMemo(() => {
    if (mode === "template") return template ? renderStatement(template.pattern, chosen) : "";
    return manualText.trim();
  }, [mode, template, chosen, manualText]);

  const setCountTo = (n: number) => {
    const next = Math.max(1, n);
    setCount(next);
    setSelected((prev) => {
      const copy = [...prev];
      while (copy.length < next) copy.push(null);
      return copy.slice(0, next);
    });
    setActiveSlot((s) => Math.min(s, next - 1));
  };

  if (!user) return null;

  const submit = () => {
    if (submitting) return;
    if (!preview) {
      toast.error("نص البيان مطلوب");
      return;
    }
    setSubmitting(true);
    const topic = suggestTopic(preview);
    const variableValues: Record<string, string> = {};
    if (chosen.length) {
      variableValues["{PERSONS}"] = chosen.map((p) => p.fullName).join("، ");
      variableValues["{PERSON}"] = chosen[0]!.fullName;
      variableValues["{S_NUMBER}"] = chosen.map((p) => String(p.sNumber ?? "-")).join("، ");
    }
    const res = createDailyRecord(user, {
      statementText: preview,
      topicId: (mode === "template" ? template?.topicId : null) ?? topic?.id ?? null,
      statementTypeId: mode === "template" ? (template?.statementTypeId ?? null) : null,
      movementTypeId: mode === "template" ? (template?.movementTypeId ?? null) : null,
      templateId: mode === "template" ? (template?.id ?? null) : null,
      entryMode: mode,
      persons: chosen,
      variableValues,
      requestId,
    });
    if (!res.ok) {
      setSubmitting(false);
      toast.error(res.error ?? "تعذر الحفظ");
      return;
    }
    toast.success(`تم حفظ البيان رقم ${res.record?.sequence}`);
    onSaved();
    if (mode === "manual" && can("templates.manage")) {
      setTplPattern(suggestPattern(preview, chosen));
      setTplName(preview.slice(0, 30));
      setAskTemplate(true);
      setSubmitting(false);
      return;
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>{askTemplate ? "حفظ كقالب" : "إضافة بيان"}</DialogTitle>
        </DialogHeader>

        {askTemplate ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              راجع المتغيّرات المقترحة قبل الحفظ. المتغيّرات المكتشفة:{" "}
              {templateVariables(tplPattern).join("، ") || "لا يوجد"}
            </p>
            <div className="space-y-1.5">
              <Label>اسم القالب</Label>
              <Input value={tplName} onChange={(e) => setTplName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>صيغة البيان</Label>
              <Textarea rows={3} value={tplPattern} onChange={(e) => setTplPattern(e.target.value)} />
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={onClose}>
                تخطي
              </Button>
              <Button
                onClick={() => {
                  const topic = suggestTopic(tplPattern);
                  const res = saveTemplate(user, {
                    name: tplName,
                    pattern: tplPattern,
                    topicId: topic?.id ?? null,
                    statementTypeId: null,
                    source: "manual",
                  });
                  toast[res.ok ? "success" : "error"](res.ok ? "تم حفظ القالب" : (res.error ?? "تعذر الحفظ"));
                  if (res.ok) {
                    onSaved();
                    onClose();
                  }
                }}
              >
                حفظ القالب
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              {canTemplates && (
                <Button
                  size="sm"
                  variant={mode === "template" ? "default" : "outline"}
                  onClick={() => setMode("template")}
                >
                  <Sparkles className="size-4" /> القوالب
                </Button>
              )}
              {canManual && (
                <Button size="sm" variant={mode === "manual" ? "default" : "outline"} onClick={() => setMode("manual")}>
                  <FileText className="size-4" /> كتابة يدوية
                </Button>
              )}
            </div>

            {mode === "template" ? (
              canTemplates ? (
                <div className="space-y-1.5">
                  <Label>القالب</Label>
                  <div className="grid gap-2">
                    {sorted.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTemplateId(t.id)}
                        className={`rounded-md border p-2 text-right text-sm ${
                          templateId === t.id ? "border-primary bg-primary/5" : "border-border"
                        }`}
                      >
                        <span className="font-medium">{t.name}</span>
                        <span className="block text-[11px] text-muted-foreground">{t.pattern}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-destructive">لا تملك صلاحية استخدام القوالب</p>
              )
            ) : canManual ? (
              <div className="space-y-1.5">
                <Label>نص البيان</Label>
                <Textarea rows={3} value={manualText} onChange={(e) => setManualText(e.target.value)} />
              </div>
            ) : (
              <p className="text-sm text-destructive">لا تملك صلاحية الكتابة اليدوية</p>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>عدد الأشخاص</Label>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="outline" onClick={() => setCountTo(count - 1)} aria-label="إنقاص">
                    <Minus className="size-4" />
                  </Button>
                  <span className="w-8 text-center text-sm font-bold">{count}</span>
                  <Button size="icon" variant="outline" onClick={() => setCountTo(count + 1)} aria-label="زيادة">
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-1.5">
                {selected.map((id, i) => {
                  const p = persons.find((x) => x.id === id);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActiveSlot(i)}
                      className={`rounded-md border p-2 text-right text-xs ${
                        activeSlot === i ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      {p ? `${p.fullName} — كود ${p.shortCode} — س ${p.sNumber ?? "-"}` : `اختر الشخص ${i + 1}`}
                    </button>
                  );
                })}
              </div>

              <Input
                placeholder="بحث بالاسم أو الكود المختصر أو رقم S"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="grid gap-1">
                {matches.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelected((prev) => prev.map((v, i) => (i === activeSlot ? p.id : v)));
                      setQuery("");
                      setActiveSlot((s) => Math.min(s + 1, count - 1));
                    }}
                    className="rounded-md bg-muted/60 px-2 py-1.5 text-right text-xs"
                  >
                    {p.fullName} — {p.shortCode} — س {p.sNumber ?? "-"}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-border bg-muted/40 p-3">
              <p className="text-[11px] font-medium text-muted-foreground">معاينة البيان</p>
              <p className="mt-1 text-sm leading-6">{preview || "—"}</p>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={onClose}>
                إلغاء
              </Button>
              <Button onClick={submit} disabled={submitting || !preview}>
                حفظ البيان
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
