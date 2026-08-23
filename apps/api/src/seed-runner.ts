import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { openDatabase } from "./db/client.js";
import { seedDevelopmentData } from "./seed.js";

const databasePath = fileURLToPath(new URL("../data/dev.db", import.meta.url));
await mkdir(dirname(databasePath), { recursive: true });
const database = openDatabase(databasePath);
migrate(database, { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });
await seedDevelopmentData(database);
console.info("Development accounts seeded: lin / zhou");
