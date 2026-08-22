import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";
import { openDatabase } from "./db/client.js";
import { children, familyMemberships } from "./db/schema.js";
import { seedDevelopmentData } from "./seed.js";

describe("development seed", () => {
  it("creates one administrator, one reader and two children without duplicates", async () => {
    const database = openDatabase(":memory:");
    migrate(database, { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });

    const familyId = await seedDevelopmentData(database);
    await seedDevelopmentData(database);

    expect(await database.select().from(familyMemberships)).toHaveLength(2);
    expect(await database.select().from(children).where(eq(children.familyId, familyId))).toHaveLength(2);
  });
});
