import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { useStoreData } from "@/hooks/use-store-data";
import { uid } from "@/lib/store";
import {
  minutesBetween,
  openMovements,
  refreshMovementStatuses,
  registerReturn,
  startMovement,
} from "@/lib/movements";
import { MOVEMENT_STATUS_LABEL, S_LIST, type Movement, type Permit, type Person } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/movements")({
  head: () => ({
    meta: [
      { title: "الحركة والقيام والعودة | السجل اليومي الإلكتروني" },
      {
        name: "description",
        content: "تسجيل القيام من التصاريح الجاهزة ومتابعة الخارجين حاليًا والوقت المتبقي والتأخير وتسجيل العودة.",
      },
      { property: "og:title", content: "الحركة والقيام والعودة" },
      { property: "og:description", content: "متابعة الخارجين حاليًا وتسجيل القيام والعودة." },
    ],
  }),
  component: () => (
    <AppShell requires="movements.view">
      <MovementsPage />
    </AppShell>
  ),
});

function useClock(ms = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function fmtMinutes(total: number) {
  const abs = Math.abs(total);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return h > 0 ? `${h} س ${m} د` : `${m} د`;
}

function matchPerson(p: Person, q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return (
    p.fullName.toLowerCase().includes(s) ||
    p.shortCode.toLowerCase().includes(s) ||
    String(p.sNumber ?? "").includes(s)
  );
}

function MovementsPage() {
  const { user, can } = useAuth();
  const { persons, permits, exitTypes, refresh } = useStoreData();
  const now = useClock();

  const [tab, setTab] = useState<"ready" | "out">("ready");
  const [qReady, setQReady] = useState("");
  const [qOut, setQOut] = useState("");
  const [sFilter, setSFilter] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Movement[]>([]);

  useEffect(() => {
    refreshMovementStatuses(now);
    setOpen(openMovements(now));
  }, [now, permits]);

  const personById = useMemo(() => new Map(persons.map((p) => [p.id, p])), [persons]);
  const exitTypeName = (id: string) => exitTypes.find((t) => t.id === id)?.name ?? "—";

  const readyPermits = useMemo(() => {
    return permits
      .filter((p) => p.status === "ready")
      .filter((p) => {
        const linked = p.persons.map((r) => personById.get(r.personId)).filter(Boolean) as Person[];
        const sOk = sFilter === null || linked.some((x) => x.sNumber === sFilter);
        const qOk = !qReady.trim() || linked.some((x) => matchPerson(x, qReady));
        return sOk && qOk;
      })
      .sort((a, b) => a.issuedAt.localeCompare(b.issuedAt));
  }, [permits, personById, sFilter, qReady]);

  const outFiltered = useMemo(() => {
    const s = qOut.trim().toLowerCase();
    if (!s) return open;
    return open.filter((m) =>
      m.persons.some(
        (p) =>
          p.fullNameAtStart.toLowerCase().includes(s) ||
          p.shortCodeAtStart.toLowerCase().includes(s) ||
          String(p.sNumberAtStart ?? "").includes(s),
      ),
    );
  }, [open, qOut]);

  const doStart = (permit: Permit) => {
    if (!user || busy) return;
    setBusy(true);
    const res = startMovement(user, { permitId: permit.id, requestId: uid() });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error ?? "تعذر تسجيل القيام");
    toast.success("تم تسجيل القيام وإضافة البيان للسجل اليومي");
    refresh();
    setOpen(openMovements(new Date()));
    setTab("out");
  };

  const doReturn = (m: Movement) => {
    if (!user || busy) return;
    setBusy(true);
    const res = registerReturn(user, { movementId: m.id, requestId: uid() });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error ?? "تعذر تسجيل العودة");
    const late = res.movement?.return?.lateMinutes ?? 0;
    toast.success(late > 0 ? `تم تسجيل العودة بتأخير ${fmtMinutes(late)}` : "تم تسجيل العودة في الوقت");
    refresh();
    setOpen(openMovements(new Date()));
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">الحركة: القيام والعودة</h1>
        <p className="text-sm text-muted-foreground">
          التصريح لا يعني القيام. يبدأ الخروج فعليًا عند تسجيل القيام من هذه الصفحة.
        </p>
      </div>

      <div className="flex gap-2">
        <Button variant={tab === "ready" ? "default" : "outline"} size="sm" onClick={() => setTab("ready")}>
          التصاريح الجاهزة ({permits.filter((p) => p.status === "ready").length})
        </Button>
        <Button variant={tab === "out" ? "default" : "outline"} size="sm" onClick={() => setTab("out")}>
          الخارجون حاليًا ({open.length})
        </Button>
      </div>

      {tab === "ready" ? (
        <div className="space-y-3">
          <Input
            placeholder="بحث بالاسم أو الكود المختصر أو رقم S"
            value={qReady}
            onChange={(e) => setQReady(e.target.value)}
          />
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant={sFilter === null ? "secondary" : "ghost"} onClick={() => setSFilter(null)}>
              الكل
            </Button>
            {S_LIST.map((n) => (
              <Button
                key={n}
                size="sm"
                variant={sFilter === n ? "secondary" : "ghost"}
                onClick={() => setSFilter(sFilter === n ? null : n)}
              >
                S{n}
              </Button>
            ))}
          </div>

          {readyPermits.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              لا توجد تصاريح جاهزة مطابقة
            </p>
          ) : (
            readyPermits.map((p) => {
              const linked = p.persons.map((r) => personById.get(r.personId)).filter(Boolean) as Person[];
              const isOpenCard = expanded === p.id;
              return (
                <Card key={p.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                      <span>{linked.map((x) => x.fullName).join("، ") || "—"}</span>
                      <Badge variant="secondary">{exitTypeName(p.exitTypeId)}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {linked.map((x) => (
                        <span key={x.id} className="rounded bg-muted px-2 py-1">
                          {x.shortCode} · س {x.sNumber ?? "-"}
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="text-xs font-medium text-primary underline"
                      onClick={() => setExpanded(isOpenCard ? null : p.id)}
                    >
                      {isOpenCard ? "إخفاء التفاصيل" : "تفاصيل التصريح"}
                    </button>
                    {isOpenCard && (
                      <dl className="grid grid-cols-2 gap-2 rounded-md bg-muted/50 p-3 text-xs">
                        <div>
                          <dt className="text-muted-foreground">وقت الخروج المصرح</dt>
                          <dd>{p.exitTime || "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">العودة المتوقعة</dt>
                          <dd>
                            {p.expectedReturnDate || "—"} {p.expectedReturnTime || ""}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">المدة</dt>
                          <dd>{p.durationMinutes ? fmtMinutes(p.durationMinutes) : "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">أصدره</dt>
                          <dd>{p.issuedByName ?? "—"}</dd>
                        </div>
                        {p.notes ? (
                          <div className="col-span-2">
                            <dt className="text-muted-foreground">ملاحظات</dt>
                            <dd>{p.notes}</dd>
                          </div>
                        ) : null}
                      </dl>
                    )}
                    <Button
                      className="w-full"
                      disabled={!can("movements.start") || busy}
                      onClick={() => doStart(p)}
                    >
                      تسجيل قيام
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <Input placeholder="بحث بالاسم أو الكود" value={qOut} onChange={(e) => setQOut(e.target.value)} />
          {outFiltered.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              لا يوجد خارجون حاليًا
            </p>
          ) : (
            outFiltered.map((m) => {
              const remaining = minutesBetween(now.toISOString(), m.expectedReturnAt);
              const late = remaining < 0;
              return (
                <Card key={m.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                      <span>{m.persons.map((p) => p.fullNameAtStart).join("، ")}</span>
                      <Badge
                        variant={m.status === "absent" ? "destructive" : m.status === "late" ? "outline" : "secondary"}
                      >
                        {MOVEMENT_STATUS_LABEL[m.status]}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {m.persons.map((p) => (
                        <span key={p.personId} className="rounded bg-muted px-2 py-1">
                          {p.shortCodeAtStart} · س {p.sNumberAtStart ?? "-"}
                        </span>
                      ))}
                      <span className="rounded bg-muted px-2 py-1">{m.exitTypeName}</span>
                    </div>
                    <dl className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <dt className="text-muted-foreground">وقت القيام</dt>
                        <dd>{new Date(m.startedAt).toLocaleString("ar-EG")}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">العودة المتوقعة</dt>
                        <dd>{new Date(m.expectedReturnAt).toLocaleString("ar-EG")}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">{late ? "التأخير" : "الوقت المتبقي"}</dt>
                        <dd className={late ? "font-semibold text-destructive" : "font-semibold"}>
                          {fmtMinutes(remaining)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">سجّل القيام</dt>
                        <dd>{m.startedByName}</dd>
                      </div>
                    </dl>
                    <Button
                      className="w-full"
                      variant={late ? "destructive" : "default"}
                      disabled={!can("movements.return") || busy}
                      onClick={() => doReturn(m)}
                    >
                      تسجيل العودة
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
