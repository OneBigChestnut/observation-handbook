import { describe, expect, it } from "vitest";
import * as domain from "./index.js";

type DomainApi = {
  getCardTemplateCategory: (photoCount: number) => "one_photo" | "two_photos" | "three_photos" | "four_photos";
  assertPortraitTemplate: (orientation: "portrait" | "landscape") => void;
  getTemplateRemovalAction: (usageCount: number) => "delete" | "retire";
};

const api = domain as unknown as DomainApi;

describe("template selection", () => {
  it("groups card layouts by their 1-4 photo count", () => {
    expect(api.getCardTemplateCategory(1)).toBe("one_photo");
    expect(api.getCardTemplateCategory(2)).toBe("two_photos");
    expect(api.getCardTemplateCategory(3)).toBe("three_photos");
    expect(api.getCardTemplateCategory(4)).toBe("four_photos");
  });

  it("accepts portrait templates only", () => {
    expect(() => api.assertPortraitTemplate("portrait")).not.toThrow();
    expect(() => api.assertPortraitTemplate("landscape")).toThrow("portrait");
  });

  it("deletes unused versions but retires used versions", () => {
    expect(api.getTemplateRemovalAction(0)).toBe("delete");
    expect(api.getTemplateRemovalAction(1)).toBe("retire");
  });
});
