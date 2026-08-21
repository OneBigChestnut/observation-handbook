import { describe, expect, it } from "vitest";
import * as domain from "./index.js";

type DomainApi = {
  DEFAULT_CARD_VIEW: "month";
  isCardView: (value: string) => boolean;
  createThumbnailUrl: (assetKey: string, width: number) => string;
};

const api = domain as unknown as DomainApi;

describe("card browsing rules", () => {
  it("uses month view by default and only supports the three agreed views", () => {
    expect(api.DEFAULT_CARD_VIEW).toBe("month");
    expect(api.isCardView("month")).toBe(true);
    expect(api.isCardView("timeline")).toBe(true);
    expect(api.isCardView("calendar")).toBe(true);
    expect(api.isCardView("gallery")).toBe(false);
  });

  it("creates a sized thumbnail URL rather than returning the original asset URL", () => {
    expect(api.createThumbnailUrl("cards/child-1/photo.jpg", 320)).toBe(
      "/media/cards/child-1/photo.jpg?width=320&fit=cover",
    );
  });
});
