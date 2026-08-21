import { describe, expect, it } from "vitest";
import * as domain from "./index.js";

type DomainApi = {
  assertSuperAdminAccess: (role: "family_admin" | "family_reader" | "super_admin") => void;
};

const api = domain as unknown as DomainApi;

describe("admin center access", () => {
  it("allows only a super administrator into the admin center", () => {
    expect(() => api.assertSuperAdminAccess("super_admin")).not.toThrow();
    expect(() => api.assertSuperAdminAccess("family_admin")).toThrow("super administrator");
    expect(() => api.assertSuperAdminAccess("family_reader")).toThrow("super administrator");
  });
});
