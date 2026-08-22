import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { buildApp } from "./app.js";
import { getApiConfig } from "./config.js";
import { openDatabase } from "./db/client.js";

const config = getApiConfig(process.env);
const databasePath = resolve(process.cwd(), config.databaseUrl.replace(/^file:/, ""));
await mkdir(dirname(databasePath), { recursive: true });
const database = openDatabase(databasePath);
migrate(database, { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });
const app = await buildApp(database, config);
await app.listen({ host: "127.0.0.1", port: Number(process.env.PORT ?? 3000) });
