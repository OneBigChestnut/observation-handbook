import { describe, expect, it } from "vitest";
import * as domain from "./index.js";

type DomainApi = {
  PAPER_SIZE: "A5";
  assertA5PaperSize: (paperSize: string) => void;
  getCardTemplateCategory: (photoCount: number) => "one_photo" | "two_photos" | "three_photos" | "four_photos";
  assertPortraitTemplate: (orientation: "portrait" | "landscape") => void;
  getTemplateRemovalAction: (usageCount: number) => "delete" | "retire";
  assertCardTemplateMatchesHandbook: (input: { handbookPaper: "A5"; templatePaper: "A5"; photoCount: number; templateCategory: "one_photo" | "two_photos" | "three_photos" | "four_photos" }) => void;
};

const api = domain as unknown as DomainApi;

describe("template selection", () => {
  it("uses A5 as the only paper size", () => {
    expect(api.PAPER_SIZE).toBe("A5");
    expect(() => api.assertA5PaperSize("A5")).not.toThrow();
    expect(() => api.assertA5PaperSize("A4")).toThrow("A5");
  });

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

  it("requires card templates to match the handbook paper and photo count", () => {
    expect(() => api.assertCardTemplateMatchesHandbook({ handbookPaper: "A5", templatePaper: "A5", photoCount: 3, templateCategory: "three_photos" })).not.toThrow();
    expect(() => api.assertCardTemplateMatchesHandbook({ handbookPaper: "A5", templatePaper: "A4" as never, photoCount: 3, templateCategory: "three_photos" })).toThrow("A5");
    expect(() => api.assertCardTemplateMatchesHandbook({ handbookPaper: "A5", templatePaper: "A5", photoCount: 3, templateCategory: "two_photos" })).toThrow("photo count");
  });
});
