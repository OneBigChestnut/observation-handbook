import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { getApiConfig } from "../config.js";
import { openDatabase } from "../db/client.js";
import { accounts, children, families, familyMemberships, handbooks, handbookCards, observationCards } from "../db/schema.js";
import { hashPassword } from "../password.js";
import { renderHandbookPdf } from "../exports/pdf.js";

it("keeps Chinese card copy as selectable PDF text", async () => {
  const output = await renderHandbookPdf({
      title: "我看春天",
      introduction: "观察记录",
      childName: "大宝",
      startedAt: "2026-08-23",
      cards: [{ observedAt: "2026-08-24", text: "红绿", textBlocks: ["红绿", "绿绿的红红的。"], photos: [], layout: { texts: [{ x: 10, y: 68, width: 80, height: 9, content: "", color: "#254c3c", fontSize: 16 }, { x: 10, y: 79, width: 80, height: 12, content: "", color: "#57806a", fontSize: 11 }] } }],
      kind: "screen",
    });
  const rawPdf = output.toString("latin1");
  expect(rawPdf).toContain("/FontFile2");
  expect(rawPdf).not.toContain("/Subtype /Image");
});

describe("exports", () => it("creates an immutable A5 job, renders a real PDF, and denies readers", async () => {
  const database = openDatabase(":memory:");
  migrate(database, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
  await database.insert(accounts).values([{ id: "a", username: "a", passwordHash: await hashPassword("correct-horse-battery-staple"), createdAt: new Date() }, { id: "r", username: "r", passwordHash: await hashPassword("correct-horse-battery-staple"), createdAt: new Date() }]);
  await database.insert(families).values({ id: "f", name: "f", createdAt: new Date() });
  await database.insert(familyMemberships).values([{ accountId: "a", familyId: "f", role: "admin" }, { accountId: "r", familyId: "f", role: "reader" }]);
  await database.insert(children).values({ id: "c", familyId: "f", name: "c", createdAt: new Date() });
  await database.insert(handbooks).values({ id: "h", childId: "c", title: "h", introduction: "i", startedAt: "2026-01-01", visibility: "family", createdAt: new Date(), updatedAt: new Date() });
  await database.insert(observationCards).values({ id: "card", childId: "c", observedAt: "2026-01-02", text: "观察", state: "active", projectId: null, observationPart: null, season: null, stage: null, changeNote: null, evidence: null, hypothesis: null, templateId: null, createdAt: new Date(), updatedAt: new Date() });
  await database.insert(handbookCards).values({ handbookId: "h", cardId: "card", position: 0 });
  const app = await buildApp(database, getApiConfig({ SESSION_SECRET: "a".repeat(32) }));
  const login = async (username: string) => (await app.inject({ method: "POST", url: "/api/auth/login", payload: { username, password: "correct-horse-battery-staple" } })).headers["set-cookie"] as string;
  const admin = await login("a");
  const reader = await login("r");
  expect((await app.inject({ method: "POST", url: "/api/children/c/exports", headers: { cookie: reader }, payload: { handbookId: "h", kind: "screen" } })).statusCode).toBe(403);
  const print = await app.inject({ method: "POST", url: "/api/children/c/exports", headers: { cookie: admin }, payload: { handbookId: "h", kind: "print" } });
  expect(JSON.parse(print.json().export.snapshot).format).toMatchObject({ paperSize: "A5", bleedMm: 3, cropMarks: true });
  const download = await app.inject({ method: "GET", url: `/api/exports/${print.json().export.id}/download`, headers: { cookie: admin } });
  expect(download.headers["content-type"]).toContain("application/pdf");
  expect(download.body).toContain("%PDF-");
  expect(download.body).toContain("jsPDF");
  const repeatDownload = await app.inject({ method: "GET", url: `/api/exports/${print.json().export.id}/download`, headers: { cookie: admin } });
  expect(repeatDownload.body).toBe(download.body);
  await app.close();
}));
