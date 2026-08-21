import { describe, expect, it } from "vitest";
import * as domain from "./index.js";

type DomainApi = {
  assignFamilyRole: (members: Array<{ accountId: string; role: "family_admin" | "family_reader" }>, accountId: string, role: "family_admin" | "family_reader") => Array<{ accountId: string; role: "family_admin" | "family_reader" }>;
  assertChildResourceAccess: (input: { selectedChildId: string; resourceChildId: string }) => void;
};

const api = domain as unknown as DomainApi;

describe("family access rules", () => {
  it("rejects assigning a second family administrator", () => {
    expect(() => api.assignFamilyRole([{ accountId: "a1", role: "family_admin" }], "a2", "family_admin")).toThrow("one family administrator");
  });

  it("allows a reader role beside the family administrator", () => {
    expect(api.assignFamilyRole([{ accountId: "a1", role: "family_admin" }], "a2", "family_reader")).toEqual([
      { accountId: "a1", role: "family_admin" },
      { accountId: "a2", role: "family_reader" }
    ]);
  });

  it("rejects a resource that belongs to a different child", () => {
    expect(() => api.assertChildResourceAccess({ selectedChildId: "ann", resourceChildId: "mumu" })).toThrow("child scope");
  });
});
