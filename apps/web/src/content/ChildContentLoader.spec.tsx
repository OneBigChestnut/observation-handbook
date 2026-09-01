// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChildContentLoader } from "./ChildContentLoader.js";

afterEach(cleanup);

describe("ChildContentLoader", () => {
  it("loads only the selected child's cards and renders thumbnail URLs", async () => {
    const loadCards = vi.fn().mockResolvedValue([{ id: "card-a", observedAt: "2026-08-22", text: "叶子变黄了", photos: [{ id: "media-a", thumbnailUrl: "/api/media/media-a/thumbnail" }], tags: [{ id: "tag-a", name: "银杏", color: "ochre" }] }]);

    render(<ChildContentLoader childId="child-a" loadCards={loadCards} />);

    expect(await screen.findByRole("img", { name: "叶子变黄了" })).toHaveAttribute("src", "/api/media/media-a/thumbnail");
    expect(loadCards).toHaveBeenCalledWith("child-a");
  });

  it("passes the complete card to the edit workbench and shows card metadata", async () => {
    const card = { id: "card-a", observedAt: "2026-08-22", createdAt: "2026-08-22T09:30:00.000Z", text: "叶子变黄了", photos: [], tags: [{ id: "tag-a", name: "银杏", color: "ochre" }], handbooks: [{ id: "handbook-a", title: "公园的一年" }] };
    const onEdit = vi.fn();

    render(<ChildContentLoader childId="child-a" canEdit onEdit={onEdit} loadCards={vi.fn().mockResolvedValue([card])} />);

    expect(await screen.findByText("#银杏")).toBeInTheDocument();
    expect(screen.getByText("公园的一年")).toBeInTheDocument();
    expect(screen.getByText("制作于 2026-08-22")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "打开卡片编辑" }));
    expect(onEdit).toHaveBeenCalledWith(card);

    expect(screen.queryByRole("button", { name: "删除卡片" })).not.toBeInTheDocument();
  });

  it("does not render mutation controls for a reader", async () => {
    render(<ChildContentLoader childId="child-a" loadCards={vi.fn().mockResolvedValue([{ id: "card-a", observedAt: "2026-08-22", text: "叶子变黄了", photos: [], tags: [] }])} />);
    await screen.findByText("叶子变黄了");
    expect(screen.queryByRole("button", { name: "编辑" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "归档" })).not.toBeInTheDocument();
  });

  it("shows a load error instead of pretending there are no records, then retries", async () => {
    const loadCards = vi.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce([]);
    render(<ChildContentLoader childId="child-a" loadCards={loadCards} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("观察记录加载失败");
    fireEvent.click(screen.getByRole("button", { name: "重试加载观察记录" }));
    expect(loadCards).toHaveBeenCalledTimes(2);
  });
});
