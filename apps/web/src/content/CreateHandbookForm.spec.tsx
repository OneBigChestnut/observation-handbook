// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreateHandbookForm } from "./CreateHandbookForm.js";

describe("CreateHandbookForm", () => {
  afterEach(() => cleanup());

  it("creates a handbook without unrelated tag and card selection steps", async () => {
    const user = userEvent.setup();
    const createHandbook = vi.fn().mockResolvedValue({ id: "handbook-a" });
    render(<CreateHandbookForm childId="child-a" loadTemplates={vi.fn().mockResolvedValue([{ id: "cover-a", name: "自然封面", kind: "cover", state: "published" }, { id: "back-a", name: "自然封底", kind: "back", state: "published" }])} createHandbook={createHandbook} onCreated={vi.fn()} />);

    await user.type(await screen.findByLabelText("手册名称"), "银杏的一年");
    await user.type(screen.getByLabelText("内容介绍"), "四季观察");
    expect(screen.queryByText("关联标签")).not.toBeInTheDocument();
    expect(screen.queryByText("收录卡片")).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("封面模板"), "cover-a");
    await user.selectOptions(screen.getByLabelText("封底模板"), "back-a");
    await user.click(screen.getByRole("button", { name: "创建手册" }));

    expect(createHandbook).toHaveBeenCalledWith("child-a", expect.objectContaining({ title: "银杏的一年", introduction: "四季观察", tagIds: [], cardIds: [], coverTemplateId: "cover-a", backTemplateId: "back-a" }));
  });

  it("lets the family choose separate cover and back photos from existing cards", async () => {
    const user = userEvent.setup();
    const createHandbook = vi.fn().mockResolvedValue({ id: "handbook-a" });
    render(<CreateHandbookForm childId="child-a" loadCards={vi.fn().mockResolvedValue([{ id: "card-a", observedAt: "2026-08-20", text: "一片叶子", photos: [{ id: "media-a", thumbnailUrl: "/leaf.jpg" }], tags: [] }])} loadTemplates={vi.fn().mockResolvedValue([{ id: "cover-a", name: "自然封面", kind: "cover", state: "published" }, { id: "back-a", name: "自然封底", kind: "back", state: "published" }])} createHandbook={createHandbook} onCreated={vi.fn()} />);
    await user.type(await screen.findByLabelText("手册名称"), "银杏的一年");
    await user.type(screen.getByLabelText("内容介绍"), "四季观察");
    await user.selectOptions(screen.getByLabelText("封面模板"), "cover-a");
    await user.selectOptions(screen.getByLabelText("封底模板"), "back-a");
    await user.click(screen.getByRole("button", { name: "选择为封面 一片叶子" }));
    await user.click(screen.getByRole("button", { name: "选择为封底 一片叶子" }));
    await user.click(screen.getByRole("button", { name: "创建手册" }));
    expect(createHandbook).toHaveBeenCalledWith("child-a", expect.objectContaining({ coverPhotoId: "media-a", backPhotoId: "media-a" }));
  });
});
