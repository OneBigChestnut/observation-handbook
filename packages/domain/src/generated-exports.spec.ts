import { describe, expect, it } from "vitest";
import * as domain from "./index.js";

type DomainApi = {
  createGeneratedExport: (input: { id: string; handbookId: string; kind: "screen" | "print" }) => {
    id: string;
    handbookId: string;
    kind: "screen" | "print";
    status: "ready";
  };
  removeGeneratedExport: <T extends { id: string }>(files: T[], id: string) => T[];
};

const api = domain as unknown as DomainApi;

describe("generated export files", () => {
  it("creates a ready-to-download export after its handbook and PDF type are confirmed", () => {
    expect(api.createGeneratedExport({ id: "file-1", handbookId: "ginkgo", kind: "screen" })).toEqual({
      id: "file-1", handbookId: "ginkgo", kind: "screen", status: "ready",
    });
  });

  it("removes a generated file without affecting the others", () => {
    expect(api.removeGeneratedExport([{ id: "file-1" }, { id: "file-2" }], "file-1")).toEqual([{ id: "file-2" }]);
  });
});
