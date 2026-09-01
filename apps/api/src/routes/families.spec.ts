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

  it("allows a super admin to inspect a family child", async () => {
    const database = openDatabase(":memory:");
    migrate(database, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
    await database.insert(accounts).values({ id: "platform", username: "platform", passwordHash: await hashPassword("correct-horse-battery-staple"), platformRole: "super_admin", createdAt: new Date() });
    await database.insert(families).values({ id: "family-a", name: "甲家", createdAt: new Date() });
    await database.insert(children).values({ id: "child-a", familyId: "family-a", name: "乐乐", createdAt: new Date() });
    const app = await buildApp(database, getApiConfig({ SESSION_SECRET: "a".repeat(32) }));
    const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "platform", password: "correct-horse-battery-staple" } });
    const response = await app.inject({ method: "GET", url: "/api/children/child-a", headers: { cookie: login.headers["set-cookie"] as string } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ child: { id: "child-a", name: "乐乐" } });
    await app.close();
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

  it("creates a child PIN account that can edit only its own archive", async () => {
    const database = openDatabase(":memory:");
    migrate(database, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
    await database.insert(accounts).values({ id: "admin-1", username: "parent", passwordHash: await hashPassword("correct-horse-battery-staple"), createdAt: new Date() });
    await database.insert(families).values({ id: "family-1", name: "林家", createdAt: new Date() });
    await database.insert(familyMemberships).values({ accountId: "admin-1", familyId: "family-1", role: "admin" });
    await database.insert(children).values({ id: "sibling", familyId: "family-1", name: "安安", createdAt: new Date() });
    const app = await buildApp(database, getApiConfig({ SESSION_SECRET: "a".repeat(32) }));
    const parentLogin = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "parent", password: "correct-horse-battery-staple" } });
    const created = await app.inject({ method: "POST", url: "/api/families/family-1/children", headers: { cookie: parentLogin.headers["set-cookie"] as string }, payload: { name: "乐乐", username: "lele", pin: "123456" } });
    expect(created.statusCode).toBe(201);
    const childLogin = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "lele", password: "123456" } });
    expect(childLogin.statusCode).toBe(200);
    const cookie = childLogin.headers["set-cookie"] as string;
    const ownFamilies = await app.inject({ method: "GET", url: "/api/families/current", headers: { cookie } });
    const ownChildId = created.json().child.id as string;
    const ownTag = await app.inject({ method: "POST", url: `/api/children/${ownChildId}/tags`, headers: { cookie }, payload: { name: "树皮", color: "olive" } });
    const siblingTag = await app.inject({ method: "POST", url: "/api/children/sibling/tags", headers: { cookie }, payload: { name: "越界", color: "olive" } });
    const memberList = await app.inject({ method: "GET", url: "/api/families/family-1/members", headers: { cookie } });

    expect(ownFamilies.json()).toMatchObject({ families: [{ children: [{ id: ownChildId, name: "乐乐" }] }] });
    expect(ownTag.statusCode).toBe(201);
    expect(siblingTag.statusCode).toBe(403);
    expect(memberList.statusCode).toBe(403);

    const resetPin = await app.inject({ method: "PATCH", url: `/api/families/family-1/children/${ownChildId}/pin`, headers: { cookie: parentLogin.headers["set-cookie"] as string }, payload: { pin: "654321" } });
    const oldPin = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "lele", password: "123456" } });
    const newPin = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "lele", password: "654321" } });
    expect(resetPin.statusCode).toBe(204);
    expect(oldPin.statusCode).toBe(401);
    expect(newPin.statusCode).toBe(200);
  });
});
