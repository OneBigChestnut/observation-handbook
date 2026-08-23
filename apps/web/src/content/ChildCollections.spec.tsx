// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChildHandbookList, ChildTagList } from "./ChildCollections.js";

afterEach(cleanup);

describe("child content collections", () => {
  it("loads tag and handbook summaries for the current child", async () => {
    const loadTags = vi.fn().mockResolvedValue([{ id: "tag-a", name: "银杏", color: "ochre", cardCount: 3 }]);
    const loadHandbooks = vi.fn().mockResolvedValue([{ id: "handbook-a", title: "银杏的一年", introduction: "四季观察", startedAt: "2026-03-10", completedAt: null, status: "ongoing", cardCount: 3, tagCount: 1, cardIds: ["card-a", "card-b"], tagIds: ["tag-a"] }]);

    render(<><ChildTagList childId="child-a" loadTags={loadTags} /><ChildHandbookList childId="child-a" loadHandbooks={loadHandbooks} /></>);

    expect(await screen.findByText("银杏")).toBeInTheDocument();
    expect(await screen.findByText("银杏的一年")).toBeInTheDocument();
    expect(loadTags).toHaveBeenCalledWith("child-a");
    expect(loadHandbooks).toHaveBeenCalledWith("child-a");
  });

  it("allows an administrator to complete a handbook and reorder its cards", async () => {
    const handbook = { id: "handbook-a", title: "银杏的一年", introduction: "四季观察", startedAt: "2026-03-10", completedAt: null, status: "ongoing" as const, cardCount: 2, tagCount: 1, cardIds: ["card-a", "card-b"], tagIds: ["tag-a"] };
    const updateHandbook = vi.fn().mockResolvedValue(handbook);
    render(<ChildHandbookList childId="child-a" canEdit loadHandbooks={vi.fn().mockResolvedValue([handbook])} updateHandbook={updateHandbook} />);

    fireEvent.click(await screen.findByRole("button", { name: "完成观察" }));
    expect(updateHandbook).toHaveBeenCalledWith("handbook-a", { completedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
    fireEvent.click(screen.getByRole("button", { name: "反转卡片顺序" }));
    expect(updateHandbook).toHaveBeenCalledWith("handbook-a", { cardIds: ["card-b", "card-a"] });
  });

  it("does not show handbook mutation controls to a reader", async () => {
    const handbook = { id: "handbook-a", title: "银杏的一年", introduction: "四季观察", startedAt: "2026-03-10", completedAt: null, status: "ongoing" as const, cardCount: 2, tagCount: 1, cardIds: ["card-a", "card-b"], tagIds: ["tag-a"] };
    render(<ChildHandbookList childId="child-a" loadHandbooks={vi.fn().mockResolvedValue([handbook])} />);
    await screen.findByText("银杏的一年");
    expect(screen.queryByRole("button", { name: "完成观察" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "反转卡片顺序" })).not.toBeInTheDocument();
  });
});
