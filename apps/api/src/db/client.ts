import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

export function openDatabase(filename: string) {
  return drizzle(new BetterSqlite3(filename));
}
