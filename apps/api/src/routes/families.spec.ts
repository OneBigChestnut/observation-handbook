import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { getApiConfig } from "../config.js";
import { openDatabase } from "../db/client.js";
import { accounts, children, families, familyMemberships } from "../db/schema.js";
import { hashPassword } from "../password.js";

describe("family api", () => {
  it("allows an administrator to add a read-only adult", async () => {
    const database = openDatabase(":memory:");
    migrate(database, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
    await database.insert(accounts).values([
      { id: "admin-1", username: "admin", passwordHash: await hashPassword("correct-horse-battery-staple"), createdAt: new Date() },
      { id: "reader-1", username: "reader", passwordHash: await hashPassword("correct-horse-battery-staple"), createdAt: new Date() },
    ]);
    await database.insert(families).values({ id: "family-1", name: "林家档案室", createdAt: new Date() });
    await database.insert(familyMemberships).values({ accountId: "admin-1", familyId: "family-1", role: "admin" });
    const app = await buildApp(database, getApiConfig({ SESSION_SECRET: "a".repeat(32) }));
    const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "admin", password: "correct-horse-battery-staple" } });

    const response = await app.inject({ method: "POST", url: "/api/families/family-1/members", headers: { cookie: login.headers["set-cookie"] as string }, payload: { accountId: "reader-1" } });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ member: { accountId: "reader-1", role: "reader" } });
  });

  it("does not return a child from another family", async () => {
    const database = openDatabase(":memory:");
    migrate(database, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
    await database.insert(accounts).values({ id: "account-a", username: "family-a", passwordHash: await hashPassword("correct-horse-battery-staple"), createdAt: new Date() });
    await database.insert(families).values([{ id: "family-a", name: "甲家", createdAt: new Date() }, { id: "family-b", name: "乙家", createdAt: new Date() }]);
    await database.insert(familyMemberships).values({ accountId: "account-a", familyId: "family-a", role: "admin" });
    await database.insert(children).values({ id: "child-b", familyId: "family-b", name: "豆豆", createdAt: new Date() });
    const app = await buildApp(database, getApiConfig({ SESSION_SECRET: "a".repeat(32) }));
    const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "family-a", password: "correct-horse-battery-staple" } });

    const response = await app.inject({ method: "GET", url: "/api/children/child-b", headers: { cookie: login.headers["set-cookie"] as string } });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: "FAMILY_ACCESS_DENIED" });
  });

  it("allows a reader to view a family but rejects child creation", async () => {
    const database = openDatabase(":memory:");
    migrate(database, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
    await database.insert(accounts).values({ id: "reader-1", username: "reader", passwordHash: await hashPassword("correct-horse-battery-staple"), createdAt: new Date() });
    await database.insert(families).values({ id: "family-1", name: "林家档案室", createdAt: new Date() });
    await database.insert(familyMemberships).values({ accountId: "reader-1", familyId: "family-1", role: "reader" });
    await database.insert(children).values({ id: "child-1", familyId: "family-1", name: "乐乐", createdAt: new Date() });
    const app = await buildApp(database, getApiConfig({ SESSION_SECRET: "a".repeat(32) }));
    const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "reader", password: "correct-horse-battery-staple" } });
    const cookie = login.headers["set-cookie"] as string;

    const current = await app.inject({ method: "GET", url: "/api/families/current", headers: { cookie } });
    const createChild = await app.inject({ method: "POST", url: "/api/families/family-1/children", headers: { cookie }, payload: { name: "安安" } });

    expect(current.statusCode).toBe(200);
    expect(current.json()).toMatchObject({ families: [{ id: "family-1", children: [{ id: "child-1", name: "乐乐" }] }] });
    expect(createChild.statusCode).toBe(403);
    expect(createChild.json()).toMatchObject({ code: "FAMILY_ADMIN_REQUIRED" });
  });
});
