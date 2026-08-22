import { describe, expect, it } from "vitest";
import * as domain from "./index.js";

type PersistentContentApi = {
  assertCardPhotoCount: (photoCount: number) => void;
  assertSameChildIds: (childId: string, relatedChildIds: string[]) => void;
};

const api = domain as unknown as PersistentContentApi;

describe("persistent observation content rules", () => {
  it("requires one through four photos for every card", () => {
    expect(() => api.assertCardPhotoCount(0)).toThrow("1 to 4 photos");
    expect(() => api.assertCardPhotoCount(1)).not.toThrow();
    expect(() => api.assertCardPhotoCount(4)).not.toThrow();
    expect(() => api.assertCardPhotoCount(5)).toThrow("1 to 4 photos");
  });

  it("rejects cross-child content associations", () => {
    expect(() => api.assertSameChildIds("child-a", ["child-a", "child-b"])).toThrow("child scope violation");
  });
});
