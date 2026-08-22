// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChildContentLoader } from "./ChildContentLoader.js";

describe("ChildContentLoader", () => {
  it("loads only the selected child's cards and renders thumbnail URLs", async () => {
    const loadCards = vi.fn().mockResolvedValue([{ id: "card-a", observedAt: "2026-08-22", text: "叶子变黄了", photos: [{ id: "media-a", thumbnailUrl: "/api/media/media-a/thumbnail" }], tags: [{ id: "tag-a", name: "银杏", color: "ochre" }] }]);

    render(<ChildContentLoader childId="child-a" loadCards={loadCards} />);

    expect(await screen.findByRole("img", { name: "叶子变黄了" })).toHaveAttribute("src", "/api/media/media-a/thumbnail");
    expect(loadCards).toHaveBeenCalledWith("child-a");
  });
});
