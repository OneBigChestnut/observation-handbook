import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

export function openDatabase(filename: string) {
  return drizzle(new BetterSqlite3(filename), { schema });
}

export type AppDatabase = ReturnType<typeof openDatabase>;
