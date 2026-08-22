import { describe, expect, it } from "vitest";
import { getApiConfig } from "./config.js";

describe("api configuration", () => {
  it("uses a local SQLite file and a strict session cookie in production", () => {
    const config = getApiConfig({
      NODE_ENV: "production",
      DATABASE_URL: "file:./test.db",
      SESSION_SECRET: "a".repeat(32),
    });

    expect(config.databaseUrl).toBe("file:./test.db");
    expect(config.sessionCookie.secure).toBe(true);
    expect(config.sessionCookie.httpOnly).toBe(true);
  });
});
