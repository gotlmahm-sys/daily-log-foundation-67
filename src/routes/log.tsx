import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { SignaturePad } from "@/components/SignaturePad";
import { useAuth } from "@/lib/auth";
import { useStoreData } from "@/hooks/use-store-data";
import { getEntries, logAudit, setEntries, uid } from "@/lib/store";
import { SHIFT_LABEL, STATUS_LABEL, type LogEntry } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/log")({
  head: () => ({
    meta: [
      { title: "السجل اليومي | قيود الورديات" },
      { name: "description", content: "إنشاء قيود الورديات اليومية، رفعها للاعتماد، وتوقيعها إلكترونيًا." },
      { property: "og:title", content: "السجل اليومي | قيود الورديات" },
      { property: "og:description", content: "إنشاء قيود الورديات اليومية واعتمادها وتوقيعها إلكترونيًا." },
    ],
  }),
  component: () => (
    <AppShell>
      <LogPage />
    </AppShell>
  ),
});

function LogPage() {
  const { user, can } = useAuth();
  const { entries } = useStoreData();
  const [filter, setFilter] = useState<"all" | LogEntry["status"]>("all");
  const [signing, setSigning] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    shift: "morning" as LogEntry["shift"],
    title: "",
    body: "",
  });

  const visible = useMemo(() => {
    if (!user) return [];
    const base = can("log.view.all") ? entries : entries.filter((e) => e.authorId === user.id);
    return base.filter((e) => filter === "all" || e.status === filter);
  }, [entries, user, can, filter]);

  if (!user) return null;

  const save = (list: LogEntry[]) => setEntries(list);

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      toast.error("العنوان والتفاصيل مطلوبة");
      return;
    }
    const now = new Date().toISOString();
    const entry: LogEntry = {
      id: uid(),
      date: form.date,
      shift: form.shift,
      department: user.department,
      title: form.title.trim(),
      body: form.body.trim(),
      authorId: user.id,
      authorName: user.fullName,
      status: "draft",
      signatures: [],
      createdAt: now,
      updatedAt: now,
    };
    save([entry, ...getEntries()]);
    logAudit(user, "إنشاء قيد", entry.title);
    setForm({ ...form, title: "", body: "" });
    toast.success("تم حفظ القيد كمسودة");
  };

  const update = (id: string, patch: Partial<LogEntry>, action: string) => {
    const list = getEntries().map((e) =>
      e.id === id ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e,
    );
    save(list);
    const target = list.find((e) => e.id === id);
    logAudit(user, action, target?.title ?? id);
  };

  const sign = (id: string, image: string) => {
    const entry = getEntries().find((e) => e.id === id);
    if (!entry) return;
    if (entry.signatures.some((s) => s.userId === user.id)) {
      toast.error("لقد وقّعت هذا القيد مسبقًا");
      setSigning(null);
      return;
    }
    update(
      id,
      {
        signatures: [
          ...entry.signatures,
          {
            userId: user.id,
            fullName: user.fullName,
            role: user.role,
            signedAt: new Date().toISOString(),
            image,
          },
        ],
      },
      "توقيع قيد",
    );
    setSigning(null);
    toast.success("تم تسجيل التوقيع");
  };

  return (
    <div className="space-y-5">
      {can("log.create") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">قيد جديد</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={create} className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="date">التاريخ</Label>
                  <Input
                    id="date"
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>الوردية</Label>
                  <Select
                    value={form.shift}
                    onValueChange={(v) => setForm({ ...form, shift: v as LogEntry["shift"] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SHIFT_LABEL).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">العنوان</Label>
                <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="body">التفاصيل</Label>
                <Textarea id="body" rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
              </div>
              <Button type="submit">حفظ كمسودة</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {(["all", "draft", "submitted", "approved", "rejected"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {f === "all" ? "الكل" : STATUS_LABEL[f]}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {visible.map((e) => {
          const mine = e.authorId === user.id;
          return (
            <Card key={e.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{e.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.date} · {SHIFT_LABEL[e.shift]} · {e.department} · {e.authorName}
                    </p>
                  </div>
                  <Badge variant={e.status === "approved" ? "default" : "secondary"}>{STATUS_LABEL[e.status]}</Badge>
                </div>
                <p className="whitespace-pre-wrap text-sm">{e.body}</p>

                {e.reviewerNote && (
                  <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
                    ملاحظة المراجع: {e.reviewerNote}
                  </p>
                )}

                {e.signatures.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {e.signatures.map((s) => (
                      <div key={s.userId} className="rounded-md border border-border p-2">
                        <img src={s.image} alt={`توقيع ${s.fullName}`} className="h-12 w-32 object-contain" />
                        <p className="text-[11px] text-muted-foreground">
                          {s.fullName} · {new Date(s.signedAt).toLocaleString("ar-EG")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {mine && e.status === "draft" && can("log.edit.own") && (
                    <Button size="sm" onClick={() => update(e.id, { status: "submitted" }, "رفع قيد للاعتماد")}>
                      رفع للاعتماد
                    </Button>
                  )}
                  {can("log.review") && e.status === "submitted" && (
                    <>
                      <Button size="sm" onClick={() => update(e.id, { status: "approved" }, "اعتماد قيد")}>
                        اعتماد
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          update(e.id, { status: "rejected", reviewerNote: "يحتاج مزيدًا من التفاصيل" }, "رفض قيد")
                        }
                      >
                        رفض
                      </Button>
                    </>
                  )}
                  {can("log.sign") && !e.signatures.some((s) => s.userId === user.id) && (
                    <Button size="sm" variant="outline" onClick={() => setSigning(signing === e.id ? null : e.id)}>
                      توقيع
                    </Button>
                  )}
                </div>

                {signing === e.id && (
                  <SignaturePad onSave={(img) => sign(e.id, img)} onCancel={() => setSigning(null)} />
                )}
              </CardContent>
            </Card>
          );
        })}
        {visible.length === 0 && <p className="text-sm text-muted-foreground">لا توجد قيود مطابقة.</p>}
      </div>
    </div>
  );
}
