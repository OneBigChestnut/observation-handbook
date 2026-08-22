import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { openDatabase } from "./client.js";

describe("SQLite database client", () => {
  it("opens an isolated in-memory SQLite database", () => {
    const database = openDatabase(":memory:");

    expect(database.get<{ value: number }>(sql`select 1 as value`)).toEqual({ value: 1 });
  });
});
