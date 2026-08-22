import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { getApiConfig } from "../config.js";
import { openDatabase } from "../db/client.js";
import { accounts, children, families, familyMemberships, mediaAssets } from "../db/schema.js";
import { hashPassword } from "../password.js";

describe("media api", () => {
  it("returns a thumbnail only to the media child's family", async () => {
    const mediaDirectory = join(tmpdir(), `observation-media-${crypto.randomUUID()}`);
    await mkdir(mediaDirectory, { recursive: true });
    await writeFile(join(mediaDirectory, "leaf-thumb.jpg"), "thumbnail");
    const database = openDatabase(":memory:");
    migrate(database, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
    await database.insert(accounts).values([
      { id: "account-a", username: "family-a", passwordHash: await hashPassword("correct-horse-battery-staple"), createdAt: new Date() },
      { id: "account-b", username: "family-b", passwordHash: await hashPassword("correct-horse-battery-staple"), createdAt: new Date() },
    ]);
    await database.insert(families).values([{ id: "family-a", name: "甲家", createdAt: new Date() }, { id: "family-b", name: "乙家", createdAt: new Date() }]);
    await database.insert(familyMemberships).values([{ accountId: "account-a", familyId: "family-a", role: "admin" }, { accountId: "account-b", familyId: "family-b", role: "admin" }]);
    await database.insert(children).values({ id: "child-a", familyId: "family-a", name: "乐乐", createdAt: new Date() });
    await database.insert(mediaAssets).values({ id: "media-a", childId: "child-a", originalPath: "leaf.jpg", thumbnailPath: "leaf-thumb.jpg", mimeType: "image/jpeg", width: 1200, height: 900, createdAt: new Date() });
    const config = { ...getApiConfig({ SESSION_SECRET: "a".repeat(32) }), mediaDirectory };
    const app = await buildApp(database, config);
    const loginA = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "family-a", password: "correct-horse-battery-staple" } });
    const loginB = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "family-b", password: "correct-horse-battery-staple" } });

    const allowed = await app.inject({ method: "GET", url: "/api/media/media-a/thumbnail", headers: { cookie: loginA.headers["set-cookie"] as string } });
    const denied = await app.inject({ method: "GET", url: "/api/media/media-a/thumbnail", headers: { cookie: loginB.headers["set-cookie"] as string } });

    expect(allowed.statusCode).toBe(200);
    expect(allowed.body).toBe("thumbnail");
    expect(denied.statusCode).toBe(403);
    await app.close();
    await rm(mediaDirectory, { recursive: true, force: true });
  });
});
