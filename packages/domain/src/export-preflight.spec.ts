import { describe, expect, it } from "vitest";
import * as domain from "./index.js";

type DomainApi = {
  preflightPrintExport: (input: {
    photos: Array<{ widthPx: number; heightPx: number }>;
    hasSafeAreaViolation: boolean;
    hasTextOverflow: boolean;
  }) => Array<{ code: "low_resolution" | "safe_area" | "text_overflow" }>;
};

const api = domain as unknown as DomainApi;

describe("print export preflight", () => {
  it("flags low-resolution images, safe-area violations and overflowing text", () => {
    expect(api.preflightPrintExport({
      photos: [{ widthPx: 480, heightPx: 320 }, { widthPx: 2400, heightPx: 1600 }],
      hasSafeAreaViolation: true,
      hasTextOverflow: true,
    })).toEqual([
      { code: "low_resolution" },
      { code: "safe_area" },
      { code: "text_overflow" },
    ]);
  });

  it("passes a print-ready handbook with no preflight issues", () => {
    expect(api.preflightPrintExport({
      photos: [{ widthPx: 2400, heightPx: 1600 }],
      hasSafeAreaViolation: false,
      hasTextOverflow: false,
    })).toEqual([]);
  });
});
