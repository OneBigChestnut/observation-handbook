import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";
import { createSession, getActorFromToken } from "./auth.js";
import { openDatabase } from "./db/client.js";
import { accounts } from "./db/schema.js";

describe("authenticated sessions", () => {
  it("rejects an expired session token", async () => {
    const database = openDatabase(":memory:");
    migrate(database, { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });
    await database.insert(accounts).values({ id: "account-1", username: "admin", passwordHash: "hash", createdAt: new Date("2026-08-20T00:00:00Z") });

    const { rawToken } = await createSession(database, "account-1", new Date("2026-08-22T00:00:00Z"));

    await expect(getActorFromToken(database, rawToken, new Date("2026-09-22T00:00:00Z"))).resolves.toBeNull();
  });
});
