import { describe, expect, it } from "vitest";
import * as schema from "./schema.js";

type ContentSchema = {
  mediaAssets: object;
  observationCards: object;
  cardPhotos: object;
  tags: object;
  cardTags: object;
  handbooks: object;
  handbookCards: object;
  handbookTags: object;
};

const contentSchema = schema as unknown as ContentSchema;

describe("persistent observation content schema", () => {
  it("defines media, card, tag and handbook relationship tables", () => {
    expect(contentSchema.mediaAssets).toBeDefined();
    expect(contentSchema.observationCards).toBeDefined();
    expect(contentSchema.cardPhotos).toBeDefined();
    expect(contentSchema.tags).toBeDefined();
    expect(contentSchema.cardTags).toBeDefined();
    expect(contentSchema.handbooks).toBeDefined();
    expect(contentSchema.handbookCards).toBeDefined();
    expect(contentSchema.handbookTags).toBeDefined();
  });
});
