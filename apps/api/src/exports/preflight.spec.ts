import { describe, expect, it } from "vitest";
import { preflightExport } from "./preflight.js";
describe("export preflight", () => it("reports all publication blockers", () => {
  expect(preflightExport({ cardCount: 0, hasCoverPhoto: false, templateRetired: true, imageWidth: 1200, textWithinSafeArea: false })).toEqual({ ok: false, issues: ["EMPTY_HANDBOOK", "COVER_PHOTO_REQUIRED", "TEMPLATE_RETIRED", "IMAGE_RESOLUTION_INSUFFICIENT", "TEXT_OUTSIDE_SAFE_AREA"] });
}));
