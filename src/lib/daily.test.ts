import { beforeEach, describe, expect, test } from "bun:test";

/* ---- minimal browser env (localStorage + window events) ---- */
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
  key(i: number) {
    return Array.from(this.m.keys())[i] ?? null;
  }
  get length() {
    return this.m.size;
  }
}
const storage = new MemStorage();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: storage,
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
};
(globalThis as unknown as { localStorage: unknown }).localStorage = storage;

const store = await import("./store");
const daily = await import("./daily");
const { ensureSeed, getUsers, setSessionUserId, setPersons } = store;
import type { Person, User } from "./types";

const person = (id: string, name: string, s: number): Person => ({
  id,
  fullName: name,
  sNumber: s,
  shortCode: `C${s}`,
  active: true,
  createdAt: new Date().toISOString(),
});

const P1 = person("p1", "أحمد علي", 3);
const P2 = person("p2", "محمد سعيد", 7);

let owner: User;
let employee: User;

function reset() {
  storage.clear();
  ensureSeed();
  daily.ensureDailySeed();
  setPersons([P1, P2]);
  owner = getUsers().find((u) => u.role === "owner")!;
  employee = getUsers().find((u) => u.role === "employee")!;
  setSessionUserId(owner.id);
}

const tplFor = (name: string) => daily.getTemplates().find((t) => t.name === name)!;

describe("daily register", () => {
  beforeEach(reset);

  test("open day, sequence starts at 1 and increments without duplicates", () => {
    const d = daily.businessDateOf();
    daily.openRegister(owner, d);
    for (let i = 0; i < 3; i++) {
      const r = daily.createDailyRecord(owner, {
        statementText: `بيان ${i}`,
        topicId: null,
        statementTypeId: null,
        entryMode: "manual",
        persons: [],
        requestId: `req-${i}`,
      });
      expect(r.ok).toBe(true);
    }
    const seqs = daily.getRecordsFor(d).map((r) => r.sequence);
    expect(seqs).toEqual([1, 2, 3]);
    expect(new Set(seqs).size).toBe(3);
  });

  test("a new business day restarts at 1 and hides the previous day", () => {
    const d = daily.businessDateOf();
    daily.createDailyRecord(owner, {
      statementText: "أمس",
      topicId: null,
      statementTypeId: null,
      entryMode: "manual",
      persons: [],
      requestId: "a",
    });
    // simulate the next business day by rewriting the stored record's date
    const key = "sijil.records";
    const all = JSON.parse(storage.getItem(key)!);
    const prev = new Date(`${d}T12:00:00Z`);
    prev.setUTCDate(prev.getUTCDate() - 1);
    const prevDate = prev.toISOString().slice(0, 10);
    all[0].businessDate = prevDate;
    storage.setItem(key, JSON.stringify(all));

    const r = daily.createDailyRecord(owner, {
      statementText: "اليوم",
      topicId: null,
      statementTypeId: null,
      entryMode: "manual",
      persons: [],
      requestId: "b",
    });
    expect(r.record!.sequence).toBe(1);
    expect(daily.getRecordsFor(d).length).toBe(1);
    expect(daily.getRecordsFor(prevDate).length).toBe(1);
  });

  test("repeated submit with the same requestId creates no duplicate", () => {
    const input = {
      statementText: "بيان مكرر",
      topicId: null,
      statementTypeId: null,
      entryMode: "manual" as const,
      persons: [],
      requestId: "same",
    };
    const a = daily.createDailyRecord(owner, input);
    const b = daily.createDailyRecord(owner, input);
    const c = daily.createDailyRecord(owner, input);
    expect(a.record!.id).toBe(b.record!.id);
    expect(b.record!.id).toBe(c.record!.id);
    expect(daily.getRecordsFor(daily.businessDateOf()).length).toBe(1);
  });

  test("created_by, signature and createdAt come from the store, not the caller", () => {
    const spoof = { ...owner, id: employee.id, fullName: "مزيف", signatureName: "مزيف" } as User;
    const r = daily.createDailyRecord(spoof, {
      statementText: "محاولة انتحال",
      topicId: null,
      statementTypeId: null,
      entryMode: "manual",
      persons: [],
      requestId: "spoof",
      at: new Date("2001-01-01T00:00:00Z"),
    });
    // session belongs to owner → a record for another user id is rejected
    expect(r.ok).toBe(false);

    const ok = daily.createDailyRecord({ ...owner, fullName: "مزيف", signatureName: "مزيف" } as User, {
      statementText: "بيان",
      topicId: null,
      statementTypeId: null,
      entryMode: "manual",
      persons: [],
      requestId: "ok",
      at: new Date("2001-01-01T00:00:00Z"),
    });
    expect(ok.record!.createdBy).toBe(owner.id);
    expect(ok.record!.createdByName).toBe(owner.fullName);
    expect(ok.record!.signatureName).toBe(owner.signatureName || owner.fullName);
    expect(new Date(ok.record!.createdAt).getFullYear()).toBeGreaterThan(2020);
  });
});

describe("templates and record persons", () => {
  beforeEach(reset);

  test("templates come from storage and render {PERSON} + {S_NUMBER}", () => {
    const tpl = tplFor("قيام فسحة (شخص واحد)");
    const text = daily.renderStatement(tpl.pattern, [P1]);
    expect(text).toContain(P1.fullName);
    expect(text).toContain("3");
    expect(text).not.toContain("{");

    const r = daily.createDailyRecord(owner, {
      statementText: text,
      topicId: tpl.topicId,
      statementTypeId: tpl.statementTypeId,
      templateId: tpl.id,
      entryMode: "template",
      persons: [P1],
      requestId: "t1",
    });
    expect(r.record!.statementText).toBe(text);
    expect(r.record!.persons).toEqual([
      { personId: "p1", fullNameAtCreation: P1.fullName, sNumberAtCreation: 3, shortCodeAtCreation: "C3" },
    ]);
    const after = daily.getTemplates().find((t) => t.id === tpl.id)!;
    expect(after.usageCount).toBe(1);
    expect(after.lastUsedAt).toBeTruthy();
  });

  test("{PERSONS} renders every selected person and each is stored as its own relation", () => {
    const tpl = tplFor("قيام فسحة (مجموعة)");
    const text = daily.renderStatement(tpl.pattern, [P1, P2]);
    expect(text).toContain(P1.fullName);
    expect(text).toContain(P2.fullName);
    const r = daily.createDailyRecord(owner, {
      statementText: text,
      topicId: tpl.topicId,
      statementTypeId: tpl.statementTypeId,
      templateId: tpl.id,
      entryMode: "template",
      persons: [P1, P2],
      requestId: "t2",
    });
    expect(r.record!.persons.map((p) => p.personId)).toEqual(["p1", "p2"]);
  });

  test("usage_count only moves on a real record, not on preview or a failed save", () => {
    const tpl = tplFor("عودة من الفسحة");
    daily.renderStatement(tpl.pattern, [P1]);
    expect(daily.getTemplates().find((t) => t.id === tpl.id)!.usageCount).toBe(0);
    const fail = daily.createDailyRecord(owner, {
      statementText: "   ",
      topicId: null,
      statementTypeId: null,
      templateId: tpl.id,
      entryMode: "template",
      persons: [P1],
      requestId: "t3",
    });
    expect(fail.ok).toBe(false);
    expect(daily.getTemplates().find((t) => t.id === tpl.id)!.usageCount).toBe(0);
  });

  test("manual text keeps its original text and yields a person-free pattern reusable for others", () => {
    const manual = `قيام المجند ${P1.fullName} س ${P1.sNumber} مأمورية.`;
    const rec = daily.createDailyRecord(owner, {
      statementText: manual,
      topicId: daily.suggestTopic(manual)?.id ?? null,
      statementTypeId: null,
      entryMode: "manual",
      persons: [P1],
      requestId: "m1",
    });
    expect(rec.record!.statementText).toBe(manual);

    const pattern = daily.suggestPattern(manual, [P1]);
    expect(pattern).not.toContain(P1.fullName);
    expect(pattern).toContain("{PERSON}");
    expect(pattern).toContain("{S_NUMBER}");

    const saved = daily.saveTemplate(owner, {
      name: "مأمورية",
      pattern,
      topicId: null,
      statementTypeId: null,
      source: "manual",
    });
    expect(saved.ok).toBe(true);
    const reused = daily.renderStatement(saved.template!.pattern, [P2]);
    expect(reused).toContain(P2.fullName);
    expect(reused).toContain("7");
    expect(reused).not.toContain(P1.fullName);
  });
});

describe("topics and permissions", () => {
  beforeEach(reset);

  test("topics are read from storage and detected from statement meaning", () => {
    expect(daily.getTopics().length).toBeGreaterThan(0);
    expect(daily.suggestTopic("عودة المجند من الفسحة")?.name).toBe("عودة");
    expect(daily.suggestTopic("غياب المجند")?.name).toBe("غياب");
  });

  test("data layer rejects actions the role lacks, even when the UI is bypassed", () => {
    setSessionUserId(employee.id);
    const manual = daily.createDailyRecord(employee, {
      statementText: "كتابة يدوية",
      topicId: null,
      statementTypeId: null,
      entryMode: "manual",
      persons: [],
      requestId: "e1",
    });
    expect(manual.ok).toBe(false);

    const tplSave = daily.saveTemplate(employee, {
      name: "x",
      pattern: "قيام {PERSON}",
      topicId: null,
      statementTypeId: null,
      source: "manual",
    });
    expect(tplSave.ok).toBe(false);

    const allowed = daily.createDailyRecord(employee, {
      statementText: daily.renderStatement(tplFor("عودة من الفسحة").pattern, [P1]),
      topicId: null,
      statementTypeId: null,
      templateId: tplFor("عودة من الفسحة").id,
      entryMode: "template",
      persons: [P1],
      requestId: "e2",
    });
    expect(allowed.ok).toBe(true);
  });

  test("inactive or non-session users cannot write records", () => {
    setSessionUserId(null);
    const r = daily.createDailyRecord({ ...owner, id: "ghost" } as User, {
      statementText: "شبح",
      topicId: null,
      statementTypeId: null,
      entryMode: "manual",
      persons: [],
      requestId: "g1",
    });
    expect(r.ok).toBe(false);
  });
});
