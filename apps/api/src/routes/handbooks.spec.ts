import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { getApiConfig } from "../config.js";
import { openDatabase } from "../db/client.js";
import { accounts, cardTags, children, families, familyMemberships, observationCards, tags } from "../db/schema.js";
import { hashPassword } from "../password.js";

describe("handbook api", () => {
  it("prefills a handbook from its tag without automatically adding later matching cards", async () => {
    const database = openDatabase(":memory:");
    migrate(database, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
    await database.insert(accounts).values({ id: "admin-a", username: "admin-a", passwordHash: await hashPassword("correct-horse-battery-staple"), createdAt: new Date() });
    await database.insert(families).values({ id: "family-a", name: "甲家", createdAt: new Date() });
    await database.insert(familyMemberships).values({ accountId: "admin-a", familyId: "family-a", role: "admin" });
    await database.insert(children).values({ id: "child-a", familyId: "family-a", name: "乐乐", createdAt: new Date() });
    await database.insert(tags).values({ id: "tag-ginkgo", childId: "child-a", name: "银杏", color: "ochre", createdAt: new Date() });
    await database.insert(observationCards).values({ id: "card-ginkgo-1", childId: "child-a", observedAt: "2026-08-18", text: "第一片黄叶", createdAt: new Date(), updatedAt: new Date() });
    await database.insert(cardTags).values({ cardId: "card-ginkgo-1", tagId: "tag-ginkgo" });
    const app = await buildApp(database, getApiConfig({ SESSION_SECRET: "a".repeat(32) }));
    const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "admin-a", password: "correct-horse-battery-staple" } });
    const cookie = login.headers["set-cookie"] as string;

    const created = await app.inject({ method: "POST", url: "/api/children/child-a/handbooks", headers: { cookie }, payload: { title: "银杏的一年", introduction: "四季观察", startedAt: "2026-03-10", tagIds: ["tag-ginkgo"] } });
    const listed = await app.inject({ method: "GET", url: "/api/children/child-a/handbooks", headers: { cookie } });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ handbook: { title: "银杏的一年", status: "ongoing", cardIds: ["card-ginkgo-1"], tagIds: ["tag-ginkgo"] } });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toMatchObject({ handbooks: [{ title: "银杏的一年", cardCount: 1, tagCount: 1 }] });
    await database.insert(observationCards).values({ id: "card-ginkgo-2", childId: "child-a", observedAt: "2026-08-22", text: "第二片黄叶", createdAt: new Date(), updatedAt: new Date() });
    await database.insert(cardTags).values({ cardId: "card-ginkgo-2", tagId: "tag-ginkgo" });
    const detail = await app.inject({ method: "GET", url: `/api/handbooks/${created.json().handbook.id}`, headers: { cookie } });
    const updated = await app.inject({ method: "PATCH", url: `/api/handbooks/${created.json().handbook.id}`, headers: { cookie }, payload: { completedAt: "2026-08-22", cardIds: ["card-ginkgo-1", "card-ginkgo-2"], tagIds: ["tag-ginkgo"] } });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({ handbook: { cardIds: ["card-ginkgo-1"] } });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ handbook: { status: "completed", completedAt: "2026-08-22", cardIds: ["card-ginkgo-1", "card-ginkgo-2"] } });
    const referencedCardDeletion = await app.inject({ method: "DELETE", url: "/api/cards/card-ginkgo-1", headers: { cookie } });
    expect(referencedCardDeletion.statusCode).toBe(409);
    expect(referencedCardDeletion.json()).toMatchObject({ code: "CARD_REFERENCED", affectedHandbookIds: [created.json().handbook.id] });
    await app.close();
  });
});
