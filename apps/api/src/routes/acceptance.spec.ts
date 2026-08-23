import { describe, expect, it } from "vitest";
import { preflightExport } from "../exports/preflight.js";
import { getPdfExportSpec } from "@observation-handbook/domain";
describe("release acceptance", () => {
  it("keeps the two A5 output contracts and their print marks distinct", () => {
    expect(getPdfExportSpec("screen")).toMatchObject({ bleedMm: 0, cropMarks: false });
    expect(getPdfExportSpec("print")).toMatchObject({ bleedMm: 3, cropMarks: true });
    expect(preflightExport({ cardCount: 1, hasCoverPhoto: true, templateRetired: false, imageWidth: 2000, textWithinSafeArea: true })).toEqual({ ok: true, issues: [] });
  });
});
