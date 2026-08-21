import { describe, expect, it } from "vitest";
import * as domain from "./index.js";

describe("observation handbook workspace", () => {
  it("defines the maximum number of photos on an observation card", () => {
    expect(domain.CARD_PHOTO_LIMIT).toBe(4);
  });
});
