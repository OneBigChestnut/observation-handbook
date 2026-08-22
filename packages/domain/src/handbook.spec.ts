import { describe, expect, it } from "vitest";
import * as domain from "./index.js";

type DomainApi = {
  createObservationHandbook: (input: {
    childId: string;
    title: string;
    introduction: string;
    startedAt?: string;
    completedAt?: string;
  }) => {
    childId: string;
    title: string;
    introduction: string;
    startedAt?: string;
    completedAt?: string;
    status: "ongoing" | "completed";
    visibility: "family";
  };
  publishObservationHandbook: (input: { role: "family_admin" | "family_reader" }) => { visibility: "public" };
  filterObservationCardsByHandbook: <T extends { handbookId?: string }>(cards: T[], handbookId: string) => T[];
};

const api = domain as unknown as DomainApi;

describe("observation handbooks", () => {
  it("keeps the agreed handbook summary fields and derives its completion state", () => {
    expect(api.createObservationHandbook({
      childId: "child-1",
      title: "银杏的一年",
      introduction: "从春天的新芽到冬天的落叶。",
      startedAt: "2026-03-10",
      completedAt: "2026-12-20",
    })).toMatchObject({ status: "completed", visibility: "family", completedAt: "2026-12-20" });

    expect(api.createObservationHandbook({
      childId: "child-1",
      title: "门前的街道",
      introduction: "持续记录街角的变化。",
    })).toMatchObject({ status: "ongoing", visibility: "family", completedAt: undefined });
  });

  it("allows the family administrator to publish directly but prevents read-only adults", () => {
    expect(api.publishObservationHandbook({ role: "family_admin" })).toEqual({ visibility: "public" });
    expect(() => api.publishObservationHandbook({ role: "family_reader" })).toThrow("family administrator");
  });

  it("only returns cards belonging to the selected handbook", () => {
    const card = { id: "card-1", handbookId: "ginkgo" };
    expect(api.filterObservationCardsByHandbook([card, { id: "card-2", handbookId: "street" }], "ginkgo")).toEqual([card]);
  });
});
