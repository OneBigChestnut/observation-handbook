// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChildHandbookList, ChildTagList } from "./ChildCollections.js";

describe("child content collections", () => {
  it("loads tag and handbook summaries for the current child", async () => {
    const loadTags = vi.fn().mockResolvedValue([{ id: "tag-a", name: "银杏", color: "ochre", cardCount: 3 }]);
    const loadHandbooks = vi.fn().mockResolvedValue([{ id: "handbook-a", title: "银杏的一年", introduction: "四季观察", startedAt: "2026-03-10", completedAt: null, status: "ongoing", cardCount: 3, tagCount: 1 }]);

    render(<><ChildTagList childId="child-a" loadTags={loadTags} /><ChildHandbookList childId="child-a" loadHandbooks={loadHandbooks} /></>);

    expect(await screen.findByText("银杏")).toBeInTheDocument();
    expect(await screen.findByText("银杏的一年")).toBeInTheDocument();
    expect(loadTags).toHaveBeenCalledWith("child-a");
    expect(loadHandbooks).toHaveBeenCalledWith("child-a");
  });
});
