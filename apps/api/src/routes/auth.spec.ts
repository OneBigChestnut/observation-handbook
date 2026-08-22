import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { getApiConfig } from "../config.js";
import { openDatabase } from "../db/client.js";
import { accounts } from "../db/schema.js";
import { hashPassword } from "../password.js";

describe("authentication api", () => {
  it("does not expose the current account without a session", async () => {
    const database = openDatabase(":memory:");
    migrate(database, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
    const app = await buildApp(database, getApiConfig({ SESSION_SECRET: "a".repeat(32) }));

    const response = await app.inject({ method: "GET", url: "/api/auth/me" });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: "AUTH_REQUIRED" });
  });

  it("creates an httpOnly session only for valid credentials", async () => {
    const database = openDatabase(":memory:");
    migrate(database, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
    await database.insert(accounts).values({
      id: "account-1",
      username: "admin",
      passwordHash: await hashPassword("correct-horse-battery-staple"),
      createdAt: new Date("2026-08-20T00:00:00Z"),
    });
    const app = await buildApp(database, getApiConfig({ SESSION_SECRET: "a".repeat(32) }));

    const failed = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "admin", password: "wrong-password" } });
    expect(failed.statusCode).toBe(401);

    const success = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "admin", password: "correct-horse-battery-staple" } });
    expect(success.statusCode).toBe(200);
    expect(success.headers["set-cookie"]).toContain("HttpOnly");
  });
});
