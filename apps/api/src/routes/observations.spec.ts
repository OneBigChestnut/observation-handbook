import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { getApiConfig } from "../config.js";
import { openDatabase } from "../db/client.js";
import { accounts, children, families, familyMemberships, handbookCards, handbooks, mediaAssets, observationCards, observationProjects, tags } from "../db/schema.js";
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
    await database.insert(tags).values({ id: "tag-ginkgo", childId: "child-a", name: "银杏", color: "ochre", createdAt: new Date() });
    await database.insert(observationProjects).values({ id: "project-a", childId: "child-a", title: "银杏", objectName: "银杏", place: "公园", question: "叶子怎样变黄", startedAt: "2026-03-01", completedAt: null, cadenceDays: 7, focusParts: "[]", stages: "[]", coverMediaAssetId: null, conclusion: "", createdAt: new Date(), updatedAt: new Date() });
    const app = await buildApp(database, getApiConfig({ SESSION_SECRET: "a".repeat(32) }));
    const adminLogin = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "admin-a", password: "correct-horse-battery-staple" } });
    const readerLogin = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "reader-a", password: "correct-horse-battery-staple" } });
    const cookie = adminLogin.headers["set-cookie"] as string;

    const created = await app.inject({ method: "POST", url: "/api/children/child-a/cards", headers: { cookie }, payload: { projectId: "project-a", observationPart: "树叶", season: "夏", observedAt: "2026-08-22", text: "叶子变黄了", textBlocks: ["叶子变黄了", "我还发现叶脉更清楚了"], mediaAssetIds: ["media-a"], tagIds: ["tag-ginkgo"] } });
    const listed = await app.inject({ method: "GET", url: "/api/children/child-a/cards", headers: { cookie } });
    const createdTag = await app.inject({ method: "POST", url: "/api/children/child-a/tags", headers: { cookie }, payload: { name: "自然", color: "forest" } });
    const listedTags = await app.inject({ method: "GET", url: "/api/children/child-a/tags", headers: { cookie } });
    const readerWrite = await app.inject({ method: "POST", url: "/api/children/child-a/cards", headers: { cookie: readerLogin.headers["set-cookie"] as string }, payload: { projectId: "project-a", observedAt: "2026-08-22", text: "不能写", mediaAssetIds: ["media-a"], tagNames: [] } });
    const foreignMedia = await app.inject({ method: "POST", url: "/api/children/child-a/cards", headers: { cookie }, payload: { projectId: "project-a", observedAt: "2026-08-22", text: "不能引用", mediaAssetIds: ["media-b"], tagNames: [] } });

    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ card: { childId: "child-a", textBlocks: ["叶子变黄了", "我还发现叶脉更清楚了"], tags: [{ name: "银杏" }], photos: [{ thumbnailUrl: "/api/media/media-a/thumbnail" }] } });
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
    const updated = await app.inject({ method: "PATCH", url: `/api/cards/${created.json().card.id}`, headers: { cookie }, payload: { text: "叶子完全变黄了", textBlocks: ["叶子完全变黄了", "叶脉和边缘都更清楚了"] } });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ card: { text: "叶子完全变黄了", textBlocks: ["叶子完全变黄了", "叶脉和边缘都更清楚了"] } });
    const tagReplaced = await app.inject({ method: "PATCH", url: `/api/cards/${created.json().card.id}`, headers: { cookie }, payload: { tagIds: [createdTag.json().tag.id] } });
    expect(tagReplaced.statusCode).toBe(200);
    expect(tagReplaced.json()).toMatchObject({ card: { tags: [{ id: createdTag.json().tag.id, name: "自然" }] } });
    await database.insert(handbooks).values({ id: "handbook-a", childId: "child-a", title: "银杏的一年", introduction: "记录变化", startedAt: "2026-03-01", completedAt: null, visibility: "family", coverTemplateId: null, backTemplateId: null, coverPhotoId: null, backPhotoId: null, createdAt: new Date(), updatedAt: new Date() });
    await database.insert(observationCards).values({ id: "card-second", childId: "child-a", projectId: null, observationPart: null, season: null, stage: null, changeNote: null, evidence: null, hypothesis: null, observedAt: "2026-08-23", text: "第二张", textBlocks: null, state: "active", templateId: null, createdAt: new Date(), updatedAt: new Date() });
    await database.insert(handbookCards).values([{ handbookId: "handbook-a", cardId: created.json().card.id, position: 0 }, { handbookId: "handbook-a", cardId: "card-second", position: 1 }]);
    const savedWithExistingHandbook = await app.inject({ method: "PATCH", url: "/api/cards/card-second", headers: { cookie }, payload: { tagIds: [createdTag.json().tag.id], handbookIds: ["handbook-a"] } });
    expect(savedWithExistingHandbook.statusCode).toBe(200);
    const renamedTag = await app.inject({ method: "PATCH", url: `/api/children/child-a/tags/${createdTag.json().tag.id}`, headers: { cookie }, payload: { name: "自然观察", color: "forest" } });
    expect(renamedTag.statusCode).toBe(200);
    expect(renamedTag.json()).toMatchObject({ tag: { id: createdTag.json().tag.id, name: "自然观察", color: "forest" } });
    const blockedTagDeletion = await app.inject({ method: "DELETE", url: `/api/children/child-a/tags/${createdTag.json().tag.id}`, headers: { cookie } });
    expect(blockedTagDeletion.statusCode).toBe(409);
    expect(blockedTagDeletion.json()).toEqual({ code: "TAG_IN_USE" });
    const unusedTag = await app.inject({ method: "POST", url: "/api/children/child-a/tags", headers: { cookie }, payload: { name: "未使用", color: "olive" } });
    const deletedTag = await app.inject({ method: "DELETE", url: `/api/children/child-a/tags/${unusedTag.json().tag.id}`, headers: { cookie } });
    expect(deletedTag.statusCode).toBe(204);
    await database.delete(handbookCards).where(eq(handbookCards.cardId, created.json().card.id)).run();
    await database.update(observationCards).set({ state: "archived" }).where(eq(observationCards.id, "card-second")).run();
    const archived = await app.inject({ method: "DELETE", url: `/api/cards/${created.json().card.id}`, headers: { cookie } });
    const afterArchive = await app.inject({ method: "GET", url: "/api/children/child-a/cards", headers: { cookie } });
    expect(archived.statusCode).toBe(204);
    expect(afterArchive.json()).toEqual({ cards: [] });
    await app.close();
  });
});
