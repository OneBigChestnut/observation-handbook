// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client.js";
import { ChildContentLoader } from "./ChildContentLoader.js";

afterEach(cleanup);

describe("ChildContentLoader", () => {
  it("loads only the selected child's cards and renders thumbnail URLs", async () => {
    const loadCards = vi.fn().mockResolvedValue([{ id: "card-a", observedAt: "2026-08-22", text: "叶子变黄了", photos: [{ id: "media-a", thumbnailUrl: "/api/media/media-a/thumbnail" }], tags: [{ id: "tag-a", name: "银杏", color: "ochre" }] }]);

    render(<ChildContentLoader childId="child-a" loadCards={loadCards} />);

    expect(await screen.findByRole("img", { name: "叶子变黄了" })).toHaveAttribute("src", "/api/media/media-a/thumbnail");
    expect(loadCards).toHaveBeenCalledWith("child-a");
  });

  it("allows an administrator to edit a card and explains why a referenced card cannot be archived", async () => {
    const card = { id: "card-a", observedAt: "2026-08-22", text: "叶子变黄了", photos: [], tags: [] };
    const updateCard = vi.fn().mockResolvedValue(card);
    const archiveCard = vi.fn().mockRejectedValue(new ApiError(409, "CARD_REFERENCED", { affectedHandbookIds: ["handbook-a"] }));

    render(<ChildContentLoader childId="child-a" canEdit loadCards={vi.fn().mockResolvedValue([card])} updateCard={updateCard} archiveCard={archiveCard} />);

    fireEvent.click(await screen.findByRole("button", { name: "编辑" }));
    fireEvent.change(screen.getByRole("textbox", { name: "编辑观察文字" }), { target: { value: "叶子完全变黄了" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(updateCard).toHaveBeenCalledWith("card-a", { text: "叶子完全变黄了" });

    fireEvent.click(screen.getByRole("button", { name: "归档" }));
    expect(await screen.findByRole("status")).toHaveTextContent("已被 1 本手册收录（handbook-a），不能归档");
  });

  it("does not render mutation controls for a reader", async () => {
    render(<ChildContentLoader childId="child-a" loadCards={vi.fn().mockResolvedValue([{ id: "card-a", observedAt: "2026-08-22", text: "叶子变黄了", photos: [], tags: [] }])} />);
    await screen.findByText("叶子变黄了");
    expect(screen.queryByRole("button", { name: "编辑" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "归档" })).not.toBeInTheDocument();
  });
});
