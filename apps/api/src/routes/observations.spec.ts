import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { getApiConfig } from "../config.js";
import { openDatabase } from "../db/client.js";
import { accounts, children, families, familyMemberships, mediaAssets } from "../db/schema.js";
import { hashPassword } from "../password.js";

describe("observation api", () => {
  it("creates a card from current-child media and tags", async () => {
    const database = openDatabase(":memory:");
    migrate(database, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
    await database.insert(accounts).values([
      { id: "admin-a", username: "admin-a", passwordHash: await hashPassword("correct-horse-battery-staple"), createdAt: new Date() },
      { id: "reader-a", username: "reader-a", passwordHash: await hashPassword("correct-horse-battery-staple"), createdAt: new Date() },
      { id: "admin-b", username: "admin-b", passwordHash: await hashPassword("correct-horse-battery-staple"), createdAt: new Date() },
    ]);
    await database.insert(families).values([{ id: "family-a", name: "甲家", createdAt: new Date() }, { id: "family-b", name: "乙家", createdAt: new Date() }]);
    await database.insert(familyMemberships).values([{ accountId: "admin-a", familyId: "family-a", role: "admin" }, { accountId: "reader-a", familyId: "family-a", role: "reader" }, { accountId: "admin-b", familyId: "family-b", role: "admin" }]);
    await database.insert(children).values([{ id: "child-a", familyId: "family-a", name: "乐乐", createdAt: new Date() }, { id: "child-b", familyId: "family-b", name: "豆豆", createdAt: new Date() }]);
    await database.insert(mediaAssets).values([
      { id: "media-a", childId: "child-a", originalPath: "originals/a.jpg", thumbnailPath: "thumbnails/a.jpg", mimeType: "image/jpeg", width: 1200, height: 900, createdAt: new Date() },
      { id: "media-b", childId: "child-b", originalPath: "originals/b.jpg", thumbnailPath: "thumbnails/b.jpg", mimeType: "image/jpeg", width: 1200, height: 900, createdAt: new Date() },
    ]);
    const app = await buildApp(database, getApiConfig({ SESSION_SECRET: "a".repeat(32) }));
    const adminLogin = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "admin-a", password: "correct-horse-battery-staple" } });
    const readerLogin = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "reader-a", password: "correct-horse-battery-staple" } });
    const cookie = adminLogin.headers["set-cookie"] as string;

    const created = await app.inject({ method: "POST", url: "/api/children/child-a/cards", headers: { cookie }, payload: { observedAt: "2026-08-22", text: "叶子变黄了", mediaAssetIds: ["media-a"], tagNames: ["银杏"] } });
    const listed = await app.inject({ method: "GET", url: "/api/children/child-a/cards", headers: { cookie } });
    const createdTag = await app.inject({ method: "POST", url: "/api/children/child-a/tags", headers: { cookie }, payload: { name: "自然", color: "forest" } });
    const listedTags = await app.inject({ method: "GET", url: "/api/children/child-a/tags", headers: { cookie } });
    const readerWrite = await app.inject({ method: "POST", url: "/api/children/child-a/cards", headers: { cookie: readerLogin.headers["set-cookie"] as string }, payload: { observedAt: "2026-08-22", text: "不能写", mediaAssetIds: ["media-a"], tagNames: [] } });
    const foreignMedia = await app.inject({ method: "POST", url: "/api/children/child-a/cards", headers: { cookie }, payload: { observedAt: "2026-08-22", text: "不能引用", mediaAssetIds: ["media-b"], tagNames: [] } });

    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ card: { childId: "child-a", tags: [{ name: "银杏" }], photos: [{ thumbnailUrl: "/api/media/media-a/thumbnail" }] } });
    expect(listed.json()).toMatchObject({ cards: [{ text: "叶子变黄了", tags: [{ name: "银杏" }] }] });
    expect(createdTag.statusCode).toBe(201);
    expect(listedTags.json().tags).toEqual(expect.arrayContaining([expect.objectContaining({ name: "银杏", cardCount: 1 }), expect.objectContaining({ name: "自然", cardCount: 0 })]));
    expect(readerWrite.statusCode).toBe(403);
    expect(foreignMedia.statusCode).toBe(403);
    const readerEdit = await app.inject({ method: "PATCH", url: `/api/cards/${created.json().card.id}`, headers: { cookie: readerLogin.headers["set-cookie"] as string }, payload: { text: "不能改" } });
    const readerArchive = await app.inject({ method: "DELETE", url: `/api/cards/${created.json().card.id}`, headers: { cookie: readerLogin.headers["set-cookie"] as string } });
    const foreignEdit = await app.inject({ method: "PATCH", url: `/api/cards/${created.json().card.id}`, headers: { cookie: (await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "admin-b", password: "correct-horse-battery-staple" } })).headers["set-cookie"] as string }, payload: { text: "越权修改" } });
    expect(readerEdit.statusCode).toBe(403);
    expect(readerArchive.statusCode).toBe(403);
    expect(foreignEdit.statusCode).toBe(403);
    const updated = await app.inject({ method: "PATCH", url: `/api/cards/${created.json().card.id}`, headers: { cookie }, payload: { text: "叶子完全变黄了" } });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ card: { text: "叶子完全变黄了" } });
    const archived = await app.inject({ method: "DELETE", url: `/api/cards/${created.json().card.id}`, headers: { cookie } });
    const afterArchive = await app.inject({ method: "GET", url: "/api/children/child-a/cards", headers: { cookie } });
    expect(archived.statusCode).toBe(204);
    expect(afterArchive.json()).toEqual({ cards: [] });
    await app.close();
  });
});
