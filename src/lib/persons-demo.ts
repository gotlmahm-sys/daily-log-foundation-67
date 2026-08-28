import { generateShortCode, uid } from "./store";
import type { Person } from "./types";

const FIRST = ["أحمد", "محمد", "علي", "خالد", "يوسف", "عمر", "مصطفى", "كريم", "طارق", "سامي"];
const SECOND = ["حسن", "إبراهيم", "سعيد", "فؤاد", "رمضان", "عبدالله", "منصور", "صابر", "شعبان", "جابر"];
const LAST = ["الشريف", "العطار", "المصري", "الدسوقي", "الحسيني", "زايد", "قنديل", "بدران", "حمدي", "سليمان"];

/** fully fictitious identifiers — never real national ids (prefix 99 is unused) */
function fakeId(i: number) {
  const seq = String(100000 + i * 137).slice(0, 6);
  return `99${String(20 + (i % 30)).padStart(2, "0")}0${(i % 9) + 1}${String((i % 28) + 1).padStart(2, "0")}${seq}`;
}

export function buildDemoPersons(count: number, by: { id: string; fullName: string }): Person[] {
  const now = new Date().toISOString();
  return Array.from({ length: count }, (_, i) => {
    const nationalId = fakeId(i + 1);
    return {
      id: uid(),
      fullName: `${FIRST[i % FIRST.length]} ${SECOND[(i * 3) % SECOND.length]} ${LAST[(i * 7) % LAST.length]}`,
      nationalId,
      shortCode: generateShortCode(nationalId),
      sNumber: (i % 18) + 1,
      active: true,
      createdAt: now,
      createdBy: by.id,
      createdByName: by.fullName,
    } satisfies Person;
  });
}

export function personsToCsv(persons: Person[]): string {
  const rows = [
    ["الاسم", "الرقم التجريبي", "الكود المختصر", "S"],
    ...persons.map((p) => [p.fullName, p.nationalId ?? "", p.shortCode, p.sNumber ? `S${p.sNumber}` : ""]),
  ];
  return rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
}

export function parsePersonsCsv(text: string, by: { id: string; fullName: string }): Person[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const now = new Date().toISOString();
  const out: Person[] = [];
  for (const [i, line] of lines.entries()) {
    const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    if (i === 0 && /الاسم|name/i.test(cells[0] ?? "")) continue;
    const [fullName, nationalId, shortCode, s] = cells;
    if (!fullName) continue;
    const sNum = Number((s ?? "").replace(/[^\d]/g, ""));
    out.push({
      id: uid(),
      fullName,
      nationalId: nationalId ?? "",
      shortCode: shortCode || generateShortCode(nationalId ?? ""),
      sNumber: sNum >= 1 ? sNum : null,
      active: true,
      createdAt: now,
      createdBy: by.id,
      createdByName: by.fullName,
    });
  }
  return out;
}
