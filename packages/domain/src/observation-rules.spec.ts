import { describe, expect, it } from "vitest";
import * as domain from "./index.js";

type DomainApi = {
  createObservationCard: (input: { childId: string; photos: string[]; text: string }) => unknown;
  validateHandbookCardChildren: (childId: string, cardChildIds: string[]) => void;
  retireTemplateVersion: (input: { usageCount: number }) => { state: "retired" };
};

const api = domain as unknown as DomainApi;

describe("observation domain rules", () => {
  it("rejects a fifth photo on a card", () => {
    expect(() => api.createObservationCard({ childId: "ann", photos: ["1", "2", "3", "4", "5"], text: "观察" })).toThrow("4");
  });

  it("rejects cards from another child in a handbook", () => {
    expect(() => api.validateHandbookCardChildren("ann", ["ann", "mumu"])).toThrow("child scope");
  });

  it("retires a used template version instead of deleting it", () => {
    expect(api.retireTemplateVersion({ usageCount: 1 })).toEqual({ state: "retired" });
  });
});
