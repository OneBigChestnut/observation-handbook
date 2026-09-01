import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";
import { openDatabase } from "./db/client.js";
import { accounts, cardPhotos, children, familyMemberships, handbooks, mediaAssets, observationCards, templateVersions } from "./db/schema.js";
import { seedDevelopmentData } from "./seed.js";

describe("development seed", () => {
  it("creates a non-platform demo family with photographed records and completed handbooks", async () => {
    const database = openDatabase(":memory:");
    migrate(database, { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });

    const familyId = await seedDevelopmentData(database);
    await seedDevelopmentData(database);

    expect((await database.query.accounts.findFirst({ where: eq(accounts.username, "lin") }))?.platformRole).toBeNull();
    expect((await database.query.accounts.findFirst({ where: eq(accounts.username, "platform") }))?.platformRole).toBe("super_admin");
    expect(await database.select().from(familyMemberships)).toHaveLength(2);
    expect(await database.select().from(children).where(eq(children.familyId, familyId))).toHaveLength(2);
    expect(await database.select().from(observationCards)).toHaveLength(20);
    expect(await database.select().from(handbooks)).toHaveLength(4);
    expect(await database.select().from(mediaAssets)).toHaveLength(11);
    expect(await database.select().from(cardPhotos)).toHaveLength(20);
    const templates = await database.select().from(templateVersions);
    expect(templates).toHaveLength(24);
    expect(Object.fromEntries(["cover", "back", "card_1", "card_2", "card_3", "card_4"].map(kind => [kind, templates.filter(template => template.kind === kind).length]))).toEqual({ cover: 4, back: 4, card_1: 4, card_2: 4, card_3: 4, card_4: 4 });
    expect(JSON.parse(templates.find(template => template.kind === "cover")!.layout).texts).toHaveLength(3);
    expect(JSON.parse(templates.find(template => template.kind === "card_4")!.layout).texts).toHaveLength(2);
  });
});
