import { logAudit } from "./store";
import type { DailyRecord, User } from "./types";
import { formatBusinessTime } from "./daily";

/** daily register export columns, in the required order */
export const RECORD_COLUMNS = ["التسلسل", "التاريخ والوقت", "البيان", "الموضوع", "التوقيع"] as const;

const cell = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;

export function recordsToCsv(records: DailyRecord[], businessDate: string): string {
  const rows = [...records]
    .sort((a, b) => a.sequence - b.sequence)
    .map((r) =>
      [
        String(r.sequence),
        `${businessDate} ${formatBusinessTime(r.createdAt)}`,
        r.statementText,
        r.topicName || "",
        r.signatureName || r.createdByName,
      ]
        .map(cell)
        .join(","),
    );
  return "\uFEFF" + [RECORD_COLUMNS.map(cell).join(","), ...rows].join("\r\n");
}

export function downloadCsv(filename: string, csv: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** exports the actual stored records of a business date, respecting sequence order */
export function exportDailyRecords(user: User, businessDate: string, records: DailyRecord[]) {
  downloadCsv(`daily-register-${businessDate}.csv`, recordsToCsv(records, businessDate));
  logAudit(user, "تصدير السجل اليومي", businessDate, `عدد البيانات: ${records.length}`);
}

export function printDailyRegister(user: User, businessDate: string, count: number) {
  logAudit(user, "طباعة السجل اليومي", businessDate, `عدد البيانات: ${count}`);
  if (typeof window !== "undefined") window.print();
}
