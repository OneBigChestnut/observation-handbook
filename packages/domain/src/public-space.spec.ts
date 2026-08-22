import { describe, expect, it } from "vitest";
import * as domain from "./index.js";

type DomainApi = {
  listPublicHandbooks: <T extends { visibility: "family" | "public" }>(handbooks: T[]) => T[];
  unpublishObservationHandbook: (input: { role: "family_admin" | "family_reader" }) => { visibility: "family" };
};

const api = domain as unknown as DomainApi;

describe("public space", () => {
  it("only lists handbooks that were directly published to public space", () => {
    const published = { id: "ginkgo", visibility: "public" as const };
    expect(api.listPublicHandbooks([
      { id: "street", visibility: "family" as const },
      published,
    ])).toEqual([published]);
  });

  it("allows only the family administrator to withdraw a public handbook", () => {
    expect(api.unpublishObservationHandbook({ role: "family_admin" })).toEqual({ visibility: "family" });
    expect(() => api.unpublishObservationHandbook({ role: "family_reader" })).toThrow("family administrator");
  });
});
