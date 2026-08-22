import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { getApiConfig } from "../config.js";
import { openDatabase } from "../db/client.js";
import { accounts, children, families, familyMemberships } from "../db/schema.js";
import { hashPassword } from "../password.js";

describe("family api", () => {
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
