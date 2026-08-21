import { describe, expect, it } from "vitest";
import * as domain from "./index.js";

type DomainApi = {
  createObservationTag: (input: { childId: string; name: string }) => { childId: string; name: string };
  groupTagsByChild: (input: Array<{ childId: string; name: string }>, childId: string) => Array<{ childId: string; name: string }>;
};

const api = domain as unknown as DomainApi;

describe("tag management", () => {
  it("creates a tag inside one child's scope", () => {
    expect(api.createObservationTag({ childId: "child-lele", name: "银杏" })).toEqual({
      childId: "child-lele",
      name: "银杏",
    });
  });

  it("does not expose another child's tags in the current child view", () => {
    const tags = [
      { childId: "child-lele", name: "银杏" },
      { childId: "child-anan", name: "小动物" },
    ];
    expect(api.groupTagsByChild(tags, "child-lele")).toEqual([{ childId: "child-lele", name: "银杏" }]);
  });
});
