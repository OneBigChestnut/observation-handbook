import { describe, expect, it } from "vitest";
import * as domain from "./index.js";

type DomainApi = {
  assertSuperAdminAccess: (role: "family_admin" | "family_reader" | "super_admin") => void;
  removePlatformMember: (members: Array<{ accountId: string; role: "super_admin" | "operations_admin" }>, accountId: string) => Array<{ accountId: string; role: "super_admin" | "operations_admin" }>;
  assignPlatformRole: (members: Array<{ accountId: string; role: "super_admin" | "operations_admin" }>, accountId: string, role: "super_admin" | "operations_admin") => Array<{ accountId: string; role: "super_admin" | "operations_admin" }>;
};

const api = domain as unknown as DomainApi;

describe("admin center access", () => {
  it("allows only a super administrator into the admin center", () => {
    expect(() => api.assertSuperAdminAccess("super_admin")).not.toThrow();
    expect(() => api.assertSuperAdminAccess("family_admin")).toThrow("super administrator");
    expect(() => api.assertSuperAdminAccess("family_reader")).toThrow("super administrator");
  });

  it("does not remove the final super administrator", () => {
    const members = [{ accountId: "s1", role: "super_admin" as const }, { accountId: "o1", role: "operations_admin" as const }];
    expect(api.removePlatformMember(members, "o1")).toEqual([{ accountId: "s1", role: "super_admin" }]);
    expect(() => api.removePlatformMember(members, "s1")).toThrow("one super administrator");
  });

  it("does not demote the final super administrator", () => {
    expect(() => api.assignPlatformRole([{ accountId: "s1", role: "super_admin" }], "s1", "operations_admin")).toThrow("one super administrator");
  });
});
