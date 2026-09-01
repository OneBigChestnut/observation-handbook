import { afterEach, describe, expect, it, vi } from "vitest";
import { request } from "./client.js";

describe("API requests", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("does not label an empty POST request as JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ publication: { id: "publication-a" } }), { status: 201, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await request("/api/handbooks/handbook-a/publish", { method: "POST" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("content-type")).toBeNull();
  });
});
