// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { PublicHandbookReader } from "./PublicHandbookReader.js";

it("uses the same fixed reading frame as a family handbook", async () => {
  render(<PublicHandbookReader id="publication-a" onClose={vi.fn()} loadPublication={vi.fn().mockResolvedValue({ id: "publication-a", title: "公园的一年", introduction: "四季观察", childName: "乐乐", cardCount: 1, publishedAt: "2026-08-30", cards: [{ observedAt: "2026-08-01", text: "第一片叶子", photos: [] }] })} />);
  const dialog = await screen.findByRole("dialog", { name: "公园的一年阅读" });
  expect(dialog).toHaveClass("handbook-reader-modal");
  expect(screen.getByLabelText("手册页面缩略图")).toHaveClass("handbook-page-rail");
  expect(screen.getByRole("button", { name: "封面" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "举报此作品" })).not.toBeInTheDocument();
});
