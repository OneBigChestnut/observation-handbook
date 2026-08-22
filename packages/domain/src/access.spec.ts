import { describe, expect, it } from "vitest";
import { assertFamilyRoleChange, requireFamilyAdmin, requireFamilyRead } from "./access.js";

describe("family scoped access", () => {
  it("rejects a reader from writing and rejects access to another family", () => {
    const actor = { memberships: [{ familyId: "family-a", role: "reader" as const }] };

    expect(() => requireFamilyAdmin(actor, "family-a")).toThrow("FAMILY_ADMIN_REQUIRED");
    expect(() => requireFamilyRead(actor, "family-b")).toThrow("FAMILY_ACCESS_DENIED");
  });
});

describe("family administrator invariants", () => {
  it("does not allow the only administrator to become a reader", () => {
    expect(() => assertFamilyRoleChange([
      { accountId: "admin-1", role: "admin" as const },
    ], { accountId: "admin-1", role: "reader" })).toThrow("FAMILY_ADMIN_REQUIRED");
  });
});
