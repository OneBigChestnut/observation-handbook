// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CreateHandbookForm } from "./CreateHandbookForm.js";

describe("CreateHandbookForm", () => {
  it("creates a handbook with selected current-child tags and cards", async () => {
    const user = userEvent.setup();
    const createHandbook = vi.fn().mockResolvedValue({ id: "handbook-a" });
    render(<CreateHandbookForm childId="child-a" loadTags={vi.fn().mockResolvedValue([{ id: "tag-a", name: "银杏", color: "ochre", cardCount: 1 }])} loadCards={vi.fn().mockResolvedValue([{ id: "card-a", observedAt: "2026-08-22", text: "第一片黄叶", photos: [], tags: [] }])} createHandbook={createHandbook} onCreated={vi.fn()} />);

    await user.type(await screen.findByLabelText("手册名称"), "银杏的一年");
    await user.type(screen.getByLabelText("内容介绍"), "四季观察");
    await user.click(screen.getByLabelText("银杏"));
    await user.click(screen.getByLabelText("第一片黄叶"));
    await user.click(screen.getByRole("button", { name: "创建手册" }));

    expect(createHandbook).toHaveBeenCalledWith("child-a", expect.objectContaining({ title: "银杏的一年", introduction: "四季观察", tagIds: ["tag-a"], cardIds: ["card-a"] }));
  });
});
