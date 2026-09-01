import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { getApiConfig } from "../config.js";
import { openDatabase } from "../db/client.js";
import { accounts, children, families, familyMemberships, observationCards, observationProjects } from "../db/schema.js";
import { hashPassword } from "../password.js";

describe("observation projects", () => it("guides a child from a project to a timeline and missing-part prompt", async () => {
  const database = openDatabase(":memory:"); migrate(database, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
  await database.insert(accounts).values({ id: "adult", username: "adult", passwordHash: await hashPassword("correct-horse-battery-staple"), createdAt: new Date() }); await database.insert(families).values({ id: "family", name: "家", createdAt: new Date() }); await database.insert(familyMemberships).values({ accountId: "adult", familyId: "family", role: "admin" }); await database.insert(children).values({ id: "child", familyId: "family", name: "乐乐", createdAt: new Date() });
  const app = await buildApp(database, getApiConfig({ SESSION_SECRET: "a".repeat(32) })); const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "adult", password: "correct-horse-battery-staple" } }); const cookie = login.headers["set-cookie"] as string;
  const created = await app.inject({ method: "POST", url: "/api/children/child/projects", headers: { cookie }, payload: { title: "公园的一年", objectName: "银杏树", place: "小区公园", question: "四季里叶子怎样变化？", startedAt: "2026-03-01", cadenceDays: 7, focusParts: ["树叶", "树皮"] } }); const id = created.json().project.id as string;
  await database.insert(observationCards).values({ id: "card", childId: "child", projectId: id, observedAt: "2026-03-02", text: "新芽", observationPart: "树叶", season: "春", changeNote: "发芽", evidence: "照片", hypothesis: "天气变暖", createdAt: new Date(), updatedAt: new Date() });
  const learning = await app.inject({ method: "GET", url: `/api/projects/${id}/learning`, headers: { cookie } });
  expect(created.statusCode).toBe(201); expect(learning.json()).toMatchObject({ timeline: [{ part: "树叶", season: "春" }], missingParts: ["树皮"] }); await app.close();
}));
