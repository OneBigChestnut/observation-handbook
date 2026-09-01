// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { PublicHandbookList } from "./PublicHandbookList.js";

it("renders published handbooks as cover thumbnails with their basic information", async () => {
  const onOpen = vi.fn();
  render(<PublicHandbookList onOpen={onOpen} loadPublications={vi.fn().mockResolvedValue([{
    id: "publication-a", title: "公园的一年", introduction: "从一棵树的春夏秋冬开始。", childName: "乐乐", cardCount: 12, publishedAt: "2026-08-30T00:00:00.000Z", coverThumbnailUrl: "/cover.jpg"
  }])} />);

  expect(await screen.findByRole("img", { name: "公园的一年封面" })).toHaveAttribute("src", "/cover.jpg");
  expect(screen.getByText("从一棵树的春夏秋冬开始。")).toBeInTheDocument();
  expect(screen.getByText("乐乐 · 12 张卡片")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "阅读整本手册 公园的一年" }));
  expect(onOpen).toHaveBeenCalledWith("publication-a");
});
