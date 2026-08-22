import { describe, expect, it } from "vitest";
import * as domain from "./index.js";

type DomainApi = {
  assignFamilyRole: (members: Array<{ accountId: string; role: "family_admin" | "family_reader" }>, accountId: string, role: "family_admin" | "family_reader") => Array<{ accountId: string; role: "family_admin" | "family_reader" }>;
  assertChildResourceAccess: (input: { selectedChildId: string; resourceChildId: string }) => void;
  removeFamilyMember: (members: Array<{ accountId: string; role: "family_admin" | "family_reader" }>, accountId: string) => Array<{ accountId: string; role: "family_admin" | "family_reader" }>;
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

  it("does not allow the only administrator to be downgraded to read-only", () => {
    expect(() => api.assignFamilyRole([
      { accountId: "a1", role: "family_admin" },
    ], "a1", "family_reader")).toThrow("one family administrator");
  });

  it("removes a reader but preserves the sole administrator", () => {
    const members = [{ accountId: "a1", role: "family_admin" as const }, { accountId: "a2", role: "family_reader" as const }];
    expect(api.removeFamilyMember(members, "a2")).toEqual([{ accountId: "a1", role: "family_admin" }]);
    expect(() => api.removeFamilyMember(members, "a1")).toThrow("one family administrator");
  });

  it("rejects a resource that belongs to a different child", () => {
    expect(() => api.assertChildResourceAccess({ selectedChildId: "ann", resourceChildId: "mumu" })).toThrow("child scope");
  });
});
