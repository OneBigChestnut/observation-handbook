import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { getApiConfig } from "../config.js";
import { openDatabase } from "../db/client.js";
import { accounts, templateUsages, templateVersions } from "../db/schema.js";
import { hashPassword } from "../password.js";

describe("template api", () => {
  it("allows only super admins to manage fixed A5 portrait template versions and retires referenced versions", async () => {
    const database = openDatabase(":memory:"); migrate(database, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
    await database.insert(accounts).values([{ id: "super", username: "super", passwordHash: await hashPassword("correct-horse-battery-staple"), platformRole: "super_admin", createdAt: new Date() }, { id: "ordinary", username: "ordinary", passwordHash: await hashPassword("correct-horse-battery-staple"), createdAt: new Date() }]);
    const app = await buildApp(database, getApiConfig({ SESSION_SECRET: "a".repeat(32) }));
    const superCookie = (await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "super", password: "correct-horse-battery-staple" } })).headers["set-cookie"] as string;
    const ordinaryCookie = (await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "ordinary", password: "correct-horse-battery-staple" } })).headers["set-cookie"] as string;
    const denied = await app.inject({ method: "POST", url: "/api/admin/templates", headers: { cookie: ordinaryCookie }, payload: { name: "不能创建", kind: "cover", state: "published" } });
    const created = await app.inject({ method: "POST", url: "/api/admin/templates", headers: { cookie: superCookie }, payload: { name: "自然封面", kind: "cover", state: "published" } });
    expect(denied.statusCode).toBe(403); expect(created.statusCode).toBe(201); expect(created.json()).toMatchObject({ template: { kind: "cover", state: "published", paperSize: "A5", orientation: "portrait", layout: { preset: "standard", safeMarginMm: 10, textAlign: "left" } } });
    const template = created.json().template; await database.insert(templateUsages).values({ id: "usage-a", templateVersionId: template.id, referenceType: "export", referenceId: "export-a", createdAt: new Date() });
    const edited = await app.inject({ method: "PATCH", url: `/api/admin/templates/${template.id}`, headers: { cookie: superCookie }, payload: { name: "不可改" } });
    const removed = await app.inject({ method: "DELETE", url: `/api/admin/templates/${template.id}`, headers: { cookie: superCookie } });
    const publicList = await app.inject({ method: "GET", url: "/api/templates?kind=cover", headers: { cookie: ordinaryCookie } });
    expect(edited.statusCode).toBe(409); expect(removed.json()).toMatchObject({ retired: true, template: { state: "retired" } }); expect(publicList.json()).toEqual({ templates: [] });
    await app.close();
  });
});
